// Annuler / rétablir dans la timeline.
import { DECK_IDS } from '../decks.js';
import { History } from '../history.js';
import { t } from '../i18n.js';
import { defaultPositions } from '../params.js';
import * as store from '../storage.js';
import { cleanBus, cleanTrack } from '../timeline.js';
import { renderAcid } from './acid-ui.js';
import { renderBuses } from './buses-ui.js';
import { $, engine, padKey, provide, state, timeline, tlHistory } from './core.js';
import { renderLibrary } from './library-ui.js';
import { cleanMarkers } from './markers.js';
import { renderAll, toast } from './misc.js';
import { save } from './save.js';
import { renderScenes } from './scenes.js';
import { loadBank, loadPads, padsInUse } from './sounds.js';
import { loadTlBuffers, renderTl, tlRec } from './tl.js';
import { tlSelect } from './tl-select.js';
import { renderTr } from './tr909-ui.js';

// ---------- Annuler / rétablir (timeline) ----------

// Instantané de la timeline : pistes (muets et blocs) et longueur. La position de lecture n'en fait pas partie.
// Instantané de ce qu'« Annuler » ramène : la timeline (pistes, blocs, longueur, marqueurs, bus), les pads (son, nom,
// couleur : pas la position de leurs potentiomètres), les patterns de la TR-909 et de la TB-303, les scènes.
// Les réglages tournés en continu (potentiomètres, faders) n'en font pas partie : chaque cran serait une étape.
const padSnap = p => p && { name: p.name, color: p.color, sampleId: p.sampleId, bpm: p.bpm ?? 0 };
export const tlSnapshot = () => JSON.stringify({
  bars: state.tl.bars, tracks: state.tl.tracks, markers: state.tl.markers, buses: state.tl.buses,
  pads: state.banks.map(b => b.map(padSnap)), tr: state.tr.patterns, acid: state.acid.patterns, scenes: state.scenes,
});

// Pads de l'instantané : un pad dont le son n'a pas changé garde ses potentiomètres ; les autres sont recréés.
function restorePads(snap) {
  if (!Array.isArray(snap)) return;
  snap.forEach((bank, b) => bank.forEach((sp, i) => {
    const cur = state.banks[b]?.[i];
    if (!sp) {
      if (cur) { engine.stopPad(padKey(b, i)); state.banks[b][i] = null; }
    } else if (cur && cur.sampleId === sp.sampleId) {
      Object.assign(cur, { name: sp.name, color: sp.color, bpm: sp.bpm });
    } else {
      if (cur) engine.stopPad(padKey(b, i));
      state.banks[b][i] = { ...sp, p: cur?.p ? { ...cur.p } : defaultPositions('pad'), buffer: null };
    }
  }));
  loadBank(state.bank).then(renderAll);
  loadPads(padsInUse());
}

export function initHistory() {
  provide({ tlHistory: new History(tlSnapshot, snap => {
    const s = JSON.parse(snap);
    state.tl.bars = s.bars;
    state.tl.tracks = s.tracks.map(cleanTrack);
    state.tl.markers = cleanMarkers(s.markers);
    if (s.buses) state.tl.buses = s.buses.map(cleanBus);
    restorePads(s.pads);
    if (s.tr) { state.tr.patterns = s.tr; renderTr(); }
    if (s.acid) { state.acid.patterns = s.acid; renderAcid(); }
    if (s.scenes) { state.scenes = s.scenes; renderScenes(); }
    renderAll();
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
// Enregistrements (« rec: ») et sons importés (« user: ») qui ne servent plus nulle part (pads, timeline, platines,
// bibliothèque) : effacés au démarrage, pas à la suppression (« Annuler » doit pouvoir les ramener).
export async function cleanRecordings() {
  const used = new Set([...state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)), ...state.banks.flat().map(p => p?.sampleId),
    ...DECK_IDS.map(id => state.decks[id].sampleId), ...state.userSounds.map(u => u.sampleId)]);
  const ids = await store.listSampleIds().catch(() => []);
  for (const id of ids) if (typeof id === 'string' && /^(rec|user):/.test(id) && !used.has(id)) store.deleteSample(id).catch(() => {});
}
