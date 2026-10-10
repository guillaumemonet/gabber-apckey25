// Annuler / rétablir dans la timeline.
import { DECK_IDS } from '../decks.js';
import { History } from '../history.js';
import { t } from '../i18n.js';
import * as store from '../storage.js';
import { cleanTrack } from '../timeline.js';
import { $, provide, state, timeline, tlHistory } from './core.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { loadTlBuffers, renderTl, tlRec } from './tl.js';
import { renderBuses } from './buses-ui.js';
import { cleanMarkers } from './markers.js';
import { tlSelect } from './tl-select.js';

// ---------- Annuler / rétablir (timeline) ----------

// Instantané de la timeline : pistes (muets et blocs) et longueur. La position de lecture n'en fait pas partie.
export const tlSnapshot = () => JSON.stringify({ bars: state.tl.bars, tracks: state.tl.tracks, markers: state.tl.markers });

export function initHistory() {
  provide({ tlHistory: new History(tlSnapshot, snap => {
    const s = JSON.parse(snap);
    state.tl.bars = s.bars;
    state.tl.tracks = s.tracks.map(cleanTrack);
    state.tl.markers = cleanMarkers(s.markers);
    timeline.updateAllTracks();
    renderBuses();
    tlSelect(null, null);
    loadTlBuffers().then(renderTl);
    renderTl();
    renderLibrary();
    save();
  }) });
  tlHistory.onChange = renderUndo;
  $('#tl-undo').addEventListener('click', tlUndo);
  $('#tl-redo').addEventListener('click', tlRedo);
  // Ctrl+Z = annuler, Ctrl+Maj+Z ou Ctrl+Y = rétablir (sauf dans un champ de texte, qui garde les siens).
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); tlUndo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); tlRedo(); }
  });
  renderUndo();
}

export function tlUndo() {
  if (tlRec) return;   // pas pendant un enregistrement
  if (tlHistory.undo()) toast(t('tl.undone'));
}

export function tlRedo() {
  if (tlRec) return;
  if (tlHistory.redo()) toast(t('tl.redone'));
}

export function renderUndo() {
  $('#tl-undo').disabled = !tlHistory?.canUndo;
  $('#tl-redo').disabled = !tlHistory?.canRedo;
}

// Enregistrements (sons « rec: ») qui ne servent plus à aucun bloc ni pad : effacés au démarrage.
// (Pas à la suppression d'un bloc : « Annuler » doit pouvoir le faire revenir.)
export async function cleanRecordings() {
  const used = new Set([...state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)), ...state.banks.flat().map(p => p?.sampleId), ...DECK_IDS.map(id => state.decks[id].sampleId)]);
  const ids = await store.listSampleIds().catch(() => []);
  for (const id of ids) if (typeof id === 'string' && id.startsWith('rec:') && !used.has(id)) store.deleteSample(id).catch(() => {});
}
