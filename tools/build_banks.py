"""Construit les banques de sons de GabberKey à partir d'échantillons libres (CC0).

Source : les échantillons de Sonic Pi (https://github.com/sonic-pi-net/sonic-pi,
dossier etc/samples), tous placés dans le domaine public (CC0).

Traitement :
  - one-shots : suppression du silence initial, normalisation de crête à -1 dBFS ;
  - boucles   : détection du tempo, étirement temporel (WSOLA, sans changer la hauteur)
                vers le tempo cible, découpe à un nombre exact de mesures,
                normalisation en niveau RMS.

Usage :  tools\\.venv\\Scripts\\python tools\\build_banks.py [--bpm 120] [--force]
Sortie : sounds/<banque>/*.flac + sounds/banks.json (lu par l'application).
"""
import argparse
import json
import shutil
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

import gabber

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / 'cache' / 'sonic-pi'
OUT = ROOT / 'sounds'
BASE_URL = 'https://raw.githubusercontent.com/sonic-pi-net/sonic-pi/dev/etc/samples/'

# Couleurs = indices de la palette LED de l'APC Key 25 mk2.
RED, ORANGE, YELLOW, LIME, GREEN, TEAL, CYAN, BLUE, VIOLET, MAGENTA, PINK, WHITE = 5, 9, 13, 17, 21, 33, 37, 41, 49, 53, 57, 3
ONESHOT, HOLD, LOOP = 0, 1, 2

