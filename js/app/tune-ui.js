// Fenêtre Autotune (js/autotune.js) : la voix d'un bloc audio (prise enregistrée ou son) recalée sur une gamme ou sur
// les notes d'un bloc (la mélodie d'un lead). Les réglages recalculent un aperçu (courbe de hauteur, dans un Worker) ;
// Appliquer remplace le son du bloc par la voix corrigée (« Annuler » revient en arrière). Le son d'origine est gardé :
// rouvrir l'autotune sur ce bloc repart de lui, « Retirer » le remet.
import { TUNE_SCALES, autotune } from '../autotune.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { clipEvents } from '../notes.js';
import { encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { $, engine, state, timeline, wm } from './core.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { ensureBuffer, renderTl, tlSel, trackName } from './tl.js';
import { tlSelect } from './tl-select.js';
import { noteLabel } from './tl-record.js';

export const TUNE_MODES = ['scale', 'notes'];
export const TUNE_STYLES = { robot: { speed: 0, humanize: 0 }, tight: { speed: 25, humanize: 0.3 }, natural: { speed: 90, humanize: 0.8 } };
export const defaultTuneState = () => ({ mode: 'scale', key: 'gen', scale: 'minor', notes: null, speed: 0, humanize: 0, formant: 0, mix: 1 });
const MARGIN = 0.25;   // secondes analysées de part et d'autre de la partie jouée du son

export function mergeTuneState(saved) {
  const v = defaultTuneState();
  if (!saved || typeof saved !== 'object') return v;
  if (TUNE_MODES.includes(saved.mode)) v.mode = saved.mode;
  if (saved.key === 'gen' || (Number.isInteger(saved.key) && saved.key >= 0 && saved.key < 12)) v.key = saved.key;
  if (saved.scale in TUNE_SCALES) v.scale = saved.scale;
  if (typeof saved.notes === 'string') v.notes = saved.notes;
  const num = (k, lo, hi) => { if (Number.isFinite(saved[k])) v[k] = Math.min(hi, Math.max(lo, saved[k])); };
  num('speed', 0, 400); num('humanize', 0, 1); num('formant', -12, 12); num('mix', 0, 1);
  return v;
}
const tuneSettings = () => { const v = state.tune; return { mode: v.mode, key: v.key, scale: v.scale, notes: v.notes, speed: v.speed, humanize: v.humanize, formant: v.formant, mix: v.mix }; };

// Tonalité du générateur (premier accord de sa suite) : { root, scale }.
export function genTuneKey() {
  const c = parseProgression(state.gen?.prog ?? '').chords[0];
  return c ? { root: c.root, scale: c.intervals.includes(3) ? 'minor' : 'major' } : { root: 5, scale: 'minor' };
}
const resolvedKey = () => (state.tune.key === 'gen' ? genTuneKey() : { root: state.tune.key, scale: state.tune.scale });

// ---- Bloc corrigé ----

let tuneClipId = null;   // dernier bloc audio choisi (gardé quand la sélection passe ailleurs)
const findClip = id => {
  for (const [track, tr] of state.tl.tracks.entries()) { const clip = tr.clips.find(c => c.id === id); if (clip) return { track, clip }; }
  return null;
};
// Le bloc audio visé : le bloc sélectionné s'il est audio, sinon le dernier choisi. -> { track, clip } ou null
export function tuneTarget() {
  const c = tlSel?.clip;
  if (c && !c.type && c.sampleId) tuneClipId = c.id;
  return tuneClipId ? findClip(tuneClipId) : null;
}
// Ouvre l'autotune sur un bloc (menu du bloc).
export function openTune(track, clip) {
  tlSelect(track, clip);
  tuneClipId = clip.id;
  if (clip.tune) Object.assign(state.tune, mergeTuneState(clip.tune));
  wm.toggle('tune', true);
  renderTl();
  renderTuneWin();
}

// Blocs de notes de la timeline, et celui qui sert de mélodie (choisi, sinon celui qui recouvre le plus le bloc audio).
export function tuneNoteClips() {
  const out = [];
  state.tl.tracks.forEach((tr, track) => { for (const clip of tr.clips) if (clip.type === 'note') out.push({ track, clip }); });
  return out.sort((a, b) => a.clip.start - b.clip.start || a.track - b.track);
}
export function tuneNoteClip(target = tuneTarget()) {
  const all = tuneNoteClips();
  const chosen = all.find(s => s.clip.id === state.tune.notes);
  if (chosen || !target) return chosen ?? all[0] ?? null;
  const a0 = target.clip.start, a1 = a0 + timeline.clipBeats(target.clip);
  const over = s => Math.min(a1, s.clip.start + s.clip.len) - Math.max(a0, s.clip.start);
  return all.reduce((b, s) => (!b || over(s) > over(b) + 1e-6 ? s : b), null);
}

// Ce qu'il faut corriger dans le son d'origine du bloc : partie jouée (échantillons), décalage entendu (demi-tons),
// notes de la mélodie en secondes du son.
function tuneJob(clip, buf) {
  const bpm = state.bpm, bd = 60 / bpm;
  const rate = clip.bpm ? bpm / clip.bpm : 1;
  const k = bd * rate;   // secondes du son par temps de la timeline
  const dur = buf.duration;
  let from = (clip.offset ?? 0) * k, to = clip.loop ? dur : from + timeline.clipBeats(clip) * k;
  if (clip.loop) from = 0;
  if (clip.reverse) [from, to] = [dur - to, dur - from];
  from = Math.max(0, from - MARGIN);
  to = Math.min(dur, to + MARGIN);
  const shift = clip.warp ? (clip.semi ?? 0) : 12 * Math.log2(rate);
  const { root, scale } = resolvedKey();
  const v = state.tune;
  let notes = [];
  if (v.mode === 'notes') {
    const src = tuneNoteClip({ clip });
    const origin = clip.start - (clip.offset ?? 0);
    if (src) {
      notes = clipEvents(src.clip).map(e => {
        let t0 = (src.clip.start + e.t - origin) * k, t1 = t0 + e.len * k;
        if (clip.reverse) [t0, t1] = [dur - t1, dur - t0];
        return { t0, t1, note: e.note };
      }).filter(n => n.t1 > from && n.t0 < to);
    }
  }
  return { from, to, opts: { mode: v.mode, root, scale, notes, shift, speed: v.speed, humanize: v.humanize, formant: v.formant, mix: v.mix } };
}

// ---- Calcul (Worker, sinon ici) ----

let worker = null, nextJob = 0;
const jobs = new Map();
function runTune(chans, sr, opts) {
  try {
    if (!worker) {
      worker = new Worker('js/tune-worker.js?v=1', { type: 'module' });
      worker.onmessage = e => { jobs.get(e.data.id)?.(e.data); jobs.delete(e.data.id); };
      worker.onerror = () => { for (const r of jobs.values()) r({ error: 'worker' }); jobs.clear(); worker = null; };
    }
    const id = ++nextJob;
    return new Promise(res => { jobs.set(id, res); worker.postMessage({ id, chans, sr, opts }, chans.map(c => c.buffer)); });
  } catch {
    const r = autotune(chans, sr, opts);
    return Promise.resolve({ chans: r.chans, curve: { ...r.curve, hop: r.track.hop, start: r.track.start, sr }, stats: r.stats });
  }
}

let last = null;      // dernier calcul : { key, clipId, buffer, curve, stats, from, to, opts }
let pending = null;   // calcul en cours : { key, promise }
const srcIdOf = clip => clip.tune?.src ?? clip.sampleId;

/** Calcule la voix corrigée du bloc visé (gardée tant que rien ne change). -> last ou null */
export async function tuneRender(target = tuneTarget()) {
  if (!target) return null;
  const { clip } = target;
  const buf = await ensureBuffer(srcIdOf(clip));
  if (!buf) { toast(t('tune.noSound'), 3000); return null; }
  const job = tuneJob(clip, buf);
  const key = JSON.stringify([srcIdOf(clip), buf.length, job.from, job.to, job.opts]);
  if (last?.key === key) return last;
  if (pending?.key === key) return pending.promise;
  const sr = buf.sampleRate, a = Math.floor(job.from * sr), b = Math.ceil(job.to * sr);
  const chans = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c).slice(a, b));
  setTuneStatus(t('tune.working'));
  const promise = runTune(chans, sr, job.opts).then(r => {
    if (r.error) throw new Error(r.error);
    // Son complet : l'original, avec la partie corrigée à sa place.
    const out = engine.ctx.createBuffer(buf.numberOfChannels, buf.length, sr);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c).slice();
      d.set(r.chans[c], a);
      out.copyToChannel(d, c);
    }
    const res = { key, clipId: clip.id, buffer: out, curve: r.curve, stats: r.stats, from: a / sr, to: b / sr, opts: job.opts };
    if (pending?.key === key) { last = res; pending = null; }
    return res;
  }).catch(err => {
    if (pending?.key === key) pending = null;
    console.error(err);
    toast(t('tune.fail', { msg: err.message }), 5000);
    return null;
  });
  pending = { key, promise };
  const res = await promise;
  renderTuneCurve();
  renderTuneStatus();
  return res;
}

