"""Compositeur musical de GabberKey : écrit une piste (lead, basse, contre-chant) sur les accords d'un passage.

Modèle : Anticipatory Music Transformer (stanford-crfm/music-medium-800k, Apache 2.0), entraîné sur des fichiers
MIDI. Les accords et le kick du passage lui sont donnés comme événements à venir (contrôles) ; il écrit la piste
demandée, limitée à un instrument et à une tessiture. Rien ne sort de la machine.

  GET  /health    -> { ok, model, device }
  POST /generate  { bpm, beats, chords: [{ t, len, notes: [midi] }], kick: [t], part: lead | bass | counter,
                    density: low | mid | high, program (instrument de référence, 0-127), candidates, seed, temperature }
                  -> { notes: [{ t, len, note, vel }], seed, score }   (en temps musicaux, depuis le début du passage)

Le passage est joué deux fois (la première sert d'élan, on garde la seconde), au demi-tempo au-dessus de 130 BPM ;
plusieurs propositions, la meilleure gardée (notes des accords sur les temps forts, densité, variété, pas de trou).
"""
import json
import math
import os
import random
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from transformers import AutoModelForCausalLM

import anticipation.sample as sample
from anticipation.config import TIME_RESOLUTION, MAX_DUR, MAX_TIME
from anticipation.vocab import CONTROL_OFFSET, DUR_OFFSET, NOTE_OFFSET, TIME_OFFSET

MODEL = os.environ.get('GABBERKEY_MUSIC_MODEL', 'stanford-crfm/music-medium-800k')
PORT = int(os.environ.get('PORT', '8090'))
ORIGINS = ('http://localhost', 'http://127.0.0.1')
MAX_BEATS = 64
MAX_SECONDS = 95    # le modèle lit au plus 100 s
HALF_TIME_ABOVE = 130   # au-dessus, le modèle écrit au demi-tempo (il a appris sur des morceaux autour de 120 BPM)

# Parties : instrument General MIDI (0-127), tessiture, une note à la fois.
PARTS = {
    'lead': {'program': 81, 'lo': 60, 'hi': 88, 'mono': True},      # Lead 2 (dent de scie)
    'counter': {'program': 48, 'lo': 55, 'hi': 79, 'mono': False},  # ensemble de cordes
    'bass': {'program': 38, 'lo': 28, 'hi': 52, 'mono': True},      # Synth bass 1
}
CHORD_PROGRAM = 89   # Pad 2 (warm) : les accords donnés au modèle
KICK = (128, 36)     # batterie, grosse caisse

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f'Chargement de {MODEL} sur {device}…', flush=True)
model = AutoModelForCausalLM.from_pretrained(MODEL).to(device).eval()
if device == 'cuda':
    model = model.half()
print('Prêt.', flush=True)

_allowed = None   # notes autorisées pendant une génération : (instrument, plus basse, plus haute)
_lock = threading.Lock()   # une génération à la fois (le filtre est global)


def instr_logits(logits, full_history):
    """Remplace le filtre du modèle : seules les notes de l'instrument et de la tessiture demandés."""
    if _allowed is None:
        return logits
    instr, lo, hi = _allowed
    keep = logits.new_full(logits.shape, -float('inf'))
    a = NOTE_OFFSET + instr * 128
    keep[a + lo:a + hi + 1] = logits[a + lo:a + hi + 1]
    return keep


sample.instr_logits = instr_logits

_budget = [0]   # notes que la génération en cours peut encore écrire
_add_token = sample.add_token


def add_token(model, z, tokens, top_p, current_time, debug=False):
    """Comme celui du modèle, avec un plafond : au-delà, un événement après la fin arrête la génération."""
    if _budget[0] <= 0:
        return [TIME_OFFSET + MAX_TIME - 1, DUR_OFFSET, NOTE_OFFSET]
    _budget[0] -= 1
    return _add_token(model, z, tokens, top_p, current_time, debug)


sample.add_token = add_token
MAX_NOTES_PER_BEAT = 4


def event(t_sec, dur_sec, instr, pitch):
    t = max(0, int(round(t_sec * TIME_RESOLUTION)))
    d = max(1, min(MAX_DUR - 1, int(round(dur_sec * TIME_RESOLUTION))))
    return [TIME_OFFSET + t, DUR_OFFSET + d, NOTE_OFFSET + instr * 128 + pitch]


DENSITY = {'low': 0.6, 'mid': 1.2, 'high': 2.2}   # notes par temps visées