# Chaque banque : 5 rangées de 8 pads, de la rangée du BAS (pads 1-8) vers le haut.
# Une entrée : nom de fichier sans extension, ou None pour un pad vide.
BANKS = [
    ('Batterie', [
        (RED, ONESHOT, ['bd_808', 'bd_boom', 'bd_fat', 'bd_haus', 'bd_klub', 'bd_tek', 'drum_heavy_kick', 'bd_zum']),
        (ORANGE, ONESHOT, ['sn_dolf', 'sn_dub', 'sn_generic', 'sn_zome', 'drum_snare_hard', 'drum_snare_soft', 'elec_hi_snare', 'perc_snap']),
        (YELLOW, ONESHOT, ['drum_cymbal_closed', 'drum_cymbal_pedal', 'drum_cymbal_open', 'hat_cab', 'hat_gnu', 'hat_psych', 'hat_raw', 'hat_snap']),
        (PINK, ONESHOT, ['drum_tom_lo_hard', 'drum_tom_mid_hard', 'drum_tom_hi_hard', 'drum_tom_lo_soft', 'drum_tom_mid_soft', 'drum_tom_hi_soft', 'drum_roll', 'drum_cowbell']),
        (LIME, ONESHOT, ['drum_cymbal_hard', 'drum_cymbal_soft', 'drum_splash_hard', 'drum_splash_soft', 'ride_tri', 'ride_via', 'hat_zild', 'hat_metal']),
    ]),
    ('Électro', [
        (RED, ONESHOT, ['bd_ada', 'bd_chip', 'bd_gas', 'bd_jazz', 'bd_mehackit', 'bd_pure', 'bd_sone', 'bd_zome']),
        (ORANGE, ONESHOT, ['elec_snare', 'elec_lo_snare', 'elec_mid_snare', 'elec_filt_snare', 'elec_hollow_kick', 'elec_soft_kick', 'elec_fuzz_tom', 'elec_cymbal']),
        (YELLOW, ONESHOT, ['hat_bdu', 'hat_cats', 'hat_gem', 'hat_gump', 'hat_hier', 'hat_len', 'hat_mess', 'hat_noiz']),
        (CYAN, ONESHOT, ['elec_beep', 'elec_bell', 'elec_blip', 'elec_blip2', 'elec_blup', 'elec_bong', 'elec_chime', 'elec_ping']),
        (TEAL, ONESHOT, ['elec_plip', 'elec_pop', 'elec_tick', 'elec_triangle', 'elec_twang', 'elec_twip', 'elec_wood', 'elec_flip']),
    ]),
    ('Boucles', [
        (MAGENTA, ONESHOT, ['glitch_perc1', 'glitch_perc2', 'glitch_perc3', 'glitch_perc4', 'glitch_perc5', 'glitch_robot1', 'glitch_robot2', 'glitch_bass_g']),
        (YELLOW, ONESHOT, ['hat_sci', 'hat_star', 'hat_tap', 'hat_yosh', 'hat_zan', 'hat_zap', 'tbd_perc_blip', 'tbd_perc_tap_1']),
        (GREEN, LOOP, ['loop_amen', 'loop_amen_full', 'loop_breakbeat', 'loop_compus', 'loop_garzul', 'loop_industrial', 'loop_mika', 'loop_safari']),
        (BLUE, LOOP, ['loop_mehackit1', 'loop_mehackit2', 'loop_perc1', 'loop_perc2', 'loop_tabla', 'loop_electric', 'loop_3d_printer', 'loop_weirdo']),
        (VIOLET, LOOP, ['arovane_beat_a', 'arovane_beat_b', 'arovane_beat_c', 'arovane_beat_d', 'arovane_beat_e', 'tbd_fxbed_loop', None, None]),
    ]),
    ('Textures', [
        (BLUE, ONESHOT, ['bass_dnb_f', 'bass_drop_c', 'bass_hard_c', 'bass_hit_c', 'bass_thick_c', 'bass_trance_c', 'bass_voxy_c', 'bass_woodsy_c']),
        (ORANGE, ONESHOT, ['bass_voxy_hit_c', 'guit_e_fifths', 'guit_e_slide', 'guit_em9', 'guit_harmonics', 'tbd_highkey_c4', 'tbd_voctone', 'ambi_piano']),
        (VIOLET, HOLD, ['tbd_pad_1', 'tbd_pad_2', 'tbd_pad_3', 'tbd_pad_4', 'ambi_choir', 'ambi_drone', 'ambi_glass_hum', 'ambi_haunted_hum']),
        (CYAN, ONESHOT, ['ambi_glass_rub', 'ambi_lunar_land', 'ambi_sauna', 'ambi_soft_buzz', 'ambi_dark_woosh', 'ambi_swoosh', 'loop_drone_g_97', 'misc_cineboom']),
        (WHITE, ONESHOT, ['vinyl_backspin', 'vinyl_hiss', 'vinyl_rewind', 'vinyl_scratch', 'perc_swoosh', 'perc_swash', 'perc_impact1', 'perc_impact2']),
    ]),
    ('Tabla & divers', [
        (ORANGE, ONESHOT, ['tabla_dhec', 'tabla_ghe1', 'tabla_ghe2', 'tabla_ghe3', 'tabla_ghe4', 'tabla_ghe5', 'tabla_ghe6', 'tabla_ghe7']),
        (YELLOW, ONESHOT, ['tabla_ghe8', 'tabla_ke1', 'tabla_ke2', 'tabla_ke3', 'tabla_na', 'tabla_na_o', 'tabla_na_s', 'tabla_re']),
        (LIME, ONESHOT, ['tabla_tas1', 'tabla_tas2', 'tabla_tas3', 'tabla_te1', 'tabla_te2', 'tabla_te_m', 'tabla_te_ne', 'tabla_tun1']),
        (PINK, ONESHOT, ['tabla_tun2', 'tabla_tun3', 'perc_bell', 'perc_bell2', 'perc_door', 'perc_snap2', 'perc_till', 'misc_crow']),
        (GREEN, ONESHOT, ['mehackit_phone1', 'mehackit_phone2', 'mehackit_phone3', 'mehackit_phone4', 'mehackit_robot1', 'mehackit_robot2', 'mehackit_robot3', 'misc_burp']),
    ]),
]

# Nombre de mesures (4/4) imposé quand la détection automatique se trompe.
BARS_OVERRIDE = {
    # 'loop_amen': 1,
}