/** Appliquer : le son du bloc devient la voix corrigée (le son d'origine est gardé dans clip.tune.src). */
export async function applyTune() {
  stopTunePreview();
  const target = tuneTarget();
  if (!target) { toast(t('tune.noClip'), 3500); return null; }
  const res = await tuneRender(target);
  const ref = findClip(target.clip.id);   // le bloc existe toujours (rien n'a été annulé pendant le calcul)
  if (!res || !ref) return null;
  const { clip, track } = ref;
  const src = srcIdOf(clip);
  const id = `rec:${crypto.randomUUID()}`;
  bufferCache.set(id, res.buffer);
  clip.tune = { src, ...tuneSettings() };
  clip.sampleId = id;
  timeline.updateTrack(track);
  renderTl();
  save();
  toast(t('tune.applied', { name: clip.name ?? '', track: trackName(track) }), 3500);
  const data = encodeWav([...Array(res.buffer.numberOfChannels).keys()].map(c => res.buffer.getChannelData(c)), res.buffer.sampleRate);
  store.saveSample(id, { name: clip.name ?? t('tune.title'), data }).then(renderLibrary).catch(err => console.warn('Autotune', err));
  renderTuneWin();
  return { track, clip };
}

/** Retirer : le bloc retrouve son son d'origine. */
export function removeTune() {
  stopTunePreview();
  const target = tuneTarget();
  if (!target?.clip.tune) return false;
  const { clip, track } = target;
  clip.sampleId = clip.tune.src;
  delete clip.tune;
  timeline.updateTrack(track);
  renderTl();
  save();
  renderTuneWin();
  return true;
}

