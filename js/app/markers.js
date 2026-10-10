// Marqueurs de la timeline : des repères nommés (intro, montée, drop…) sous les numéros de mesure.
// Clic = la tête de lecture y va ; glisser = déplacer (à la mesure, Maj = au temps) ; double-clic = renommer ;
// clic droit = supprimer. « + Marqueur » (coin de la règle) ou double-clic dans la règle = nouveau marqueur.
// Alt+← / Alt+→ : marqueur précédent / suivant.
import { t } from '../i18n.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, state, timeline } from './core.js';
import { save } from './save.js';
import { TL_HEAD, beatPx, tlRec } from './tl.js';
import { tlFocus } from './tl-select.js';

export const MAX_MARKERS = 64;
const markers = () => state.tl.markers;

/** Marqueurs valides d'une sauvegarde ou d'un fichier, triés. */
export function cleanMarkers(list) {
  return (Array.isArray(list) ? list : [])
    .filter(m => Number.isFinite(m?.beat) && m.beat >= 0)
    .slice(0, MAX_MARKERS)
    .map(m => ({ id: typeof m.id === 'string' ? m.id : crypto.randomUUID(), beat: +m.beat, name: String(m.name ?? '').slice(0, 32) }))
    .sort((a, b) => a.beat - b.beat);
}

// La tête de lecture va au temps `beat` (la lecture repart de là si elle tournait).
export function seek(beat) {
  state.tl.playhead = Math.max(0, Math.min(timeline.length - 1, beat));
  if (timeline.playing && !tlRec) timeline.play(state.tl.playhead);
  save();
  renderMarkers();
}

export function addMarker(beat, name) {
  if (markers().length >= MAX_MARKERS) return null;
  const at = Math.max(0, beat);
  const exist = markers().find(m => Math.abs(m.beat - at) < 1e-6);
  if (exist) return exist;
  const m = { id: crypto.randomUUID(), beat: at, name: name ?? t('mk.default', { n: markers().length + 1 }) };
  markers().push(m);
  markers().sort((a, b) => a.beat - b.beat);
  save();
  renderMarkers();
  return m;
}

export function removeMarker(m) {
  const i = markers().indexOf(m);
  if (i >= 0) markers().splice(i, 1);
  save();
  renderMarkers();
}

// Marqueur précédent / suivant par rapport à la tête de lecture.
export function jumpMarker(dir) {
  const pos = timeline.playing ? timeline.position() : state.tl.playhead;
  const list = markers();
  const m = dir > 0 ? list.find(x => x.beat > pos + 0.01) : [...list].reverse().find(x => x.beat < pos - 0.5);
  if (m) seek(m.beat);
  return m ?? null;
}

function rename(m, label) {
  const input = document.createElement('input');
  input.className = 'tl-marker-edit';
  input.value = m.name;
  input.maxLength = 32;
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = ok => {
    if (done) return;
    done = true;
    if (ok) m.name = input.value.trim().slice(0, 32) || m.name;
    save();
    renderMarkers();
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', e => e.stopPropagation());
}

export function buildMarkers() {
  const ruler = $('#tl-ruler');
  // Double-clic dans la règle : un marqueur à cette mesure.
  ruler.addEventListener('dblclick', e => {
    if (e.target.closest('.tl-marker')) return;
    const r = ruler.getBoundingClientRect();
    addMarker(Math.floor((e.clientX - r.left) / beatPx() / BEATS_PER_BAR) * BEATS_PER_BAR);
  });
  const add = document.createElement('button');
  add.id = 'tl-marker-add';
  add.dataset.icon = 'plus';
  add.textContent = t('mk.add');
  add.title = t('mk.addTitle');
  add.addEventListener('click', () => {
    const pos = timeline.playing ? timeline.position() : state.tl.playhead;
    addMarker(Math.floor(pos / BEATS_PER_BAR) * BEATS_PER_BAR);
  });
  $('#tl-grid .tl-corner').appendChild(add);
  window.addEventListener('keydown', e => {
    if (!tlFocus || !e.altKey || e.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); jumpMarker(e.key === 'ArrowRight' ? 1 : -1); }
  });
  renderMarkers();
}

export function renderMarkers() {
  const ruler = $('#tl-ruler'), grid = $('#tl-grid');
  if (!ruler) return;
  for (const el of grid.querySelectorAll('.tl-marker, .tl-mline')) el.remove();
  const bp = beatPx();
  for (const m of markers()) {
    const el = document.createElement('div');
    el.className = 'tl-marker';
    el.style.left = `${m.beat * bp}px`;
    el.title = t('mk.title');
    const label = document.createElement('span');
    label.textContent = m.name;
    el.appendChild(label);
    el._obj = m;
    el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); removeMarker(m); });
    el.addEventListener('dblclick', e => { e.stopPropagation(); rename(m, label); });
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const x0 = e.clientX, b0 = m.beat;
      let moved = false;
      const onMove = ev => {
        const d = (ev.clientX - x0) / bp;
        if (!moved && Math.abs(ev.clientX - x0) < 4) return;
        moved = true;
        const raw = Math.max(0, b0 + d);
        m.beat = ev.shiftKey ? Math.round(raw) : Math.round(raw / BEATS_PER_BAR) * BEATS_PER_BAR;
        el.style.left = `${m.beat * bp}px`;
        line.style.left = `${TL_HEAD + m.beat * bp}px`;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (moved) { markers().sort((a, b) => a.beat - b.beat); save(); renderMarkers(); } else seek(m.beat);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    ruler.appendChild(el);
    // Trait fin sur toute la hauteur des pistes.
    const line = document.createElement('div');
    line.className = 'tl-mline';
    line.style.left = `${TL_HEAD + m.beat * bp}px`;
    grid.appendChild(line);
  }
}
