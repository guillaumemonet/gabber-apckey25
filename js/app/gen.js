// Générateur de nappes : blocs d’accords posés sur la timeline.
import { PROGRESSIONS, bassNote, parseProgression, voiceChords } from '../chords.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { PAGES } from '../params.js';
import { PRESETS, presetById } from '../presets.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, engine, state, timeline } from './core.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { armedTrack, renderTl } from './tl.js';

// ---------- Générateur de nappes ----------

// Pose sur la timeline des blocs d'accords (cordes, nappes…) à partir d'une suite d'accords, chacun joué avec son preset.
export const GEN_SOUNDS = ['strings', 'pads', 'choirs', 'supersaw', 'stabs', 'keys'];
export const GEN_REGISTERS = { low: 55, mid: 62, high: 69 };
export const GEN_RHYTHMS = ['hold', 'beats', 'offbeat', 'eighths'];
export const GEN_BASS = { none: null, sub: { preset: 'sub_bass', rhythm: 'hold' }, offbeat: { preset: 'bass', rhythm: 'offbeat' }, reese: { preset: 'reese', rhythm: 'hold' } };
export const defaultGen = () => ({ prog: PROGRESSIONS[0], preset: 'epic_strings', register: 'mid', bars: 2, repeat: 2, rhythm: 'hold', bass: 'none' });

export function mergeGen(saved) {
  const g = defaultGen();
  if (!saved || typeof saved !== 'object') return g;
  if (typeof saved.prog === 'string') g.prog = saved.prog;
  if (saved.preset === 'current' || PRESETS.some(p => p.id === saved.preset)) g.preset = saved.preset;
  if (saved.register in GEN_REGISTERS) g.register = saved.register;
  if ([1, 2, 4].includes(saved.bars)) g.bars = saved.bars;
  if ([1, 2, 4].includes(saved.repeat)) g.repeat = saved.repeat;
  if (GEN_RHYTHMS.includes(saved.rhythm)) g.rhythm = saved.rhythm;
  if (saved.bass in GEN_BASS) g.bass = saved.bass;
  return g;
}

// Réglages d'un preset pour un bloc de la timeline (indépendants du preset joué au clavier).
export const patchCache = new Map();
export function presetPatch(id) {
  if (!patchCache.has(id)) {
    const preset = presetById(id);
    const values = Object.fromEntries(PAGES.synth.params.map(d => [d.id, preset.values[d.id] ?? d.def]));
    patchCache.set(id, { cfg: preset.voice, values });
  }
  return patchCache.get(id);
}

// Coups d'un accord qui dure `beats` temps : [début, longueur] en temps.
export function genHits(rhythm, beats) {
  if (rhythm === 'hold') return [[0, beats]];
  const hits = [];
  for (let b = 0; b < beats; b++) {
    if (rhythm === 'beats') hits.push([b, 0.9]);
    else if (rhythm === 'offbeat') hits.push([b + 0.5, 0.4]);
    else hits.push([b, 0.4], [b + 0.5, 0.4]);
  }
  return hits;
}

// Son choisi, ou le preset joué au clavier.
export const genPreset = () => (state.gen.preset === 'current' ? state.preset : state.gen.preset);

export function generatePads() {
  const g = state.gen;
  const { chords, bad } = parseProgression(g.prog);
  if (!chords.length) { toast(t('gen.none'), 3000); return; }
  const voiced = voiceChords(chords, GEN_REGISTERS[g.register]);
  const chordBeats = g.bars * BEATS_PER_BAR;
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const total = chordBeats * chords.length * g.repeat;
  const blocks = (notesOf, rhythm, preset, cat) => {
    const out = [];
    for (let r = 0; r < g.repeat; r++) {
      chords.forEach((c, i) => {
        const at = start + (r * chords.length + i) * chordBeats;
        for (const [o, len] of genHits(rhythm, chordBeats)) {
          out.push({ id: crypto.randomUUID(), type: 'note', notes: notesOf(i), vel: 0.8, preset, name: c.name, cat, color: catColor(cat), start: at + o, len, loop: false });
        }
      });
    }
    return out;
  };
  // Une piste entièrement libre sur toute la durée, à partir de la piste armée.
  const used = [];
  const lane = () => {
    const tracks = state.tl.tracks;
    for (let k = 0; k < tracks.length; k++) {
      const i = (armedTrack() + k) % tracks.length;
      if (used.includes(i)) continue;
      if (!tracks[i].clips.some(c => c.start < start + total - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6)) return i;
    }
    return -1;
  };
  const bass = GEN_BASS[g.bass];
  const lanes = [lane()];
  if (lanes[0] >= 0) used.push(lanes[0]);
  if (bass) { lanes.push(lane()); }
  if (lanes.some(i => i < 0)) { toast(t('gen.full', { bars: total / BEATS_PER_BAR, bar: start / BEATS_PER_BAR + 1 }), 4000); return; }
  state.tl.tracks[lanes[0]].clips.push(...blocks(i => voiced[i], g.rhythm, genPreset(), 'pad'));
  if (bass) state.tl.tracks[lanes[1]].clips.push(...blocks(i => [bassNote(chords[i])], bass.rhythm, bass.preset, 'bass'));
  if (start + total > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil((start + total) / BEATS_PER_BAR));
  renderTl();
  save();
  const msg = t('gen.done', { n: chords.length * g.repeat, track: lanes.map(i => i + 1).join(' + ') });
  toast(bad.length ? `${msg} · ${t('gen.bad', { list: bad.join(' ') })}` : msg, 4000);
}

