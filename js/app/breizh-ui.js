// Fenêtre Breizh generator : un air à la manière des sonneurs bretons (js/breizh.js), joué par la bombarde, le biniou,
// la cornemuse, un couple de sonneurs ou un bagad, avec ses bourdons. Comme le générateur de mélodie : un brouillon
// (un passage de l'air) affiché dans un piano roll sous les réglages, Écouter, Nouvel air, Générer.
// Générer pose un bloc de notes pour la mélodie, un pour la deuxième voix (couple, bagad) et un pour le bourdon.
import { BZ_DANCES, BZ_DRONES, BZ_FORMS, BZ_INSTRUMENTS, BZ_MODES, BZ_ORNAMENTS, bzBreathe, bzDroneNotes, bzPhraseBeats, bzShift, generateBreizh } from '../breizh.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { PALETTE } from '../apc.js';
import { PianoRoll } from '../pianoroll.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, engine, state, uiColor } from './core.js';
import { freeLanes, presetPatch } from './gen.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { growSong, renderTl } from './tl.js';
import { noteLabel } from './tl-record.js';

export const defaultBreizh = () => ({ instrument: 'couple', dance: 'andro', tonic: 5, mode: 'minor', bars: 4, form: 'AB', repeat: 1, ornaments: 'light', drone: 'tonic', seed: 1,
  draft: null });   // brouillon : { seq, edited } (un passage de l'air)

export function mergeBreizh(saved) {
  const b = defaultBreizh();
  if (!saved || typeof saved !== 'object') return b;
  if (saved.instrument in BZ_INSTRUMENTS) b.instrument = saved.instrument;
  if (BZ_DANCES.includes(saved.dance)) b.dance = saved.dance;
  if (Number.isInteger(saved.tonic) && saved.tonic >= 0 && saved.tonic < 12) b.tonic = saved.tonic;
  if (saved.mode in BZ_MODES) b.mode = saved.mode;
  if ([2, 4].includes(saved.bars)) b.bars = saved.bars;
  if (BZ_FORMS.includes(saved.form)) b.form = saved.form;
  if ([1, 2, 4].includes(saved.repeat)) b.repeat = saved.repeat;
  if (BZ_ORNAMENTS.includes(saved.ornaments)) b.ornaments = saved.ornaments;
  if (BZ_DRONES.includes(saved.drone)) b.drone = saved.drone;
  if (Number.isInteger(saved.seed) && saved.seed > 0) b.seed = saved.seed;
  const d = saved.draft;
  if (d && Array.isArray(d.seq)) {
    const seq = d.seq.filter(n => [n?.t, n?.len, n?.note].every(Number.isFinite) && n.t >= 0 && n.len > 0 && n.note >= 0 && n.note <= 127)
      .map(n => ({ t: n.t, len: n.len, note: Math.round(n.note), vel: Number.isFinite(n.vel) ? Math.min(1, Math.max(0, n.vel)) : 0.85 }));
    b.draft = { seq, edited: !!d.edited, pat: 0, len: 0 };
  }
  return b;
}

// ---- Brouillon et voix ----

export const breizhSeq = () => generateBreizh(state.breizh);
export function breizhDraft() {
  const b = state.breizh;
  if (!b.draft) refreshBreizh(true);
  b.draft.pat = b.draft.len = bzPhraseBeats(b);
  return b.draft;
}
// Recalcule le brouillon à partir des réglages (pas s'il a été retouché à la main, sauf `force`).
export function refreshBreizh(force = false) {
  const b = state.breizh;
  if (b.draft?.edited && !force) return;
  b.draft = { seq: breizhSeq(), edited: false, pat: 0, len: 0 };
}
// Voix posées par Générer (et jouées par Écouter) : [{ seq | notes, preset, name, cat }].
export function breizhParts() {
  const b = state.breizh, ins = BZ_INSTRUMENTS[b.instrument];
  const d = breizhDraft(), end = d.pat;
  const seq = d.seq.filter(n => n.t < end - 1e-6).map(n => ({ ...n, len: Math.min(n.len, end - n.t) }));
  const parts = [{ seq: ins.breathe ? bzBreathe(seq) : seq, preset: ins.lead, cat: 'lead' }];
  if (ins.second) parts.push({ seq: bzShift(seq, ins.second.shift), preset: ins.second.preset, cat: 'lead' });
  const drone = bzDroneNotes(b);
  if (drone.length) parts.push({ notes: drone, preset: 'bourdon', cat: 'pad' });
  return parts;
}

