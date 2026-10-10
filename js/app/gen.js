// Fenêtre Générateur : à partir d'une suite d'accords, pose sur la timeline des blocs d'accords (cordes, nappes,
// chœurs…, avec une basse) ou une mélodie (lead) qui suit les accords (js/melody.js).
import { PROGRESSIONS, bassNote, parseProgression, voiceChords } from '../chords.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { LEAD_DENSITIES, LEAD_REGISTERS, LEAD_STYLES, generateLead } from '../melody.js';
import { PAGES } from '../params.js';
import { PRESETS, presetById } from '../presets.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, engine, state, timeline } from './core.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { armedTrack, renderTl } from './tl.js';

// ---------- Générateur ----------

export const GEN_SOUNDS = ['strings', 'pads', 'choirs', 'supersaw', 'stabs', 'keys'];
export const LEAD_SOUNDS = ['supersaw', 'leads', 'hoovers', 'stabs'];
export const GEN_REGISTERS = { low: 55, mid: 62, high: 69 };
export const GEN_RHYTHMS = ['hold', 'beats', 'offbeat', 'eighths'];
export const GEN_BASS = { none: null, sub: { preset: 'sub_bass', rhythm: 'hold' }, offbeat: { preset: 'bass', rhythm: 'offbeat' }, reese: { preset: 'reese', rhythm: 'hold' } };
export const defaultLead = () => ({ preset: 'hardstyle_lead', register: 'high', style: 'anthem', density: 'mid', double: false, seed: 1 });
export const defaultGen = () => ({ tab: 'chords', prog: PROGRESSIONS[0], preset: 'epic_strings', register: 'mid', bars: 2, repeat: 2, rhythm: 'hold', bass: 'none', lead: defaultLead() });