def generate(req):
    """Une piste sur le passage : le modèle joue le passage deux fois (la première sert d'élan), plusieurs
    propositions, la meilleure gardée (notes des accords sur les temps forts, densité, variété, pas de trou)."""
    bpm = float(req.get('bpm', 170))
    if not 40 <= bpm <= 260:
        raise ValueError('bpm')
    beats = float(req.get('beats', 16))
    spb = 60 / (bpm / 2 if bpm > HALF_TIME_ABOVE else bpm)   # secondes par temps vues par le modèle
    if not 1 <= beats <= MAX_BEATS or 2 * beats * spb > MAX_SECONDS:
        raise ValueError('beats')
    name = req.get('part', 'lead')
    part = PARTS.get(name)
    if part is None:
        raise ValueError('part')
    if 'program' in req:   # autre instrument de référence pour la partie (0-127)
        prog = int(req['program'])
        if not 0 <= prog < 128:
            raise ValueError('program')
        part = {**part, 'program': prog}
    seed = int(req.get('seed', random.randrange(1 << 30)))
    top_p = min(1.0, max(0.5, float(req.get('temperature', 0.95))))
    count = min(8, max(1, int(req.get('candidates', 4))))
    density = DENSITY.get(req.get('density', 'mid'), DENSITY['mid']) * (0.7 if name == 'counter' else 1)

    # Contexte : accords (pad) et kick sur deux passages, comme événements à venir.
    chords = [c for c in req.get('chords', [])[:256] if 0 <= float(c['t']) < beats]
    ctx = []
    for rep in (0, beats):
        for c in chords:
            for p in c.get('notes', [])[:8]:
                if 0 <= int(p) < 128:
                    ctx += event((rep + float(c['t'])) * spb, float(c['len']) * spb * 0.95, CHORD_PROGRAM, int(p))
        for b in req.get('kick', [])[:512]:
            if 0 <= float(b) < beats:
                ctx += event((rep + float(b)) * spb, 0.1, *KICK)
    ctx = sorted_events(ctx)

    t0 = time.time()
    best = None
    for k in range(count):
        out = run(ctx, 2 * beats * spb, part, top_p, seed + k, int(MAX_NOTES_PER_BEAT * 2 * beats))
        notes = []
        for tm, du, nt in zip(out[0::3], out[1::3], out[2::3]):
            if nt >= CONTROL_OFFSET or (nt - NOTE_OFFSET) // 128 != part['program']:
                continue
            t = (tm - TIME_OFFSET) / TIME_RESOLUTION / spb - beats   # le second passage
            if t < -0.125:
                continue
            notes.append({'t': max(0, t), 'len': (du - DUR_OFFSET) / TIME_RESOLUTION / spb, 'note': (nt - NOTE_OFFSET) % 128})
        notes = tidy(notes, beats, part['mono'])
        sc = score(notes, chords, beats, density)
        if best is None or sc > best[0]:
            best = (sc, notes, seed + k)
    sc, notes, used = best
    print(f"{name}: {len(notes)} notes, score {sc:.2f}, {count} propositions en {time.time() - t0:.1f} s (graine {used})", flush=True)
    return {'notes': notes, 'seed': used, 'score': round(sc, 3)}


def run(ctx, seconds, part, top_p, seed, max_notes):
    global _allowed
    with _lock:
        _budget[0] = max_notes
        torch.manual_seed(seed)
        _allowed = (part['program'], part['lo'], part['hi'])
        try:
            return sample.generate(model, 0, seconds, inputs=ctx, top_p=top_p)
        finally:
            _allowed = None


def score(notes, chords, beats, density):
    """Note d'une proposition (plus haut = mieux)."""
    if not notes:
        return -9.0
    def chord_at(t):
        for c in chords:
            if float(c['t']) <= t < float(c['t']) + float(c['len']):
                return {int(p) % 12 for p in c['notes']}
        return set()
    scale = {int(p) % 12 for c in chords for p in c['notes']}
    strong = [n for n in notes if n['t'] % 1 == 0]
    fit = sum(n['note'] % 12 in chord_at(n['t']) for n in strong) / max(1, len(strong))
    inkey = sum(n['note'] % 12 in scale for n in notes) / len(notes)
    dens = len(notes) / beats
    dens_sc = -abs(math.log(max(1e-3, dens / density)))
    variety = min(1.0, len({n['note'] for n in notes}) / 5)
    starts = [0] + [n['t'] for n in notes] + [beats]
    gap = max(b - a for a, b in zip(starts, starts[1:]))
    gap_sc = -max(0.0, gap - 4) / 4
    # répétitions : la même note plus de 4 fois de suite
    run_len, worst = 1, 1
    for a, b in zip(notes, notes[1:]):
        run_len = run_len + 1 if a['note'] == b['note'] else 1
        worst = max(worst, run_len)
    rep_sc = -max(0, worst - 4) / 4
    return 1.2 * fit + 0.8 * inkey + dens_sc + 0.6 * variety + gap_sc + rep_sc


def sorted_events(tokens):
    ev = [tokens[i:i + 3] for i in range(0, len(tokens), 3)]
    ev.sort(key=lambda e: (e[0], e[2]))
    return [x for e in ev for x in e]


def tidy(notes, beats, mono):
    """Sur la grille des doubles croches, dans le passage ; une note à la fois pour une ligne (la plus aiguë)."""
    q = 0.25
    out = []
    for n in notes:
        t = round(n['t'] / q) * q
        if t >= beats:
            continue
        ln = max(q, round(n['len'] / q) * q)
        out.append({'t': t, 'len': min(ln, beats - t), 'note': n['note'], 'vel': 0.85})
    out.sort(key=lambda n: (n['t'], -n['note']))
    if mono:
        line = []
        for n in out:
            if line and line[-1]['t'] == n['t']:
                continue   # même départ : on garde la plus aiguë
            if line and line[-1]['t'] + line[-1]['len'] > n['t']:
                line[-1]['len'] = n['t'] - line[-1]['t']
            line.append(n)
        # jeu lié : chaque note tient jusqu'à la suivante (au plus 2 temps), comme un lead joué legato
        for a, b in zip(line, line[1:] + [None]):
            gap = (b['t'] if b else beats) - a['t']
            if gap <= 2:
                a['len'] = max(a['len'], gap)
        out = line
    # accent sur les temps
    for n in out:
        n['vel'] = 0.95 if n['t'] % 1 == 0 else 0.8
    return out


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        origin = self.headers.get('Origin', '')
        if origin.startswith(ORIGINS):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, {'ok': True, 'model': MODEL, 'device': device})
        self.reply(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/generate':
            return self.reply(404, {'error': 'not found'})
        try:
            n = min(int(self.headers.get('Content-Length', 0)), 1 << 20)
            self.reply(200, generate(json.loads(self.rfile.read(n))))
        except (ValueError, KeyError, TypeError) as e:
            self.reply(400, {'error': f'bad request: {e}'})

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
