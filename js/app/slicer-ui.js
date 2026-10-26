// Fenêtre du découpeur de breaks (js/slicer.js) : une boucle (fichier, pad, bibliothèque, bloc de la timeline) découpée
// sur ses coups ou en parts égales ; les repères se déplacent, s'ajoutent, s'enlèvent. Les tranches vont sur des pads, et
// « Vers le séquenceur » écrit en plus le motif d'origine dans un pattern du séquenceur pas à pas : le break rejoue au
// tempo du projet sans changer de hauteur, et chaque coup se déplace ou se remplace.
import { guessBpm } from '../decks.js';
import { t } from '../i18n.js';
import { guessCat } from '../library.js';
import { SLICES_MAX, SLICE_GRIDS, detectOnsets, gridSlices, monoOf, sliceBuffers, sliceSteps, zeroCross } from '../slicer.js';
import { PATTERNS } from '../drummachine.js';
import { SEQ_LENS, seqPatternUsed, seqRow } from '../stepseq.js';
import * as store from '../storage.js';
import { $, currentPad, engine, state, stepSeq, wm } from './core.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { renderPads } from './pads.js';
import { save } from './save.js';
import { bufferToPad, openSendTo } from './send-to.js';
import { renderSeq } from './seq-ui.js';
import { bufferCache } from './sounds.js';
import { ensureBuffer } from './tl.js';

export const SLICE_COLORS = [5, 9, 13, 21, 37, 41, 49, 57];   // couleurs des tranches (palette de l'APC), en boucle

export let slicerBuffer = null;
export let slicerPeaks = null;    // { mono, width, peaks }
export let slicerLast = -1;      // tranche écoutée en dernier (surlignée)
export let slicerPreview = [];   // sons de l'écoute en cours

export const slicerSt = () => state.slicer;
// Mesures de la boucle à son tempo.
export const slicerBars = () => (slicerBuffer && slicerSt().bpm ? slicerBuffer.duration * slicerSt().bpm / 240 : 0);

// ---- Chargement ----

/** Charge un son dans le découpeur : { sampleId, name, bpm (0 = inconnu) }. Les repères sont recalculés. */
export async function openSlicer(item) {
  const buffer = await ensureBuffer(item.sampleId);
  if (!buffer) { toast(t('lib.loadFail'), 3000); return false; }
  stopSlicerPreview();
  Object.assign(slicerSt(), { sampleId: item.sampleId, name: (item.name ?? '').slice(0, 32), bpm: guessBpm(buffer.duration, item.bpm || 0, state.bpm) });
  slicerBuffer = buffer;
  slicerPeaks = null;
  computeSlices();
  wm.toggle('slicer', true);
  renderSlicer();
  save();
  return true;
}

// Fichier audio : gardé comme son de l'utilisateur (il rejoint aussi la bibliothèque).
export async function loadSlicerFile(file) {
  if (!file || !file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i.test(file.name)) return;
  const data = await file.arrayBuffer();
  let buffer;
  try { buffer = await engine.ctx.decodeAudioData(data.slice(0)); } catch { alert(t('editor.unreadable', { name: file.name })); return; }
  const sampleId = `user:${crypto.randomUUID()}`;
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 32);
  await store.saveSample(sampleId, { name, data });
  bufferCache.set(sampleId, buffer);
  state.userSounds.push({ sampleId, name, cat: guessCat(name) });
  renderLibrary();
  await openSlicer({ sampleId, name, bpm: 0 });
}

// Au démarrage (ou à l'ouverture d'un fichier de réglages) : le son enregistré, s'il est encore là.
export async function restoreSlicer() {
  slicerBuffer = slicerSt().sampleId ? await ensureBuffer(slicerSt().sampleId) : null;
  slicerPeaks = null;
  renderSlicer();
}

// ---- Repères ----

export function computeSlices() {
  if (!slicerBuffer) { slicerSt().slices = []; return; }
  slicerSt().slices = slicerSt().mode === 'grid' ? gridSlices(slicerBuffer.duration, slicerSt().grid) : detectOnsets(slicerBuffer, slicerSt().sens);
  slicerLast = -1;
}
export function reslice() { computeSlices(); renderSlicer(); save(); }