export function mergeGen(saved) {
  const g = defaultGen();
  if (!saved || typeof saved !== 'object') return g;
  if (saved.tab === 'lead') g.tab = 'lead';
  if (typeof saved.prog === 'string') g.prog = saved.prog;
  if (saved.preset === 'current' || PRESETS.some(p => p.id === saved.preset)) g.preset = saved.preset;
  if (saved.register in GEN_REGISTERS) g.register = saved.register;
  if ([1, 2, 4].includes(saved.bars)) g.bars = saved.bars;
  if ([1, 2, 4].includes(saved.repeat)) g.repeat = saved.repeat;
  if (GEN_RHYTHMS.includes(saved.rhythm)) g.rhythm = saved.rhythm;
  if (saved.bass in GEN_BASS) g.bass = saved.bass;
  const l = saved.lead;
  if (l && typeof l === 'object') {
    if (l.preset === 'current' || PRESETS.some(p => p.id === l.preset)) g.lead.preset = l.preset;
    if (l.register in LEAD_REGISTERS) g.lead.register = l.register;
    if (LEAD_STYLES.includes(l.style)) g.lead.style = l.style;
    if (LEAD_DENSITIES.includes(l.density)) g.lead.density = l.density;
    g.lead.double = !!l.double;
    if (Number.isInteger(l.seed) && l.seed > 0) g.lead.seed = l.seed;
  }
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
export const leadPreset = () => (state.gen.lead.preset === 'current' ? state.preset : state.gen.lead.preset);

// Accords de la suite tapée ; un message si aucun n'est reconnu.
function progression() {
  const res = parseProgression(state.gen.prog);
  if (!res.chords.length) toast(t('gen.none'), 3000);
  return res;
}
const genStart = () => Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;

// Pistes entièrement libres sur [start, start + total[, à partir de la piste armée (n pistes différentes) ; null s'il en manque.
function freeLanes(start, total, n) {
  const tracks = state.tl.tracks, out = [];
  for (let k = 0; k < tracks.length && out.length < n; k++) {
    const i = (armedTrack() + k) % tracks.length;
    if (!tracks[i].clips.some(c => c.start < start + total - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6)) out.push(i);
  }
  if (out.length < n) { toast(t('gen.full', { bars: total / BEATS_PER_BAR, bar: start / BEATS_PER_BAR + 1 }), 4000); return null; }
  return out;
}
function growSong(end) {
  if (end > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil(end / BEATS_PER_BAR));
}

// ---- Accords ----

export function generatePads() {
  const g = state.gen;
  const { chords, bad } = progression();
  if (!chords.length) return;
  const voiced = voiceChords(chords, GEN_REGISTERS[g.register]);
  const chordBeats = g.bars * BEATS_PER_BAR;
  const start = genStart();
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
  const bass = GEN_BASS[g.bass];
  const lanes = freeLanes(start, total, bass ? 2 : 1);
  if (!lanes) return;
  state.tl.tracks[lanes[0]].clips.push(...blocks(i => voiced[i], g.rhythm, genPreset(), 'pad'));
  if (bass) state.tl.tracks[lanes[1]].clips.push(...blocks(i => [bassNote(chords[i])], bass.rhythm, bass.preset, 'bass'));
  growSong(start + total);
  renderTl();
  save();
  const msg = t('gen.done', { n: chords.length * g.repeat, track: lanes.map(i => i + 1).join(' + ') });
  toast(bad.length ? `${msg} · ${t('gen.bad', { list: bad.join(' ') })}` : msg, 4000);
}

// ---- Mélodie ----

// Une phrase de mélodie sur toute la suite (répétée ensuite par le bloc).
export function leadSeq(chords) {
  const g = state.gen, l = g.lead;
  return generateLead(chords, { style: l.style, density: l.density, register: l.register, beatsPerChord: g.bars * BEATS_PER_BAR, seed: l.seed, double: l.double });
}

// Un seul bloc de notes (format du piano roll) : la phrase, répétée sur toute la durée.
export function generateLeadClip() {
  const g = state.gen;
  const { chords, bad } = progression();
  if (!chords.length) return;
  const phrase = g.bars * BEATS_PER_BAR * chords.length;
  const start = genStart();
  const total = phrase * g.repeat;
  const lanes = freeLanes(start, total, 1);
  if (!lanes) return;
  const clip = { id: crypto.randomUUID(), type: 'note', seq: leadSeq(chords), pat: phrase, preset: leadPreset(), name: t(`gen.style.${g.lead.style}`),
    cat: 'lead', color: catColor('lead'), start, len: total, loop: false };
  state.tl.tracks[lanes[0]].clips.push(clip);
  growSong(start + total);
  renderTl();
  save();
  const msg = t('gen.leadDone', { notes: clip.seq.length, track: lanes[0] + 1 });
  toast(bad.length ? `${msg} · ${t('gen.bad', { list: bad.join(' ') })}` : msg, 4000);
}

// ---- Écoute ----

// Voix de l'écoute en cours (le moteur les oublie dès que leur fin est programmée : on les garde pour pouvoir les couper).
let preview = [], previewEnd = 0;
export const genPreviewing = () => preview.length > 0 && engine.ctx.currentTime < previewEnd;
// Coupe l'écoute ; renvoie true si elle jouait encore.
export function stopGenPreview() {
  const was = genPreviewing();
  for (const v of preview) engine.releaseVoice(v, 0.01);
  preview = [];
  return was;
}
function playNotes(notes, preset) {
  const patch = presetPatch(preset);
  const t0 = engine.ctx.currentTime + 0.05, bd = 60 / state.bpm;
  notes.forEach((n, k) => {
    const key = `gen:${k}`;
    engine.noteOn(n.note, n.vel, t0 + n.t * bd, key, patch);
    const v = engine.voices.get(key);
    engine.noteOff(n.note, false, t0 + (n.t + n.len) * bd, key);
    if (v) preview.push(v);
    previewEnd = Math.max(previewEnd, t0 + (n.t + n.len) * bd + 0.3);
  });
}

// Accords : le premier accord ; mélodie : les deux premiers accords (au plus 4 mesures).
export function previewGen() {
  if (stopGenPreview()) return;
  const g = state.gen;
  const { chords } = progression();
  if (!chords.length) return;
  if (g.tab === 'lead') {
    const end = Math.min(2 * g.bars, 4) * BEATS_PER_BAR;
    playNotes(leadSeq(chords).filter(n => n.t < end).map(n => ({ ...n, len: Math.min(n.len, end - n.t) })), leadPreset());
  } else {
    playNotes(voiceChords(chords, GEN_REGISTERS[g.register])[0].map(note => ({ t: 0, len: 4, note, vel: 0.8 })), genPreset());
  }
}

// ---- Fenêtre ----

const field = (label, el) => {
  const l = document.createElement('label');
  const s = document.createElement('span');
  s.textContent = label;
  l.append(s, el);
  return l;
};
const button = (text, fn, cls = '') => {
  const b = document.createElement('button');
  b.textContent = text;
  if (cls) b.className = cls;
  b.addEventListener('click', fn);
  return b;
};
// Liste déroulante liée à un réglage de `obj` (state.gen ou state.gen.lead).
function select(obj, key, options, cast = v => v) {
  const el = document.createElement('select');
  el.dataset.key = key;
  for (const [v, text] of options) el.add(new Option(text, v));
  el.value = obj()[key];
  el.addEventListener('change', () => { obj()[key] = cast(el.value); save(); renderGenInfo(); });
  return el;
}
// Presets des familles proposées, ou le preset joué au clavier.
function soundSelect(obj, families) {
  const el = document.createElement('select');
  el.dataset.key = 'preset';
  el.add(new Option(t('gen.current'), 'current'));
  for (const f of families) {
    const grp = document.createElement('optgroup');
    grp.label = t(`family.${f}`);
    for (const p of PRESETS.filter(p => p.family === f)) grp.appendChild(new Option(p.name, p.id));
    el.appendChild(grp);
  }
  el.value = obj().preset;
  el.addEventListener('change', () => { obj().preset = el.value; save(); });
  return el;
}

export function buildGen() {
  const box = $('#gen');
  const G = () => state.gen, L = () => state.gen.lead;
  const tabs = document.createElement('div');
  tabs.className = 'gen-tabs';
  for (const id of ['chords', 'lead']) {
    tabs.appendChild(button(t(`gen.tab.${id}`), () => { stopGenPreview(); state.gen.tab = id; save(); renderGen(); })).dataset.tab = id;
  }
  // Commun : suite d'accords, mesures par accord, répétitions.
  const prog = document.createElement('input');
  prog.type = 'text';
  prog.id = 'gen-prog';
  prog.spellcheck = false;
  prog.title = t('gen.progHint');
  prog.addEventListener('input', () => { state.gen.prog = prog.value; save(); renderGenInfo(); });
  const chips = document.createElement('div');
  chips.className = 'gen-chips';
  for (const p of PROGRESSIONS) chips.appendChild(button(p, () => { prog.value = state.gen.prog = p; save(); renderGenInfo(); }));
  const row1 = document.createElement('div');
  row1.className = 'gen-row';
  row1.append(field(t('gen.prog'), prog), chips);
  const row2 = document.createElement('div');
  row2.className = 'gen-row';
  row2.append(
    field(t('gen.bars'), select(G, 'bars', [1, 2, 4].map(n => [n, n]), Number)),
    field(t('gen.repeat'), select(G, 'repeat', [1, 2, 4].map(n => [n, `×${n}`]), Number)),
  );
  // Accords.
  const chords = document.createElement('div');
  chords.className = 'gen-row gen-panel';
  chords.dataset.panel = 'chords';
  chords.append(
    field(t('gen.sound'), soundSelect(G, GEN_SOUNDS)),
    field(t('gen.register'), select(G, 'register', Object.keys(GEN_REGISTERS).map(k => [k, t(`gen.reg.${k}`)]))),
    field(t('gen.rhythm'), select(G, 'rhythm', GEN_RHYTHMS.map(k => [k, t(`gen.rh.${k}`)]))),
    field(t('gen.bass'), select(G, 'bass', Object.keys(GEN_BASS).map(k => [k, t(`gen.bass.${k}`)]))),
  );
  // Mélodie.
  const lead = document.createElement('div');
  lead.className = 'gen-row gen-panel';
  lead.dataset.panel = 'lead';
  const dbl = document.createElement('input');
  dbl.type = 'checkbox';
  dbl.id = 'gen-double';
  dbl.addEventListener('change', () => { state.gen.lead.double = dbl.checked; save(); });
  const idea = button(t('gen.idea'), () => {
    stopGenPreview();
    state.gen.lead.seed = 1 + Math.floor(Math.random() * 1e6);
    save();
    previewGen();
  });
  idea.id = 'gen-idea';
  idea.dataset.icon = 'wand';
  lead.append(
    field(t('gen.sound'), soundSelect(L, LEAD_SOUNDS)),
    field(t('gen.style'), select(L, 'style', LEAD_STYLES.map(k => [k, t(`gen.style.${k}`)]))),
    field(t('gen.density'), select(L, 'density', LEAD_DENSITIES.map(k => [k, t(`gen.dens.${k}`)]))),
    field(t('gen.register'), select(L, 'register', Object.keys(LEAD_REGISTERS).map(k => [k, t(`gen.reg.${k}`)]))),
    field(t('gen.double'), dbl),
    idea,
  );
  const actions = document.createElement('div');
  actions.className = 'gen-row gen-actions';
  const go = button(t('gen.go'), () => (state.gen.tab === 'lead' ? generateLeadClip() : generatePads()), 'primary');
  go.id = 'gen-go';
  const listen = button(t('gen.listen'), previewGen);
  listen.id = 'gen-listen';
  actions.append(listen, go);
  const info = document.createElement('span');
  info.className = 'hint gen-info';
  box.append(tabs, row1, row2, chords, lead, actions, info);
  renderGen();
}

// Réglages affichés (après le chargement d'un projet, d'un fichier…).
export function renderGen() {
  const box = $('#gen');
  if (!box) return;
  const g = state.gen;
  for (const b of box.querySelectorAll('.gen-tabs button')) b.classList.toggle('active', b.dataset.tab === g.tab);
  for (const p of box.querySelectorAll('.gen-panel')) p.hidden = p.dataset.panel !== g.tab;
  box.querySelector('#gen-prog').value = g.prog;
  for (const p of box.querySelectorAll('.gen-panel, .gen-row')) {
    const obj = p.dataset.panel === 'lead' ? g.lead : g;
    for (const s of p.querySelectorAll(':scope > label > select')) s.value = obj[s.dataset.key];
  }
  box.querySelector('#gen-double').checked = g.lead.double;
  renderGenInfo();
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