// ---- Écouter (la partie jouée du bloc, seule, corrigée ou d'origine) ----

let preview = null;
export function stopTunePreview() {
  if (!preview) return false;
  try { preview.stop(); } catch { /* déjà fini */ }
  preview = null;
  for (const b of document.querySelectorAll('#tune .tune-listen')) b.classList.remove('active');
  return true;
}
export async function previewTune(original = false) {
  const was = preview?.original;
  if (stopTunePreview() && was === original) return;
  const target = tuneTarget();
  if (!target) { toast(t('tune.noClip'), 3500); return; }
  const res = await tuneRender(target);
  if (!res) return;
  const { clip } = target;
  const buf = original ? await ensureBuffer(srcIdOf(clip)) : res.buffer;
  const node = engine.ctx.createBufferSource();
  node.buffer = clip.reverse ? timeline.reversed(buf) : buf;
  const rate = clip.bpm ? state.bpm / clip.bpm : 1;
  if (!clip.warp) node.playbackRate.value = rate;
  else if (clip.semi) node.detune.value = clip.semi * 100;
  const g = engine.ctx.createGain();
  g.gain.value = clip.gain ?? 1;
  node.connect(g).connect(engine.master);
  const from = clip.reverse ? buf.duration - res.to : res.from;
  node.onended = () => { if (preview === node) stopTunePreview(); };
  node.start(0, Math.max(0, from), Math.max(0.05, res.to - res.from));
  node.original = original;
  preview = node;
  $(original ? '#tune-orig' : '#tune-listen')?.classList.add('active');
}

// ---- Fenêtre ----

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const field = (label, input, extra) => el('label', {}, el('span', { textContent: label }), input, ...(extra ? [extra] : []));
let renderTimer = 0;
// Aperçu recalculé peu après le dernier changement (réglage, bloc choisi).
export function scheduleTuneRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { if (wm.isOpen('tune') && tuneTarget()) tuneRender(); }, 250);
}
function onTuneChange() {
  stopTunePreview();
  save();
  renderTuneWin();
  scheduleTuneRender();
}
function tSelect(key, options, cast = v => v) {
  const s = el('select');
  s.dataset.key = key;
  for (const [v, text] of options) s.add(new Option(text, v));
  s.addEventListener('change', () => { state.tune[key] = cast(s.value); onTuneChange(); });
  return s;
}
// Potentiomètre linéaire : valeur affichée par fmt, double-clic = valeur par défaut.
function tRange(key, min, max, step, fmt) {
  const r = el('input', { type: 'range', min, max, step });
  r.dataset.key = key;
  const out = el('em', { className: 'tune-val' });
  r.addEventListener('input', () => { state.tune[key] = +r.value; out.textContent = fmt(+r.value); });
  r.addEventListener('change', onTuneChange);
  r.addEventListener('dblclick', () => { state.tune[key] = defaultTuneState()[key]; onTuneChange(); });
  r.fmt = fmt;
  return [r, out];
}