export function addSlice(sec) {
  const s = slicerSt().slices;
  if (!slicerBuffer || s.length >= SLICES_MAX) { toast(t('slicer.max', { n: SLICES_MAX }), 3000); return; }
  const x = slicerPeaks?.mono ?? monoOf(slicerBuffer);
  const at = zeroCross(x, Math.round(sec * slicerBuffer.sampleRate)) / slicerBuffer.sampleRate;
  if (s.some(v => Math.abs(v - at) < 0.01)) return;
  s.push(at);
  s.sort((a, b) => a - b);
  renderSlicer();
  save();
}
export function removeSlice(k) {
  if (k <= 0 || k >= slicerSt().slices.length) return;   // le premier repère (début du son) reste
  slicerSt().slices.splice(k, 1);
  renderSlicer();
  save();
}

// ---- Écoute ----

export function stopSlicerPreview() {
  for (const s of slicerPreview) { try { s.stop(); } catch { /* déjà fini */ } }
  const was = slicerPreview.length > 0;
  slicerPreview = [];
  $('#sl-play')?.classList.remove('active');
  return was;
}
export function slicerPlayBuffer(buf, when, out = engine.previewOut()) {
  const src = engine.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  src.start(when);
  return src;
}
export function playSlice(k) {
  if (!slicerBuffer) return;
  stopSlicerPreview();
  slicerLast = k;
  slicerPreview = [slicerPlayBuffer(sliceBuffers(engine.ctx, slicerBuffer, slicerSt().slices)[k], engine.ctx.currentTime)];
  drawSlicer();
}
// La boucle rejouée tranche par tranche au tempo du projet : plus vite ou plus lent, sans changer de hauteur.
export function previewSlicer() {
  if (stopSlicerPreview() || !slicerBuffer) return;
  const bufs = sliceBuffers(engine.ctx, slicerBuffer, slicerSt().slices);
  const k = slicerSt().bpm ? slicerSt().bpm / state.bpm : 1, t0 = engine.ctx.currentTime + 0.05, out = engine.previewOut();
  slicerPreview = bufs.map((b, i) => slicerPlayBuffer(b, t0 + slicerSt().slices[i] * k, out));
  const last = slicerPreview[slicerPreview.length - 1];
  if (last) last.onended = () => { if (slicerPreview.includes(last)) stopSlicerPreview(); };
  $('#sl-play').classList.add('active');
}

// ---- Vers les pads et le séquenceur ----

/** Pose les tranches sur les pads de la banque `b`, à partir du pad `first`. -> pads utilisés, ou null. */
export function slicesToPads(b, first) {
  const s = slicerSt(), n = s.slices.length;
  if (!slicerBuffer || !n) return null;
  if (first + n > 40) { toast(t('slicer.noRoom', { n, pad: first + 1 }), 4000); return null; }
  const bufs = sliceBuffers(engine.ctx, slicerBuffer, s.slices);
  const pads = bufs.map((buf, k) => {
    bufferToPad(buf, `${s.name || t('slicer.slice')} ${k + 1}`.slice(0, 24), SLICE_COLORS[k % SLICE_COLORS.length], b, first + k, { quiet: true });
    return first + k;
  });
  if (b === state.bank) renderPads();
  return pads;
}

// Le motif d'origine dans le séquenceur : un pattern libre (sinon celui en cours), une ligne par tranche.
export function slicesToSeq(b, first) {
  const s = slicerSt();
  const pads = slicesToPads(b, first);
  if (!pads) return null;
  const bpm = s.bpm || state.bpm;
  const steps = Math.round(slicerBars() * 16) || 16;
  const len = SEQ_LENS.find(l => l >= steps) ?? SEQ_LENS[SEQ_LENS.length - 1];
  const at = sliceSteps(s.slices, bpm, len);
  const pats = state.seq.patterns;
  let k = [...Array(PATTERNS).keys()].map(i => (state.seq.pattern + i) % PATTERNS).find(i => !seqPatternUsed(pats[i]));
  if (k === undefined) k = state.seq.pattern;
  pats[k] = { len, rows: pads.map((pad, i) => { const row = seqRow(b, pad, len); if (at[i] !== null) row.steps[at[i]] = i === 0 ? 2 : 1; return row; }) };
  stepSeq.selectPattern(k);
  state.seq.page = 0;
  wm.toggle('seq', true);
  renderSeq();
  save();
  toast(t('slicer.seqDone', { n: pads.length, pattern: k + 1, bank: b + 1, pad: first + 1 }), 4500);
  return k;
}

