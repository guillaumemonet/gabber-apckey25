// Effets de piste de la timeline : blocs d’effet et leur éditeur.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { SHAPES } from '../tr909.js';
import { FX_BANK, FX_FAMILY_COLORS, FX_TYPES as TFX_TYPES, bankName, fxDefaults } from '../trackfx.js';
import { state, uiColor } from './core.js';
import { curveById, curveItems, curveName, curveSvg, openCurve } from './curve-ui.js';
import { save } from './save.js';
import { beatPx, growSong, renderTl, renderTrackHeads, setTlSel, snapBeat, tlSel } from './tl.js';
import { tlGroupDown, tlPicked, tlSelect } from './tl-select.js';

// ---------- Effets de piste (timeline) ----------

export const FX_ROW = 16;            // hauteur d'une ligne d'effets (px)
export const fxColor = b => PALETTE[uiColor(FX_FAMILY_COLORS[TFX_TYPES[b.fx]?.family] ?? 49)];

// Éléments de la banque d'effets, pour la bibliothèque.
export const fxItems = () => [...FX_BANK.map(b => ({ kind: 'fx', sampleId: `fx:${b.id}`, name: bankName(b), cat: TFX_TYPES[b.fx].family, fx: b.fx, p: b.p ?? {}, len: b.len, family: TFX_TYPES[b.fx].family })), ...curveItems()];
export const FX_FAMILIES = [...new Set([...FX_BANK.map(b => TFX_TYPES[b.fx].family), 'curve'])];

export function tlPlaceFx(item, track, beat) {
  const block = { id: crypto.randomUUID(), fx: item.fx, start: beat, len: item.len, p: { ...fxDefaults(item.fx), ...item.p }, name: item.name };
  state.tl.tracks[track].fx.push(block);
  growSong(block);
  tlSelect(track, block);
  renderTl();
  save();
}

export function tlDeleteFx(track, block) {
  const list = state.tl.tracks[track].fx;
  list.splice(list.indexOf(block), 1);
  if (tlSel?.fx === block) setTlSel(null);
  tlPicked.delete(block);
  closeFxEditor();
  renderTl();
  save();
}

// Lignes d'effets d'une piste : les blocs qui se chevauchent s'empilent.
export function fxRows(blocks) {
  const ends = [];
  const rows = new Map();
  for (const b of [...blocks].sort((a, c) => a.start - c.start)) {
    let r = ends.findIndex(e => e <= b.start + 1e-6);
    if (r < 0) { r = ends.length; ends.push(0); }
    ends[r] = b.start + b.len;
    rows.set(b, r);
  }
  return { rows, count: Math.max(1, ends.length) };
}

export function fxEl(track, block, row) {
  const bp = beatPx();
  const el = document.createElement('div');
  el.className = 'tl-fx' + (tlPicked.has(block) ? ' selected' : '');
  el._obj = block;
  el.style.left = `${block.start * bp}px`;
  el.style.width = `${Math.max(6, block.len * bp - 1)}px`;
  el.style.top = `${row * FX_ROW + 1}px`;
  el.style.setProperty('--c', fxColor(block));
  const isCurve = block.fx === 'curve';
  const name = isCurve ? curveName(block.p.curve) : block.name;
  el.title = `${name} — ${t(isCurve ? 'curve.clipTitle' : 'tfx.clipTitle')}`;
  const label = document.createElement('span');
  label.textContent = name;
  const grip = document.createElement('div');
  grip.className = 'tl-grip';
  const c = isCurve && curveById(block.p.curve);
  const svg = c && curveSvg(c, block.len);
  if (svg) el.appendChild(svg);
  el.append(label, grip);
  el.addEventListener('contextmenu', e => { e.preventDefault(); tlDeleteFx(track, block); });
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const resizing = e.target === grip;
    if (!resizing) { tlGroupDown(e, block, track); return; }
    let target = block;
    let where = track;
    if (e.altKey && !resizing) {
      target = { ...block, id: crypto.randomUUID(), p: { ...block.p } };
      state.tl.tracks[track].fx.push(target);
    }
    tlSelect(where, target);
    const startX = e.clientX;
    const origStart = target.start;
    const origLen = target.len;
    let moved = target !== block;
    const onMove = ev => {
      const dx = (ev.clientX - startX) / beatPx();
      if (resizing) {
        const len = Math.max(1, ev.shiftKey ? Math.round(origLen + dx) : Math.max(1, Math.round((origLen + dx) / BEATS_PER_BAR) * BEATS_PER_BAR || 1));
        if (len === target.len) return;
        target.len = len;
      } else {
        const start = Math.max(0, snapBeat(origStart + dx, ev.shiftKey));
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
        const to = lane ? +lane.dataset.track : where;
        if (start === target.start && to === where) return;
        target.start = start;
        if (to !== where) {
          const from = state.tl.tracks[where].fx;
          from.splice(from.indexOf(target), 1);
          state.tl.tracks[to].fx.push(target);
          where = to;
          tlSelect(where, target);
        }
      }
      moved = true;
      renderTl();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) { growSong(target); save(); }
      renderTl();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  return el;
}