def fetch(name):
    path = CACHE / f'{name}.flac'
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE_URL + path.name, timeout=60) as r:
            path.write_bytes(r.read())
    return path


def db(x):
    return 10 ** (x / 20)


def normalize_peak(x, target_db=-1.0):
    peak = np.max(np.abs(x))
    return x * (db(target_db) / peak) if peak > 0 else x


def normalize_rms(x, target_db=-16.0, ceiling_db=-1.0):
    rms = np.sqrt(np.mean(x ** 2))
    if rms == 0:
        return x
    y = x * (db(target_db) / rms)
    peak = np.max(np.abs(y))
    return y * (db(ceiling_db) / peak) if peak > db(ceiling_db) else y


def trim_start(x, sr, threshold_db=-50.0):
    mono = np.max(np.abs(x), axis=1)
    idx = np.argmax(mono > db(threshold_db) * np.max(mono))
    idx = max(0, idx - int(0.002 * sr))   # garder 2 ms avant l'attaque
    return x[idx:]


def fade_edges(x, sr, fade_in=0.002, fade_out=0.004):
    n_in, n_out = min(len(x), int(fade_in * sr)), min(len(x), int(fade_out * sr))
    x = x.copy()
    x[:n_in] *= np.linspace(0, 1, n_in)[:, None]
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out)[:, None]
    return x


def onset_envelope(x, sr, hop=512, n_fft=2048):
    mono = x.mean(axis=1)
    if len(mono) < n_fft:
        return np.zeros(1), hop
    frames = np.lib.stride_tricks.sliding_window_view(mono, n_fft)[::hop] * np.hanning(n_fft)
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 10)
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    return flux - flux.mean(), hop


def estimate_tempo(x, sr):
    """Tempo par autocorrélation du flux spectral, pondérée autour de 120 BPM."""
    env, hop = onset_envelope(x, sr)
    if len(env) < 16:
        return None
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    fps = sr / hop
    lags = np.arange(len(ac))
    valid = (lags >= fps * 60 / 200) & (lags <= fps * 60 / 60)
    if not valid.any():
        return None
    bpm = 60 * fps / np.maximum(lags, 1)
    weight = np.exp(-0.5 * (np.log2(bpm / 120) / 0.9) ** 2)
    score = np.where(valid, ac * weight, -np.inf)
    return float(bpm[np.argmax(score)])


def detect_bars(name, x, sr):
    """Une boucle bien découpée dure un nombre entier de mesures : on choisit la
    longueur qui donne un tempo plausible, départagée par l'estimation du rythme."""
    dur = len(x) / sr
    if name in BARS_OVERRIDE:
        bars = BARS_OVERRIDE[name]
        return bars, 240 * bars / dur
    est = estimate_tempo(x, sr)
    candidates = [(b, 240 * b / dur) for b in (0.5, 1, 2, 4, 8, 16) if 70 <= 240 * b / dur <= 185]
    if not candidates:
        candidates = [min(((b, 240 * b / dur) for b in (0.25, 0.5, 1, 2, 4, 8, 16)),
                          key=lambda c: abs(np.log2(c[1] / 120)))]
    ref = est or 120
    bars, bpm = min(candidates, key=lambda c: abs(np.log2(c[1] / ref)))
    return bars, bpm