export function pickSlicesPad(e, then) {
  if (!slicerSt().slices.length) { toast(t('slicer.empty'), 3000); return; }
  const r = e.currentTarget.getBoundingClientRect();
  openSendTo(null, null, r.left, r.bottom + 4, { name: '', head: t('slicer.padsHead', { n: slicerSt().slices.length }), hint: t('slicer.padsHint'), pick: true,
    toPad: (b, i) => then(b, i) });
}

// ---- Fenêtre ----

export function buildSlicer() {
  $('#sl-file').addEventListener('click', () => $('#sl-input').click());
  $('#sl-input').addEventListener('change', e => { loadSlicerFile(e.target.files[0]); e.target.value = ''; });
  $('#sl-pad').addEventListener('click', () => {
    const pad = currentPad();
    if (!pad?.sampleId) { toast(t('slicer.noPad'), 3000); return; }
    openSlicer({ sampleId: pad.sampleId, name: pad.name, bpm: pad.bpm || 0 });
  });
  for (const b of $('#sl-mode').children) b.addEventListener('click', () => { slicerSt().mode = b.dataset.mode; reslice(); });
  $('#sl-sens').addEventListener('change', e => { slicerSt().sens = e.target.value / 100; if (slicerSt().mode === 'onset') reslice(); });
  for (const n of SLICE_GRIDS) $('#sl-grid').add(new Option(t('slicer.gridN', { n }), n));
  $('#sl-grid').addEventListener('change', e => { slicerSt().grid = +e.target.value; if (slicerSt().mode === 'grid') reslice(); });
  $('#sl-bpm').addEventListener('change', e => { const v = +e.target.value; if (v >= 40 && v <= 400) { slicerSt().bpm = v; save(); } renderSlicer(); });
  $('#sl-play').addEventListener('click', previewSlicer);
  $('#sl-to-pads').addEventListener('click', e => pickSlicesPad(e, (b, i) => { if (slicesToPads(b, i)) toast(t('slicer.padsDone', { n: slicerSt().slices.length, bank: b + 1, pad: i + 1 }), 3500); }));
  $('#sl-to-seq').addEventListener('click', e => pickSlicesPad(e, slicesToSeq));
  const wrap = $('#sl-wave-wrap');
  wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.classList.add('dragover'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('dragover'));
  wrap.addEventListener('drop', e => { e.preventDefault(); wrap.classList.remove('dragover'); loadSlicerFile(e.dataTransfer.files[0]); });
  bindSlicerWave();
  new ResizeObserver(() => { slicerPeaks = null; drawSlicer(); }).observe(wrap);
  restoreSlicer();
}

export function renderSlicer() {
  if (!$('#sl-wave')) return;
  const s = slicerSt();
  $('#sl-name').textContent = s.sampleId ? s.name : t('slicer.noSound');
  for (const b of $('#sl-mode').children) b.classList.toggle('active', b.dataset.mode === s.mode);
  $('#sl-sens-wrap').hidden = s.mode !== 'onset';
  $('#sl-grid-wrap').hidden = s.mode !== 'grid';
  $('#sl-sens').value = Math.round(s.sens * 100);
  $('#sl-grid').value = s.grid;
  $('#sl-bpm').value = s.bpm || '';
  const bars = slicerBars();
  $('#sl-info').textContent = slicerBuffer ? t('slicer.info', { n: s.slices.length, bars: bars ? (Math.round(bars * 100) / 100).toString() : '?' }) : '';
  for (const id of ['#sl-play', '#sl-to-pads', '#sl-to-seq']) $(id).disabled = !slicerBuffer || !s.slices.length;
  drawSlicer();
}