export function buildTuneWin() {
  const box = $('#tune');
  if (!box) return;
  const row = (...els) => el('div', { className: 'gen-row' }, ...els);
  const names = t('notes');
  const keySel = tSelect('key', [['gen', ''], ...names.map((n, i) => [i, n])], v => (v === 'gen' ? v : +v));
  keySel.id = 'tune-key';
  const scaleSel = tSelect('scale', Object.keys(TUNE_SCALES).map(s => [s, t(`tune.scale.${s}`)]));
  const notesSel = el('select', { id: 'tune-notes' });
  notesSel.addEventListener('change', () => { state.tune.notes = notesSel.value || null; onTuneChange(); });
  notesSel.addEventListener('focus', renderTuneNoteClips);
  const [speed, speedV] = tRange('speed', 0, 400, 5, v => (v ? `${v} ms` : t('tune.instant')));
  const [human, humanV] = tRange('humanize', 0, 1, 0.05, v => `${Math.round(v * 100)} %`);
  const [formant, formantV] = tRange('formant', -12, 12, 0.5, v => `${v > 0 ? '+' : ''}${v}`);
  const [mix, mixV] = tRange('mix', 0, 1, 0.05, v => `${Math.round(v * 100)} %`);
  const styles = el('div', { className: 'gen-chips tune-styles' }, ...Object.keys(TUNE_STYLES).map(s => {
    const b = el('button', { textContent: t(`tune.style.${s}`), title: t(`tune.style.${s}Title`) });
    b.addEventListener('click', () => { Object.assign(state.tune, TUNE_STYLES[s]); onTuneChange(); });
    return b;
  }));
  const btn = (id, label, icon, fn, cls = '') => { const b = el('button', { id, textContent: label, className: cls }); b.dataset.icon = icon; b.addEventListener('click', fn); return b; };
  const actions = row(
    btn('tune-listen', t('tune.listen'), 'play', () => previewTune(false), 'tune-listen'),
    btn('tune-orig', t('tune.original'), 'play', () => previewTune(true), 'tune-listen'),
    btn('tune-go', t('tune.apply'), 'wand', applyTune, 'primary'),
    btn('tune-remove', t('tune.remove'), 'reset', removeTune));
  actions.classList.add('gen-actions');
  box.append(
    el('p', { className: 'hint', textContent: t('tune.intro') }),
    el('div', { className: 'tune-clip', id: 'tune-clip' }),
    row(field(t('tune.mode'), tSelect('mode', TUNE_MODES.map(m => [m, t(`tune.mode.${m}`)]))),
      el('label', { className: 'tune-scale' }, el('span', { textContent: t('tune.key') }), keySel, scaleSel),
      el('label', { className: 'tune-notes' }, el('span', { textContent: t('tune.notes') }), notesSel)),
    row(field(t('tune.speed'), speed, speedV), field(t('tune.humanize'), human, humanV), styles),
    row(field(t('tune.formant'), formant, formantV), field(t('tune.mix'), mix, mixV)),
    el('canvas', { id: 'tune-curve', className: 'tune-curve', height: 150 }),
    el('div', { className: 'hint', id: 'tune-status' }),
    actions);
  for (const [r, title] of [[speed, 'tune.speedTitle'], [human, 'tune.humanizeTitle'], [formant, 'tune.formantTitle'], [mix, 'tune.mixTitle']]) r.closest('label').title = t(title);
  renderTuneWin();
}

export function renderTuneNoteClips() {
  const sel = $('#tune-notes');
  if (!sel) return;
  const all = tuneNoteClips(), cur = tuneNoteClip();
  sel.replaceChildren(...(all.length ? all.map(({ track, clip }) => new Option(t('voice.srcItem', { track: trackName(track), name: clip.name ?? '', bar: Math.floor(clip.start / 4) + 1 }), clip.id))
    : [new Option(t('voice.noBlockShort'), '')]));
  sel.value = cur?.clip.id ?? '';
  sel.disabled = !all.length;
}