def wsola(x, speed, frame=1024, tolerance=256):
    """Étirement temporel WSOLA (conserve la hauteur). speed > 1 = plus rapide."""
    if abs(speed - 1) < 1e-3:
        return x
    hs = frame // 2
    ha = hs * speed
    win = np.hanning(frame)[:, None]
    out_len = int(len(x) / speed)
    n_frames = out_len // hs + 1
    pad = np.zeros((frame + tolerance * 2 + int(ha) + hs, x.shape[1]))
    src = np.concatenate([pad[:tolerance], x, pad])
    mono = src.mean(axis=1)
    out = np.zeros((n_frames * hs + frame, x.shape[1]))
    norm = np.zeros((n_frames * hs + frame, 1))
    prev = tolerance   # position (dans src) de la trame précédente
    for m in range(n_frames):
        nominal = int(round(m * ha)) + tolerance
        if nominal + frame + tolerance >= len(src):
            break
        if m == 0:
            best = nominal
        else:
            # Chercher la trame qui prolonge le mieux la précédente.
            template = mono[prev + hs: prev + hs + frame]
            region = mono[nominal - tolerance: nominal + tolerance + frame]
            corr = np.correlate(region, template, mode='valid')
            best = nominal - tolerance + int(np.argmax(corr))
        out[m * hs: m * hs + frame] += src[best: best + frame] * win
        norm[m * hs: m * hs + frame] += win
        prev = best
    out = out / np.maximum(norm, 1e-3)
    return out[:out_len]


def fit_length(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros((n - len(x), x.shape[1]))])


def process(name, mode, target_bpm):
    x, sr = sf.read(fetch(name), always_2d=True, dtype='float64')
    info = {}
    if mode == LOOP:
        bars, src_bpm = detect_bars(name, x, sr)
        y = wsola(x, target_bpm / src_bpm)
        # Longueur exacte en mesures pour que la boucle tourne sans décalage.
        y = fit_length(y, int(round(bars * 240 / target_bpm * sr)))
        y = normalize_rms(y)
        y = fade_edges(y, sr, fade_in=0.001, fade_out=0.003)
        info = {'bpm': target_bpm, 'bars': bars, 'sourceBpm': round(src_bpm, 2)}
    else:
        y = trim_start(x, sr)
        y = normalize_peak(y)
        y = fade_edges(y, sr, fade_in=0.0005, fade_out=0.01)
    return y, sr, info


def pretty(name):
    for prefix in ('drum_', 'elec_', 'ambi_', 'loop_', 'glitch_', 'mehackit_', 'tbd_', 'misc_', 'perc_', 'guit_', 'vinyl_'):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name.replace('_', ' ')[:24]



# Catégories de la bibliothèque (façon eJay) : défaut par rangée de chaque banque, affiné par le nom.
CATEGORIES = ['kick', 'drums', 'bass', 'lead', 'keys', 'pad', 'voice', 'fx']
ROW_CATS = {
    'Batterie': ['kick', 'drums', 'drums', 'drums', 'drums'],
    'Électro': ['kick', 'drums', 'drums', 'fx', 'fx'],
    'Boucles': ['fx', 'drums', 'drums', 'drums', 'drums'],
    'Textures': ['bass', 'keys', 'pad', 'pad', 'fx'],
    'Tabla & divers': ['drums', 'drums', 'drums', 'drums', 'fx'],
    'Gabber': ['kick', 'drums', 'lead', 'keys', 'drums'],
    'Gabber 2': ['kick', 'fx', 'drums', 'drums', 'keys'],
    'Hardcore': ['kick', 'bass', 'pad', 'drums', 'drums'],
    'Oldschool': ['kick', 'drums', 'keys', 'fx', 'drums'],
    'Mainstream': ['kick', 'drums', 'lead', 'voice', 'drums'],
    'New wave': ['kick', 'kick', 'lead', 'fx', 'drums'],
}