// Réglages d'un bloc d'effet (double-clic) : petite fenêtre posée sous le bloc.
export function openFxEditor(track, block, anchor) {
  if (block.fx === 'curve') { openCurve(block.p.curve, { track, block }); return; }
  openParamEditor({ title: block.name, color: fxColor(block), params: TFX_TYPES[block.fx].params, values: block.p, anchor, onEnd: save });
}

// Petite fenêtre de réglages posée sous un élément : listes et curseurs d'après la description des réglages.
export let fxEditing = null;
export function openParamEditor({ title, color, params, values, anchor, onInput = () => {}, onEnd = () => {} }) {
  closeFxEditor();
  const box = document.createElement('div');
  box.id = 'fx-editor';
  box.className = 'fx-editor';
  box.innerHTML = `<div class="fx-editor-head"><b></b><button class="win-close" title="${t('win.close')}">✕</button></div><div class="fx-editor-body"></div>`;
  box.querySelector('b').textContent = title;
  box.querySelector('b').style.color = color;
  box.querySelector('.win-close').addEventListener('click', closeFxEditor);
  const body = box.querySelector('.fx-editor-body');
  const list = Object.entries(params);
  if (!list.length) body.innerHTML = `<p class="hint">${t('tfx.noParams')}</p>`;
  for (const [k, [kind, , a, b, step]] of list) {
    const row = document.createElement('label');
    row.className = 'fx-param';
    const name = document.createElement('span');
    name.textContent = t(`tfxp.${k}`);
    row.appendChild(name);
    if (kind === 'select') {
      const sel = document.createElement('select');
      for (const v of a) sel.add(new Option(fxOptionLabel(k, v), v));
      sel.value = values[k];
      sel.addEventListener('change', () => { values[k] = typeof a[0] === 'number' ? +sel.value : sel.value; onInput(k); onEnd(); });
      row.appendChild(sel);
    } else {
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'range', min: a, max: b, step, value: values[k] });
      const val = document.createElement('em');
      const show = () => { val.textContent = fxValueLabel(k, values[k]); };
      inp.addEventListener('input', () => { values[k] = +inp.value; show(); onInput(k); });
      inp.addEventListener('change', onEnd);
      show();
      row.append(inp, val);
    }
    body.appendChild(row);
  }
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left))}px`;
  box.style.top = `${r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
  fxEditing = { box };
  setTimeout(() => window.addEventListener('pointerdown', fxOutside, true), 0);
}

export function fxOutside(e) { if (fxEditing && !fxEditing.box.contains(e.target)) closeFxEditor(); }
export function closeFxEditor() {
  window.removeEventListener('pointerdown', fxOutside, true);
  const track = fxEditing?.track;
  fxEditing?.box.remove();
  fxEditing = null;
  if (track !== undefined) renderTrackHeads();
}

export function fxOptionLabel(k, v) {
  if (k === 'pattern') return t(`pcf.${v}`);
  if (k === 'mode') return v.toUpperCase();
  if (k === 'div') return v === 6 ? '1/8 .' : v === 3 ? '1/4 T' : `1/${v}`;
  if (k === 'bars') return t('tfx.barsN', { n: v });
  if (k === 'dir') return t(`tfx.dir.${v}`);
  if (k === 'shape') return t('tr.shapes')[SHAPES.indexOf(v)] ?? v;
  if (k === 'lfo') return v ? t('box.lfoN', { n: v }) : t('box.off');
  return String(v);
}

export function fxValueLabel(k, v) {
  if (['to', 'lo', 'hi', 'freq', 'cutoff', 'tone'].includes(k)) return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`;
  if (k === 'threshold' || k === 'makeup') return `${v} dB`;
  if (k === 'ratio') return `${v}:1`;
  if (k === 'bits') return `${v} bits`;
  if (k === 'size') return `${v} s`;
  if (k === 'dec') return `${Math.round(v * 1000)} ms`;
  if (['radius', 'distance', 'height'].includes(k)) return `${v} m`;
  if (['reso', 'q'].includes(k)) return v.toFixed(1);
  return `${Math.round(v * 100)}%`;
}

// Variables modifiées depuis d'autres modules.
export function setFxEditing(v) { return (fxEditing = v); }