// Forme d'onde, repères numérotés ; la tranche écoutée en dernier est éclairée.
export function drawSlicer() {
  const cv = $('#sl-wave');
  if (!cv) return;
  const w = Math.max(200, Math.round(cv.parentElement.clientWidth || 600));
  if (cv.width !== w) cv.width = w;
  const g = cv.getContext('2d'), h = cv.height, mid = h / 2;
  g.clearRect(0, 0, w, h);
  if (!slicerBuffer) {
    g.fillStyle = '#8b8d94';
    g.font = '14px system-ui';
    g.textAlign = 'center';
    g.fillText(t('slicer.drop'), w / 2, mid + 5);
    return;
  }
  if (!slicerPeaks || slicerPeaks.width !== w) {
    const mono = slicerPeaks?.mono ?? monoOf(slicerBuffer);
    const step = mono.length / w, peaks = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let j = Math.floor(x * step); j < Math.floor((x + 1) * step); j++) m = Math.max(m, Math.abs(mono[j]));
      peaks[x] = m;
    }
    slicerPeaks = { mono, width: w, peaks };
  }
  const dur = slicerBuffer.duration, xs = slicerSt().slices.map(v => v / dur * w);
  xs.forEach((x, k) => {
    const x2 = xs[k + 1] ?? w;
    g.fillStyle = k === slicerLast ? 'rgba(255,90,54,.12)' : k % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,0)';
    g.fillRect(x, 0, x2 - x, h);
  });
  for (let x = 0; x < w; x++) {
    const k = Math.max(0, xs.findLastIndex(v => v <= x));
    g.fillStyle = k === slicerLast ? '#ff5a36' : k % 2 ? '#2aa86c' : '#3dd68c';   // deux tons alternés, la tranche écoutée en orange
    const ph = Math.max(1, slicerPeaks.peaks[x] * (mid - 4));
    g.fillRect(x, mid - ph, 1, ph * 2);
  }
  g.font = '11px system-ui';
  g.textAlign = 'left';
  xs.forEach((x, k) => {
    g.fillStyle = '#fff';
    g.fillRect(Math.round(x), 0, 1, h);
    g.fillRect(Math.round(x), 0, 7, 3);
    g.fillText(String(k + 1), Math.round(x) + 3, 14);
  });
}

// Souris : clic = écouter la tranche ; glisser un repère = le déplacer ; double-clic = ajouter ; clic droit = enlever.
export function bindSlicerWave() {
  const cv = $('#sl-wave');
  const secAt = e => { const r = cv.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (slicerBuffer?.duration ?? 0); };
  const markerAt = e => {
    if (!slicerBuffer) return -1;
    const r = cv.getBoundingClientRect(), px = slicerBuffer.duration / r.width;
    const sec = secAt(e);
    return slicerSt().slices.findIndex((v, k) => k > 0 && Math.abs(v - sec) < 5 * px);
  };
  let drag = -1;
  cv.addEventListener('pointermove', e => {
    if (drag > 0) {
      const s = slicerSt().slices, lo = s[drag - 1] + 0.01, hi = (s[drag + 1] ?? slicerBuffer.duration) - 0.01;
      s[drag] = Math.min(hi, Math.max(lo, secAt(e)));
      drawSlicer();
      return;
    }
    cv.style.cursor = markerAt(e) > 0 ? 'ew-resize' : '';
  });
  cv.addEventListener('pointerdown', e => {
    if (!slicerBuffer || e.button !== 0) return;
    const k = markerAt(e);
    if (k > 0) { drag = k; try { cv.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } return; }
    const sec = secAt(e);
    playSlice(Math.max(0, slicerSt().slices.findLastIndex(v => v <= sec)));
  });
  cv.addEventListener('pointerup', () => {
    if (drag <= 0) return;
    const s = slicerSt().slices, x = slicerPeaks?.mono ?? monoOf(slicerBuffer);
    s[drag] = zeroCross(x, Math.round(s[drag] * slicerBuffer.sampleRate)) / slicerBuffer.sampleRate;
    drag = -1;
    renderSlicer();
    save();
  });
  cv.addEventListener('dblclick', e => { if (markerAt(e) < 0) addSlice(secAt(e)); });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); const k = markerAt(e); if (k > 0) removeSlice(k); });
}