export function generateBreizhClips() {
  const b = state.breizh;
  const phrase = bzPhraseBeats(b), total = phrase * b.repeat;
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const parts = breizhParts();
  const lanes = freeLanes(start, total, parts.length);
  if (!lanes) return;
  const name = `${t(`breizh.ins.${b.instrument}`)} · ${t(`breizh.dance.${b.dance}`)}`;
  parts.forEach((p, k) => {
    const common = { id: crypto.randomUUID(), type: 'note', preset: p.preset, cat: p.cat, color: catColor(p.cat), start, len: total, loop: false };
    const clip = p.notes ? { ...common, notes: p.notes, vel: 0.6, name: t('preset.bourdon') }
      : { ...common, seq: p.seq.map(n => ({ ...n })), pat: phrase, name: k === 0 ? name : t(`preset.${p.preset}`) };
    state.tl.tracks[lanes[k]].clips.push(clip);
    growSong(clip);
  });
  renderTl();
  save();
  toast(t('breizh.done', { name, bars: total / BEATS_PER_BAR, track: lanes.map(i => i + 1).join(' + ') }), 4000);
}

// ---- Écoute (toutes les voix ; un deuxième clic arrête) ----

let preview = [], previewEnd = 0, previewT0 = 0, previewTimer = 0;
export const breizhPreviewing = () => engine.ctx.currentTime < previewEnd && (preview.length > 0 || !!previewTimer);
export function stopBreizhPreview() {
  const was = breizhPreviewing();
  clearInterval(previewTimer);
  previewTimer = 0;
  for (const v of preview) engine.releaseVoice(v, 0.01);
  preview = [];
  previewEnd = 0;
  return was;
}
export function previewBreizh() {
  if (stopBreizhPreview()) return;
  const end = breizhDraft().pat, bd = 60 / state.bpm;
  previewT0 = engine.ctx.currentTime + 0.05;
  previewEnd = previewT0 + end * bd + 0.3;
  // Notes programmées au fil de l'écoute (un peu d'avance), chacune avec le son de sa voix.
  const queue = breizhParts().flatMap((p, pi) => (p.notes ? p.notes.map(note => ({ t: 0, len: end, note, vel: 0.6 })) : p.seq).map((n, k) => ({ ...n, key: `bz:${pi}:${k}`, patch: presetPatch(p.preset) })))
    .sort((a, b) => a.t - b.t);
  let next = 0;
  const pump = () => {
    const horizon = engine.ctx.currentTime + 0.4;
    while (next < queue.length && previewT0 + queue[next].t * bd < horizon) {
      const n = queue[next++];
      engine.noteOn(n.note, n.vel, previewT0 + n.t * bd, n.key, n.patch);
      const v = engine.voices.get(n.key);
      engine.noteOff(n.note, false, previewT0 + (n.t + n.len) * bd, n.key);
      if (v) preview.push(v);
    }
    if (preview.length > 96) preview = preview.slice(-96);
    if (next >= queue.length) { clearInterval(previewTimer); previewTimer = 0; }
  };
  pump();
  if (next < queue.length) previewTimer = setInterval(pump, 100);
}

// ---- Fenêtre ----

const field = (label, el) => {
  const l = document.createElement('label');
  const s = document.createElement('span');
  s.textContent = label;
  l.append(s, el);
  return l;
};
const bzButton = (text, fn, cls = '') => {
  const b = document.createElement('button');
  b.textContent = text;
  if (cls) b.className = cls;
  b.addEventListener('click', fn);
  return b;
};
function onBreizhChange() {
  stopBreizhPreview();
  refreshBreizh();
  save();
  renderBreizh();
  renderBreizhRoll(true);
}
function bzSelect(key, options, cast = v => v) {
  const el = document.createElement('select');
  el.dataset.key = key;
  for (const [v, text] of options) el.add(new Option(text, v));
  el.addEventListener('change', () => { state.breizh[key] = cast(el.value); onBreizhChange(); });
  return el;
}

export let breizhRoll = null;
let wasPreviewing = false;