// Écoute du premier accord avec le son choisi.
export function previewGen() {
  const g = state.gen;
  const { chords } = parseProgression(g.prog);
  if (!chords.length) { toast(t('gen.none'), 3000); return; }
  const notes = voiceChords(chords, GEN_REGISTERS[g.register])[0];
  const patch = presetPatch(genPreset());
  const t0 = engine.ctx.currentTime + 0.02;
  notes.forEach((n, k) => {
    engine.noteOn(n, 0.8, t0, `gen:${k}`, patch);
    engine.noteOff(n, false, t0 + 1.2, `gen:${k}`);
  });
}

export function buildGen() {
  const box = $('#gen');
  const g = state.gen;
  const field = (label, el) => {
    const l = document.createElement('label');
    const s = document.createElement('span');
    s.textContent = label;
    l.append(s, el);
    return l;
  };
  const select = (key, options, cast = v => v) => {
    const el = document.createElement('select');
    for (const [v, text] of options) el.add(new Option(text, v));
    el.value = g[key];
    el.addEventListener('change', () => { g[key] = cast(el.value); save(); renderGenInfo(); });
    return el;
  };
  const prog = document.createElement('input');
  prog.type = 'text';
  prog.value = g.prog;
  prog.spellcheck = false;
  prog.title = t('gen.progHint');
  prog.addEventListener('input', () => { g.prog = prog.value; save(); renderGenInfo(); });
  const chips = document.createElement('div');
  chips.className = 'gen-chips';
  for (const p of PROGRESSIONS) {
    const b = document.createElement('button');
    b.textContent = p;
    b.addEventListener('click', () => { prog.value = g.prog = p; save(); renderGenInfo(); });
    chips.appendChild(b);
  }
  const sound = document.createElement('select');
  sound.add(new Option(t('gen.current'), 'current'));
  for (const f of GEN_SOUNDS) {
    const grp = document.createElement('optgroup');
    grp.label = t(`family.${f}`);
    for (const p of PRESETS.filter(p => p.family === f)) grp.appendChild(new Option(p.name, p.id));
    sound.appendChild(grp);
  }
  sound.value = g.preset;
  sound.addEventListener('change', () => { g.preset = sound.value; save(); });
  const go = document.createElement('button');
  go.className = 'primary';
  go.textContent = t('gen.go');
  go.addEventListener('click', generatePads);
  const listen = document.createElement('button');
  listen.textContent = t('gen.listen');
  listen.addEventListener('click', previewGen);
  const info = document.createElement('span');
  info.className = 'hint gen-info';
  const row1 = document.createElement('div');
  row1.className = 'gen-row';
  row1.append(field(t('gen.prog'), prog), chips);
  const row2 = document.createElement('div');
  row2.className = 'gen-row';
  row2.append(
    field(t('gen.sound'), sound),
    field(t('gen.register'), select('register', Object.keys(GEN_REGISTERS).map(k => [k, t(`gen.reg.${k}`)]))),
    field(t('gen.bars'), select('bars', [1, 2, 4].map(n => [n, n]), Number)),
    field(t('gen.repeat'), select('repeat', [1, 2, 4].map(n => [n, `×${n}`]), Number)),
    field(t('gen.rhythm'), select('rhythm', GEN_RHYTHMS.map(k => [k, t(`gen.rh.${k}`)]))),
    field(t('gen.bass'), select('bass', Object.keys(GEN_BASS).map(k => [k, t(`gen.bass.${k}`)]))),
    listen, go,
  );
  box.append(row1, row2, info);
  $('#gen-btn').addEventListener('click', () => {
    box.hidden = !box.hidden;
    $('#gen-btn').classList.toggle('active', !box.hidden);
    renderGenInfo();
  });
}

// Accords reconnus, durée et point de départ.
export function renderGenInfo() {
  const el = $('#gen .gen-info');
  if (!el) return;
  const g = state.gen;
  const { chords, bad } = parseProgression(g.prog);
  const bars = chords.length * g.bars * g.repeat;
  el.textContent = chords.length
    ? t('gen.where', { chords: chords.map(c => c.name).join(' – '), bars, bar: Math.floor(state.tl.playhead / BEATS_PER_BAR) + 1 }) + (bad.length ? ` · ${t('gen.bad', { list: bad.join(' ') })}` : '')
    : t('gen.none');
}
