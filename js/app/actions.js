// Actions communes à la souris et au contrôleur : pads, banques, pages, potentiomètres, quantification.
import { acidKnobDefs } from '../acid.js';
import { DECK_IDS, deckKnobDefs } from '../decks.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { mixKnobDefs } from '../mixer.js';
import { oscKnobDefs } from '../osc.js';
import { PAGES, toValue } from '../params.js';
import * as store from '../storage.js';
import { trKnobDefs } from '../tr909.js';
import { renderAcidKnobs } from './acid-ui.js';
import { renderLeds } from './controller.js';
import {
  acid, currentPad, decks, drum, engine, mixer, newPad, oscSynth, padKey, performer, pickerColors, playing, shiftHeld,
  sidechain, state, timeline
} from './core.js';
import { renderDecks } from './decks-ui.js';
import { kickKnobEls, renderKick } from './kick-ui.js';
import { flashKnob, renderKnobs, renderPages } from './knobs.js';
import { renderLibrary } from './library-ui.js';
import { renderAll, toast } from './misc.js';
import { masterDef, mixField, renderMixer, renderStrip } from './mixer-ui.js';
import { oscChanged } from './osc-ui.js';
import { renderEditor, renderEditorKnobs, renderPad, renderPads } from './pads.js';
import { PERF, heldRolls, perfActive, renderPerf } from './perf-fx.js';
import { acidPresets, synthTouched, trPresets } from './presets-bar.js';
import { save } from './save.js';
import { padCat } from './sidechain-ui.js';
import { renderSynthKnobs, synthKnobDefs } from './synth-ui.js';
import { ensureBuffer, tlRec, tlStopRec } from './tl.js';
import { stopTlPreview } from './tl-listen.js';
import { tlRecordPad } from './tl-record.js';
import { renderTr } from './tr909-ui.js';
import { applyVizKnobs, renderViz, vizKnobDefs } from './viz-ui.js';

// ---------- Actions (communes souris / contrôleur) ----------

export function triggerPad(i) {
  selectPad(i);
  const pad = state.banks[state.bank][i];
  const v = engine.playPad(padKey(state.bank, i), pad);
  if (pad?.buffer && padCat(pad) === 'kick' && engine.padMode(pad) !== 'loop') sidechain.kick(v?.startAt);
  if (v) tlRecordPad(state.bank, i, v.startAt);
}

// Pad en attente (départ ou arrêt calé sur la grille) : il clignote vite, à l'écran et sur l'APC.
export const padPending = key => { const v = engine.padVoices.get(key), now = engine.ctx.currentTime; return !!v && (v.startAt > now + 0.02 || v.stopAt > now); };
export let pendingTimer = null;
export function watchPending() {
  if (pendingTimer) return;
  pendingTimer = setInterval(() => {
    const any = [...engine.padVoices.keys()].some(padPending);
    renderLeds();
    if (!any) { clearInterval(pendingTimer); pendingTimer = null; renderPads(); }
  }, 70);
}

export function releasePad(i) {
  engine.releasePad(padKey(state.bank, i));
}

export function selectPad(i) {
  if (state.selected === i) return;
  state.selected = i;
  renderPads();
  renderEditor();
  if (kickKnobEls.length) renderKick();   // info-bulle « → Pad » du designer de kick
  if (state.page === 'pad') renderKnobs();
  renderLeds();
}

export function setBank(b) {
  state.bank = b;
  renderAll();
  save();
}

export function setPage(page) {
  state.page = page;
  renderPages();
  renderKnobs();
  renderLeds();
  save();
}

export function panic() {
  stopTlPreview();
  drum.stop();
  acid.stop();
  decks.stopAll();
  engine.stopAllPads();
  performer.allOff();
  engine.allNotesOff();
  oscSynth.allNotesOff();
  for (const i of [...perfActive]) { perfActive.delete(i); PERF[i].off?.(); }
  heldRolls.length = 0;
  engine.rollOff();
  renderPerf();
  renderTr();
  if (tlRec) tlStopRec(); else timeline.stop();
  renderLeds();
}

export function onPadState(key, isPlaying, mode) {
  if (isPlaying) playing.set(key, mode); else playing.delete(key);
  if (padPending(key)) watchPending();
  if (Math.floor(key / 40) !== state.bank) return;
  renderPad(key % 40);
  renderLeds();
}

// Potentiomètres d'une page (par défaut celle que pilotent les potentiomètres de l'APC) : définitions et objet qui stocke leurs positions.
export function knobDefs(page = state.page) {
  if (mixField(page)) {
    const defs = mixKnobDefs(mixField(page));
    return [...defs, ...new Array(7 - defs.length).fill(null), masterDef()];   // K8 = volume général
  }
  if (page === 'synth') return synthKnobDefs();
  if (page === 'acid') return acidKnobDefs();
  if (page === 'osc') return oscKnobDefs();
  if (page === 'viz') return vizKnobDefs();
  if (page === 'decks') return [...deckKnobDefs(), masterDef()];
  return page === 'tr' ? trKnobDefs(state.tr.sel) : PAGES[page].params;
}
export function knobTarget(def, page = state.page) {
  if (!def) return null;
  if (def.ch) return state.mix.channels[def.ch];
  if (mixField(page)) return state.globals;   // K8 = volume général
  if (page === 'pad') return currentPad()?.p;
  if (def.acid) return state.acid.params;
  if (def.osc) return state.osc.params;
  if (def.viz) return state.viz.k;
  if (def.deck) return def.deck === 'x' ? state.decks : state.decks[def.deck];
  if (page === 'tr') return def.group === 'global' ? state.tr.globals : state.tr.params[state.tr.sel];
  return state.globals;
}

