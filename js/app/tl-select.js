// Timeline : sélection multiple, glisser, lasso, copier / coller, raccourcis.
import { t } from '../i18n.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { splitAtPlayhead } from './clip-menu.js';
import { $, state, timeline, wm } from './core.js';
import { libSelected, renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { openRoll } from './roll-ui.js';
import { save } from './save.js';
import { beatPx, growSong, renderTl, setTlSel, snapBeat, tlPlaceItem, tlTarget } from './tl.js';
import { tlTap } from './tl-listen.js';
import { tlPlaceFx } from './trackfx-ui.js';

// ---------- Sélection multiple et copier / coller (timeline) ----------

// Blocs sélectionnés : blocs de son / de notes et blocs d'effet (objets de state.tl.tracks[i].clips / .fx).
export const tlPicked = new Set();
export let tlClipboard = null;       // { items: [{ kind, track, obj }], span } ; départs relatifs au premier bloc
export let tlFocus = false;          // le dernier clic était dans la timeline (ou la bibliothèque) : les raccourcis sont pour elle
export const isFxBlock = o => typeof o?.fx === 'string';
export const tlList = (obj, track) => state.tl.tracks[track][isFxBlock(obj) ? 'fx' : 'clips'];
export const blockLen = obj => (isFxBlock(obj) ? obj.len : timeline.clipBeats(obj));

// Sélectionne un seul bloc (ou rien).
export function tlSelect(track, obj) {
  tlPicked.clear();
  if (obj) tlPicked.add(obj);
  setTlSel(obj ? (isFxBlock(obj) ? { track, fx: obj } : { track, clip: obj }) : null);
}

// Blocs sélectionnés avec leur piste (ceux qui ont disparu, après « Annuler » par exemple, sont oubliés).
export function tlItems() {
  const out = [];
  state.tl.tracks.forEach((tr, track) => {
    for (const obj of tr.clips) if (tlPicked.has(obj)) out.push({ obj, track });
    for (const obj of tr.fx) if (tlPicked.has(obj)) out.push({ obj, track });
  });
  tlPicked.clear();
  for (const it of out) tlPicked.add(it.obj);
  return out;
}

export const cloneBlock = obj => ({ ...structuredClone(obj), id: crypto.randomUUID() });

// Glisser un bloc : tous les blocs sélectionnés bougent ensemble (Alt = copie) ; Ctrl + clic = ajouter / retirer.
export function tlGroupDown(e, obj, track) {
  if (e.ctrlKey || e.metaKey) {
    if (tlPicked.has(obj)) tlPicked.delete(obj); else tlPicked.add(obj);
    renderTl();
    return;
  }
  if (!tlPicked.has(obj)) tlSelect(track, obj);
  let items = tlItems();
  let lead = obj;
  if (e.altKey) {
    const copies = items.map(it => ({ obj: cloneBlock(it.obj), track: it.track, from: it.obj }));
    for (const c of copies) tlList(c.obj, c.track).push(c.obj);
    lead = copies.find(c => c.from === obj).obj;
    items = copies;
    tlPicked.clear();
    for (const c of copies) tlPicked.add(c.obj);
  }
  const orig = items.map(it => ({ obj: it.obj, start: it.obj.start, track: it.track, cur: it.track }));
  const o = orig.find(x => x.obj === lead);
  const minStart = Math.min(...orig.map(x => x.start));
  const minTrack = Math.min(...orig.map(x => x.track));
  const maxTrack = Math.max(...orig.map(x => x.track));
  const startX = e.clientX;
  let moved = e.altKey;
  const onMove = ev => {
    const dx = (ev.clientX - startX) / beatPx();
    const delta = Math.max(-minStart, Math.max(0, snapBeat(o.start + dx, ev.shiftKey)) - o.start);
    const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
    const dTrack = Math.max(-minTrack, Math.min(state.tl.tracks.length - 1 - maxTrack, (lane ? +lane.dataset.track : o.cur) - o.track));
    if (orig.every(x => x.obj.start === x.start + delta && x.cur === x.track + dTrack)) return;
    for (const x of orig) {
      x.obj.start = x.start + delta;
      const to = x.track + dTrack;
      if (to !== x.cur) {
        const from = tlList(x.obj, x.cur);
        from.splice(from.indexOf(x.obj), 1);
        tlList(x.obj, to).push(x.obj);
        x.cur = to;
      }
    }
    setTlSel(isFxBlock(lead) ? { track: o.cur, fx: lead } : { track: o.cur, clip: lead });
    moved = true;
    renderTl();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) { for (const x of orig) growSong({ start: x.obj.start, len: blockLen(x.obj) }); save(); }
    else if (!isFxBlock(lead) && lead.type === 'note' && wm.isOpen('roll') && state.roll.clip !== lead.id) openRoll(lead, false);
    renderTl();
    if (!moved && !e.altKey) tlTap(o.cur, lead);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// Case vide : un clic pose le dernier son choisi (ou vide la sélection) ; glisser = sélection au lasso
// (Maj / Ctrl : ajoutée à la sélection).
export function tlLaneDown(e) {
  const x0 = e.clientX, y0 = e.clientY;
  const keep = e.shiftKey || e.ctrlKey || e.metaKey ? new Set(tlPicked) : new Set();
  const grid = $('#tl-grid');
  let band = null;
  const onMove = ev => {
    if (!band && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!band) { band = document.createElement('div'); band.className = 'tl-band'; grid.appendChild(band); }
    const g = grid.getBoundingClientRect();
    const r = { left: Math.min(x0, ev.clientX), right: Math.max(x0, ev.clientX), top: Math.min(y0, ev.clientY), bottom: Math.max(y0, ev.clientY) };
    Object.assign(band.style, { left: `${r.left - g.left}px`, top: `${r.top - g.top}px`, width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px` });
    tlPicked.clear();
    for (const o of keep) tlPicked.add(o);
    for (const el of grid.querySelectorAll('.tl-clip, .tl-fx')) {
      const b = el.getBoundingClientRect();
      const hit = b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
      el.classList.toggle('selected', hit || keep.has(el._obj));
      if (hit) tlPicked.add(el._obj);
    }
  };
  const onUp = ev => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (band) { band.remove(); renderTl(); return; }
    if (tlPicked.size && !libSelected) { tlSelect(null, null); renderTl(); return; }
    if (!libSelected) { toast(t('tl.noItem'), 3000); return; }
    const target = tlTarget(ev);
    if (target) (libSelected.kind === 'fx' ? tlPlaceFx : tlPlaceItem)(libSelected, target.track, target.beat);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// Durée d'un groupe de blocs, arrondie à la mesure : pas du collage à la suite.
export function tlSpan(items) {
  const s = Math.min(...items.map(it => it.obj.start));
  const e = Math.max(...items.map(it => it.obj.start + blockLen(it.obj)));
  return { start: s, span: Math.max(BEATS_PER_BAR, Math.ceil((e - s) / BEATS_PER_BAR - 1e-6) * BEATS_PER_BAR) };
}

export function tlCopy() {
  const items = tlItems();
  if (!items.length) return false;
  const { start, span } = tlSpan(items);
  tlClipboard = { span, items: items.map(it => ({ track: it.track, obj: { ...structuredClone(it.obj), start: it.obj.start - start } })) };
  toast(t('tl.copied', { n: items.length }));
  return true;
}

// Colle à la tête de lecture, sur les mêmes pistes ; la tête de lecture passe à la fin du collage.
export function tlPaste(at = state.tl.playhead) {
  if (!tlClipboard) return;
  tlPicked.clear();
  for (const it of tlClipboard.items) {
    const obj = { ...cloneBlock(it.obj), start: at + it.obj.start };
    tlList(obj, it.track).push(obj);
    tlPicked.add(obj);
    growSong({ start: obj.start, len: blockLen(obj) });
  }
  state.tl.playhead = at + tlClipboard.span;
  renderTl();
  save();
}

export function tlDuplicate() {
  const items = tlItems();
  if (!items.length) return;
  const { start, span } = tlSpan(items);
  tlPicked.clear();
  for (const it of items) {
    const obj = { ...cloneBlock(it.obj), start: it.obj.start + span };
    tlList(obj, it.track).push(obj);
    tlPicked.add(obj);
    growSong({ start: obj.start, len: blockLen(obj) });
  }
  state.tl.playhead = start + span * 2;
  renderTl();
  save();
}

export function tlDeletePicked() {
  const items = tlItems();
  if (!items.length) return;
  for (const it of items) { const l = tlList(it.obj, it.track); l.splice(l.indexOf(it.obj), 1); }
  if (items.some(it => it.obj.sampleId?.startsWith('rec:'))) renderLibrary();
  tlSelect(null, null);
  renderTl();
  save();
}

export function tlSelectAll() {
  tlPicked.clear();
  for (const tr of state.tl.tracks) { for (const c of tr.clips) tlPicked.add(c); for (const b of tr.fx) tlPicked.add(b); }
  renderTl();
}

// Raccourcis de la timeline (quand le dernier clic était dedans).
export function tlKey(e) {
  if (!tlFocus || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === 'Delete' || e.key === 'Backspace') { if (tlPicked.size) { e.preventDefault(); tlDeletePicked(); } return; }
  if (e.key === 'Escape') { tlSelect(null, null); renderTl(); return; }
  if (!ctrl || e.altKey) return;
  if (k === 'a') { e.preventDefault(); tlSelectAll(); }
  else if (k === 'c') { e.preventDefault(); tlCopy(); }
  else if (k === 'x') { e.preventDefault(); if (tlCopy()) tlDeletePicked(); }
  else if (k === 'v') { e.preventDefault(); tlPaste(); }
  else if (k === 'd') { e.preventDefault(); tlDuplicate(); }
  else if (k === 'e') { e.preventDefault(); splitAtPlayhead(); }   // couper à la tête de lecture
}

// Variables modifiées depuis d'autres modules.
export function setTlFocus(v) { return (tlFocus = v); }