export function buildBreizh() {
  const box = $('#breizh');
  const row = (...els) => { const r = document.createElement('div'); r.className = 'gen-row'; r.append(...els); return r; };
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = t('breizh.intro');
  const idea = bzButton(t('breizh.idea'), () => {
    stopBreizhPreview();
    state.breizh.seed = 1 + Math.floor(Math.random() * 1e6);
    refreshBreizh(true);
    save();
    renderBreizhRoll(true);
    previewBreizh();
  });
  idea.id = 'breizh-idea';
  idea.dataset.icon = 'wand';
  const listen = bzButton(t('gen.listen'), previewBreizh);
  listen.id = 'breizh-listen';
  listen.dataset.icon = 'play';
  const go = bzButton(t('gen.go'), generateBreizhClips, 'primary');
  go.id = 'breizh-go';
  const actions = row(idea, listen, go);
  actions.classList.add('gen-actions');
  const info = document.createElement('span');
  info.className = 'hint breizh-info';
  const bar = row();
  bar.classList.add('gen-rollbar');
  const edited = document.createElement('span');
  edited.className = 'hint gen-edited';
  const redo = bzButton(t('gen.recompute'), () => { stopBreizhPreview(); refreshBreizh(true); save(); renderBreizhRoll(true); });
  redo.id = 'breizh-recompute';
  redo.dataset.icon = 'reset';
  bar.append(edited, redo);
  const wrap = document.createElement('div');
  wrap.className = 'gen-roll';
  const cv = document.createElement('canvas');
  cv.id = 'breizh-canvas';
  cv.tabIndex = 0;
  wrap.appendChild(cv);
  box.append(intro,
    row(field(t('breizh.instrument'), bzSelect('instrument', Object.keys(BZ_INSTRUMENTS).map(k => [k, t(`breizh.ins.${k}`)]))),
      field(t('breizh.dance'), bzSelect('dance', BZ_DANCES.map(k => [k, t(`breizh.dance.${k}`)]))),
      field(t('breizh.tonic'), bzSelect('tonic', t('notes').map((n, i) => [i, n]), Number)),
      field(t('breizh.mode'), bzSelect('mode', Object.keys(BZ_MODES).map(k => [k, t(`breizh.mode.${k}`)])))),
    row(field(t('breizh.bars'), bzSelect('bars', [2, 4].map(n => [n, n]), Number)),
      field(t('breizh.form'), bzSelect('form', BZ_FORMS.map(k => [k, t(`breizh.form.${k}`)]))),
      field(t('gen.repeat'), bzSelect('repeat', [1, 2, 4].map(n => [n, `×${n}`]), Number)),
      field(t('breizh.ornaments'), bzSelect('ornaments', BZ_ORNAMENTS.map(k => [k, t(`breizh.orn.${k}`)]))),
      field(t('breizh.drone'), bzSelect('drone', BZ_DRONES.map(k => [k, t(`breizh.drone.${k}`)])))),
    actions, info, bar, wrap);
  const preset = () => BZ_INSTRUMENTS[state.breizh.instrument].lead;
  breizhRoll = new PianoRoll(cv, {
    clip: () => breizhDraft(),
    changed: () => { state.breizh.draft.edited = true; save(); renderBreizhEdited(); },
    noteOn: (n, v) => engine.noteOn(n, v, undefined, `bzroll:${n}`, presetPatch(preset())),
    noteOff: n => engine.noteOff(n, false, undefined, `bzroll:${n}`),
    playhead: () => (breizhPreviewing() ? (engine.ctx.currentTime - previewT0) / (60 / state.bpm) : null),
    color: () => PALETTE[uiColor(catColor('lead'))],
    noteName: noteLabel,
  });
  cv.addEventListener('keydown', e => { if (breizhRoll.key(e)) { e.preventDefault(); e.stopPropagation(); } });
  cv.addEventListener('pointerdown', () => cv.focus());
  (function frame() {
    if (breizhPreviewing() || wasPreviewing) breizhRoll.draw();
    wasPreviewing = breizhPreviewing();
    requestAnimationFrame(frame);
  })();
  renderBreizh();
}

export function renderBreizhRoll(fit = false) {
  if (!breizhRoll) return;
  if (fit) breizhRoll.fit(); else breizhRoll.draw();
  renderBreizhEdited();
}
function renderBreizhEdited() {
  const d = breizhDraft();
  $('#breizh .gen-edited').textContent = d.edited ? t('gen.edited') : t('breizh.draftHint');
  $('#breizh-recompute').disabled = !d.edited;
}

// Réglages affichés (après le chargement d'un projet, d'un fichier…) et ce que Générer va poser.
export function renderBreizh() {
  const box = $('#breizh');
  if (!box) return;
  const b = state.breizh;
  for (const s of box.querySelectorAll('select[data-key]')) s.value = b[s.dataset.key];
  const parts = breizhParts().length;
  box.querySelector('.breizh-info').textContent = t('breizh.where', { bars: bzPhraseBeats(b) * b.repeat / BEATS_PER_BAR, bar: Math.floor(state.tl.playhead / BEATS_PER_BAR) + 1, n: parts });
}
