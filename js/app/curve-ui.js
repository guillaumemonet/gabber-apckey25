// Designer d'effet : courbes dessinées sur 1, 2 ou 4 temps.
import { CURVE_BEATS, CURVE_SHAPES, CURVE_TARGETS, cleanCurve, curveAt, curveValue, defaultCurve } from '../curves.js';
import { t } from '../i18n.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { TrackChain, setCurveResolver } from '../trackfx.js';
import { $, engine, state, timeline, wm } from './core.js';
import { libManifest, libTab, renderLibrary, showLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { ensureBuffer, renderTl, tlSel } from './tl.js';
import { tlPlaceFx } from './trackfx-ui.js';

// ---------- Designer d'effet (courbes) ----------

// Une courbe dessinée sur 1, 2 ou 4 temps pilote un réglage de la piste pendant un bloc « Courbe » (js/curves.js).
// Les formes de départ sont fixes ; les tiennes (state.curves) se retouchent en direct : tous leurs blocs suivent.
export const CURVE_GRIDS = [0, 1, 2, 4, 8, 3, 6];   // divisions par temps (0 = libre)
export const CURVE_GRID_LABEL = { 0: null, 1: '1/4', 2: '1/8', 4: '1/16', 8: '1/32', 3: '1/8T', 6: '1/16T' };
export const CURVE_COLORS = { vol: '#ffc53d', lp: '#3dd68c', hp: '#12a594', pan: '#0090ff', drive: '#ff5a36', rev: '#a78bfa', dly: '#d6409f' };
// Sons d'écoute : une boucle de la bibliothèque (banque, nom).
export const CURVE_SOURCES = { drums: ['Gabber', 'Beat full'], bass: ['Hardcore', 'Offbeat bass'], pad: ['Hardcore', 'String pads'], lead: ['Gabber', 'Hoover riff'] };

export const curveEd = { draft: defaultCurve(), src: null, bind: null, grid: 4, sel: -1, source: 'drums', dirty: false };
export const curveById = id => (id === '__draft' ? curveEd.draft : state.curves.find(c => c.id === id) ?? CURVE_SHAPES.find(c => c.id === id) ?? null);
export const curveName = id => { const c = curveById(id); return !c ? t('curve.missing') : c.id?.startsWith('b:') ? t(`curve.shape.${c.id.slice(2)}`) : c.name || t('curve.unnamed'); };
export const curveIsMine = () => !!curveEd.src?.startsWith('u:');
export const curveBlocks = id => state.tl.tracks.flatMap((tr, i) => tr.fx.filter(b => b.fx === 'curve' && b.p.curve === id).map(b => ({ track: i, block: b })));
setCurveResolver(curveById);

// Éléments « Courbes » de la bibliothèque (onglet Effets) : formes de départ puis les tiennes.
export const curveItems = () => [...CURVE_SHAPES, ...state.curves].map(c => ({
  kind: 'fx', sampleId: `fx:curve:${c.id}`, name: curveName(c.id), cat: 'curve', fx: 'curve', p: { curve: c.id }, len: 16, family: 'curve', curveId: c.id, ownCurve: c.id.startsWith('u:'),
}));

// Ouvre une courbe dans le designer ; `bind` : le bloc de la timeline d'où l'on vient (il prendra la courbe enregistrée).
export function openCurve(id, bind = null) {
  const c = curveById(id);
  curveEd.src = c?.id ?? null;
  curveEd.draft = curveIsMine() ? c : { ...structuredClone(c ?? defaultCurve()), id: null, name: '' };
  curveEd.bind = bind;
  curveEd.sel = -1;
  curveEd.dirty = false;
  if (!wm.isOpen('curve')) wm.toggle('curve', true);
  renderCurveEditor();
  curvePreviewUpdate();
}

export function newCurve() {
  curveEd.src = null;
  curveEd.draft = defaultCurve();
  curveEd.bind = null;
  curveEd.sel = -1;
  curveEd.dirty = false;
  renderCurveEditor();
  curvePreviewUpdate();
}

// Après chaque retouche : la courbe à toi s'applique tout de suite (blocs de la timeline, sauvegarde).
export let curveSaveTimer = 0;
export function curveChanged(structure = false) {
  renderCurveCanvas();
  if (structure) renderCurveControls();
  curvePreviewUpdate();
  if (!curveIsMine()) { curveEd.dirty = true; return; }
  clearTimeout(curveSaveTimer);
  curveSaveTimer = setTimeout(() => {
    const id = curveEd.src;
    timeline.refreshFx(b => b.fx === 'curve' && b.p.curve === id);
    renderTl();
    if (libTab === 'fx') renderLibrary();
    save();
  }, 120);
}

export function saveCurve() {
  const d = curveEd.draft;
  const name = d.name.trim() || (curveEd.src ? curveName(curveEd.src) : '') || t('curve.defaultName', { n: state.curves.length + 1 });
  const c = cleanCurve({ ...d, id: `u:${crypto.randomUUID()}`, name });
  state.curves.push(c);
  curveEd.src = c.id;
  curveEd.draft = c;
  curveEd.dirty = false;
  // Ouverte depuis un bloc d'une forme de départ : ce bloc prend ta courbe.
  const b = curveEd.bind?.block;
  if (b && state.tl.tracks[curveEd.bind.track]?.fx.includes(b) && !b.p.curve.startsWith('u:')) { b.p.curve = c.id; b.name = c.name; }
  showLibrary('fx', 'curve');
  renderTl();
  renderCurveEditor();
  save();
  toast(t('curve.saved'), 3000);
}

export function copyCurve() {
  curveEd.draft = { ...structuredClone(curveEd.draft), id: null, name: `${curveName(curveEd.src ?? '__draft')} 2`.slice(0, 32) };
  curveEd.src = null;
  curveEd.bind = null;
  renderCurveEditor();
}

export function deleteCurve(id) {
  const c = state.curves.find(x => x.id === id);
  if (!c) return;
  const used = curveBlocks(id).length;
  if (!confirm(t('curve.delConfirm', { name: c.name, n: used }))) return;
  state.curves = state.curves.filter(x => x !== c);
  if (curveEd.src === id) newCurve();
  renderLibrary();
  renderTl();
  renderCurveEditor();
  save();
}

// Pose la courbe à la tête de lecture, sur la piste du bloc sélectionné (sinon la première), pour 4 mesures.
export function placeCurve() {
  if (!curveIsMine() && (curveEd.dirty || !curveEd.src)) saveCurve();
  const id = curveEd.src;
  const track = tlSel?.track ?? 0;
  const beat = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  tlPlaceFx({ fx: 'curve', p: { curve: id }, len: 16, name: curveName(id) }, track, beat);
  toast(t('curve.placed', { n: track + 1 }), 2500);
}

// ---- Écoute : une boucle de la bibliothèque passe par la courbe en cours ----
export let curvePrev = null;
export async function curvePreviewToggle() {
  if (curvePrev) { curvePreviewStop(); return; }
  const [bank, name] = CURVE_SOURCES[curveEd.source];
  const p = libManifest?.banks.find(b => b.name === bank)?.pads.find(x => x?.name === name);
  const id = p && `lib:${p.file}`;
  const buf = id && await ensureBuffer(id);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  const ctx = engine.ctx;
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(engine.master);
  const chain = new TrackChain(ctx, engine, out);
  const block = { id: 'curve-preview', fx: 'curve', start: 0, len: 1e6, p: { curve: '__draft' } };
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = p.bpm ? state.bpm / p.bpm : 1;
  src.connect(chain.input);
  const t0 = ctx.currentTime + 0.05;
  src.start(t0);
  curvePrev = { src, chain, block, out, t0, timer: setInterval(curvePreviewUpdate, 40000) };
  curvePreviewUpdate();
  $('#curve-play').classList.add('active');
  $('#curve-play').textContent = t('curve.stop');
  (function frame() { if (!curvePrev) return; renderCurveCanvas(); requestAnimationFrame(frame); })();
}

export function curvePreviewUpdate() {
  if (!curvePrev) return;
  const { chain, block, t0 } = curvePrev;
  const bd = 60 / state.bpm;
  const now = engine.ctx.currentTime + 0.03;
  chain.sync([block]);   // réglage piloté changé : la chaîne est reconstruite
  chain.play(block, now, now + 60, bd, (now - t0) / bd);
}

export function curvePreviewStop() {
  if (!curvePrev) return;
  const { src, chain, out, timer } = curvePrev;
  curvePrev = null;
  clearInterval(timer);
  const now = engine.ctx.currentTime;
  out.gain.setTargetAtTime(0, now, 0.01);
  try { src.stop(now + 0.06); } catch { /* déjà arrêtée */ }
  setTimeout(() => { chain.reset(); out.disconnect(); }, 120);
  $('#curve-play').classList.remove('active');
  $('#curve-play').textContent = t('curve.play');
  renderCurveCanvas();
}

// ---- Fenêtre ----
export function buildCurve() {
  const target = $('#curve-target');
  for (const id of CURVE_TARGETS) target.add(new Option(t(`curve.target.${id}`), id));
  target.addEventListener('change', () => { curveEd.draft.target = target.value; curveChanged(true); });
  const beats = $('#curve-beats');
  for (const n of CURVE_BEATS) {
    const b = document.createElement('button');
    b.dataset.beats = n;
    b.textContent = t(n === 1 ? 'curve.beat1' : 'curve.beats', { n });
    b.addEventListener('click', () => { curveEd.draft.beats = n; curveChanged(true); });
    beats.appendChild(b);
  }
  const grid = $('#curve-grid');
  for (const g of CURVE_GRIDS) grid.add(new Option(CURVE_GRID_LABEL[g] ?? t('curve.grid.free'), g));
  grid.value = curveEd.grid;
  grid.addEventListener('change', () => { curveEd.grid = +grid.value; renderCurveCanvas(); });
  $('#curve-name').addEventListener('input', e => { curveEd.draft.name = e.target.value.slice(0, 32); if (curveIsMine()) curveChanged(); });
  for (const el of document.querySelectorAll('#curve-sliders input')) {
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      curveEd.draft[k] = k === 'depth' ? +el.value / 100 : k === 'freq' ? Math.round(Math.exp(+el.value)) : +el.value;
      renderCurveControls();
      curveChanged();
    });
  }
  const srcSel = $('#curve-src');
  for (const id of Object.keys(CURVE_SOURCES)) srcSel.add(new Option(t(`curve.src.${id}`), id));
  srcSel.addEventListener('change', () => { curveEd.source = srcSel.value; if (curvePrev) { curvePreviewStop(); curvePreviewToggle(); } });
  $('#curve-play').addEventListener('click', curvePreviewToggle);
  $('#curve-new').addEventListener('click', newCurve);
  $('#curve-save').addEventListener('click', saveCurve);
  $('#curve-copy').addEventListener('click', copyCurve);
  $('#curve-del').addEventListener('click', () => deleteCurve(curveEd.src));
  $('#curve-place').addEventListener('click', placeCurve);
  bindCurveCanvas();
  new ResizeObserver(() => renderCurveCanvas()).observe($('#curve-canvas'));
  renderCurveEditor();
}