// Tourne un potentiomètre : delta relatif (mk2, souris) ou position absolue (mk1).
export function turnKnob(index, { delta, value }, page = state.page) {
  const def = knobDefs(page)[index];
  const pad = currentPad();
  const target = knobTarget(def, page);
  if (!def || !target) return;

  if (value !== undefined) {
    target[def.id] = value;
  } else {
    const stepSize = def.steps ? Math.max(0.01, 1 / (def.steps - 1) / 3) : 0.01;
    target[def.id] = Math.min(1, Math.max(0, target[def.id] + delta * stepSize * (shiftHeld && !def.steps ? 0.25 : 1)));
  }

  if (def.ch) {
    mixer.update();
    renderStrip(def.ch);
  } else if (page === 'pad') {
    engine.updatePadVoice(padKey(state.bank, state.selected), pad);
    renderEditorKnobs();
    if (def.id === 'mode') { renderPad(state.selected); renderEditor(); }
  } else if (page === 'tr') {
    if (def.id === 'volume') drum.setVolume(target.volume);
  } else if (def.acid) {
    state.acid.sound = null;
    acid.update();
    renderAcidKnobs();
    acidPresets?.render();
  } else if (def.osc) {
    oscChanged();
  } else if (def.viz) {
    if (def.id === 'strobe' && target.strobe > 0) toast(t('viz.strobeWarn'), 5000);
    applyVizKnobs();
    renderViz();
  } else if (def.deck) {
    decks.update();
    renderDecks();
  } else {
    engine.set(def.id, toValue(def, target[def.id]));
    if (page === 'synth') synthTouched();
  }
  if (page === 'tr' && def.group === 'inst' && state.tr.kit !== null) { state.tr.kit = null; trPresets?.render(); }
  if (def.id === 'master') renderMixer();
  if (page === 'synth') renderSynthKnobs();
  flashKnob(page, index);
  save();
}

export async function loadFileIntoPad(file, i) {
  if (!file || !file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i.test(file.name)) return;
  const data = await file.arrayBuffer();
  let buffer;
  try {
    buffer = await engine.ctx.decodeAudioData(data.slice(0));
  } catch {
    alert(t('editor.unreadable', { name: file.name }));
    return;
  }
  const old = state.banks[state.bank][i];
  if (old?.sampleId?.startsWith('user:')) store.deleteSample(old.sampleId).catch(() => {});

  const id = `user:${crypto.randomUUID()}`;
  await store.saveSample(id, { name: file.name, data });
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
  const pad = newPad(name, old?.color ?? pickerColors()[i % pickerColors().length], id, buffer);
  if (old) pad.p = old.p;   // garder les réglages du pad
  state.banks[state.bank][i] = pad;
  selectPad(i);
  renderPad(i);
  renderEditor();
  renderLeds();
  renderLibrary();
  save();
}

// Un son de la bibliothèque lâché sur un pad : il remplace son son (les réglages du pad restent, le mode suit le son :
// boucle calée sur le tempo pour une boucle, un coup sinon).
export async function loadItemIntoPad(item, i) {
  const buffer = await ensureBuffer(item.sampleId);
  if (!buffer) { toast(t('lib.loadFail'), 3000); return; }
  const b = state.bank;
  const old = state.banks[b][i];
  engine.stopPad(padKey(b, i));
  const pad = newPad(item.name.slice(0, 24), catColor(item.cat), item.sampleId, buffer, item.bpm || 0);
  if (old) pad.p = { ...old.p };
  pad.p.mode = (item.loop ? 2 : 0) / (PAGES.pad.params[7].steps - 1);
  state.banks[b][i] = pad;
  if (old?.sampleId?.startsWith('user:') && !sampleInUse(old.sampleId)) store.deleteSample(old.sampleId).catch(() => {});
  selectPad(i);
  renderPad(i);
  renderEditor();
  renderLeds();
  save();
  toast(t('pad.dropped', { n: i + 1, name: pad.name }), 2000);
}

// Un son importé sert-il encore quelque part (pads, timeline, bibliothèque, platines) ?
export const sampleInUse = id => state.banks.some(bk => bk.some(p => p?.sampleId === id)) || state.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === id))
  || state.userSounds.some(u => u.sampleId === id) || DECK_IDS.some(d => state.decks[d]?.sampleId === id);

// Vide la banque affichée (les sons de la bibliothèque y restent ; un son importé qui ne sert plus ailleurs est effacé).
export function clearBank() {
  const b = state.bank;
  const n = state.banks[b].filter(Boolean).length;
  if (!n) { toast(t('bank.empty', { n: b + 1 }), 2500); return; }
  if (!confirm(t('bank.clearConfirm', { n: b + 1, count: n }))) return;
  const olds = state.banks[b];
  olds.forEach((_, i) => engine.stopPad(padKey(b, i)));
  state.banks[b] = new Array(40).fill(null);
  for (const p of olds) if (p?.sampleId?.startsWith('user:') && !sampleInUse(p.sampleId)) store.deleteSample(p.sampleId).catch(() => {});
  renderPads();
  renderEditor();
  renderKnobs();
  renderLeds();
  save();
  toast(t('bank.cleared', { n: b + 1 }), 2500);
}

export function clearPad(i) {
  const old = state.banks[state.bank][i];
  if (!old) return;
  engine.stopPad(padKey(state.bank, i));
  if (old.sampleId?.startsWith('user:')) store.deleteSample(old.sampleId).catch(() => {});
  state.banks[state.bank][i] = null;
  renderPad(i);
  renderEditor();
  renderKnobs();
  renderLeds();
  save();
}
