// Fenêtre Designer de montée (js/buildup.js) : la montée avant un drop, qui tombe sur la mesure de la tête de lecture.
// Écouter joue les éléments mélangés ; Générer pose chaque élément en bloc audio sur une piste libre, et ajoute
// (au choix) un filtre qui monte et un silence juste avant le drop sur les pistes qui jouent pendant la montée.
import { BU_BARS, BU_GAPS, BU_ROLL_FROM, BU_SUB_LENS, buildupParts } from '../buildup.js';
import { t } from '../i18n.js';
import { renderKick as synthKick } from '../kickdesign.js';
import { catColor } from '../library.js';
import { encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { fxDefaults } from '../trackfx.js';
import { $, engine, state, timeline } from './core.js';
import { freeLanes } from './gen.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { growSong, renderTl } from './tl.js';

// Mesure du drop : celle de la tête de lecture.
export const buildupDrop = () => Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;

async function parts() {
  const b = state.buildup, sr = engine.ctx.sampleRate;
  const kick = b.kickroll ? await synthKick(state.kick.params, sr) : null;
  return buildupParts(b, state.bpm, sr, kick);
}

// ---- Écouter : les éléments mélangés, du début de la montée à 2 s après le drop ----

let preview = null;
export function stopBuildupPreview() {
  if (!preview) return false;
  for (const s of preview) { try { s.stop(); } catch { /* déjà fini */ } }
  preview = null;
  $('#bu-listen')?.classList.remove('active');
  return true;
}
export async function previewBuildup() {
  if (stopBuildupPreview()) return;
  const list = await parts();
  const bd = 60 / state.bpm, t0 = engine.ctx.currentTime + 0.05, lead = state.buildup.bars * BEATS_PER_BAR * bd;
  preview = list.map(p => {
    const src = engine.ctx.createBufferSource();
    src.buffer = p.buffer;
    src.connect(engine.master);
    src.start(t0 + lead + p.start * bd);
    return src;
  });
  const last = preview[preview.length - 1];
  if (last) last.onended = () => { if (preview?.includes(last)) stopBuildupPreview(); };
  $('#bu-listen')?.classList.add('active');
}

// ---- Générer ----

export async function generateBuildup() {
  stopBuildupPreview();
  const b = state.buildup, drop = buildupDrop(), beats = b.bars * BEATS_PER_BAR, start = drop - beats;
  if (start < 0) { toast(t('bu.noRoom', { bars: b.bars, bar: drop / BEATS_PER_BAR + 1 }), 4000); return null; }
  const tracks = state.tl.tracks;
  // Pistes qui jouent pendant la montée (avant d'y poser les éléments) : filtre qui monte et silence avant le drop.
  const playing = tracks.map((tr, i) => i).filter(i => tracks[i].clips.some(c => c.start < drop && c.start + timeline.clipBeats(c) > start));
  toast(t('bu.rendering'), 30000);
  const list = await parts();
  const bd = 60 / state.bpm, sr = engine.ctx.sampleRate, made = [];
  for (const p of list) {
    const at = drop + p.start, len = Math.max(1, Math.ceil(p.buffer.duration / bd - 1e-3));
    const lanes = freeLanes(at, len, 1);
    if (!lanes) break;
    const id = `rec:${crypto.randomUUID()}`, name = t(`bu.part.${p.id}`);
    bufferCache.set(id, p.buffer);
    store.saveSample(id, { name, data: encodeWav([0, 1].map(c => p.buffer.getChannelData(c)), sr) }).then(renderLibrary).catch(err => console.warn('Montée', err));
    const clip = { id: crypto.randomUUID(), start: at, len, sampleId: id, name, cat: 'fx', color: catColor('fx'), bpm: state.bpm, loop: false };
    const tr = tracks[lanes[0]];
    tr.clips.push(clip);
    if (!tr.name) tr.name = name.slice(0, 24);
    growSong(clip);
    made.push(lanes[0]);
  }
  for (const i of playing) {
    const tr = tracks[i];
    if (b.filter) tr.fx.push({ id: crypto.randomUUID(), fx: 'hprise', start, len: beats - b.gap, p: fxDefaults('hprise'), name: '' });
    if (b.gap > 0) tr.fx.push({ id: crypto.randomUUID(), fx: 'mute', start: drop - b.gap, len: b.gap, p: fxDefaults('mute'), name: '' });
    timeline.updateTrack(i);
  }
  for (const i of made) timeline.updateTrack(i);
  renderTl();
  save();
  renderLibrary();
  toast(t('bu.done', { bars: b.bars, bar: drop / BEATS_PER_BAR + 1, n: made.length }), 4000);
  return { tracks: made, playing };
}

// ---- Fenêtre ----

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const field = (label, input) => el('label', {}, el('span', { textContent: label }), input);
function onBuChange() { stopBuildupPreview(); save(); renderBuildup(); }
function sel(key, options, cast = Number) {
  const s = el('select');
  s.dataset.key = key;
  for (const [v, text] of options) s.add(new Option(text, v));
  s.addEventListener('change', () => { state.buildup[key] = cast(s.value); onBuChange(); });
  return s;
}
function check(key) {
  const c = el('input', { type: 'checkbox' });
  c.dataset.key = key;
  c.addEventListener('change', () => { state.buildup[key] = c.checked; onBuChange(); });
  return field(t(`bu.${key}`), c);
}
function range(key, min, max, step) {
  const r = el('input', { type: 'range', min, max, step });
  r.dataset.key = key;
  r.addEventListener('input', () => { state.buildup[key] = +r.value; save(); });
  r.addEventListener('change', onBuChange);
  return field(t(`bu.${key}`), r);
}

export function buildBuildup() {
  const box = $('#buildup');
  if (!box) return;
  const row = (...els) => el('div', { className: 'gen-row' }, ...els);
  const listen = el('button', { id: 'bu-listen', textContent: t('gen.listen') });
  listen.dataset.icon = 'play';
  listen.addEventListener('click', previewBuildup);
  const go = el('button', { id: 'bu-go', className: 'primary', textContent: t('gen.go') });
  go.addEventListener('click', generateBuildup);
  const actions = row(listen, go);
  actions.classList.add('gen-actions');
  box.append(
    el('p', { className: 'hint', textContent: t('bu.intro') }),
    row(field(t('bu.bars'), sel('bars', BU_BARS.map(n => [n, t('tl.bars', { n })]))),
      field(t('bu.gap'), sel('gap', BU_GAPS.map(g => [g, g ? t('bu.gapBeats', { n: g }) : t('bu.none')])))),
    el('div', { className: 'bu-group' }, el('b', { textContent: t('bu.build') }),
      row(check('noise'), range('noiseLevel', 0, 1, 0.01)),
      row(check('tone'), field(t('bu.toneRange'), sel('toneRange', [[12, '+12'], [24, '+24'], [36, '+36']]))),
      row(check('snare'), field(t('bu.snareFrom'), sel('snareFrom', BU_ROLL_FROM.map(n => [n, t(`bu.from.${n}`)]))), range('snarePitch', 0, 12, 1)),
      row(check('kickroll'), check('filter'))),
    el('div', { className: 'bu-group' }, el('b', { textContent: t('bu.dropGroup') }),
      row(check('sub'), field(t('bu.subLen'), sel('subLen', BU_SUB_LENS.map(n => [n, t('bu.beats', { n })]))), range('subDrive', 0, 1, 0.01)),
      row(check('impact'))),
    actions,
    el('p', { className: 'hint bu-where' }));
  renderBuildup();
}

export function renderBuildup() {
  const box = $('#buildup');
  if (!box?.firstChild) return;
  const b = state.buildup;
  for (const s of box.querySelectorAll('select[data-key]')) s.value = String(b[s.dataset.key]);
  for (const c of box.querySelectorAll('input[type=checkbox][data-key]')) c.checked = !!b[c.dataset.key];
  for (const r of box.querySelectorAll('input[type=range][data-key]')) r.value = b[r.dataset.key];
  const drop = buildupDrop();
  box.querySelector('.bu-where').textContent = drop - b.bars * BEATS_PER_BAR < 0
    ? t('bu.noRoom', { bars: b.bars, bar: drop / BEATS_PER_BAR + 1 })
    : t('bu.where', { from: drop / BEATS_PER_BAR - b.bars + 1, bar: drop / BEATS_PER_BAR + 1 });
}