let shownClip = null;
// Réglages et bloc affichés.
export function renderTuneWin() {
  const box = $('#tune');
  if (!box || !box.childElementCount) return;
  const v = state.tune, target = tuneTarget();
  // Un autre bloc déjà corrigé : ses réglages reviennent.
  if (target && target.clip.id !== shownClip) {
    shownClip = target.clip.id;
    if (target.clip.tune) Object.assign(state.tune, mergeTuneState(target.clip.tune));
  }
  for (const s of box.querySelectorAll('select[data-key]')) s.value = String(v[s.dataset.key]);
  for (const r of box.querySelectorAll('input[type=range][data-key]')) { r.value = v[r.dataset.key]; r.nextElementSibling.textContent = r.fmt(v[r.dataset.key]); }
  const gk = genTuneKey();
  $('#tune-key').options[0].text = t('tune.genKey', { key: `${t('notes')[gk.root]} ${t(`tune.scale.${gk.scale}`)}` });
  box.querySelector('select[data-key="scale"]').disabled = v.key === 'gen';
  box.querySelector('.tune-scale').hidden = v.mode !== 'scale';
  box.querySelector('.tune-notes').hidden = v.mode !== 'notes';
  renderTuneNoteClips();
  $('#tune-clip').textContent = target ? t('tune.clip', { name: target.clip.name ?? '', track: trackName(target.track), state: target.clip.tune ? t('tune.isTuned') : '' }) : t('tune.noClip');
  for (const id of ['#tune-listen', '#tune-orig', '#tune-go']) $(id).disabled = !target;
  $('#tune-remove').hidden = !target?.clip.tune;
  renderTuneCurve();
  renderTuneStatus();
}

// Appelé à chaque dessin de la timeline : la fenêtre suit le bloc sélectionné.
export function renderTuneTarget() {
  if (!wm?.isOpen('tune')) return;
  const target = tuneTarget();
  if ((target?.clip.id ?? null) === shownClip) return;
  stopTunePreview();
  renderTuneWin();
  if (target) scheduleTuneRender();
}

function setTuneStatus(text) { const s = $('#tune-status'); if (s) s.textContent = text; }
function renderTuneStatus() {
  const target = tuneTarget();
  const fresh = last && target && last.clipId === target.clip.id;
  if (pending) return;
  setTuneStatus(!target ? '' : fresh ? t('tune.stats', { voiced: Math.round(last.stats.voiced * 100), cents: Math.round(last.stats.moved) }) : t('tune.idle'));
}

// Courbe : hauteur chantée (gris), hauteur corrigée (couleur), notes visées (traits).
export function renderTuneCurve() {
  const cv = $('#tune-curve');
  if (!cv) return;
  const w = cv.clientWidth || 600;
  if (cv.width !== w) cv.width = w;
  const g = cv.getContext('2d'), H = cv.height;
  g.clearRect(0, 0, w, H);
  const target = tuneTarget();
  if (!last || !target || last.clipId !== target.clip.id) return;
  const { input, output, target: tg } = last.curve;
  const N = input.length;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < N; k++) for (const a of [input, output, tg]) if (Number.isFinite(a[k])) { lo = Math.min(lo, a[k]); hi = Math.max(hi, a[k]); }
  if (!Number.isFinite(lo)) return;
  lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
  const st = getComputedStyle(cv), css = { getPropertyValue: k => st.getPropertyValue(k).trim() };
  const y = m => H - 4 - (m - lo) / (hi - lo) * (H - 8), x = k => k / Math.max(1, N - 1) * w;
  g.font = '10px sans-serif';
  for (let n = Math.ceil(lo); n <= hi; n++) {
    g.fillStyle = css.getPropertyValue('--line') || '#333';
    g.fillRect(0, Math.round(y(n)), w, 1);
    if ((hi - lo) < 30 || n % 12 === 0) { g.fillStyle = css.getPropertyValue('--muted') || '#888'; g.fillText(noteLabel(n), 2, y(n) - 2); }
  }
  const line = (a, color, width) => {
    g.strokeStyle = color; g.lineWidth = width;
    g.beginPath();
    let on = false;
    for (let k = 0; k < N; k++) {
      if (!Number.isFinite(a[k])) { on = false; continue; }
      if (on) g.lineTo(x(k), y(a[k])); else g.moveTo(x(k), y(a[k]));
      on = true;
    }
    g.stroke();
  };
  g.globalAlpha = 0.35;
  line(tg, css.getPropertyValue('--accent-2') || '#0af', 5);
  g.globalAlpha = 1;
  line(input, css.getPropertyValue('--muted') || '#888', 1.5);
  line(output, css.getPropertyValue('--accent') || '#f50', 2);
}