def categorize(bank, row, name, mode):
    n = name.lower()
    has = lambda *words: any(w in n for w in words)
    if mode != 2 and has('kick') and not has('bass'):   # « Screech kick » reste un kick
        return 'kick'
    if has('choir', 'chœur', 'vox', 'voctone', 'shout'):
        return 'voice'
    if has('hoover', 'screech', 'acid', 'arp', 'horn', 'lead', 'highkey', 'supersaw', 'pluck'):
        return 'lead'
    if has('stab', 'piano', 'mentasm', 'belgian', 'rave ', 'guit', 'horror bell', 'bell chord', 'bell melody'):
        return 'keys'
    if has('string', 'pad', 'drone', 'staccato', 'orchestra'):
        return 'pad'
    if has('bass', 'reese'):
        return 'bass'
    if has('siren', 'riser', 'downlifter', 'laser', 'impact', 'noise', 'zap', 'scratch', 'whistle', 'air raid', 'crash inv', 'reverse crash', 'breakdown'):
        return 'fx'
    return ROW_CATS.get(bank, ['drums'] * 5)[min(row, 4)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--bpm', type=float, default=120, help='target tempo for loops (default 120)')
    ap.add_argument('--gabber-bpm', type=float, default=190, help='tempo of the gabber loops (default 190)')
    ap.add_argument('--force', action='store_true', help='download the source files again')
    args = ap.parse_args()

    if args.force and CACHE.exists():
        shutil.rmtree(CACHE)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    manifest = {'bpm': args.bpm, 'source': 'Sonic Pi samples (CC0)', 'banks': []}
    for b, (bank_name, rows) in enumerate(BANKS):
        folder = OUT / f'bank{b + 1}'
        folder.mkdir()
        pads = []
        for row, (color, mode, names) in enumerate(rows):
            for name in names:
                if name is None:
                    pads.append(None)
                    continue
                print(f'[{bank_name}] {name}', end='', flush=True)
                try:
                    y, sr, info = process(name, mode, args.bpm)
                except Exception as err:   # un fichier manquant ne bloque pas le reste
                    print(f'  FAILED: {err}')
                    pads.append(None)
                    continue
                sf.write(folder / f'{name}.flac', y.astype(np.float32), sr, subtype='PCM_16')
                if info:
                    print(f"  {info['sourceBpm']} BPM, {info['bars']} bar(s) -> {args.bpm:g} BPM", end='')
                print()
                pads.append({'file': f'bank{b + 1}/{name}.flac', 'name': pretty(name), 'color': color, 'mode': mode,
                             'cat': categorize(bank_name, row, pretty(name), mode), **info})
        manifest['banks'].append({'name': bank_name, 'pads': pads})

    # Banques hardcore / gabber générées par synthèse (tools/gabber.py).
    for bank_name, sounds in gabber.build(args.gabber_bpm):
        b = len(manifest['banks'])
        folder = OUT / f'bank{b + 1}'
        folder.mkdir()
        pads = []
        for i, (name, color, mode, sig, bars) in enumerate(sounds):
            print(f'[{bank_name}] {name}', flush=True)
            fname = f'{i + 1:02d}.flac'
            sf.write(folder / fname, sig.astype(np.float32), gabber.SR, subtype='PCM_16')
            pad = {'file': f'bank{b + 1}/{fname}', 'name': name, 'color': color, 'mode': mode, 'cat': categorize(bank_name, i // 8, name, mode)}
            if bars:
                pad.update(bpm=args.gabber_bpm, bars=bars)
                kicks = gabber.kicks_of(bank_name, name)
                if kicks:
                    pad['kicks'] = kicks   # position des kicks (sidechain)
            pads.append(pad)
        manifest['banks'].append({'name': bank_name, 'pads': pads})

    (OUT / 'banks.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    (OUT / 'CREDITS.md').write_text(
        '# Credits\n\nBanks 2-6 use samples from Sonic Pi (https://github.com/sonic-pi-net/sonic-pi, etc/samples),\n'
        'dedicated to the public domain (CC0) by their authors on freesound.org, Arovane and The Black Dog.\n'
        'They were processed (normalisation, trimming, tempo matching) by tools/build_banks.py.\n\n'
        'The Gabber, Hardcore, Oldschool, Mainstream and New wave banks are fully synthesised by tools/gabber.py (no external samples).\n',
        encoding='utf-8')
    total = sum(p is not None for bank in manifest['banks'] for p in bank['pads'])
    print(f'\n{total} sounds written to {OUT}')


if __name__ == '__main__':
    sys.exit(main())