export function renderCurveEditor() {
  if (!$('#curve-canvas')) return;
  // Formes de départ et tes courbes.
  const list = $('#curve-shapes');
  list.innerHTML = '';
  const add = (c, mine) => {
    const b = document.createElement('button');
    b.textContent = curveName(c.id);
    b.style.setProperty('--c', CURVE_COLORS[c.target]);
    if (mine) b.dataset.icon = 'user';
    b.classList.toggle('active', curveEd.src === c.id);
    b.title = t(`curve.target.${c.target}`);
    b.addEventListener('click', () => openCurve(c.id));
    list.appendChild(b);
  };
  for (const c of CURVE_SHAPES) add(c, false);
  for (const c of state.curves) add(c, true);
  renderCurveControls();
  renderCurveCanvas();
}

export function renderCurveControls() {
  const d = curveEd.draft;
  const mine = curveIsMine();
  $('#curve-target').value = d.target;
  for (const b of $('#curve-beats').children) b.classList.toggle('active', +b.dataset.beats === d.beats);
  const name = $('#curve-name');
  if (document.activeElement !== name) name.value = d.name;
  name.placeholder = !mine && curveEd.src ? curveName(curveEd.src) : t('curve.namePh');
  const filt = d.target === 'lp' || d.target === 'hp';
  for (const row of document.querySelectorAll('#curve-sliders label')) {
    const k = row.dataset.k;
    row.hidden = (k === 'freq' || k === 'q') && !filt;
    const inp = row.querySelector('input');
    const v = d[k];
    if (k === 'freq') {
      [inp.min, inp.max] = d.target === 'lp' ? [Math.log(40), Math.log(5000)] : [Math.log(200), Math.log(12000)];
      inp.value = Math.log(v);
      row.querySelector('span').textContent = t(`curve.freq.${d.target === 'hp' ? 'hp' : 'lp'}`);
    } else inp.value = k === 'depth' ? v * 100 : v;
    row.querySelector('em').textContent = k === 'depth' ? `${Math.round(v * 100)}%` : k === 'smooth' ? `${Math.round(v)} ms` : k === 'freq' ? fmtHz(v) : v.toFixed(1);
  }
  $('#curve-save').hidden = mine;
  $('#curve-del').hidden = !mine;
  $('#curve-hint').textContent = mine ? t('curve.liveHint', { n: curveBlocks(curveEd.src).length }) : t('curve.draftHint');
}
export const fmtHz = v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`);

// Valeur affichée d'une hauteur (0..1) sur l'axe : dans l'unité du réglage piloté (profondeur à 100 %).
export function curveAxisLabel(target, y) {
  const v = curveValue({ ...curveEd.draft, depth: 1 }, y);
  if (target === 'lp' || target === 'hp') return fmtHz(v);
  if (target === 'pan') return Math.abs(v) < 0.02 ? 'C' : v < 0 ? `${t('fmt.left')}${Math.round(-v * 100)}` : `${t('fmt.right')}${Math.round(v * 100)}`;
  return `${Math.round(v * 100)}%`;
}

// ---- Éditeur graphique ----
export const CV_PAD = { l: 46, r: 10, t: 10, b: 20 };
export function curveGeom() {
  const cv = $('#curve-canvas');
  const w = cv.clientWidth, h = cv.clientHeight;
  return { cv, w, h, x: u => CV_PAD.l + u * (w - CV_PAD.l - CV_PAD.r), y: v => CV_PAD.t + (1 - v) * (h - CV_PAD.t - CV_PAD.b),
    u: px => (px - CV_PAD.l) / (w - CV_PAD.l - CV_PAD.r), v: py => 1 - (py - CV_PAD.t) / (h - CV_PAD.t - CV_PAD.b) };
}
// Poignées de courbure : au milieu de chaque segment (boucle comprise).
export function curveHandles(d) {
  const pts = d.points;
  return pts.map((a, i) => {
    const b = pts[i + 1] ?? { ...pts[0], x: pts[0].x + 1 };
    let mid = (a.x + b.x) / 2;
    const y = curveAt(d, mid);
    if (mid >= 1) mid -= 1;
    return { i, x: mid, y, hold: a.hold, rising: b.y > a.y };
  });
}

export function renderCurveCanvas() {
  const cv = $('#curve-canvas');
  if (!cv?.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const g = curveGeom();
  if (cv.width !== Math.round(g.w * dpr) || cv.height !== Math.round(g.h * dpr)) { cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const d = curveEd.draft;
  const col = CURVE_COLORS[d.target];
  c.fillStyle = '#111214';
  c.fillRect(0, 0, g.w, g.h);
  // Grille : divisions, temps (plus marqués), valeurs.
  const div = curveEd.grid;
  c.font = '10px system-ui, sans-serif';
  c.textBaseline = 'middle';
  if (div) {
    const n = d.beats * div;
    for (let k = 0; k <= n; k++) {
      c.strokeStyle = k % div === 0 ? '#3a3d45' : '#22242a';
      c.beginPath(); c.moveTo(g.x(k / n) + 0.5, g.y(1)); c.lineTo(g.x(k / n) + 0.5, g.y(0)); c.stroke();
    }
  }
  c.fillStyle = '#8b8d94';
  c.textAlign = 'center';
  for (let k = 0; k < d.beats; k++) {
    c.strokeStyle = '#4a4e57';
    c.beginPath(); c.moveTo(g.x(k / d.beats) + 0.5, g.y(1)); c.lineTo(g.x(k / d.beats) + 0.5, g.y(0)); c.stroke();
    c.fillText(String(k + 1), g.x((k + 0.04) / d.beats), g.h - 9);
  }
  c.textAlign = 'right';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    c.strokeStyle = '#26282e';
    c.beginPath(); c.moveTo(g.x(0), g.y(v) + 0.5); c.lineTo(g.x(1), g.y(v) + 0.5); c.stroke();
    c.fillText(curveAxisLabel(d.target, v), CV_PAD.l - 6, g.y(v));
  }
  // La courbe (remplie) et ce que la profondeur en garde (pointillés).
  const N = Math.max(200, Math.round(g.w));
  const pathAt = fn => { c.beginPath(); for (let i = 0; i <= N; i++) { const u = i / N; const px = g.x(u), py = g.y(fn(Math.min(0.99999, u))); if (i) c.lineTo(px, py); else c.moveTo(px, py); } };
  pathAt(u => curveAt(d, u));
  c.lineTo(g.x(1), g.y(0)); c.lineTo(g.x(0), g.y(0)); c.closePath();
  c.fillStyle = col + '30';
  c.fill();
  pathAt(u => curveAt(d, u));
  c.strokeStyle = col;
  c.lineWidth = 2;
  c.stroke();
  if (d.depth < 0.99) {
    const n = { vol: 1, lp: 1, hp: 0, pan: 0.5, drive: 0, rev: 0, dly: 0 }[d.target];
    pathAt(u => n + (curveAt(d, u) - n) * d.depth);
    c.setLineDash([4, 4]); c.lineWidth = 1; c.strokeStyle = '#e8e8ea99'; c.stroke(); c.setLineDash([]);
  }
  c.lineWidth = 1;
  // Poignées de courbure (losanges ; carré = palier) puis points.
  for (const hd of curveHandles(d)) {
    const px = g.x(hd.x), py = g.y(hd.y);
    c.fillStyle = '#e8e8ea';
    c.beginPath();
    if (hd.hold) c.rect(px - 3, py - 3, 6, 6);
    else { c.moveTo(px, py - 4); c.lineTo(px + 4, py); c.lineTo(px, py + 4); c.lineTo(px - 4, py); c.closePath(); }
    c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
  }
  d.points.forEach((p, i) => {
    c.beginPath();
    c.arc(g.x(p.x), g.y(p.y), i === curveEd.sel ? 6 : 5, 0, Math.PI * 2);
    c.fillStyle = i === curveEd.sel ? '#fff' : col;
    c.fill();
    c.strokeStyle = '#111214';
    c.lineWidth = 2;
    c.stroke();
    c.lineWidth = 1;
  });
  // Tête de lecture de l'écoute.
  if (curvePrev) {
    const bd = 60 / state.bpm;
    const u = (((engine.ctx.currentTime - curvePrev.t0) / bd) / d.beats) % 1;
    if (u >= 0) {
      c.strokeStyle = '#ff5a36';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(g.x(u), g.y(1)); c.lineTo(g.x(u), g.y(0)); c.stroke();
      c.lineWidth = 1;
    }
  }
}

export function bindCurveCanvas() {
  const cv = $('#curve-canvas');
  const hit = e => {
    const r = cv.getBoundingClientRect();
    const g = curveGeom();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const d = curveEd.draft;
    const pi = d.points.findIndex(p => Math.hypot(g.x(p.x) - px, g.y(p.y) - py) <= 8);
    const hd = pi < 0 ? curveHandles(d).find(h => Math.hypot(g.x(h.x) - px, g.y(h.y) - py) <= 7) : null;
    return { g, px, py, pi, hd };
  };
  const snap = (u, free) => {
    const n = curveEd.draft.beats * curveEd.grid;
    return Math.min(1, Math.max(0, free || !n ? u : Math.round(u * n) / n));
  };
  const remove = i => {
    const d = curveEd.draft;
    if (d.points.length <= 1) return;
    d.points.splice(i, 1);
    curveEd.sel = -1;
    curveChanged();
  };
  // Une forme de départ (ou une nouvelle courbe) se retouche comme brouillon ; la tienne, directement.
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const { g, px, py, pi, hd } = hit(e);
    const d = curveEd.draft;
    if (hd) {
      // Courbure : le losange suit la souris (vers le haut = le milieu du segment monte).
      const a = d.points[hd.i];
      if (a.hold) return;
      const c0 = a.c, y0 = e.clientY;
      const move = ev => { a.c = Math.max(-1, Math.min(1, c0 + ((y0 - ev.clientY) / 70) * (hd.rising ? -1 : 1))); curveChanged(); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    let i = pi;
    if (i < 0) {   // nouveau point
      const p = { x: snap(g.u(px), e.shiftKey), y: Math.max(0, Math.min(1, g.v(py))), c: 0, hold: false };
      d.points.push(p);
      d.points.sort((a, b) => a.x - b.x);
      i = d.points.indexOf(p);
      curveChanged();
    }
    curveEd.sel = i;
    const p = d.points[i];
    const move = ev => {
      const r = cv.getBoundingClientRect();
      const prev = d.points[d.points.indexOf(p) - 1], next = d.points[d.points.indexOf(p) + 1];
      p.x = Math.max(prev ? prev.x + 0.002 : 0, Math.min(next ? next.x - 0.002 : 1, snap(g.u(ev.clientX - r.left), ev.shiftKey)));
      p.y = Math.max(0, Math.min(1, g.v(ev.clientY - r.top)));
      curveChanged();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    renderCurveCanvas();
  });
  cv.addEventListener('dblclick', e => {
    const { pi, hd } = hit(e);
    if (pi >= 0) remove(pi);
    else if (hd) { const a = curveEd.draft.points[hd.i]; a.hold = !a.hold; curveChanged(); }
  });
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { pi } = hit(e);
    if (pi >= 0) remove(pi);
  });
  cv.addEventListener('pointermove', e => {
    const { pi, hd } = hit(e);
    cv.style.cursor = pi >= 0 ? 'grab' : hd ? 'ns-resize' : 'crosshair';
  });
}

// Petit tracé de la courbe dans un bloc de la timeline (en temps : une boucle tous les `beats`).
export function curveSvg(c, len) {
  const reps = Math.ceil(len / c.beats);
  if (reps > 256) return null;
  const per = Math.max(6, Math.min(24, Math.round(600 / reps)));
  const pts = [];
  for (let r = 0; r < reps; r++) for (let k = 0; k <= per; k++) {
    const u = k / per;
    const x = (r + u) * c.beats;
    if (x > len) break;
    pts.push(`${x.toFixed(3)},${(1 - curveAt(c, Math.min(0.99999, u))).toFixed(3)}`);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${len} 1`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('tl-fx-curve');
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  return svg;
}
