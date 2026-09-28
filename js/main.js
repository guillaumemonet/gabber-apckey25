import { APC, BTN, PALETTE, PICKER_COLORS, MK1_PICKER_COLORS, mk1Equivalent } from './apc.js';
import { Engine } from './audio.js';
import { PAGES, MODES, SYNTH_KNOBS, toValue, toPos, defaultPositions } from './params.js';
import { renderDefaultKit } from './kit.js';
import { PRESETS, FAMILIES, familyGroup, presetById, migratePreset, WHITE_KEYS } from './presets.js';
import { Recorder, download, stamp, encodeWav } from './recorder.js';
import { packBanks, unpack } from './kits.js';
import * as store from './storage.js';
import { WindowManager, WINDOWS, mergeWindows } from './windows.js';
import { LIB_CATS, catColor, libraryItems, guessCat } from './library.js';
import { Mixer, CHANNELS, MIX_FIELDS, FX_TYPES, MAX_FX, defaultMixState, mergeMixState, mixKnobDefs, newFx, fxParamLabel } from './mixer.js';
import { Timeline, TL_TRACKS, BEATS_PER_BAR, defaultTlState, mergeTlState } from './timeline.js';
import { TR909, TR_INSTR, PATTERNS, trKnobDefs, defaultTrState, mergeTrState } from './tr909.js';
import { t, soundName, translatePage } from './i18n.js';
import { Performer, CHORD_MODES, ARP_MODES, ARP_RATES, defaultPlayState, mergePlayState } from './performer.js';
import { PROGRESSIONS, parseProgression, voiceChords, bassNote } from './chords.js';
import { Sidechain, SC_SOURCES, SC_DUCKED, defaultScState, mergeScState } from './sidechain.js';
import { History } from './history.js';
import { makeZip } from './zip.js';
import { KICK_PARAMS, KICK_PRESETS, kickDefaults, kickFmt, kickSteps, defaultKickState, mergeKickState, renderKick as synthKick } from './kickdesign.js';
import { Decks, DECK_IDS, DECK_KNOBS, deckKnobDefs, defaultDecksState, mergeDecksState, guessBpm, vinylTurns, rateFromSpin } from './decks.js';
import { Acid303, ACID_PATTERNS, ACID_ROWS, ACID_BASE, ACID_PARAMS, acidKnobDefs, acidFmt, acidSteps, defaultAcidState, mergeAcidState, randomPattern } from './acid.js';

translatePage();

const BANKS = 15;   // SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = banques 6-10, une 2e fois = 11-15
const PAGE_ORDER = ['synth', 'fx', 'pad', 'eq'];   // boutons de piste 1 à 4 (EQ aussi via SUSTAIN)
const UI_PAGES = [...PAGE_ORDER, 'tr', 'acid', 'decks', ...MIX_FIELDS.map(f => `mix_${f}`)];   // + TR-909 (Maj + PLAY) et mixeur (Maj + piste 1-4)
const $ = sel => document.querySelector(sel);

let engine, apc, kit, recorder, drum, mixer, wm, timeline, performer, sidechain, tlHistory, acid, decks;
let libAdded = [];   // banques de la bibliothèque ajoutées à ce démarrage
const state = {
  bank: 0,
  page: 'synth',
  selected: 0,
  bpm: 120,
  preset: 'init',   // preset du synthé (identifiant, voir js/presets.js)
  libBanks: [],     // noms des banques de la bibliothèque déjà importées
  model: null,      // dernier modèle d'APC vu ('mk1' | 'mk2')
  globals: { ...defaultPositions('synth'), ...defaultPositions('fx'), ...defaultPositions('eq') },
  banks: [],        // banks[b][i] = { name, color, sampleId, p, buffer } | null
  tr: defaultTrState(),   // TR-909 : réglages, patterns, instrument choisi
  mix: defaultMixState(), // table de mixage : voies, envois, effets d'insert
  windows: mergeWindows(null), // fenêtres des plugins : ouverte ou non, position, taille
  tl: defaultTlState(),        // timeline : pistes de clips (sons posés ou enregistrements d'outils)
  scenes: new Array(40).fill(null),   // 40 scènes (instantanés rappelés à la mesure suivante)
  play: defaultPlayState(),           // jeu du clavier : mode accords, arpégiateur
  gen: null,                          // générateur de nappes (voir defaultGen)
  sc: defaultScState(),               // sidechain : les kicks font respirer synthé, nappes et basses
  acid: defaultAcidState(),           // TB-303 : réglages et patterns
  kick: defaultKickState(),           // designer de kick
  decks: defaultDecksState(),         // platines : sons chargés et réglages des deux decks
  userSounds: [],                     // sons créés dans l'application (kicks du designer) : { sampleId, name, cat }
};
const playing = new Map();   // clé voix (banque*40 + pad) -> mode
let shiftHeld = false;

const padKey = (bank, i) => bank * 40 + i;
// Le mk1 n'a que 3 couleurs : l'interface montre la couleur réelle de la LED.
const uiColor = c => (state.model === 'mk1' ? mk1Equivalent(c) : c);
const pickerColors = () => (state.model === 'mk1' ? MK1_PICKER_COLORS : PICKER_COLORS);
const currentPad = () => state.banks[state.bank][state.selected];
const newPad = (name, color, sampleId, buffer, bpm = 0) => ({ name, color, sampleId, buffer, bpm, p: defaultPositions('pad') });

// ---------- Démarrage ----------

$('#start-btn').addEventListener('click', () => start().catch(err => {
  console.error(err);
  $('#start-msg').textContent = t('start.error', { msg: err.message });
}));

async function start() {
  $('#start-btn').disabled = true;
  $('#start-msg').textContent = t('start.generating');
  engine = new Engine();
  await engine.resume();
  kit = await renderDefaultKit();
  await restore();
  applyGlobals();
  engine.setBpm(state.bpm);
  engine.setVoice(presetById(state.preset).voice);
  engine.onPadState = onPadState;
  recorder = new Recorder(engine.ctx, engine.output);
  drum = new TR909(engine, () => state.tr);
  drum.setVolume(state.tr.globals.volume);
  drum.onStep = onTrStep;
  drum.onPattern = () => { renderTr(); renderLeds(); save(); };
  // Toutes les sources passent par la table de mixage avant le master.
  mixer = new Mixer(engine, () => state.mix);
  engine.padBus.disconnect();
  engine.padBus.connect(mixer.input('pads'));
  // Sidechain : le synthé et les sons mélodiques passent par des bus que les kicks font baisser.
  sidechain = new Sidechain(engine, () => state.sc);
  engine.pumpGain.disconnect();
  engine.pumpGain.connect(sidechain.synth).connect(mixer.input('synth'));
  sidechain.pads.connect(engine.padBus);
  engine.padOut = pad => (isDuckedSound(pad.sampleId, padCat(pad)) ? sidechain.pads : engine.padBus);
  drum.onKick = time => { sidechain.kick(time); if (tlRec?.source === 'tr') tlRec.kicks.push(time); };
  sidechain.isRunning = () => timeline?.playing || drum.running || [...engine.padVoices.values()].some(v => v.mode === 'loop');
  sidechain.loopKicks = padLoopKicks;
  acid = new Acid303(engine, () => state.acid);
  acid.out.connect(sidechain.acid).connect(mixer.input('acid'));
  await Decks.load(engine.ctx);
  decks = new Decks(engine, () => state.decks);
  decks.out.connect(mixer.input('decks'));
  drum.setDestinations(Object.fromEntries(['bd', 'snare', 'toms', 'hats', 'cym'].map(g => [g, mixer.input('tr')])));
  timeline = new Timeline(engine, () => state.tl, clipBuffer, mixer.input('tl'));
  timeline.getPad = (b, i) => state.banks[b]?.[i];
  timeline.padKey = padKey;
  timeline.getPatch = presetPatch;
  sidechain.tl.connect(mixer.input('tl'));
  timeline.duckOutput = sidechain.tl;
  timeline.isDucked = clip => isDuckedSound(clip.sampleId, clip.cat) && !clip.kickBeats;
  timeline.isKickPad = pad => padCat(pad) === 'kick' && !soundKicks(pad.sampleId);
  timeline.kicksOf = clipKicks;
  timeline.onKick = time => sidechain.kick(time);
  timeline.onHalt = () => sidechain.clear();
  // Le clavier passe par le mode accords / l'arpégiateur ; les notes produites s'enregistrent dans la timeline.
  performer = new Performer(engine, () => state.play);
  performer.onNote = (note, vel, on) => tlRecordNote(note, on, vel);
  performer.onNoteAt = tlRecordArpNote;
  await loadTlBuffers();
  cleanRecordings();
  bindTempo();

  buildPads();
  buildBanks();
  buildEditor();
  buildPages();
  buildKnobs();
  buildPiano();
  buildPresets();
  buildPerf();
  buildTr();
  buildAcid();
  buildKick();
  buildDecks();
  buildMixer();
  buildSidechain();
  buildTl();
  initHistory();
  buildGen();
  buildScenes();
  bindKits();
  bindComputerKeyboard();
  drawMeter();
  renderAll();
  wm = new WindowManager(() => state.windows, save, onWindowToggle);
  $('#layout-reset').addEventListener('click', () => wm.reset());
  buildPluginBar();
  buildLibrary();
  $('#start').classList.add('hidden');
  if (libAdded.length) toast(libAdded.map(a => t('lib.added', { name: a.name, n: a.bank })).join(' · '), 6000);

  apc = new APC();
  bindController();
  try {
    await apc.init();
  } catch (err) {
    setStatus(false, /permission|denied|not allowed/i.test(err.message) ? t('status.denied') : err.message);
  }
}

function globalDef(id) {
  return ['synth', 'fx', 'eq'].map(p => PAGES[p].params.find(d => d.id === id)).find(Boolean);
}
function globalValue(id, p) { return toValue(globalDef(id), p); }

// Applique les réglages globaux ; ceux qui n'existent plus (anciennes versions) sont retirés.
function applyGlobals() {
  for (const [id, p] of Object.entries(state.globals)) {
    if (!globalDef(id) || !Number.isFinite(p)) { delete state.globals[id]; continue; }
    engine.set(id, globalValue(id, p));
  }
}

// ---------- Sauvegarde ----------

async function restore() {
  const saved = await store.loadState().catch(() => null);
  const firstRun = !saved;
  state.gen = defaultGen();
  state.banks = Array.from({ length: BANKS }, () => new Array(40).fill(null));
  if (!saved) {
    kit.forEach((s, i) => { state.banks[0][i] = newPad(soundName(s.name), s.color, `builtin:${i}`, s.buffer); });
  } else {
    Object.assign(state.globals, saved.globals);
    state.bank = Math.min(saved.bank ?? 0, BANKS - 1);
    state.page = saved.page ?? 'synth';
    state.bpm = saved.bpm ?? 120;
    state.preset = migratePreset(saved.preset);
    // Anciennes sauvegardes : les 5 premières banques de la bibliothèque étaient déjà importées.
    state.libBanks = saved.libBanks ?? (saved.libImported ? ['Batterie', 'Électro', 'Boucles', 'Textures', 'Tabla & divers'] : []);
    state.model = saved.model ?? null;
    state.tr = mergeTrState(saved.tr);
    state.mix = mergeMixState(saved.mix);
    state.windows = mergeWindows(saved.windows);
    state.tl = mergeTlState(saved.tl);
    state.scenes = mergeScenes(saved.scenes);
    state.play = mergePlayState(saved.play);
    state.gen = mergeGen(saved.gen);
    state.sc = mergeScState(saved.sc);
    state.acid = mergeAcidState(saved.acid);
    state.kick = mergeKickState(saved.kick);
    state.decks = mergeDecksState(saved.decks);
    state.userSounds = Array.isArray(saved.userSounds) ? saved.userSounds.filter(s => typeof s?.sampleId === 'string' && s.sampleId.startsWith('user:')) : [];
    for (let b = 0; b < BANKS; b++) {
      for (let i = 0; i < 40; i++) {
        const s = saved.banks?.[b]?.[i];
        if (!s) continue;
        const pad = { bpm: 0, ...s, p: { ...defaultPositions('pad'), ...s.p }, buffer: null };
        state.banks[b][i] = pad;
        if (s.sampleId?.startsWith('builtin:')) pad.buffer = kit[+s.sampleId.slice(8)]?.buffer ?? null;
      }
    }
  }
  const added = await importLibrary();
  libAdded = firstRun ? [] : added;   // au premier lancement, tout est nouveau : pas de message

  // Décodage des fichiers (importés par l'utilisateur ou de la bibliothèque) en parallèle.
  const pending = state.banks.flat().filter(p => p && !p.buffer && /^(user|lib):/.test(p.sampleId));
  let done = 0;
  await Promise.all(pending.map(async pad => {
    let data = null;
    if (pad.sampleId.startsWith('user:')) {
      data = (await store.loadSample(pad.sampleId).catch(() => null))?.data?.slice(0);
    } else {
      data = await fetch(`sounds/${pad.sampleId.slice(4)}`, { cache: 'no-cache' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    }
    if (data) pad.buffer = await engine.ctx.decodeAudioData(data).catch(() => null);
    $('#start-msg').textContent = t('start.loading', { done: ++done, total: pending.length });
  }));
}

// Ajoute les banques de la bibliothèque (tools/build_banks.py) qui ne sont encore nulle part.
// Une banque va à son emplacement prévu s'il est vide, sinon dans la première banque vide.
// Renvoie la liste des banques ajoutées : [{ name, bank }].
async function importLibrary() {
  const lib = await fetch('sounds/banks.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!lib) return [];
  libManifest = lib;   // sert aussi à la bibliothèque de sons
  const modeDef = PAGES.pad.params[7];
  const firstImport = !state.libBanks.length;
  const added = [];
  lib.banks.forEach((bank, k) => {
    const folder = `lib:${bank.pads.find(Boolean)?.file.split('/')[0]}/`;
    const present = state.banks.some(bk => bk.some(p => p?.sampleId?.startsWith(folder)));
    if (present) {
      if (!state.libBanks.includes(bank.name)) state.libBanks.push(bank.name);
      return;
    }
    const isFree = b => b > 0 && b < BANKS && !state.banks[b].some(Boolean);
    const slot = isFree(k + 1) ? k + 1 : state.banks.findIndex((_, b) => isFree(b));
    if (slot < 0) return;   // aucune banque libre : réessayé au prochain démarrage
    bank.pads.forEach((s, i) => {
      if (!s) return;
      const pad = newPad(soundName(s.name), s.color, `lib:${s.file}`, null, s.bpm || 0);
      pad.p.mode = s.mode / (modeDef.steps - 1);
      state.banks[slot][i] = pad;
    });
    if (!state.libBanks.includes(bank.name)) state.libBanks.push(bank.name);
    added.push({ name: bank.name, bank: slot + 1 });
  });
  if (firstImport && lib.bpm) state.bpm = lib.bpm;
  return added;
}

let saveTimer;
function save() {
  if (!tlRec) tlHistory?.commit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.saveState({
      bank: state.bank,
      page: state.page,
      bpm: state.bpm,
      preset: state.preset,
      libBanks: state.libBanks,
      model: state.model,
      globals: state.globals,
      tr: state.tr,
      mix: state.mix,
      windows: state.windows,
      tl: state.tl,
      scenes: state.scenes,
      play: state.play,
      gen: state.gen,
      sc: state.sc,
      acid: state.acid,
      kick: state.kick,
      decks: state.decks,
      userSounds: state.userSounds,
      banks: state.banks.map(bank => bank.map(p => p && { name: p.name, color: p.color, sampleId: p.sampleId, bpm: p.bpm, p: p.p })),
    }).catch(err => console.warn('Save failed', err));
  }, 400);
}

// ---------- Actions (communes souris / contrôleur) ----------

function triggerPad(i) {
  selectPad(i);
  const pad = state.banks[state.bank][i];
  engine.playPad(padKey(state.bank, i), pad);
  if (pad?.buffer && padCat(pad) === 'kick' && engine.padMode(pad) !== 'loop') sidechain.kick();
  tlRecordPad(state.bank, i);
}

function releasePad(i) {
  engine.releasePad(padKey(state.bank, i));
}

function selectPad(i) {
  if (state.selected === i) return;
  state.selected = i;
  renderPads();
  renderEditor();
  if (kickKnobEls.length) renderKick();   // info-bulle « → Pad » du designer de kick
  if (state.page === 'pad') renderKnobs();
  renderLeds();
}

function setBank(b) {
  state.bank = b;
  renderAll();
  save();
}

function setPage(page) {
  state.page = page;
  renderPages();
  renderKnobs();
  renderLeds();
  save();
}

function panic() {
  drum.stop();
  acid.stop();
  decks.stopAll();
  engine.stopAllPads();
  performer.allOff();
  engine.allNotesOff();
  for (const i of [...perfActive]) { perfActive.delete(i); PERF[i].off?.(); }
  heldRolls.length = 0;
  engine.rollOff();
  renderPerf();
  renderTr();
  if (tlRec) tlStopRec(); else timeline.stop();
  renderLeds();
}

function onPadState(key, isPlaying, mode) {
  if (isPlaying) playing.set(key, mode); else playing.delete(key);
  if (Math.floor(key / 40) !== state.bank) return;
  renderPad(key % 40);
  renderLeds();
}

// Potards de la page active : définitions et objet qui stocke leurs positions.
function knobDefs() {
  if (mixField(state.page)) {
    const defs = mixKnobDefs(mixField(state.page));
    return [...defs, ...new Array(7 - defs.length).fill(null), masterDef()];   // K8 = volume général
  }
  if (state.page === 'synth') return synthKnobDefs();
  if (state.page === 'acid') return acidKnobDefs();
  if (state.page === 'decks') return [...deckKnobDefs(), masterDef()];
  return state.page === 'tr' ? trKnobDefs(state.tr.sel) : PAGES[state.page].params;
}
function knobTarget(def) {
  if (!def) return null;
  if (def.ch) return state.mix.channels[def.ch];
  if (mixField(state.page)) return state.globals;   // K8 = volume général
  if (state.page === 'pad') return currentPad()?.p;
  if (def.acid) return state.acid.params;
  if (def.deck) return def.deck === 'x' ? state.decks : state.decks[def.deck];
  if (state.page === 'tr') return def.group === 'global' ? state.tr.globals : state.tr.params[state.tr.sel];
  return state.globals;
}

// Tourne un potard : delta relatif (mk2, souris) ou position absolue (mk1).
function turnKnob(index, { delta, value }) {
  const def = knobDefs()[index];
  const pad = currentPad();
  const target = knobTarget(def);
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
  } else if (state.page === 'pad') {
    engine.updatePadVoice(padKey(state.bank, state.selected), pad);
    renderEditorKnobs();
    if (def.id === 'mode') { renderPad(state.selected); renderEditor(); }
  } else if (state.page === 'tr') {
    if (def.id === 'volume') drum.setVolume(target.volume);
  } else if (def.acid) {
    acid.update();
    renderAcidKnobs();
  } else if (def.deck) {
    decks.update();
    renderDecks();
  } else {
    engine.set(def.id, toValue(def, target[def.id]));
  }
  if (def.id === 'master') renderMixer();
  if (state.page === 'synth') renderSynthKnobs();
  renderKnob(index, true);
  save();
}

async function loadFileIntoPad(file, i) {
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

function clearPad(i) {
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

// ---------- Contrôleur ----------

function bindController() {
  apc.addEventListener('connection', ({ detail }) => {
    if (detail.model) {
      if (state.model !== detail.model) {
        state.model = detail.model;
        buildSwatches();
        renderPads();
        renderEditor();
        save();
      }
      setStatus(true, t('status.connected', { model: detail.model === 'mk2' ? 'mk2' : '(mk1)' }));
      apc.clearAll();
      renderLeds();
    } else {
      const seen = detail.allInputs.length ? t('status.portsSeen', { ports: detail.allInputs.join(', ') }) : t('status.noPorts');
      setStatus(false, t('status.notFound', { seen }));
    }
    renderPorts();
  });
  apc.addEventListener('portError', ({ detail }) => {
    setStatus(false, t('status.portBusy', { port: detail.port, msg: detail.message }));
  });
  apc.addEventListener('roles', renderPorts);

  apc.addEventListener('pad', ({ detail: { index, pressed } }) => {
    if (sceneMode) { if (pressed) { if (shiftHeld) captureScene(index); else launchScene(index); } return; }
    if (trMode) { if (pressed) trPad(index); return; }
    if (!pressed) return releasePad(index);
    if (shiftHeld) selectPad(index); else triggerPad(index);
  });

  const perfHeld = new Map();   // bouton de piste -> effet déclenché (Maj peut être relâchée avant)
  apc.addEventListener('button', ({ detail: { name, pressed } }) => {
    if (name === 'shift') { shiftHeld = pressed; return; }
    if (name.startsWith('track') && +name.slice(5) >= 5) {
      // Pistes 5-8 : effets de performance (avec Maj : 2e ligne).
      if (pressed) {
        const idx = +name.slice(5) - 5 + (shiftHeld ? 4 : 0);
        perfHeld.set(name, idx);
        perfDown(idx);
      } else if (perfHeld.has(name)) {
        perfUp(perfHeld.get(name));
        perfHeld.delete(name);
      }
      return;
    }
    if (!pressed) return;
    // PLAY = timeline (Maj + PLAY = grille 909) ; REC = enregistrement de l'outil choisi dans la timeline.
    if (name === 'play') { if (shiftHeld) toggleTrMode(); else tlToggle(); return; }
    if (name.startsWith('scene')) {
      if (trMode) toggleTrMode(false);   // choisir une banque ramène la grille aux pads
      if (sceneMode) toggleSceneMode(false);
      const k = +name.slice(5) - 1;
      const b = shiftHeld ? (state.bank === k + 5 ? k + 10 : k + 5) : k;
      setBank(b);
      if (shiftHeld) toast(t('bank.toast', { n: b + 1 }));   // la LED clignote pour 6-10 comme pour 11-15
    }
    else if (name.startsWith('track')) setPage((shiftHeld ? MIX_PAGES : PAGE_ORDER)[+name.slice(5) - 1]);
    else if (name === 'stopAll') { if (shiftHeld) toggleSceneMode(); else panic(); }
    else if (name === 'record') { if (shiftHeld) setPage(state.page === 'acid' ? 'decks' : state.page === 'decks' ? 'synth' : 'acid'); else tlRecToggle(); }
  });

  apc.addEventListener('knob', ({ detail }) => turnKnob(detail.index, detail));

  apc.addEventListener('key', ({ detail: { note, velocity, on } }) => {
    // Maj + touche : choisir un preset au lieu de jouer.
    if (on && shiftHeld && presetKey(note)) return;
    if (acidKey(note, velocity, on)) return;
    if (on) performer.noteOn(note, velocity); else performer.noteOff(note);
    setPianoKey(note, on);
  });

  apc.addEventListener('sustain', ({ detail }) => onSustainButton(detail.on));

  const log = $('#log');
  const lines = [];
  apc.addEventListener('raw', ({ detail }) => {
    if (!wm?.isOpen('monitor')) return;
    const hex = detail.data.map(b => b.toString(16).padStart(2, '0')).join(' ');
    lines.push(`${hex.padEnd(10)}  ${describe(detail.data)}   ← ${detail.port}`);
    if (lines.length > 80) lines.shift();
    log.textContent = lines.join('\n');
    log.scrollTop = log.scrollHeight;
  });
}

function describe([st, d1, d2]) {
  const type = st & 0xf0, ch = (st & 15) + 1;
  if (type === 0x90) return `note on  ch${ch} n=${d1} v=${d2}`;
  if (type === 0x80) return `note off ch${ch} n=${d1}`;
  if (type === 0xb0) return `CC       ch${ch} #${d1} = ${d2}`;
  return '';
}

function setStatus(on, text) {
  $('#status').classList.toggle('on', on);
  $('#status').classList.toggle('off', !on);
  $('#status-text').textContent = text;
}

function renderPorts() {
  const info = apc.portsInfo();
  $('#ports').textContent = info.length ? '— ' + info.map(p => `${p.name} [${p.role === 'tout' ? t('monitor.roleAll') : p.role}]`).join(' · ') : '';
  $('#swap-roles').hidden = !(apc.model === 'mk2' && info.length > 1);
}
$('#swap-roles').addEventListener('click', () => apc.swapRoles());

// Pads : couleur atténuée si chargé, pleine lumière pendant la lecture, pulsation pour une boucle.
function renderLeds() {
  if (!apc?.connected) return;
  const bank = state.banks[state.bank];
  for (let i = 0; i < 40 && !trMode && !sceneMode; i++) {
    const pad = bank[i];
    const mode = playing.get(padKey(state.bank, i));
    let led = 'off';
    if (pad?.buffer) {
      if (mode) led = mode === 'loop' ? 'pulse' : 'on';
      else led = state.page === 'pad' && i === state.selected ? 'on' : 'dim';
    }
    apc.setPad(i, pad?.color ?? 0, led);
  }
  // Banques 1-5 : LED fixe ; banques 6-15 : LED clignotante.
  BTN.scene.forEach((n, b) => apc.setButton(n, b === state.bank % 5 ? (state.bank >= 5 ? 2 : 1) : 0));
  BTN.track.forEach((n, t) => apc.setButton(n, t < 4
    ? (PAGE_ORDER[t] === state.page ? 1 : MIX_PAGES[t] === state.page ? 2 : 0)
    : (perfActive.has(t - 4) || perfActive.has(t) ? 1 : 0)));
  apc.setButton(BTN.record, tlRec ? 2 : 0);
  apc.setButton(BTN.play, timeline?.playing ? 1 : 0);
  if (trMode) renderTrLeds();
  if (sceneMode) renderSceneLeds();
}

// ---------- Interface : pads ----------

const padEls = [];

function buildPads() {
  const grid = $('#pads');
  for (let row = 4; row >= 0; row--) {
    for (let col = 0; col < 8; col++) {
      const i = row * 8 + col;
      const el = document.createElement('div');
      el.className = 'pad';
      el.innerHTML = `<span class="num">${i + 1}</span><span class="name"></span><button class="pad-edit" title="${t('pad.edit')}">✎</button>`;
      const pencil = el.querySelector('.pad-edit');
      pencil.addEventListener('pointerdown', e => e.stopPropagation());
      pencil.addEventListener('click', () => openPadEditor(i));
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (e.shiftKey) selectPad(i); else triggerPad(i);
      });
      el.addEventListener('pointerup', () => releasePad(i));
      el.addEventListener('pointerleave', e => { if (e.buttons) releasePad(i); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('dragover');
        loadFileIntoPad(e.dataTransfer.files[0], i);
      });
      padEls[i] = el;
      grid.appendChild(el);
    }
  }
  // Empêche le navigateur d'ouvrir un fichier lâché à côté d'un pad.
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
}

function renderPad(i) {
  const pad = state.banks[state.bank][i];
  const el = padEls[i];
  const mode = playing.get(padKey(state.bank, i));
  el.classList.toggle('empty', !pad);
  el.classList.toggle('playing', !!mode);
  el.classList.toggle('selected', i === state.selected);
  el.classList.toggle('loop', !!pad && MODES[toValue(PAGES.pad.params[7], pad.p.mode)] === 'loop');
  el.style.setProperty('--c', pad ? PALETTE[uiColor(pad.color)] : '#444');
  el.querySelector('.name').textContent = pad ? pad.name : t('pad.empty');
}

function renderPads() { for (let i = 0; i < 40; i++) renderPad(i); }

function buildBanks() {
  const wrap = $('#banks');
  for (let b = 0; b < BANKS; b++) {
    const btn = document.createElement('button');
    btn.textContent = `${b + 1}`;
    btn.title = b < 5 ? t('bank.title1', { n: b + 1 }) : b < 10 ? t('bank.title2', { n: b + 1, m: b - 4 }) : t('bank.title3', { n: b + 1, m: b - 9 });
    btn.addEventListener('click', () => setBank(b));
    wrap.appendChild(btn);
  }
}

function renderBanks() {
  [...$('#banks').children].forEach((btn, b) => btn.classList.toggle('active', b === state.bank));
}

// ---------- Interface : éditeur de pad ----------

function buildSwatches() {
  const colors = $('#ed-colors');
  colors.innerHTML = '';
  colors.classList.toggle('three', state.model === 'mk1');
  for (const c of pickerColors()) {
    const btn = document.createElement('button');
    btn.style.background = PALETTE[c];
    btn.dataset.color = c;
    btn.addEventListener('click', () => {
      const pad = currentPad();
      if (!pad) return;
      pad.color = c;
      renderPad(state.selected);
      renderEditor();
      renderLeds();
      save();
    });
    colors.appendChild(btn);
  }
}

function buildEditor() {
  buildSwatches();
  buildEditorKnobs();

  const modeDef = PAGES.pad.params[7];
  const modes = $('#ed-modes');
  MODES.forEach((m, k) => {
    const btn = document.createElement('button');
    btn.textContent = modeDef.fmt(k);
    btn.addEventListener('click', () => {
      const pad = currentPad();
      if (!pad) return;
      pad.p.mode = k / (MODES.length - 1);
      renderPad(state.selected);
      renderEditor();
      if (state.page === 'pad') renderKnobs();
      save();
    });
    modes.appendChild(btn);
  });

  $('#ed-name').addEventListener('input', e => {
    const pad = currentPad();
    if (!pad) return;
    pad.name = e.target.value;
    renderPad(state.selected);
    save();
  });
  $('#ed-load').addEventListener('click', () => $('#ed-file').click());
  $('#ed-file').addEventListener('change', e => {
    loadFileIntoPad(e.target.files[0], state.selected);
    e.target.value = '';
  });
  $('#ed-play').addEventListener('click', () => triggerPad(state.selected));
  $('#ed-clear').addEventListener('click', () => clearPad(state.selected));
}

function renderEditor() {
  const pad = currentPad();
  $('#ed-title').textContent = t('editor.title', { pad: state.selected + 1, bank: state.bank + 1 });
  $('#ed-name').value = pad?.name ?? '';
  $('#ed-name').disabled = !pad;
  $('#ed-play').disabled = $('#ed-clear').disabled = !pad;
  for (const btn of $('#ed-colors').children) btn.classList.toggle('active', pad && +btn.dataset.color === uiColor(pad.color));
  const mode = pad ? toValue(PAGES.pad.params[7], pad.p.mode) : -1;
  [...$('#ed-modes').children].forEach((btn, k) => btn.classList.toggle('active', k === mode));
  $('#ed-bpm').value = pad?.bpm || '';
  $('#ed-bpm').disabled = $('#ed-bpm-auto').disabled = !pad;
  drawWave(pad);
  renderEditorKnobs();
}

function drawWave(pad) {
  const cv = $('#ed-wave');
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (!pad?.buffer) {
    g.fillStyle = '#8b8d94';
    g.font = '24px system-ui';
    g.textAlign = 'center';
    g.fillText(t('editor.emptyWave'), cv.width / 2, cv.height / 2 + 8);
    return;
  }
  const data = pad.buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / cv.width));
  const mid = cv.height / 2;
  g.fillStyle = PALETTE[uiColor(pad.color)];
  for (let x = 0; x < cv.width; x++) {
    let max = 0;
    for (let j = x * step; j < (x + 1) * step && j < data.length; j++) max = Math.max(max, Math.abs(data[j]));
    const h = Math.max(1, max * mid);
    g.fillRect(x, mid - h, 1, h * 2);
  }
  const start = pad.p.start * 0.95 * cv.width;
  g.fillStyle = 'rgba(0,0,0,.6)';
  g.fillRect(0, 0, start, cv.height);
}

$('#editor').addEventListener('dragover', e => e.preventDefault());
$('#editor').addEventListener('drop', e => {
  e.preventDefault();
  loadFileIntoPad(e.dataTransfer.files[0], state.selected);
});


// Potards du pad dans l'éditeur (les mêmes que la page « Pad » des potards de l'APC).
const edKnobEls = [];
function buildEditorKnobs() {
  const wrap = $('#ed-knobs');
  PAGES.pad.params.forEach((def, k) => {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label">${def.label}</div>`;
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      turnPadParam(k, { delta: (lastY - e.clientY) / 2 * (e.shiftKey ? 0.25 : 1) });
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turnPadParam(k, { delta: e.deltaY < 0 ? 2 : -2 }); }, { passive: false });
    el.addEventListener('dblclick', () => turnPadParam(k, { value: toPos(def, def.def) }));
    edKnobEls[k] = el;
    wrap.appendChild(el);
  });
}

function turnPadParam(k, { delta, value }) {
  const pad = currentPad();
  if (!pad) return;
  const def = PAGES.pad.params[k];
  if (value !== undefined) pad.p[def.id] = value;
  else {
    const step = def.steps ? Math.max(0.01, 1 / (def.steps - 1) / 3) : 0.01;
    pad.p[def.id] = Math.min(1, Math.max(0, pad.p[def.id] + delta * step));
  }
  engine.updatePadVoice(padKey(state.bank, state.selected), pad);
  if (def.id === 'mode') { renderPad(state.selected); renderEditor(); } else renderEditorKnobs();
  if (def.id === 'start') drawWave(pad);
  if (state.page === 'pad') renderKnobs();
  save();
}

function renderEditorKnobs() {
  const pad = currentPad();
  PAGES.pad.params.forEach((def, k) => {
    const el = edKnobEls[k];
    if (!el) return;
    const p = pad ? pad.p[def.id] : 0;
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = pad ? def.fmt(toValue(def, p)) : '—';
    el.style.opacity = pad ? 1 : 0.4;
  });
}

// Crayon d'un pad : ouvre l'éditeur sur ce pad, et les potards de l'APC passent sur ses réglages.
function openPadEditor(i) {
  selectPad(i);
  if (!wm.isOpen('editor')) wm.toggle('editor', true); else wm.bring('editor');
  setPage('pad');
  renderEditor();
}

// ---------- Interface : potentiomètres ----------

function buildPages() {
  const wrap = $('#pages');
  UI_PAGES.forEach((page, k) => {
    const btn = document.createElement('button');
    btn.textContent = PAGES[page]?.label ?? t(`page.${page}`);
    btn.title = page === 'tr' ? t('tr.pageTitle') : page === 'acid' ? t('acid.pageTitle') : page === 'decks' ? t('deck.pageTitle')
      : mixField(page) ? t('mix.pageTitle', { n: MIX_FIELDS.indexOf(mixField(page)) + 1 })
      : t('page.title', { n: k + 1 });
    btn.addEventListener('click', () => setPage(page));
    wrap.appendChild(btn);
  });
}

function renderPages() {
  [...$('#pages').children].forEach((btn, k) => btn.classList.toggle('active', UI_PAGES[k] === state.page));
}

const ARC = 270;
function arcPath(p) {
  const r = 30, cx = 40, cy = 40;
  const a0 = (-ARC / 2 - 90) * Math.PI / 180;
  const a1 = a0 + p * ARC * Math.PI / 180;
  const large = p * ARC > 180 ? 1 : 0;
  const pt = a => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${pt(a0)} A ${r} ${r} 0 ${large} 1 ${pt(a1)}`;
}

const knobEls = [];
function buildKnobs() {
  const wrap = $('#knobs');
  for (let k = 0; k < 8; k++) {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="7" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="7" stroke-linecap="round"/>
        <text x="40" y="46" text-anchor="middle" fill="#8b8d94" font-size="14">K${k + 1}</text>
      </svg>
      <div class="value"></div><div class="label"></div>`;
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null) return;
      const dy = lastY - e.clientY;
      if (Math.abs(dy) < 2) return;
      lastY = e.clientY;
      shiftHeld = e.shiftKey;
      turnKnob(k, { delta: dy / 2 });
    });
    el.addEventListener('pointerup', () => { lastY = null; shiftHeld = false; });
    el.addEventListener('wheel', e => { e.preventDefault(); turnKnob(k, { delta: e.deltaY < 0 ? 2 : -2 }); }, { passive: false });
    el.addEventListener('dblclick', () => {
      const def = knobDefs()[k];
      if (!knobTarget(def)) return;
      turnKnob(k, { value: toPos(def, def.def) });
    });
    knobEls[k] = el;
    wrap.appendChild(el);
  }
}

const flashTimers = [];
function renderKnob(k, flash = false) {
  const def = knobDefs()[k];
  const el = knobEls[k];
  if (!def) {   // potard inutilisé sur cette page
    el.querySelector('.arc').setAttribute('d', '');
    el.querySelector('.label').textContent = '';
    el.querySelector('.value').textContent = '';
    el.style.opacity = 0.25;
    return;
  }
  const target = knobTarget(def);
  const p = target ? target[def.id] : 0;
  el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
  el.querySelector('.label').textContent = def.label;
  el.querySelector('.value').textContent = target ? def.fmt(toValue(def, p)) : '—';
  el.style.opacity = target ? 1 : 0.4;
  if (flash) {
    el.classList.add('flash');
    clearTimeout(flashTimers[k]);
    flashTimers[k] = setTimeout(() => el.classList.remove('flash'), 250);
  }
  if (state.page === 'pad' && def.id === 'start') drawWave(currentPad());
}

function renderKnobs() { for (let k = 0; k < 8; k++) renderKnob(k); }

// ---------- Interface : piano ----------

let pianoBase = 48;   // do3, comme l'APC Key 25 au démarrage
const heldNotes = new Set();
const BLACK = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildPiano() {
  const piano = $('#piano');
  piano.innerHTML = '';
  const whites = [];
  for (let n = pianoBase; n <= pianoBase + 24; n++) if (!BLACK.has(n % 12)) whites.push(n);
  const w = 100 / whites.length;
  let wi = 0;
  for (let n = pianoBase; n <= pianoBase + 24; n++) {
    const el = document.createElement('div');
    el.dataset.note = n;
    if (BLACK.has(n % 12)) {
      el.className = 'black';
      el.style.left = `calc(${wi * w}% - ${w * 0.3}%)`;
      el.style.width = `${w * 0.6}%`;
    } else {
      el.className = 'white';
      if (n % 12 === 0) el.innerHTML = `<span>C${Math.floor(n / 12) - 1}</span>`;
      wi++;
    }
    el.classList.toggle('on', heldNotes.has(n));
    el.addEventListener('pointerdown', e => {
      try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      playNote(n, 0.8, true);
    });
    el.addEventListener('pointerup', () => playNote(n, 0, false));
    piano.appendChild(el);
  }
}

function playNote(note, velocity, on) {
  if (acidKey(note, velocity, on)) return;
  if (on) performer.noteOn(note, velocity); else performer.noteOff(note);
  setPianoKey(note, on);
}

function setPianoKey(note, on) {
  if (on) heldNotes.add(note); else heldNotes.delete(note);
  // Suit les changements d'octave du clavier (OCT-/OCT+ ne sont pas transmis en MIDI).
  if (on && (note < pianoBase || note > pianoBase + 24)) {
    pianoBase = note - (((note % 12) + 12) % 12) - (note > pianoBase ? 12 : 0);
    pianoBase = Math.max(0, Math.min(103, pianoBase));
    buildPiano();
    return;
  }
  $(`#piano [data-note="${note}"]`)?.classList.toggle('on', on);
}

const KEYMAP = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon'];
let kbOctave = 60;

function bindComputerKeyboard() {
  const down = new Map();
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.repeat || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Shift') shiftHeld = true;
    if (e.code === 'KeyZ') { kbOctave = Math.max(24, kbOctave - 12); return; }
    if (e.code === 'KeyX') { kbOctave = Math.min(96, kbOctave + 12); return; }
    const idx = KEYMAP.indexOf(e.code);
    if (idx < 0) return;
    const note = kbOctave + idx;
    down.set(e.code, note);
    playNote(note, 0.8, true);
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') shiftHeld = false;
    const note = down.get(e.code);
    if (note === undefined) return;
    down.delete(e.code);
    playNote(note, 0, false);
  });
}

// Bouton SUSTAIN = accès à la page EQ. Clic court : bascule ; maintien : EQ le temps de l'appui.
// Marche aussi si le bouton est à bascule (il envoie alors 127 puis 0 à l'appui suivant).
let pageBeforeEq = 'synth', eqPressedAt = 0, eqOpenedByPress = false;
function onSustainButton(on) {
  if (on) {
    eqPressedAt = performance.now();
    if (state.page === 'eq') { eqOpenedByPress = false; setPage(pageBeforeEq); }
    else { pageBeforeEq = state.page; eqOpenedByPress = true; setPage('eq'); }
  } else if (eqOpenedByPress && performance.now() - eqPressedAt > 400) {
    eqOpenedByPress = false;
    setPage(pageBeforeEq);
  }
}

// ---------- Tempo ----------

function setBpm(bpm) {
  bpm = Math.round(Math.min(240, Math.max(40, bpm)) * 100) / 100;
  if (!bpm) return;
  state.bpm = bpm;
  engine.setBpm(bpm);
  if (decks) { decks.update(); renderDecks(); }   // les decks synchronisés suivent le tempo
  $('#bpm').value = Math.round(bpm * 10) / 10;
  save();
}

function bindTempo() {
  $('#bpm').value = state.bpm;
  $('#bpm').addEventListener('change', e => setBpm(+e.target.value));
  const taps = [];
  $('#tap').addEventListener('click', () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 3) setBpm(60000 * (taps.length - 1) / (now - taps[0]));
  });

  $('#ed-bpm').addEventListener('change', e => {
    const pad = currentPad();
    if (!pad) return;
    pad.bpm = +e.target.value || 0;
    save();
  });
  // Suppose un nombre entier de mesures (1, 2, 4, 8…) et prend le tempo le plus proche du tempo global.
  $('#ed-bpm-auto').addEventListener('click', () => {
    const pad = currentPad();
    if (!pad?.buffer) return;
    const dur = pad.buffer.duration * (1 - toValue(PAGES.pad.params[4], pad.p.start));
    const candidates = [0.25, 0.5, 1, 2, 4, 8, 16].map(bars => 240 * bars / dur);
    pad.bpm = Math.round(candidates.reduce((a, b) => (Math.abs(Math.log2(b / state.bpm)) < Math.abs(Math.log2(a / state.bpm)) ? b : a)) * 100) / 100;
    renderEditor();
    save();
  });
}

// ---------- Table de mixage ----------

const MIX_PAGES = MIX_FIELDS.map(f => `mix_${f}`);   // pages de potards : Maj + piste 1 à 4
const mixField = page => (page?.startsWith('mix_') ? page.slice(4) : null);
const masterDef = () => PAGES.fx.params.find(d => d.id === 'master');
const stripEls = {};
const DEFAULT_FIELD = { vol: 0.75, pan: 0.5, delay: 0, reverb: 0 };

function fieldFmt(field, id, v) { return mixKnobDefs(field).find(d => d.ch === id).fmt(v); }

function buildMixer() {
  const wrap = $('#mixer');
  const fxOptions = Object.keys(FX_TYPES).map(k => `<option value="${k}">${t(`fx.${k}`)}</option>`).join('');
  for (const id of CHANNELS) {
    const el = document.createElement('div');
    el.className = 'strip';
    el.innerHTML = `
      <div class="strip-name">${t(`mix.ch.${id}`)}</div>
      <div class="fx-list"></div>
      <select class="fx-add"><option value="">${t('mix.addFx')}</option>${fxOptions}</select>
      ${['reverb', 'delay', 'pan'].map(f => `<label class="send"><span>${t(`mix.${f}`)}</span><input type="range" min="0" max="1" step="0.01" data-field="${f}"><em></em></label>`).join('')}
      <div class="fader"><canvas class="vu" width="6" height="150"></canvas><input type="range" min="0" max="1" step="0.005" data-field="vol" orient="vertical"></div>
      <div class="db"></div>
      <div class="ms"><button class="mute" title="${t('mix.mute')}">M</button><button class="solo" title="${t('mix.solo')}">S</button></div>`;
    const ch = () => state.mix.channels[id];
    for (const inp of el.querySelectorAll('input[data-field]')) {
      const field = inp.dataset.field;
      inp.addEventListener('input', () => { ch()[field] = +inp.value; onMixChange(id); });
      inp.addEventListener('dblclick', () => { ch()[field] = DEFAULT_FIELD[field]; onMixChange(id); });
    }
    el.querySelector('.mute').addEventListener('click', () => { ch().mute = !ch().mute; onMixChange(id); });
    el.querySelector('.solo').addEventListener('click', () => { ch().solo = !ch().solo; onMixChange(id); });
    el.querySelector('.fx-add').addEventListener('change', e => {
      const type = e.target.value;
      e.target.value = '';
      if (!type || ch().fx.length >= MAX_FX) return;
      ch().fx.push(newFx(type));
      mixer.rebuild(id);
      renderFx(id);
      save();
    });
    stripEls[id] = el;
    wrap.appendChild(el);
    renderFx(id);
  }
  // Voie master : volume général du moteur et vumètre de sortie.
  const m = document.createElement('div');
  m.className = 'strip master';
  m.innerHTML = `<div class="strip-name">${t('mix.master')}</div><div class="spacer"></div>
    <div class="fader"><canvas class="vu" width="6" height="150"></canvas><input type="range" min="0" max="1" step="0.005" orient="vertical"></div>
    <div class="db"></div>`;
  const mi = m.querySelector('input');
  mi.addEventListener('input', () => {
    state.globals.master = +mi.value;
    engine.set('master', toValue(masterDef(), state.globals.master));
    renderMixer();
    if (mixField(state.page) || state.page === 'fx') renderKnobs();
    save();
  });
  stripEls.master = m;
  wrap.appendChild(m);
  renderMixer();
  drawMixerMeters();
}

function onMixChange(id) {
  mixer.update();
  renderStrip(id);
  if (mixField(state.page)) renderKnobs();
  save();
}

function renderStrip(id) {
  const ch = state.mix.channels[id];
  const el = stripEls[id];
  for (const inp of el.querySelectorAll('input[data-field]')) {
    const field = inp.dataset.field;
    inp.value = ch[field];
    const em = inp.nextElementSibling;
    if (em?.tagName === 'EM') em.textContent = fieldFmt(field, id, ch[field]);
  }
  el.querySelector('.db').textContent = fieldFmt('vol', id, ch.vol);
  el.querySelector('.mute').classList.toggle('active', ch.mute);
  el.querySelector('.solo').classList.toggle('active', ch.solo);
}

function renderMixer() {
  if (!stripEls.master) return;
  for (const id of CHANNELS) renderStrip(id);
  stripEls.master.querySelector('input').value = state.globals.master;
  stripEls.master.querySelector('.db').textContent = masterDef().fmt(toValue(masterDef(), state.globals.master));
}

function renderFx(id) {
  const list = state.mix.channels[id].fx;
  const box = stripEls[id].querySelector('.fx-list');
  box.innerHTML = '';
  list.forEach((fx, k) => {
    const item = document.createElement('div');
    item.className = 'fx';
    item.innerHTML = `<div class="fx-head"><b>${t(`fx.${fx.type}`)}</b><button class="fx-del" title="${t('mix.removeFx')}">✕</button></div>`;
    for (const [key, [min, max, step]] of Object.entries(FX_TYPES[fx.type])) {
      const row = document.createElement('label');
      row.className = 'fx-param';
      row.innerHTML = `<span>${t(`fx.p.${key}`)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${fx.p[key]}"><em></em>`;
      const inp = row.querySelector('input');
      const em = row.querySelector('em');
      em.textContent = fxParamLabel(fx.type, key, fx.p[key], fx.p);
      inp.addEventListener('input', () => {
        fx.p[key] = +inp.value;
        mixer.updateFx(id, k);
        if (key === 'mode') renderFx(id); else em.textContent = fxParamLabel(fx.type, key, fx.p[key], fx.p);
        save();
      });
      item.appendChild(row);
    }
    item.querySelector('.fx-del').addEventListener('click', () => {
      list.splice(k, 1);
      mixer.rebuild(id);
      renderFx(id);
      save();
    });
    box.appendChild(item);
  });
  stripEls[id].querySelector('.fx-add').disabled = list.length >= MAX_FX;
}

function drawMixerMeters() {
  const levels = {};
  const master = new Float32Array(engine.analyser.fftSize);
  const draw = (cv, lvl) => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const h = Math.min(1, lvl) * cv.height;
    g.fillStyle = lvl > 0.95 ? '#ff5a36' : lvl > 0.7 ? '#ffd23f' : '#3dd68c';
    g.fillRect(0, cv.height - h, cv.width, h);
  };
  (function frame() {
    for (const id of CHANNELS) {
      levels[id] = Math.max(mixer.level(id), (levels[id] ?? 0) * 0.88);
      draw(stripEls[id].querySelector('.vu'), levels[id]);
    }
    engine.analyser.getFloatTimeDomainData(master);
    let peak = 0;
    for (const v of master) peak = Math.max(peak, Math.abs(v));
    levels.master = Math.max(peak, (levels.master ?? 0) * 0.88);
    draw(stripEls.master.querySelector('.vu'), levels.master);
    requestAnimationFrame(frame);
  })();
}

// ---------- TR-909 ----------

let trMode = false;          // grille de l'APC transformée en 909
let pageBeforeTr = 'synth';
let trAccentMode = false;    // les pas posés depuis l'APC sont accentués
let trHead = -1;             // pas en cours de lecture
const trPattern = () => state.tr.patterns[state.tr.pattern];

function toggleSeq() {
  drum.toggle();
  renderTr();
  renderLeds();
}

function toggleTrMode(on = !trMode) {
  trMode = on;
  if (on) {
    sceneMode = false;
    renderScenes();
    if (state.page !== 'tr') pageBeforeTr = state.page;
    setPage('tr');
    toast(t('tr.modeOn'), 5000);
  } else if (state.page === 'tr') {
    setPage(pageBeforeTr);
  }
  renderTr();
  renderLeds();
}

function selectTrInstr(id) {
  state.tr.sel = id;
  renderTr();
  if (state.page === 'tr') renderKnobs();
  renderLeds();
  save();
}

function cycleTrStep(id, step) {
  const row = trPattern()[id];
  row[step] = (row[step] + 1) % 3;   // silence -> note -> accent -> silence
  renderTr();
  renderLeds();
  save();
}

// Grille de l'APC en mode 909 : rangées 1-2 = 16 pas de l'instrument choisi, rangées 3-4 = instruments
// puis Accent / Effacer / Muet, rangée 5 = patterns.
function trPad(i) {
  const sel = state.tr.sel;
  const row = trPattern()[sel];
  if (i < 16) {
    row[i] = row[i] ? 0 : (trAccentMode ? 2 : 1);
  } else if (i < 16 + TR_INSTR.length) {
    const { id } = TR_INSTR[i - 16];
    drum.trigger(id);
    selectTrInstr(id);
    return;
  } else if (i === 27) {
    trAccentMode = !trAccentMode;
  } else if (i === 28) {
    row.fill(0);
  } else if (i === 29) {
    state.tr.mutes[sel] = !state.tr.mutes[sel];
  } else if (i >= 32) {
    drum.selectPattern(i - 32);
    return;
  }
  renderTr();
  renderLeds();
  save();
}

function onTrStep(step) {
  trHead = step;
  renderTrHead();
  if (trMode) renderTrLeds();
}

function renderTrLeds() {
  const GREEN = 21, RED = 5, YELLOW = 13;
  const sel = state.tr.sel;
  const pat = trPattern();
  for (let i = 0; i < 16; i++) {
    const v = pat[sel][i];
    if (i === trHead) apc.setPad(i, RED, 'on');
    else apc.setPad(i, v === 2 ? YELLOW : v ? GREEN : 0, v ? 'dim' : 'off');
  }
  TR_INSTR.forEach(({ id }, k) => {
    if (id === sel) apc.setPad(16 + k, YELLOW, 'on');
    else apc.setPad(16 + k, state.tr.mutes[id] ? RED : GREEN, 'dim');
  });
  apc.setPad(27, YELLOW, trAccentMode ? 'on' : 'dim');
  apc.setPad(28, RED, 'dim');
  apc.setPad(29, RED, state.tr.mutes[sel] ? 'on' : 'dim');
  apc.setPad(30, 0, 'off');
  apc.setPad(31, 0, 'off');
  for (let k = 0; k < PATTERNS; k++) {
    const used = TR_INSTR.some(({ id }) => state.tr.patterns[k][id].some(Boolean));
    if (k === state.tr.pattern) apc.setPad(32 + k, RED, 'on');
    else if (k === drum.queued) apc.setPad(32 + k, YELLOW, 'blink');
    else apc.setPad(32 + k, GREEN, used ? 'dim' : 'off');
  }
}

const trCells = [];   // trCells[instrument][pas]
function buildTr() {
  $('#tr-play').addEventListener('click', toggleSeq);
  $('#tr-apc').addEventListener('click', () => toggleTrMode());
  $('#tr-accent').addEventListener('input', e => { state.tr.globals.accent = e.target.value / 100; save(); });
  for (let k = 0; k < PATTERNS; k++) {
    const btn = document.createElement('button');
    btn.textContent = k + 1;
    btn.title = t('tr.pattern', { n: k + 1 });
    btn.addEventListener('click', () => drum.selectPattern(k));
    $('#tr-patterns').appendChild(btn);
  }
  const grid = $('#tr-grid');
  TR_INSTR.forEach(({ id }, r) => {
    const name = document.createElement('button');
    name.className = 'tr-name';
    name.textContent = id.toUpperCase();
    name.title = t(`tr.n.${id}`);
    name.addEventListener('click', () => { drum.trigger(id); selectTrInstr(id); });
    grid.appendChild(name);
    trCells[r] = [];
    for (let s = 0; s < 16; s++) {
      const cell = document.createElement('button');
      cell.className = 'tr-cell' + (s % 4 === 0 ? ' beat' : '');
      cell.addEventListener('click', () => cycleTrStep(id, s));
      grid.appendChild(cell);
      trCells[r][s] = cell;
    }
  });
  renderTr();
}

function renderTr() {
  const play = $('#tr-play');
  play.textContent = drum.running ? t('tr.stop') : t('tr.play');
  play.classList.toggle('active', drum.running);
  $('#tr-apc').classList.toggle('active', trMode);
  $('#tr-accent').value = Math.round(state.tr.globals.accent * 100);
  [...$('#tr-patterns').children].forEach((btn, k) => {
    btn.classList.toggle('active', k === state.tr.pattern);
    btn.classList.toggle('queued', k === drum.queued);
    btn.classList.toggle('used', TR_INSTR.some(({ id }) => state.tr.patterns[k][id].some(Boolean)));
  });
  const pat = trPattern();
  const names = $('#tr-grid').querySelectorAll('.tr-name');
  TR_INSTR.forEach(({ id }, r) => {
    names[r].classList.toggle('selected', id === state.tr.sel);
    names[r].classList.toggle('muted', !!state.tr.mutes[id]);
    trCells[r].forEach((cell, s) => {
      cell.classList.toggle('on', pat[id][s] === 1);
      cell.classList.toggle('accent', pat[id][s] === 2);
    });
  });
  renderTrHead();
}

function renderTrHead() {
  trCells.forEach(row => row.forEach((cell, s) => cell.classList.toggle('head', s === trHead)));
}

// ---------- Timeline (écran principal, façon eJay) ----------

// Pads et synthé : blocs posés en jouant ; TR-909 : enregistrement audio.
const TL_SOURCES = ['pads', 'synth', 'tr', 'acid', 'decks'];
const bufferCache = new Map();   // sampleId -> AudioBuffer des blocs
const peaksCache = new Map();    // sampleId -> crêtes pour dessiner la forme d'onde
let tlRecorder = null;
let tlRec = null;                // enregistrement en cours : { beat, time, track, source, startedDrum, bpm }
let tlSel = null;                // bloc sélectionné : { track, clip }

const beatPx = () => state.tl.zoom / BEATS_PER_BAR;
const snapBeat = (v, fine) => (fine ? Math.round(v) : Math.round(v / BEATS_PER_BAR) * BEATS_PER_BAR);

// Buffer d'un son : cache, sinon pad qui utilise ce son.
function clipBuffer(sampleId) {
  if (!sampleId) return null;   // blocs de notes du synthé : pas de son
  if (bufferCache.has(sampleId)) return bufferCache.get(sampleId);
  const pad = state.banks.flat().find(p => p?.sampleId === sampleId && p.buffer);
  if (pad) bufferCache.set(sampleId, pad.buffer);
  return pad?.buffer ?? null;
}

// Charge les sons qui ne sont sur aucun pad (enregistrements, sons de la bibliothèque remplacés…).
async function loadBuffers(ids) {
  await Promise.all([...new Set(ids)].map(async id => {
    if (clipBuffer(id)) return;
    if (id.startsWith('builtin:')) { const b = kit[+id.slice(8)]?.buffer; if (b) bufferCache.set(id, b); return; }
    let data = null;
    if (id.startsWith('lib:')) data = await fetch(`sounds/${id.slice(4)}`, { cache: 'no-cache' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    else data = (await store.loadSample(id).catch(() => null))?.data?.slice(0);
    if (data) { const b = await engine.ctx.decodeAudioData(data).catch(() => null); if (b) bufferCache.set(id, b); }
  }));
}
const loadTlBuffers = () => loadBuffers([...state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)), ...state.userSounds.map(s => s.sampleId)].filter(Boolean));
async function ensureBuffer(id) { if (!clipBuffer(id)) await loadBuffers([id]); return clipBuffer(id); }

function tlToggle() {
  if (tlRec) return tlStopRec();
  if (timeline.playing) timeline.stop(); else timeline.play(state.tl.playhead);
  renderTl();
  renderLeds();
}
const tlRecToggle = () => (tlRec ? tlStopRec() : tlStartRec());

// Point de captation de l'outil enregistré (après son fader, avant le master).
function tlSourceNode(source) {
  return source === 'master' ? engine.output : mixer.strips[source].mute;
}

async function tlStartRec() {
  if (timeline.playing) timeline.stop(true);
  const source = state.tl.source;
  if (!['tr', 'acid', 'decks'].includes(source)) {
    // Pads / synthé : on joue la timeline (en boucle si activée) et chaque coup devient un bloc.
    tlRec = { mode: 'events', source, open: new Map(), dirty: false };
    timeline.play(Math.round(state.tl.playhead));
    renderTl();
    renderLeds();
    return;
  }
  tlRecorder = new Recorder(engine.ctx, tlSourceNode(source));
  await tlRecorder.start();
  const beat = Math.round(state.tl.playhead);
  timeline.recording = true;
  const time = timeline.play(beat);
  let startedDrum = false;
  if (source === 'tr' && !drum.running) { drum.start(true); startedDrum = true; }   // la 909 joue calée sur la timeline
  let startedAcid = false;
  if (source === 'acid' && !acid.playing) { if (state.acid.link) { drum.start(true); startedDrum = true; } else acid.start(true); startedAcid = true; }
  tlRec = { beat, time, track: state.tl.armed, source, startedDrum, startedAcid, bpm: state.bpm, kicks: [] };
  renderTl();
  renderTr();
  renderLeds();
}

async function tlStopRec() {
  const rec = tlRec;
  if (!rec) return;
  if (rec.mode === 'events') {
    for (const clip of rec.open.values()) growHeldNote(clip);
    tlRec = null;
    timeline.stop(true);
    for (const tr of state.tl.tracks) for (const c of tr.clips) growSong(c);
    save();
    renderTl();
    renderLeds();
    return;
  }
  tlRec = null;
  timeline.recording = false;
  const raw = await tlRecorder.stopRaw();
  timeline.stop(true);
  if (rec.startedDrum) drum.stop();
  if (rec.startedAcid) acid.stop();
  renderAcid();
  const sr = raw.sampleRate;
  // Retire ce qui a été capté avant le temps de départ.
  const skip = Math.max(0, Math.round((rec.time - raw.startedAt) * sr));
  const chans = raw.channels.map(c => c.subarray(skip));
  if (chans[0].length > sr * 0.05) {
    const buffer = engine.ctx.createBuffer(2, chans[0].length, sr);
    chans.forEach((c, i) => buffer.copyToChannel(c, i));
    const id = `rec:${crypto.randomUUID()}`;
    const n = state.tl.tracks.flatMap(tr => tr.clips).filter(c => c.sampleId?.startsWith('rec:')).length + 1;
    const name = `${t(`tl.src.${rec.source}`)} ${n}`;
    await store.saveSample(id, { name, data: encodeWav(chans, sr) });
    bufferCache.set(id, buffer);
    const len = Math.max(1, Math.round(buffer.duration * rec.bpm / 60));
    const clip = { id: crypto.randomUUID(), start: rec.beat, len, sampleId: id, name, cat: 'rec', color: catColor('rec'), bpm: rec.bpm, loop: false };
    const kicks = rec.kicks.map(k => (k - rec.time) * rec.bpm / 60).filter(k => k >= 0 && k < len);
    if (kicks.length) clip.kickBeats = kicks.map(k => Math.round(k * 1000) / 1000);   // sidechain
    state.tl.tracks[rec.track].clips.push(clip);
    growSong(clip);
    tlSel = { track: rec.track, clip };
    renderLibrary();
    save();
  }
  renderTl();
  renderTr();
  renderLeds();
}

function growSong(clip) {
  state.tl.bars = Math.max(state.tl.bars, Math.ceil((clip.start + clip.len) / BEATS_PER_BAR));
}

// Pose un son de la bibliothèque : une boucle occupe ses mesures, un son court sa durée arrondie au temps.
async function tlPlaceItem(item, track, beat) {
  const buf = await ensureBuffer(item.sampleId);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  const natural = item.bpm ? buf.duration * item.bpm / 60 : buf.duration / timeline.beatDur;
  const len = item.loop ? (item.bars ? item.bars * BEATS_PER_BAR : Math.max(BEATS_PER_BAR, snapBeat(natural))) : Math.max(1, Math.ceil(natural - 0.05));
  const clip = { id: crypto.randomUUID(), start: beat, len, sampleId: item.sampleId, name: item.name, cat: item.cat, color: catColor(item.cat), bpm: item.bpm, loop: item.loop };
  state.tl.tracks[track].clips.push(clip);
  growSong(clip);
  tlSel = { track, clip };
  renderTl();
  save();
}

function tlDelete(track, clip) {
  const list = state.tl.tracks[track].clips;
  list.splice(list.indexOf(clip), 1);
  // Un enregistrement qui ne sert plus reste stocké jusqu'au prochain démarrage (voir cleanRecordings) : « Annuler » peut le ramener.
  if (clip.sampleId?.startsWith('rec:')) renderLibrary();
  if (tlSel?.clip === clip) tlSel = null;
  renderTl();
  save();
}

// Case visée sous la souris : { track, beat } (calée à la mesure, au temps avec Maj).
function tlTarget(ev) {
  const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
  if (!lane) return null;
  const r = lane.getBoundingClientRect();
  const raw = (ev.clientX - r.left) / beatPx();
  const beat = ev.shiftKey ? Math.floor(raw) : Math.floor(raw / BEATS_PER_BAR) * BEATS_PER_BAR;
  return { track: +lane.dataset.track, beat: Math.max(0, beat), lane };
}

function buildTl() {
  $('#tl-play').addEventListener('click', tlToggle);
  $('#tl-demo').addEventListener('click', loadDemo);
  $('#tl-export').addEventListener('click', () => exportSong(false));
  $('#tl-stems').addEventListener('click', () => exportSong(true));
  $('#tl-rec').addEventListener('click', tlRecToggle);
  $('#tl-loop').addEventListener('click', () => { state.tl.loop = !state.tl.loop; renderTl(); save(); });
  $('#tl-less').addEventListener('click', () => { state.tl.bars = Math.max(4, state.tl.bars - 4); renderTl(); save(); });
  $('#tl-more').addEventListener('click', () => { state.tl.bars = Math.min(256, state.tl.bars + 4); renderTl(); save(); });
  $('#tl-zoom-in').addEventListener('click', () => { state.tl.zoom = Math.min(240, state.tl.zoom * 1.25); renderTl(); save(); });
  $('#tl-zoom-out').addEventListener('click', () => { state.tl.zoom = Math.max(16, state.tl.zoom / 1.25); renderTl(); save(); });
  const sel = $('#tl-source');
  sel.innerHTML = TL_SOURCES.map(s => `<option value="${s}">${t(`tl.src.${s}`)}</option>`).join('');
  sel.addEventListener('change', () => { state.tl.source = sel.value; save(); });

  const grid = $('#tl-grid');
  grid.innerHTML = '<div class="tl-corner"></div><div class="tl-ruler" id="tl-ruler"></div>';
  $('#tl-ruler').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    state.tl.playhead = Math.max(0, Math.min(timeline.length - 1, snapBeat((e.clientX - r.left) / beatPx() - (e.shiftKey ? 0.5 : 2), e.shiftKey)));
    if (timeline.playing && !tlRec) timeline.play(state.tl.playhead);
    save();
  });
  for (let i = 0; i < TL_TRACKS; i++) {
    const head = document.createElement('div');
    head.className = 'tl-head';
    head.innerHTML = `<span>${t('tl.track', { n: i + 1 })}</span><button class="tl-arm" title="${t('tl.arm')}">●</button><button class="tl-mute" title="${t('mix.mute')}">M</button>`;
    head.querySelector('.tl-arm').addEventListener('click', () => { state.tl.armed = i; renderTl(); save(); });
    head.querySelector('.tl-mute').addEventListener('click', () => { state.tl.tracks[i].mute = !state.tl.tracks[i].mute; renderTl(); save(); });
    const lane = document.createElement('div');
    lane.className = 'tl-lane';
    lane.dataset.track = i;
    // Clic dans une case vide : pose le dernier son choisi dans la bibliothèque.
    lane.addEventListener('pointerdown', e => {
      if (e.target !== lane || e.button !== 0) return;
      if (!libSelected) { toast(t('tl.noItem'), 3000); return; }
      const target = tlTarget(e);
      if (target) tlPlaceItem(libSelected, target.track, target.beat);
    });
    grid.append(head, lane);
  }
  const line = document.createElement('div');
  line.className = 'tl-playhead';
  line.id = 'tl-playhead';
  grid.appendChild(line);
  window.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && tlSel && !['INPUT', 'SELECT'].includes(e.target.tagName)) tlDelete(tlSel.track, tlSel.clip);
  });
  timeline.onStop = () => { renderTl(); renderLeds(); };
  const scroll = $('#tl-scroll');
  (function frame() {
    if (tlRec?.mode === 'events') {
      for (const clip of tlRec.open.values()) growHeldNote(clip);
      if ((tlRec.dirty || tlRec.open.size) && performance.now() - lastRecRender > 100) { tlRec.dirty = false; lastRecRender = performance.now(); renderTl(); }
    }
    const x = 132 + timeline.position() * beatPx();
    line.style.left = `${x}px`;
    // Pendant la lecture, la vue suit la tête de lecture.
    if (timeline.playing && (x > scroll.scrollLeft + scroll.clientWidth - 60 || x < scroll.scrollLeft + 132)) scroll.scrollLeft = x - 200;
    requestAnimationFrame(frame);
  })();
  renderTl();
}

function renderTl() {
  const st = state.tl;
  const grid = $('#tl-grid');
  const lanes = [...grid.querySelectorAll('.tl-lane')];
  if (!lanes.length) return;
  const bp = beatPx();
  grid.style.setProperty('--beat', `${bp}px`);
  grid.style.setProperty('--bar', `${st.zoom}px`);
  grid.style.setProperty('--w', `${st.bars * st.zoom}px`);
  const every = st.zoom < 30 ? 4 : st.zoom < 50 ? 2 : 1;
  $('#tl-ruler').innerHTML = Array.from({ length: st.bars }, (_, b) => (b % every ? '' : `<span style="left:${b * st.zoom}px">${b + 1}</span>`)).join('');
  $('#tl-bars').textContent = t('tl.bars', { n: st.bars });
  $('#tl-source').value = st.source;
  $('#tl-loop').classList.toggle('active', st.loop);
  const play = $('#tl-play');
  play.textContent = timeline.playing && !tlRec ? t('tr.stop') : t('tr.play');
  play.classList.toggle('active', timeline.playing && !tlRec);
  const rec = $('#tl-rec');
  rec.textContent = tlRec ? t('tl.recStop') : t('tl.rec');
  rec.classList.toggle('active', !!tlRec);
  grid.querySelectorAll('.tl-head').forEach((h, i) => {
    h.querySelector('.tl-arm').classList.toggle('active', i === st.armed);
    h.querySelector('.tl-mute').classList.toggle('active', st.tracks[i].mute);
  });
  lanes.forEach((lane, i) => {
    lane.classList.toggle('muted', st.tracks[i].mute);
    lane.querySelectorAll('.tl-clip').forEach(c => c.remove());
    for (const clip of st.tracks[i].clips) lane.appendChild(clipEl(i, clip));
  });
}

function peaks(sampleId) {
  if (peaksCache.has(sampleId)) return peaksCache.get(sampleId);
  const buf = clipBuffer(sampleId);
  if (!buf) return null;
  const data = buf.getChannelData(0);
  const n = 400;
  const step = Math.max(1, Math.floor(data.length / n));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * step; j < (i + 1) * step && j < data.length; j += 8) m = Math.max(m, Math.abs(data[j]));
    out[i] = m;
  }
  peaksCache.set(sampleId, out);
  return out;
}

// Forme d'onde du bloc ; une boucle est redessinée à chaque répétition.
function drawClip(cv, clip) {
  const w = cv.width = Math.max(1, Math.floor(cv.clientWidth));
  const h = cv.height = Math.max(1, Math.floor(cv.clientHeight));
  const g = cv.getContext('2d');
  if (clip.type === 'note') return;
  const p = peaks(clip.sampleId);
  if (!p) return;
  const natural = timeline.naturalBeats(clip) * beatPx();
  g.fillStyle = 'rgba(0,0,0,.4)';
  for (let x = 0; x < w; x++) {
    const pos = clip.loop ? (x % natural) / natural : x / natural;
    if (pos >= 1) break;
    const bar = Math.max(1, p[Math.floor(pos * p.length)] * h * 0.9);
    g.fillRect(x, (h - bar) / 2, 1, bar);
  }
  if (clip.loop) {   // repère de chaque répétition
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = natural; x < w; x += natural) g.fillRect(Math.round(x), 0, 1, h);
  }
}

function clipEl(track, clip) {
  const bp = beatPx();
  const el = document.createElement('div');
  el.className = 'tl-clip' + (tlSel?.clip === clip ? ' selected' : '') + (clip.loop ? ' loop' : '') + (clip.type ? ` ${clip.type}` : '');
  el.style.left = `${clip.start * bp}px`;
  el.style.width = `${Math.max(4, timeline.clipBeats(clip) * bp - 1)}px`;
  el.style.setProperty('--c', PALETTE[uiColor(clip.color ?? catColor(clip.cat))]);
  el.title = `${clip.name}${clip.preset ? ` · ${presetById(clip.preset).name}` : ''} — ${t('tl.clipTitle')}`;
  const cv = document.createElement('canvas');
  const label = document.createElement('span');
  label.textContent = clip.name;
  const grip = document.createElement('div');
  grip.className = 'tl-grip';
  el.append(cv, label, grip);
  requestAnimationFrame(() => drawClip(cv, clip));
  el.addEventListener('contextmenu', e => { e.preventDefault(); tlDelete(track, clip); });
  el.addEventListener('dblclick', () => {
    if (clip.type === 'note') {
      const patch = clip.preset ? presetPatch(clip.preset) : undefined;
      (clip.notes ?? [clip.note]).forEach((n, k) => {
        engine.noteOn(n, clip.vel ?? 0.85, undefined, `preview:${k}`, patch);
        setTimeout(() => engine.noteOff(n, false, undefined, `preview:${k}`), clip.preset ? 600 : 250);
      });
    }
    else if (clip.type === 'pad' && state.banks[clip.bank]?.[clip.pad]) engine.playPad(padKey(clip.bank, clip.pad), state.banks[clip.bank][clip.pad], { oneShot: true });
    else previewSample({ sampleId: clip.sampleId, name: clip.name });
  });

  // Glisser le bloc (Alt = copie) ; glisser son bord droit = longueur (une boucle se répète).
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const resizing = e.target === grip;
    let target = clip;
    let where = track;
    if (e.altKey && !resizing) {
      target = { ...clip, id: crypto.randomUUID() };
      state.tl.tracks[track].clips.push(target);
    }
    tlSel = { track: where, clip: target };
    const startX = e.clientX;
    const origStart = target.start;
    const origLen = timeline.clipBeats(target);
    let moved = target !== clip;
    const onMove = ev => {
      const dx = (ev.clientX - startX) / beatPx();
      if (resizing) {
        const len = Math.max(1, ev.shiftKey ? Math.round(origLen + dx) : Math.max(BEATS_PER_BAR, snapBeat(origLen + dx)));
        if (len === target.len) return;
        target.len = len;
      } else {
        const start = Math.max(0, snapBeat(origStart + dx, ev.shiftKey));
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
        const to = lane ? +lane.dataset.track : where;
        if (start === target.start && to === where) return;
        target.start = start;
        if (to !== where) {
          const from = state.tl.tracks[where].clips;
          from.splice(from.indexOf(target), 1);
          state.tl.tracks[to].clips.push(target);
          where = to;
          tlSel = { track: where, clip: target };
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


// ---------- Enregistrement en jouant (pads et piano -> blocs posés en direct) ----------

const REC_GRID = 0.25;   // calage des coups : la double-croche
let lastRecRender = 0;
const snapRec = v => Math.round(v / REC_GRID) * REC_GRID;
const noteLabel = n => `${t('notes')[n % 12]}${Math.floor(n / 12) - 1}`;

// Piste libre à cet endroit : la piste armée, sinon la suivante qui ne contient rien à ce moment-là.
function freeTrack(start, len) {
  const tracks = state.tl.tracks;
  for (let k = 0; k < tracks.length; k++) {
    const i = (state.tl.armed + k) % tracks.length;
    const busy = tracks[i].clips.some(c => c.start < start + len - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6);
    if (!busy) return i;
  }
  return state.tl.armed;
}

function recPosition() {
  const pos = timeline.position();
  return snapRec(timeline.length ? pos % timeline.length : pos);
}

function tlRecordPad(bank, i) {
  if (tlRec?.mode !== 'events' || tlRec.source !== 'pads' || !timeline.playing) return;
  const pad = state.banks[bank][i];
  if (!pad?.buffer) return;
  const start = recPosition();
  const len = Math.max(REC_GRID, Math.ceil(pad.buffer.duration / timeline.beatDur / REC_GRID) * REC_GRID);
  const clip = { id: crypto.randomUUID(), type: 'pad', bank, pad: i, sampleId: pad.sampleId, name: pad.name, color: pad.color, cat: 'drums', start, len, loop: false };
  state.tl.tracks[freeTrack(start, len)].clips.push(clip);
  tlRec.dirty = true;
}

function tlRecordNote(note, on, velocity = 0.85) {
  if (tlRec?.mode !== 'events' || tlRec.source !== 'synth' || !timeline.playing) return;
  if (on) {
    const start = recPosition();
    const clip = { id: crypto.randomUUID(), type: 'note', note, vel: velocity, name: noteLabel(note), color: catColor('lead'), cat: 'lead', start, len: REC_GRID, loop: false };
    state.tl.tracks[freeTrack(start, REC_GRID)].clips.push(clip);
    tlRec.open.set(note, clip);   // s'allonge tant que la touche est tenue
  } else {
    const clip = tlRec.open.get(note);
    if (!clip) return;
    tlRec.open.delete(note);
    growHeldNote(clip);
  }
  tlRec.dirty = true;
}

// Note de l'arpège programmée à l'instant `when` (secondes) pour `dur` secondes : calée sur la triple-croche.
const ARP_GRID = 0.125;
function tlRecordArpNote(note, vel, when, dur) {
  if (tlRec?.mode !== 'events' || tlRec.source !== 'synth' || !timeline.playing) return;
  let pos = timeline.position() + (when - engine.ctx.currentTime) / timeline.beatDur;
  if (timeline.length) pos %= timeline.length;
  const start = Math.round(pos / ARP_GRID) * ARP_GRID;
  const len = Math.max(ARP_GRID, Math.round(dur / timeline.beatDur / ARP_GRID) * ARP_GRID);
  const clip = { id: crypto.randomUUID(), type: 'note', note, vel, name: noteLabel(note), color: catColor('lead'), cat: 'lead', start, len, loop: false };
  state.tl.tracks[freeTrack(start, len)].clips.push(clip);
  tlRec.dirty = true;
}

function growHeldNote(clip) {
  let end = timeline.position();
  if (timeline.length) { end %= timeline.length; if (end < clip.start) end += timeline.length; }
  clip.len = Math.max(REC_GRID, snapRec(end - clip.start));
}


// ---------- Démo ----------

// Charge le morceau de démonstration (demo/demo.json) dans la timeline, avec les sons de la bibliothèque.
async function loadDemo() {
  if (state.tl.tracks.some(tr => tr.clips.length) && !confirm(t('tl.demoConfirm'))) return;
  const demo = await fetch('demo/demo.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!demo || !libManifest) { toast(t('lib.loadFail'), 3000); return; }
  if (tlRec) await tlStopRec();
  timeline.stop(true);
  setBpm(demo.bpm);
  const find = (bank, sound) => libManifest.banks.find(b => b.name === bank)?.pads.find(p => p?.name === sound);
  const tracks = state.tl.tracks.map(() => ({ mute: false, clips: [] }));
  const pending = [];
  demo.tracks.slice(0, tracks.length).forEach((list, i) => {
    for (const e of list) {
      const p = find(e.bank, e.sound);
      if (!p) continue;
      const clip = {
        id: crypto.randomUUID(), start: e.bar * BEATS_PER_BAR, len: e.bars ? e.bars * BEATS_PER_BAR : null,
        sampleId: `lib:${p.file}`, name: soundName(p.name), cat: p.cat, color: catColor(p.cat),
        bpm: p.bpm || 0, loop: p.mode === 2, gain: (e.gain ?? 1) * (demo.gain ?? 1),
      };
      tracks[i].clips.push(clip);
      pending.push(clip);
    }
  });
  await loadBuffers(pending.map(c => c.sampleId));
  for (const clip of pending) if (clip.len === null) clip.len = Math.max(1, Math.ceil(timeline.naturalBeats(clip) - 0.05));
  // Les enregistrements remplacés restent stockés jusqu'au prochain démarrage : « Annuler » peut ramener l'ancienne timeline.
  state.tl.tracks = tracks;
  state.tl.bars = demo.bars;
  state.tl.playhead = 0;
  tlSel = null;
  renderTl();
  renderLibrary();
  save();
  toast(t('tl.demoLoaded', { bpm: demo.bpm }), 5000);
}

// ---------- Bibliothèque de sons ----------

let libManifest = null;
let libCat = 'kick';
let libQuery = '';
let libSelected = null;     // dernier son choisi : un clic dans une case vide le pose
let libPreview = null;      // { src, sampleId }

function previewSample(item) {
  const same = libPreview?.sampleId === item.sampleId;
  if (libPreview) { try { libPreview.src.stop(); } catch { /* déjà fini */ } libPreview = null; renderLibraryPlaying(); }
  if (same) return;
  ensureBuffer(item.sampleId).then(buf => {
    if (!buf) return;
    const src = engine.ctx.createBufferSource();
    src.buffer = buf;
    if (item.bpm) src.playbackRate.value = state.bpm / item.bpm;
    src.connect(engine.master);
    src.start();
    libPreview = { src, sampleId: item.sampleId };
    src.onended = () => { if (libPreview?.src === src) { libPreview = null; renderLibraryPlaying(); } };
    renderLibraryPlaying();
  });
}

function buildLibrary() {
  $('#lib-search').addEventListener('input', e => { libQuery = e.target.value.trim().toLowerCase(); renderLibrary(); });
  renderLibrary();
}

function renderLibrary() {
  const list = $('#lib-list');
  if (!list || !kit) return;
  const items = libraryItems({ manifest: libManifest, kit, banks: state.banks, tl: state.tl, userSounds: state.userSounds });
  const counts = Object.fromEntries(LIB_CATS.map(c => [c.id, items.filter(i => i.cat === c.id).length]));
  $('#lib-cats').innerHTML = '';
  for (const c of LIB_CATS) {
    if (!counts[c.id] && (c.id === 'mine' || c.id === 'rec')) continue;
    const btn = document.createElement('button');
    btn.className = 'lib-cat' + (c.id === libCat && !libQuery ? ' active' : '');
    btn.style.setProperty('--c', PALETTE[uiColor(c.color)]);
    btn.innerHTML = `<i></i>${t(`lib.cat.${c.id}`)}<small>${counts[c.id]}</small>`;
    btn.addEventListener('click', () => { libCat = c.id; libQuery = ''; $('#lib-search').value = ''; renderLibrary(); });
    $('#lib-cats').appendChild(btn);
  }
  const shown = libQuery ? items.filter(i => i.name.toLowerCase().includes(libQuery)) : items.filter(i => i.cat === libCat);
  list.innerHTML = '';
  for (const item of shown) {
    const row = document.createElement('div');
    row.className = 'lib-item' + (libSelected?.sampleId === item.sampleId ? ' selected' : '');
    row.dataset.id = item.sampleId;
    row.style.setProperty('--c', PALETTE[uiColor(catColor(item.cat))]);
    row.innerHTML = `<i></i><span>${item.name}</span><small>${item.loop ? t('lib.bars', { n: item.bars || '↻' }) : t('lib.oneshot')}</small>`;
    row.addEventListener('pointerdown', e => startLibDrag(e, item));
    if (item.own) { row.title = t('lib.ownTitle'); row.addEventListener('contextmenu', e => { e.preventDefault(); removeUserSound(item); }); }
    list.appendChild(row);
  }
  if (!shown.length) list.innerHTML = `<p class="hint">${t('lib.empty')}</p>`;
  renderLibraryPlaying();
}

function renderLibraryPlaying() {
  for (const row of $('#lib-list').querySelectorAll('.lib-item')) row.classList.toggle('playing', row.dataset.id === libPreview?.sampleId);
}

// Glisser un son de la bibliothèque vers la timeline ; un simple clic le pré-écoute et le choisit.
function startLibDrag(e, item) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX;
  const sy = e.clientY;
  let ghost = null;
  let target = null;
  const drop = document.createElement('div');
  drop.className = 'tl-drop';
  const onMove = ev => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'lib-ghost';
      ghost.textContent = item.name;
      ghost.style.setProperty('--c', PALETTE[uiColor(catColor(item.cat))]);
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${ev.clientX + 12}px`;
    ghost.style.top = `${ev.clientY + 8}px`;
    const deckEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.deck');
    for (const d of document.querySelectorAll('.deck.dragover')) if (d !== deckEl) d.classList.remove('dragover');
    deckEl?.classList.add('dragover');
    target = deckEl ? { deck: deckEl.dataset.deck } : tlTarget(ev);
    if (target && !target.deck) {
      const bars = item.loop && item.bars ? item.bars : 1;
      Object.assign(drop.style, { left: `${target.beat * beatPx()}px`, width: `${bars * state.tl.zoom}px` });
      target.lane.appendChild(drop);
    } else drop.remove();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    drop.remove();
    ghost?.remove();
    libSelected = item;
    if (!ghost) { previewSample(item); renderLibrary(); return; }
    for (const d of document.querySelectorAll('.deck.dragover')) d.classList.remove('dragover');
    if (target?.deck) loadDeck(target.deck, item);
    else if (target) tlPlaceItem(item, target.track, target.beat);
    renderLibrary();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------- Fenêtres des plugins ----------

function buildPluginBar() {
  const nav = $('#plugins');
  for (const id of WINDOWS) {
    const btn = document.createElement('button');
    btn.dataset.plugin = id;
    btn.textContent = t(`win.${id}`);
    btn.addEventListener('click', () => wm.toggle(id));
    nav.appendChild(btn);
  }
  renderPluginBar();
}

function renderPluginBar() {
  for (const btn of $('#plugins').children) btn.classList.toggle('active', wm.isOpen(btn.dataset.plugin));
}

function onWindowToggle(id, open) {
  renderPluginBar();
  if (open && id === 'piano') buildPiano();
  if (open && id === 'decks') requestAnimationFrame(() => DECK_IDS.forEach(drawDeckWave));   // à la bonne largeur
}

// ---------- Scènes ----------

const SCENES = 40;
let sceneMode = false;        // grille de l'APC = 40 scènes
let sceneSaveMode = false;    // à l'écran : un clic enregistre au lieu de lancer
let currentScene = null;
let queuedScene = null;

function mergeScenes(saved) {
  const out = new Array(SCENES).fill(null);
  if (Array.isArray(saved)) saved.slice(0, SCENES).forEach((s, i) => { out[i] = s ?? null; });
  return out;
}

function toggleSceneMode(on = !sceneMode) {
  sceneMode = on;
  if (on) {
    if (trMode) toggleTrMode(false);
    toast(t('scene.modeOn'), 5000);
  }
  renderScenes();
  renderLeds();
}

// Mémorise l'état actuel : boucles lancées, patterns, pistes muettes, mixeur, preset, tempo, lecture.
function captureScene(n) {
  state.scenes[n] = {
    tr: { pattern: drum.queued ?? state.tr.pattern, mutes: { ...state.tr.mutes } },
    loops: [...engine.padVoices].filter(([, v]) => v.mode === 'loop').map(([k]) => k),
    running: drum.running,
    acid: { pattern: acid.queued ?? state.acid.pattern, running: acid.running },
    mix: Object.fromEntries(CHANNELS.map(id => {
      const { vol, pan, delay, reverb, mute, solo } = state.mix.channels[id];
      return [id, { vol, pan, delay, reverb, mute, solo }];
    })),
    preset: state.preset,
    bpm: state.bpm,
  };
  currentScene = n;
  toast(t('scene.saved', { n: n + 1 }));
  renderScenes();
  renderLeds();
  save();
}

// Rappelle une scène : tout bascule au début de la mesure suivante.
function launchScene(n) {
  const sc = state.scenes[n];
  if (!sc) { toast(t('scene.empty', { n: n + 1 }), 3500); return; }
  const ctx = engine.ctx;
  if (sc.bpm && sc.bpm !== state.bpm) setBpm(sc.bpm);
  const busy = drum.running || [...engine.padVoices.values()].some(v => v.mode === 'loop');
  const at = busy ? engine.nextBar() : ctx.currentTime;
  queuedScene = n;
  drum.selectPattern(sc.tr.pattern);
  for (const [key, v] of [...engine.padVoices]) {
    if (v.mode === 'loop' && !sc.loops.includes(key)) engine.stopPad(key, 0.01, at);
  }
  for (const key of sc.loops) {
    if (engine.padVoices.has(key)) continue;
    const pad = state.banks[Math.floor(key / 40)]?.[key % 40];
    if (pad?.buffer && engine.padMode(pad) === 'loop') engine.playPad(key, pad);   // démarre à la mesure suivante
  }
  if (sc.running && !drum.running) drum.start();
  if (sc.acid) { acid.selectPattern(sc.acid.pattern); if (sc.acid.running && !acid.playing) acid.start(true); }
  const apply = () => {
    if (queuedScene !== n) return;   // une autre scène a été demandée entre-temps
    state.tr.mutes = { ...sc.tr.mutes };
    for (const id of CHANNELS) if (sc.mix?.[id]) Object.assign(state.mix.channels[id], sc.mix[id]);
    mixer.update();
    renderMixer();
    if (sc.preset !== undefined && migratePreset(sc.preset) !== state.preset) applyPreset(migratePreset(sc.preset));
    if (!sc.running && drum.running) drum.stop();
    if (sc.acid && !sc.acid.running && acid.running) acid.stop();
    renderAcid();
    currentScene = n;
    queuedScene = null;
    renderScenes();
    renderTr();
    renderLeds();
    save();
  };
  setTimeout(apply, Math.max(0, (at - ctx.currentTime) * 1000 - 10));
  renderScenes();
  renderTr();
  renderLeds();
}

function clearScene(n) {
  if (!state.scenes[n] || !confirm(t('scene.confirmClear', { n: n + 1 }))) return;
  state.scenes[n] = null;
  if (currentScene === n) currentScene = null;
  renderScenes();
  renderLeds();
  save();
}

function renderSceneLeds() {
  const GREEN = 21, RED = 5, YELLOW = 13;
  for (let i = 0; i < SCENES; i++) {
    if (i === queuedScene) apc.setPad(i, YELLOW, 'blink');
    else if (i === currentScene) apc.setPad(i, RED, 'on');
    else apc.setPad(i, GREEN, state.scenes[i] ? 'dim' : 'off');
  }
}

const sceneEls = [];
function buildScenes() {
  $('#scene-save').addEventListener('click', () => { sceneSaveMode = !sceneSaveMode; renderScenes(); });
  $('#scene-apc').addEventListener('click', () => toggleSceneMode());
  const grid = $('#scenes');
  // Même disposition que la grille de l'APC : scènes 1-8 en bas, 33-40 en haut.
  for (let row = 4; row >= 0; row--) {
    for (let col = 0; col < 8; col++) {
      const n = row * 8 + col;
      const btn = document.createElement('button');
      btn.className = 'scene';
      btn.addEventListener('click', e => { if (e.shiftKey || sceneSaveMode) captureScene(n); else launchScene(n); });
      btn.addEventListener('contextmenu', e => { e.preventDefault(); clearScene(n); });
      sceneEls[n] = btn;
      grid.appendChild(btn);
    }
  }
  renderScenes();
}

function renderScenes() {
  $('#scene-save').classList.toggle('active', sceneSaveMode);
  $('#scene-apc').classList.toggle('active', sceneMode);
  sceneEls.forEach((btn, n) => {
    const sc = state.scenes[n];
    btn.innerHTML = `<b>${n + 1}</b><small>${sc ? t('scene.summary', { tr: sc.tr.pattern + 1, loops: sc.loops.length }) : ''}</small>`;
    btn.classList.toggle('empty', !sc);
    btn.classList.toggle('current', n === currentScene);
    btn.classList.toggle('queued', n === queuedScene);
  });
}

// ---------- Presets du synthé ----------

let synthFamily = 'leads';   // famille affichée dans la fenêtre du synthé
const synthKnobDefs = () => SYNTH_KNOBS[familyGroup(presetById(state.preset).family)].map(id => PAGES.synth.params.find(d => d.id === id));

function applyPreset(id) {
  const preset = presetById(id);
  state.preset = preset.id;
  synthFamily = preset.family;
  // Tous les potards du synthé : valeur du preset, sinon valeur par défaut.
  for (const def of PAGES.synth.params) {
    const v = preset.values[def.id] ?? def.def;
    state.globals[def.id] = Math.min(1, Math.max(0, toPos(def, v)));
    engine.set(def.id, toValue(def, state.globals[def.id]));
  }
  engine.setVoice(preset.voice);
  renderPresets();
  renderKnobs();
  toast(t('preset.toast', { name: `${t(`family.${preset.family}`)} · ${preset.name}` }));
  save();
}

// Maj + touche du clavier : touches blanches = presets de la famille, do# / ré# = famille précédente / suivante.
function presetKey(note) {
  const pc = note % 12;
  if (pc === 6) { setPlay({ chord: CHORD_MODES[(CHORD_MODES.indexOf(state.play.chord) + 1) % CHORD_MODES.length] }, true); return true; }
  if (pc === 8) { setPlay({ arp: !state.play.arp }, true); return true; }
  if (pc === 10) { setPlay({ rate: ARP_RATES[(ARP_RATES.indexOf(state.play.rate) + 1) % ARP_RATES.length] }, true); return true; }
  if (pc === 1 || pc === 3) {
    const i = FAMILIES.indexOf(synthFamily);
    synthFamily = FAMILIES[(i + (pc === 1 ? -1 : 1) + FAMILIES.length) % FAMILIES.length];
    renderPresets();
    toast(t('preset.family', { name: t(`family.${synthFamily}`) }));
    return true;
  }
  const k = WHITE_KEYS.indexOf(pc);
  if (k < 0) return false;
  const list = PRESETS.filter(p => p.family === synthFamily);
  if (list[k]) applyPreset(list[k].id);
  return true;
}

function buildPresets() {
  synthFamily = presetById(state.preset).family;
  for (const f of FAMILIES) {
    const btn = document.createElement('button');
    btn.dataset.family = f;
    btn.textContent = t(`family.${f}`);
    btn.addEventListener('click', () => { synthFamily = f; renderPresets(); });
    $('#synth-families').appendChild(btn);
  }
  buildSynthKnobs();
  buildPlayControls();
  renderPresets();
}

function renderPresets() {
  const current = presetById(state.preset);
  for (const btn of $('#synth-families').children) {
    btn.classList.toggle('active', btn.dataset.family === synthFamily);
    btn.classList.toggle('current', btn.dataset.family === current.family);
  }
  const box = $('#presets');
  box.innerHTML = '';
  PRESETS.filter(p => p.family === synthFamily).forEach((preset, k) => {
    const btn = document.createElement('button');
    btn.textContent = preset.name;
    btn.title = t('preset.title', { key: t('notes')[WHITE_KEYS[k]] });
    btn.classList.toggle('active', preset.id === state.preset);
    btn.addEventListener('click', () => applyPreset(preset.id));
    box.appendChild(btn);
  });
  renderSynthKnobs();
}

// Les 8 potards d'expression dans la fenêtre du synthé (les mêmes que la page Synthé de l'APC).
const synthKnobEls = [];
function buildSynthKnobs() {
  const wrap = $('#synth-knobs');
  for (let k = 0; k < 8; k++) {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label"></div>`;
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      turnSynthKnob(k, { delta: (lastY - e.clientY) / 2 * (e.shiftKey ? 0.25 : 1) });
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turnSynthKnob(k, { delta: e.deltaY < 0 ? 2 : -2 }); }, { passive: false });
    el.addEventListener('dblclick', () => {
      const def = synthKnobDefs()[k];
      const preset = presetById(state.preset);
      turnSynthKnob(k, { value: toPos(def, preset.values[def.id] ?? def.def) });   // retour à la valeur du preset
    });
    synthKnobEls[k] = el;
    wrap.appendChild(el);
  }
}

function turnSynthKnob(k, { delta, value }) {
  const def = synthKnobDefs()[k];
  const pos = value ?? Math.min(1, Math.max(0, state.globals[def.id] + delta * 0.01));
  state.globals[def.id] = pos;
  engine.set(def.id, toValue(def, pos));
  renderSynthKnobs();
  if (state.page === 'synth') renderKnobs();
  save();
}

function renderSynthKnobs() {
  synthKnobDefs().forEach((def, k) => {
    const el = synthKnobEls[k];
    if (!el) return;
    const p = state.globals[def.id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.label').textContent = def.label;
    el.querySelector('.value').textContent = def.fmt(toValue(def, p));
  });
}

// ---------- Mode accords et arpégiateur ----------

function setPlay(changes, announce = false) {
  Object.assign(state.play, changes);
  performer.refresh();
  renderPlayControls();
  if (announce) {
    const p = state.play;
    toast(p.arp ? t('play.toastArp', { chord: t(`chord.${p.chord}`), rate: `1/${p.rate}`, mode: t(`arp.${p.mode}`) }) : t('play.toastChord', { chord: t(`chord.${p.chord}`) }));
  }
  save();
}

function buildPlayControls() {
  const box = $('#synth-play');
  const select = (field, values, label, cast = v => v) => {
    const el = document.createElement('select');
    el.dataset.field = field;
    el.title = t(`play.${field}`);
    for (const v of values) el.add(new Option(label(v), v));
    el.addEventListener('change', () => setPlay({ [field]: cast(el.value) }));
    return el;
  };
  const toggle = field => {
    const el = document.createElement('button');
    el.dataset.field = field;
    el.textContent = t(`play.${field}`);
    el.title = t(`play.${field}Title`);
    el.addEventListener('click', () => setPlay({ [field]: !state.play[field] }));
    return el;
  };
  const group = (title, ...els) => {
    const g = document.createElement('div');
    g.className = 'play-group';
    const h = document.createElement('span');
    h.textContent = title;
    g.append(h, ...els);
    return g;
  };
  const gate = document.createElement('input');
  gate.type = 'range'; gate.min = 0.1; gate.max = 1; gate.step = 0.05;
  gate.dataset.field = 'gate';
  gate.title = t('play.gate');
  gate.addEventListener('input', () => setPlay({ gate: +gate.value }));
  box.append(
    group(t('play.chords'), select('chord', CHORD_MODES, v => t(`chord.${v}`))),
    group(t('play.arpeggio'), toggle('arp'),
      select('rate', ARP_RATES, v => `1/${v}`, Number),
      select('mode', ARP_MODES, v => t(`arp.${v}`)),
      select('octaves', [1, 2, 3], v => t('play.oct', { n: v }), Number),
      gate, toggle('latch')),
  );
  renderPlayControls();
}

function renderPlayControls() {
  const p = state.play;
  for (const el of document.querySelectorAll('#synth-play [data-field]')) {
    const f = el.dataset.field;
    if (el.tagName === 'BUTTON') el.classList.toggle('active', !!p[f]);
    else el.value = p[f];
    if (!['arp', 'chord'].includes(f)) el.disabled = !p.arp;
  }
}

// ---------- Générateur de nappes ----------

// Pose sur la timeline des blocs d'accords (cordes, nappes…) à partir d'une suite d'accords, chacun joué avec son preset.
const GEN_SOUNDS = ['strings', 'pads', 'choirs', 'supersaw', 'stabs', 'keys'];
const GEN_REGISTERS = { low: 55, mid: 62, high: 69 };
const GEN_RHYTHMS = ['hold', 'beats', 'offbeat', 'eighths'];
const GEN_BASS = { none: null, sub: { preset: 'sub_bass', rhythm: 'hold' }, offbeat: { preset: 'bass', rhythm: 'offbeat' }, reese: { preset: 'reese', rhythm: 'hold' } };
const defaultGen = () => ({ prog: PROGRESSIONS[0], preset: 'epic_strings', register: 'mid', bars: 2, repeat: 2, rhythm: 'hold', bass: 'none' });

function mergeGen(saved) {
  const g = defaultGen();
  if (!saved || typeof saved !== 'object') return g;
  if (typeof saved.prog === 'string') g.prog = saved.prog;
  if (saved.preset === 'current' || PRESETS.some(p => p.id === saved.preset)) g.preset = saved.preset;
  if (saved.register in GEN_REGISTERS) g.register = saved.register;
  if ([1, 2, 4].includes(saved.bars)) g.bars = saved.bars;
  if ([1, 2, 4].includes(saved.repeat)) g.repeat = saved.repeat;
  if (GEN_RHYTHMS.includes(saved.rhythm)) g.rhythm = saved.rhythm;
  if (saved.bass in GEN_BASS) g.bass = saved.bass;
  return g;
}

// Réglages d'un preset pour un bloc de la timeline (indépendants du preset joué au clavier).
const patchCache = new Map();
function presetPatch(id) {
  if (!patchCache.has(id)) {
    const preset = presetById(id);
    const values = Object.fromEntries(PAGES.synth.params.map(d => [d.id, preset.values[d.id] ?? d.def]));
    patchCache.set(id, { cfg: preset.voice, values });
  }
  return patchCache.get(id);
}

// Coups d'un accord qui dure `beats` temps : [début, longueur] en temps.
function genHits(rhythm, beats) {
  if (rhythm === 'hold') return [[0, beats]];
  const hits = [];
  for (let b = 0; b < beats; b++) {
    if (rhythm === 'beats') hits.push([b, 0.9]);
    else if (rhythm === 'offbeat') hits.push([b + 0.5, 0.4]);
    else hits.push([b, 0.4], [b + 0.5, 0.4]);
  }
  return hits;
}

// Son choisi, ou le preset joué au clavier.
const genPreset = () => (state.gen.preset === 'current' ? state.preset : state.gen.preset);

function generatePads() {
  const g = state.gen;
  const { chords, bad } = parseProgression(g.prog);
  if (!chords.length) { toast(t('gen.none'), 3000); return; }
  const voiced = voiceChords(chords, GEN_REGISTERS[g.register]);
  const chordBeats = g.bars * BEATS_PER_BAR;
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const total = chordBeats * chords.length * g.repeat;
  const blocks = (notesOf, rhythm, preset, cat) => {
    const out = [];
    for (let r = 0; r < g.repeat; r++) {
      chords.forEach((c, i) => {
        const at = start + (r * chords.length + i) * chordBeats;
        for (const [o, len] of genHits(rhythm, chordBeats)) {
          out.push({ id: crypto.randomUUID(), type: 'note', notes: notesOf(i), vel: 0.8, preset, name: c.name, cat, color: catColor(cat), start: at + o, len, loop: false });
        }
      });
    }
    return out;
  };
  // Une piste entièrement libre sur toute la durée, à partir de la piste armée.
  const used = [];
  const lane = () => {
    const tracks = state.tl.tracks;
    for (let k = 0; k < tracks.length; k++) {
      const i = (state.tl.armed + k) % tracks.length;
      if (used.includes(i)) continue;
      if (!tracks[i].clips.some(c => c.start < start + total - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6)) return i;
    }
    return -1;
  };
  const bass = GEN_BASS[g.bass];
  const lanes = [lane()];
  if (lanes[0] >= 0) used.push(lanes[0]);
  if (bass) { lanes.push(lane()); }
  if (lanes.some(i => i < 0)) { toast(t('gen.full', { bars: total / BEATS_PER_BAR, bar: start / BEATS_PER_BAR + 1 }), 4000); return; }
  state.tl.tracks[lanes[0]].clips.push(...blocks(i => voiced[i], g.rhythm, genPreset(), 'pad'));
  if (bass) state.tl.tracks[lanes[1]].clips.push(...blocks(i => [bassNote(chords[i])], bass.rhythm, bass.preset, 'bass'));
  if (start + total > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil((start + total) / BEATS_PER_BAR));
  renderTl();
  save();
  const msg = t('gen.done', { n: chords.length * g.repeat, track: lanes.map(i => i + 1).join(' + ') });
  toast(bad.length ? `${msg} · ${t('gen.bad', { list: bad.join(' ') })}` : msg, 4000);
}

// Écoute du premier accord avec le son choisi.
function previewGen() {
  const g = state.gen;
  const { chords } = parseProgression(g.prog);
  if (!chords.length) { toast(t('gen.none'), 3000); return; }
  const notes = voiceChords(chords, GEN_REGISTERS[g.register])[0];
  const patch = presetPatch(genPreset());
  const t0 = engine.ctx.currentTime + 0.02;
  notes.forEach((n, k) => {
    engine.noteOn(n, 0.8, t0, `gen:${k}`, patch);
    engine.noteOff(n, false, t0 + 1.2, `gen:${k}`);
  });
}

function buildGen() {
  const box = $('#gen');
  const g = state.gen;
  const field = (label, el) => {
    const l = document.createElement('label');
    const s = document.createElement('span');
    s.textContent = label;
    l.append(s, el);
    return l;
  };
  const select = (key, options, cast = v => v) => {
    const el = document.createElement('select');
    for (const [v, text] of options) el.add(new Option(text, v));
    el.value = g[key];
    el.addEventListener('change', () => { g[key] = cast(el.value); save(); renderGenInfo(); });
    return el;
  };
  const prog = document.createElement('input');
  prog.type = 'text';
  prog.value = g.prog;
  prog.spellcheck = false;
  prog.title = t('gen.progHint');
  prog.addEventListener('input', () => { g.prog = prog.value; save(); renderGenInfo(); });
  const chips = document.createElement('div');
  chips.className = 'gen-chips';
  for (const p of PROGRESSIONS) {
    const b = document.createElement('button');
    b.textContent = p;
    b.addEventListener('click', () => { prog.value = g.prog = p; save(); renderGenInfo(); });
    chips.appendChild(b);
  }
  const sound = document.createElement('select');
  sound.add(new Option(t('gen.current'), 'current'));
  for (const f of GEN_SOUNDS) {
    const grp = document.createElement('optgroup');
    grp.label = t(`family.${f}`);
    for (const p of PRESETS.filter(p => p.family === f)) grp.appendChild(new Option(p.name, p.id));
    sound.appendChild(grp);
  }
  sound.value = g.preset;
  sound.addEventListener('change', () => { g.preset = sound.value; save(); });
  const go = document.createElement('button');
  go.className = 'primary';
  go.textContent = t('gen.go');
  go.addEventListener('click', generatePads);
  const listen = document.createElement('button');
  listen.textContent = t('gen.listen');
  listen.addEventListener('click', previewGen);
  const info = document.createElement('span');
  info.className = 'hint gen-info';
  const row1 = document.createElement('div');
  row1.className = 'gen-row';
  row1.append(field(t('gen.prog'), prog), chips);
  const row2 = document.createElement('div');
  row2.className = 'gen-row';
  row2.append(
    field(t('gen.sound'), sound),
    field(t('gen.register'), select('register', Object.keys(GEN_REGISTERS).map(k => [k, t(`gen.reg.${k}`)]))),
    field(t('gen.bars'), select('bars', [1, 2, 4].map(n => [n, n]), Number)),
    field(t('gen.repeat'), select('repeat', [1, 2, 4].map(n => [n, `×${n}`]), Number)),
    field(t('gen.rhythm'), select('rhythm', GEN_RHYTHMS.map(k => [k, t(`gen.rh.${k}`)]))),
    field(t('gen.bass'), select('bass', Object.keys(GEN_BASS).map(k => [k, t(`gen.bass.${k}`)]))),
    listen, go,
  );
  box.append(row1, row2, info);
  $('#gen-btn').addEventListener('click', () => {
    box.hidden = !box.hidden;
    $('#gen-btn').classList.toggle('active', !box.hidden);
    renderGenInfo();
  });
}

// Accords reconnus, durée et point de départ.
function renderGenInfo() {
  const el = $('#gen .gen-info');
  if (!el) return;
  const g = state.gen;
  const { chords, bad } = parseProgression(g.prog);
  const bars = chords.length * g.bars * g.repeat;
  el.textContent = chords.length
    ? t('gen.where', { chords: chords.map(c => c.name).join(' – '), bars, bar: Math.floor(state.tl.playhead / BEATS_PER_BAR) + 1 }) + (bad.length ? ` · ${t('gen.bad', { list: bad.join(' ') })}` : '')
    : t('gen.none');
}

// ---------- Sidechain ----------

// Catégorie et kicks connus d'un son de la bibliothèque (sounds/banks.json).
let soundInfo = null;
function soundMeta(sampleId) {
  if (!soundInfo && libManifest) {
    soundInfo = new Map();
    for (const bank of libManifest?.banks ?? []) for (const p of bank.pads) if (p) soundInfo.set(`lib:${p.file}`, p);
  }
  return soundInfo?.get(sampleId);
}
// Kicks d'une boucle de la bibliothèque, en temps depuis son début (null si elle n'en a pas).
const soundKicks = sampleId => soundMeta(sampleId)?.kicks?.map(s => s / 4) ?? null;
function padCat(pad) {
  if (!pad) return null;
  const meta = soundMeta(pad.sampleId);
  if (meta?.cat) return meta.cat;
  if (pad.sampleId?.startsWith('builtin:')) return guessCat(kit[+pad.sampleId.slice(8)]?.name ?? pad.name);
  return guessCat(pad.name);
}
// Son baissé par le sidechain : mélodique (basse, nappe, lead, clavier, voix), et sans kick dedans.
const isDuckedSound = (sampleId, cat) => SC_DUCKED.has(cat) && !soundKicks(sampleId);

// Kicks d'un bloc de la timeline : enregistrement de la 909, boucle de la bibliothèque, ou son de kick.
function clipKicks(clip) {
  if (clip.kickBeats) return clip.kickBeats;
  const known = soundKicks(clip.sampleId);
  if (known) return known;
  return clip.cat === 'kick' ? [0] : null;
}

// Boucles des pads qui contiennent des kicks (pour le mode « kicks »).
function padLoopKicks() {
  const out = [];
  for (const [key, v] of engine.padVoices) {
    if (v.mode !== 'loop' || !v.pad?.buffer) continue;
    const kicks = soundKicks(v.pad.sampleId) ?? (padCat(v.pad) === 'kick' ? [0] : null);
    if (!kicks) continue;
    const beats = v.pad.bpm ? v.pad.buffer.duration * v.pad.bpm / 60 : v.pad.buffer.duration * engine.bpm / 60;
    if (beats > 0.25) out.push({ key, startBeat: v.startBeat, beats, kicks });
  }
  return out;
}

function setSidechain(changes) {
  Object.assign(state.sc, changes);
  sidechain.apply();
  renderSidechain();
  save();
}

function buildSidechain() {
  const box = $('#sidechain');
  box.innerHTML = `
    <span class="sc-title">${t('sc.title')}</span>
    <button data-sc="on" title="${t('sc.onTitle')}">${t('sc.on')}</button>
    <label><span>${t('sc.source')}</span><select data-sc="source">${SC_SOURCES.map(s => `<option value="${s}">${t(`sc.src.${s}`)}</option>`).join('')}</select></label>
    <label class="sc-range"><span>${t('sc.depth')}</span><input type="range" min="0" max="1" step="0.01" data-sc="depth"><em></em></label>
    <label class="sc-range"><span>${t('sc.release')}</span><input type="range" min="0.05" max="0.6" step="0.01" data-sc="release"><em></em></label>
    <span class="sc-targets"><span>${t('sc.targets')}</span>
      <button data-sc="synth" title="${t('sc.synthTitle')}">${t('sc.synth')}</button>
      <button data-sc="samples" title="${t('sc.samplesTitle')}">${t('sc.samples')}</button>
    </span>
    <span class="sc-meter" title="${t('sc.meter')}"><i></i></span>`;
  for (const el of box.querySelectorAll('button[data-sc]')) el.addEventListener('click', () => setSidechain({ [el.dataset.sc]: !state.sc[el.dataset.sc] }));
  box.querySelector('select').addEventListener('change', e => setSidechain({ source: e.target.value }));
  for (const el of box.querySelectorAll('input[data-sc]')) {
    el.addEventListener('input', () => setSidechain({ [el.dataset.sc]: +el.value }));
    el.addEventListener('dblclick', () => setSidechain({ [el.dataset.sc]: defaultScState()[el.dataset.sc] }));
  }
  // Témoin : baisse du gain en cours, lue sur le bus du synthé.
  const probe = engine.ctx.createAnalyser();
  probe.fftSize = 256;
  sidechain.shaper.connect(probe);
  const data = new Float32Array(probe.fftSize);
  const bar = box.querySelector('.sc-meter i');
  (function frame() {
    probe.getFloatTimeDomainData(data);
    let min = 0;
    for (const v of data) min = Math.min(min, v);
    bar.style.width = state.sc.on ? `${Math.round(-min * 100)}%` : '0';
    requestAnimationFrame(frame);
  })();
  renderSidechain();
}

function renderSidechain() {
  const s = state.sc;
  const box = $('#sidechain');
  box.classList.toggle('active', s.on);
  for (const el of box.querySelectorAll('button[data-sc]')) el.classList.toggle('active', !!s[el.dataset.sc]);
  box.querySelector('select').value = s.source;
  for (const el of box.querySelectorAll('input[data-sc]')) {
    el.value = s[el.dataset.sc];
    el.nextElementSibling.textContent = el.dataset.sc === 'depth' ? `${Math.round(s.depth * 100)}%` : `${Math.round(s.release * 1000)} ms`;
  }
}

// ---------- Annuler / rétablir (timeline) ----------

// Instantané de la timeline : pistes (muets et blocs) et longueur. La position de lecture n'en fait pas partie.
const tlSnapshot = () => JSON.stringify({ bars: state.tl.bars, tracks: state.tl.tracks.map(tr => ({ mute: tr.mute, clips: tr.clips })) });

function initHistory() {
  tlHistory = new History(tlSnapshot, snap => {
    const s = JSON.parse(snap);
    state.tl.bars = s.bars;
    s.tracks.forEach((tr, i) => { if (state.tl.tracks[i]) Object.assign(state.tl.tracks[i], tr); });
    tlSel = null;
    loadTlBuffers().then(renderTl);
    renderTl();
    renderLibrary();
    save();
  });
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

function tlUndo() {
  if (tlRec) return;   // pas pendant un enregistrement
  if (tlHistory.undo()) toast(t('tl.undone'));
}

function tlRedo() {
  if (tlRec) return;
  if (tlHistory.redo()) toast(t('tl.redone'));
}

function renderUndo() {
  $('#tl-undo').disabled = !tlHistory?.canUndo;
  $('#tl-redo').disabled = !tlHistory?.canRedo;
}

// Enregistrements (sons « rec: ») qui ne servent plus à aucun bloc ni pad : effacés au démarrage.
// (Pas à la suppression d'un bloc : « Annuler » doit pouvoir le faire revenir.)
async function cleanRecordings() {
  const used = new Set([...state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)), ...state.banks.flat().map(p => p?.sampleId), ...DECK_IDS.map(id => state.decks[id].sampleId)]);
  const ids = await store.listSampleIds().catch(() => []);
  for (const id of ids) if (typeof id === 'string' && id.startsWith('rec:') && !used.has(id)) store.deleteSample(id).catch(() => {});
}

// ---------- Export rapide (WAV et stems) ----------

// Le morceau est rejoué dans un contexte audio hors temps réel, avec tout le moteur reconstruit à l'identique
// (synthé, pads, table de mixage et ses effets, sidechain) : le rendu prend quelques secondes au lieu de la durée du morceau.
const EXPORT_LEAD = 0.1;   // marge de départ (les réglages se posent), retirée du fichier
const EXPORT_TAIL = 3;     // queue des réverbes et des delays

// Fin du morceau (en temps) : la fin du dernier bloc.
function songEndBeats() {
  const len = state.tl.bars * BEATS_PER_BAR;
  let end = 0;
  for (const tr of state.tl.tracks) for (const c of tr.clips) if (c.start < len) end = Math.max(end, c.start + timeline.clipBeats(c));
  return end;
}

// Rend la timeline (ou une seule piste, pour un stem) et renvoie ses deux canaux.
async function renderSong(onlyTrack = null) {
  const bd = 60 / state.bpm;
  const endBeat = songEndBeats();
  const sr = engine.ctx.sampleRate;
  const octx = new OfflineAudioContext(2, Math.ceil((EXPORT_LEAD + endBeat * bd + EXPORT_TAIL) * sr), sr);
  const e = new Engine(octx);
  for (const [id, p] of Object.entries(state.globals)) if (globalDef(id)) e.set(id, globalValue(id, p));
  e.setBpm(state.bpm);
  e.setVoice(presetById(state.preset).voice);
  const m = new Mixer(e, () => state.mix);
  e.padBus.disconnect();
  e.padBus.connect(m.input('pads'));
  const sc = new Sidechain(e, () => state.sc);
  clearInterval(sc.timer);   // tout est programmé d'avance ci-dessous
  e.pumpGain.disconnect();
  e.pumpGain.connect(sc.synth).connect(m.input('synth'));
  sc.pads.connect(e.padBus);
  sc.tl.connect(m.input('tl'));
  e.padOut = pad => (isDuckedSound(pad.sampleId, padCat(pad)) ? sc.pads : e.padBus);
  const tracks = state.tl.tracks.map((tr, i) => ({ ...tr, mute: tr.mute || (onlyTrack !== null && i !== onlyTrack) }));
  const tlState = { ...state.tl, tracks };
  const tl = new Timeline(e, () => tlState, clipBuffer, m.input('tl'));
  Object.assign(tl, {
    getPad: (b, i) => state.banks[b]?.[i], padKey, getPatch: presetPatch, duckOutput: sc.tl,
    isDucked: timeline.isDucked, isKickPad: timeline.isKickPad, kicksOf: clipKicks, onKick: time => sc.kick(time),
  });
  // Lecture linéaire du début à la fin, sans boucle ; toutes les fins de notes programmées d'un coup.
  tl.recording = true;
  tl.playing = true;
  e.origin = EXPORT_LEAD;
  tl.cycles = [{ time: EXPORT_LEAD, beat: 0 }];
  tl.scheduleCycle(EXPORT_LEAD, 0);
  tl.flush(Infinity);
  if (state.sc.on && state.sc.source === 'beat') for (let b = 0; b < endBeat; b++) sc.duck(EXPORT_LEAD + b * bd);
  await new Promise(r => setTimeout(r, 30));   // réponses impulsionnelles des réverbes (créées juste après)
  const buf = await octx.startRendering();
  const skip = Math.round(EXPORT_LEAD * sr);
  return [0, 1].map(c => buf.getChannelData(c).subarray(skip));
}

let exporting = false;
async function exportSong(stems) {
  if (exporting) return;
  if (!songEndBeats()) { toast(t('export.empty'), 3000); return; }
  if (tlRec) await tlStopRec();
  exporting = true;
  renderExport();
  const t0 = performance.now();
  try {
    const name = `gabberkey-${stamp()}`;
    if (!stems) {
      toast(t('export.rendering'), 60000);
      const chans = await renderSong();
      download(new Blob([encodeWav(chans, engine.ctx.sampleRate)], { type: 'audio/wav' }), `${name}.wav`);
    } else {
      const list = state.tl.tracks.map((tr, i) => i).filter(i => !state.tl.tracks[i].mute && state.tl.tracks[i].clips.length);
      const files = [];
      for (const [k, i] of list.entries()) {
        toast(t('export.stem', { n: k + 1, total: list.length }), 60000);
        const chans = await renderSong(i);
        const first = state.tl.tracks[i].clips.reduce((a, c) => (c.start < a.start ? c : a)).name ?? '';
        const label = `${String(i + 1).padStart(2, '0')} ${t('tl.track', { n: i + 1 })} - ${first}`.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
        files.push({ name: `${label}.wav`, data: encodeWav(chans, engine.ctx.sampleRate) });
      }
      download(makeZip(files), `${name}-stems.zip`);
    }
    toast(t('export.done', { s: ((performance.now() - t0) / 1000).toFixed(1) }), 4000);
  } catch (err) {
    console.error(err);
    toast(t('export.fail', { msg: err.message }), 5000);
  } finally {
    exporting = false;
    renderExport();
  }
}

function renderExport() {
  for (const id of ['#tl-export', '#tl-stems']) $(id).disabled = exporting;
}

// ---------- TB-303 ----------

const acidCells = [];        // acidCells[ligne][pas] ; lignes : notes de fa aigu à fa, puis Oct +, Oct −, Accent, Slide
const acidHeads = [];
const ACID_FLAGS = ['up', 'down', 'acc', 'slide'];
let acidStepRec = false;     // saisie pas à pas au clavier
let acidCursor = 0;
const acidPattern = () => state.acid.patterns[state.acid.pattern];

function buildAcid() {
  acid.onStep = renderAcidHead;
  acid.onPattern = () => { renderAcid(); save(); };
  // La 303 peut suivre l'horloge de la 909 (et s'arrêter avec elle).
  drum.listeners.push((step, time, dur) => acid.onClock(step, time, dur));
  const prevStop = drum.onStop;
  drum.onStop = () => { prevStop(); acid.clockStopped(); renderAcid(); };
  $('#acid-play').addEventListener('click', toggleAcid);
  $('#acid-wave').addEventListener('click', () => { state.acid.wave = state.acid.wave === 'sawtooth' ? 'square' : 'sawtooth'; acid.update(); renderAcid(); save(); });
  $('#acid-link').addEventListener('click', () => { state.acid.link = !state.acid.link; if (!state.acid.link) acid.clockStopped(); renderAcid(); save(); });
  $('#acid-rec').addEventListener('click', () => { acidStepRec = !acidStepRec; acidCursor = 0; renderAcid(); });
  $('#acid-rest').addEventListener('click', () => acidWrite(null));
  $('#acid-random').addEventListener('click', () => { state.acid.patterns[state.acid.pattern] = randomPattern(); renderAcid(); save(); });
  $('#acid-clear').addEventListener('click', () => {
    state.acid.patterns[state.acid.pattern] = acidPattern().map(() => ({ note: 0, gate: false, acc: false, slide: false, oct: 0 }));
    renderAcid();
    save();
  });
  for (let k = 0; k < ACID_PATTERNS; k++) {
    const btn = document.createElement('button');
    btn.textContent = k + 1;
    btn.title = t('acid.pattern', { n: k + 1 });
    btn.addEventListener('click', () => acid.selectPattern(k));
    $('#acid-patterns').appendChild(btn);
  }
  buildAcidKnobs();
  const grid = $('#acid-grid');
  // En-tête : numéros des pas (tête de lecture, curseur de saisie).
  grid.appendChild(document.createElement('span'));
  for (let s = 0; s < 16; s++) {
    const h = document.createElement('button');
    h.className = 'acid-head';
    h.textContent = s + 1;
    h.title = t('acid.cursor');
    h.addEventListener('click', () => { acidCursor = s; renderAcid(); });
    grid.appendChild(h);
    acidHeads[s] = h;
  }
  const names = t('notes');
  for (let r = 0; r < ACID_ROWS + ACID_FLAGS.length; r++) {
    const note = ACID_ROWS - 1 - r;   // fa aigu en haut
    const isNote = r < ACID_ROWS;
    const label = document.createElement('span');
    label.className = 'acid-label' + (isNote ? '' : ' flag');
    label.textContent = isNote ? names[(ACID_BASE + note) % 12] + (note === ACID_ROWS - 1 ? '′' : '') : t(`acid.f.${ACID_FLAGS[r - ACID_ROWS]}`);
    grid.appendChild(label);
    acidCells[r] = [];
    for (let s = 0; s < 16; s++) {
      const cell = document.createElement('button');
      const sharp = isNote && [1, 3, 6, 8, 10].includes((ACID_BASE + note) % 12);
      cell.className = 'acid-cell' + (s % 4 === 0 ? ' beat' : '') + (sharp ? ' sharp' : '') + (isNote ? '' : ` flag ${ACID_FLAGS[r - ACID_ROWS]}`);
      cell.addEventListener('click', () => (isNote ? acidToggleNote(s, note) : acidToggleFlag(s, ACID_FLAGS[r - ACID_ROWS])));
      grid.appendChild(cell);
      acidCells[r][s] = cell;
    }
  }
  renderAcid();
}

function acidToggleNote(s, note) {
  const st = acidPattern()[s];
  if (st.gate && st.note === note) st.gate = false;
  else { st.gate = true; st.note = note; acid.preview(st); }
  renderAcid();
  save();
}

function acidToggleFlag(s, flag) {
  const st = acidPattern()[s];
  if (flag === 'up') st.oct = st.oct === 1 ? 0 : 1;
  else if (flag === 'down') st.oct = st.oct === -1 ? 0 : -1;
  else st[flag] = !st[flag];
  renderAcid();
  save();
}

// Saisie au clavier : la note jouée va dans le pas du curseur, qui avance (silence : bouton « Silence »).
function acidWrite(midi, velocity = 0.8) {
  const st = acidPattern()[acidCursor];
  if (midi === null) {
    st.gate = false;
  } else {
    const i = midi - ACID_BASE;
    const oct = Math.max(-1, Math.min(1, Math.floor(i / 12)));
    Object.assign(st, { gate: true, note: ((i % 12) + 12) % 12, oct, acc: velocity > 0.85, slide: false });
    acid.preview(st);
  }
  acidCursor = (acidCursor + 1) % 16;
  renderAcid();
  save();
}

// Touche du clavier (APC ou ordinateur) : true si la saisie de la 303 l'a prise.
function acidKey(note, velocity, on) {
  if (!acidStepRec || !wm.isOpen('acid')) return false;
  if (on) acidWrite(note, velocity);
  return true;
}

function toggleAcid() {
  if (acid.playing) {
    if (acid.linked) drum.stop(); else acid.stop();
  } else if (state.acid.link) {
    drum.start(timeline.playing);   // suit la 909 : les deux démarrent ensemble
  } else {
    acid.start(timeline.playing);
  }
  renderAcid();
  renderTr();
}

const acidKnobEls = [];
function buildAcidKnobs() {
  const wrap = $('#acid-knobs');
  ACID_PARAMS.forEach((id, k) => {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label">${t(`acid.p.${id}`)}</div>`;
    const turn = pos => {
      const steps = acidSteps(id);
      state.acid.params[id] = Math.min(1, Math.max(0, steps ? Math.round(pos * (steps - 1)) / (steps - 1) : pos));
      acid.update();
      renderAcidKnobs();
      if (state.page === 'acid') renderKnobs();
      save();
    };
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      const step = acidSteps(id) ? 1 / (acidSteps(id) - 1) / 3 : 0.005;
      turn(state.acid.params[id] + (lastY - e.clientY) * step * (e.shiftKey ? 0.25 : 1));
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turn(state.acid.params[id] + (e.deltaY < 0 ? 0.02 : -0.02)); }, { passive: false });
    el.addEventListener('dblclick', () => turn(defaultAcidState().params[id]));
    acidKnobEls[k] = el;
    wrap.appendChild(el);
  });
}

function renderAcidKnobs() {
  ACID_PARAMS.forEach((id, k) => {
    const el = acidKnobEls[k];
    if (!el) return;
    const p = state.acid.params[id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = acidFmt(id, p);
  });
}

function renderAcid() {
  if (!acidCells.length) return;
  const play = $('#acid-play');
  play.textContent = acid.playing ? t('tr.stop') : t('tr.play');
  play.classList.toggle('active', acid.playing);
  $('#acid-wave').textContent = state.acid.wave === 'sawtooth' ? t('acid.saw') : t('acid.square');
  $('#acid-link').classList.toggle('active', state.acid.link);
  $('#acid-rec').classList.toggle('active', acidStepRec);
  $('#acid-rest').disabled = !acidStepRec;
  [...$('#acid-patterns').children].forEach((btn, k) => {
    btn.classList.toggle('active', k === state.acid.pattern);
    btn.classList.toggle('queued', k === acid.queued);
    btn.classList.toggle('used', state.acid.patterns[k].some(s => s.gate));
  });
  const pat = acidPattern();
  for (let s = 0; s < 16; s++) {
    const st = pat[s];
    for (let r = 0; r < ACID_ROWS; r++) {
      const cell = acidCells[r][s];
      const on = st.gate && st.note === ACID_ROWS - 1 - r;
      cell.classList.toggle('on', on);
      cell.classList.toggle('accent', on && st.acc);
      cell.textContent = on && st.oct ? (st.oct > 0 ? '↑' : '↓') : '';
    }
    const flags = { up: st.oct === 1, down: st.oct === -1, acc: st.acc, slide: st.slide };
    ACID_FLAGS.forEach((f, k) => acidCells[ACID_ROWS + k][s].classList.toggle('on', flags[f]));
    acidHeads[s].classList.toggle('cursor', acidStepRec && s === acidCursor);
  }
  renderAcidKnobs();
}

let acidHead = -1;
function renderAcidHead(step) {
  if (acidHead >= 0) for (const row of acidCells) row[acidHead]?.classList.remove('head');
  acidHeads[acidHead]?.classList.remove('playing');
  acidHead = step;
  if (step >= 0) {
    for (const row of acidCells) row[step].classList.add('head');
    acidHeads[step].classList.add('playing');
  } else {
    renderAcid();
  }
}

// ---------- Designer de kick ----------

let kickBuffer = null;       // dernier kick calculé (AudioBuffer)
let kickRenderId = 0;
const kickKnobEls = [];

function buildKick() {
  const presets = $('#kick-presets');
  for (const id of Object.keys(KICK_PRESETS)) {
    const b = document.createElement('button');
    b.dataset.preset = id;
    b.textContent = t(`kick.preset.${id}`);
    b.addEventListener('click', () => {
      state.kick.params = { ...kickDefaults(), ...KICK_PRESETS[id] };
      state.kick.preset = id;
      kickChanged(true);
    });
    presets.appendChild(b);
  }
  const wrap = $('#kick-knobs');
  KICK_PARAMS.forEach((id, k) => {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label">${t(`kick.p.${id}`)}</div>`;
    el.title = t(`kick.h.${id}`);
    const turn = (pos, done) => {
      const steps = kickSteps(id);
      state.kick.params[id] = Math.min(1, Math.max(0, steps ? Math.round(pos * (steps - 1)) / (steps - 1) : pos));
      state.kick.preset = null;
      renderKickKnobs();
      kickChanged(done);
    };
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      const step = kickSteps(id) ? 1 / (kickSteps(id) - 1) / 3 : 0.005;
      turn(state.kick.params[id] + (lastY - e.clientY) * step * (e.shiftKey ? 0.25 : 1), false);
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { if (lastY !== null) kickChanged(true); lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turn(state.kick.params[id] + (e.deltaY < 0 ? 0.02 : -0.02), true); }, { passive: false });
    el.addEventListener('dblclick', () => turn(kickDefaults()[id], true));
    kickKnobEls[k] = el;
    wrap.appendChild(el);
  });
  $('#kick-play').addEventListener('click', () => playKick());
  $('#kick-auto').addEventListener('click', () => { state.kick.auto = !state.kick.auto; renderKick(); save(); });
  $('#kick-to-pad').addEventListener('click', kickToPad);
  $('#kick-to-lib').addEventListener('click', kickToLibrary);
  $('#kick-wav').addEventListener('click', async () => {
    const buf = await kickRender();
    download(new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate)], { type: 'audio/wav' }), `${kickName().replace(/\s+/g, '-')}.wav`);
  });
  renderKick();
  kickRender();
}

// Calcule le kick (le dernier demandé gagne) et redessine sa forme d'onde.
async function kickRender() {
  const id = ++kickRenderId;
  const data = await synthKick(state.kick.params, engine.ctx.sampleRate);
  if (id !== kickRenderId) return kickBuffer;
  const buf = engine.ctx.createBuffer(1, data.length, engine.ctx.sampleRate);
  buf.copyToChannel(data, 0);
  kickBuffer = buf;
  drawKick(data);
  return buf;
}

let kickTimer;
function kickChanged(play) {
  clearTimeout(kickTimer);
  kickTimer = setTimeout(async () => {
    await kickRender();
    if (play && state.kick.auto) playKick(false);
  }, 40);
  renderKick();
  save();
}

async function playKick(fresh = true) {
  const buf = fresh || !kickBuffer ? await kickRender() : kickBuffer;
  const src = engine.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(engine.padBus);
  src.start();
  sidechain.kick();
}

function drawKick(data) {
  const cv = $('#kick-wave');
  const w = cv.width = cv.clientWidth * devicePixelRatio || 600;
  const h = cv.height = 90 * devicePixelRatio;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = PALETTE[5];
  const step = data.length / w;
  for (let x = 0; x < w; x++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(x * step); i < Math.floor((x + 1) * step); i++) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
    g.fillRect(x, (1 - hi) * h / 2, 1, Math.max(1, (hi - lo) * h / 2));
  }
  $('#kick-len').textContent = `${Math.round(data.length / engine.ctx.sampleRate * 1000)} ms`;
}

const kickName = () => `Kick ${state.kick.preset ? t(`kick.preset.${state.kick.preset}`) : t('kick.custom')}`;

// Le kick devient le son du pad sélectionné (banque affichée).
async function kickToPad() {
  const buf = await kickRender();
  const wav = encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate);
  await loadFileIntoPad(new File([wav], `${kickName()}.wav`, { type: 'audio/wav' }), state.selected);
  toast(t('kick.toPadDone', { n: state.selected + 1, bank: state.bank + 1 }), 3000);
}

// Le kick rejoint la bibliothèque (catégorie Kicks) : on peut le glisser sur la timeline.
async function kickToLibrary() {
  const buf = await kickRender();
  const wav = encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate);
  const sampleId = `user:${crypto.randomUUID()}`;
  const same = state.userSounds.filter(s => s.name.startsWith(kickName())).length;
  const name = same ? `${kickName()} ${same + 1}` : kickName();
  await store.saveSample(sampleId, { name, data: wav });
  bufferCache.set(sampleId, buf);
  state.userSounds.push({ sampleId, name, cat: 'kick' });
  libCat = 'kick';
  libQuery = '';
  renderLibrary();
  save();
  toast(t('kick.toLibDone', { name }), 3000);
}

// Retire un son créé dans l'application de la bibliothèque (s'il ne sert plus nulle part, son fichier est effacé).
function removeUserSound(item) {
  if (!confirm(t('lib.removeConfirm', { name: item.name }))) return;
  state.userSounds = state.userSounds.filter(s => s.sampleId !== item.sampleId);
  const used = state.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === item.sampleId)) || state.banks.flat().some(p => p?.sampleId === item.sampleId);
  if (!used) { store.deleteSample(item.sampleId).catch(() => {}); bufferCache.delete(item.sampleId); }
  renderLibrary();
  save();
}

function renderKickKnobs() {
  KICK_PARAMS.forEach((id, k) => {
    const el = kickKnobEls[k];
    if (!el) return;
    const p = state.kick.params[id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = kickFmt(id, p);
  });
}

function renderKick() {
  for (const b of $('#kick-presets').children) b.classList.toggle('active', b.dataset.preset === state.kick.preset);
  $('#kick-auto').classList.toggle('active', state.kick.auto);
  $('#kick-to-pad').title = t('kick.toPad.title', { n: state.selected + 1, bank: state.bank + 1 });
  renderKickKnobs();
}

// ---------- Platines ----------

const deckEls = {};

// Charge un son (élément de la bibliothèque) sur un deck.
async function loadDeck(id, item) {
  const buffer = await ensureBuffer(item.sampleId);
  if (!buffer) { toast(t('lib.loadFail'), 3000); return; }
  const s = state.decks[id];
  const deck = decks.decks[id];
  if (deck.playing) deck.pause();
  Object.assign(s, { sampleId: item.sampleId, name: item.name, bpm: guessBpm(buffer.duration, item.loop ? item.bpm : 0, state.bpm), cue: 0, loop: !!item.loop || buffer.duration > 8 });
  deck.setBuffer(buffer);
  deck.update();
  drawDeckWave(id);
  renderDecks();
  save();
  toast(t('deck.loaded', { name: item.name, deck: id }));
}

// Fichier audio glissé sur un deck : gardé comme son de l'utilisateur (il rejoint aussi la bibliothèque).
async function loadDeckFile(id, file) {
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
  await loadDeck(id, { sampleId, name, loop: buffer.duration > 8, bpm: 0 });
}

function buildDecks() {
  decks.busy = () => timeline.playing;
  decks.onChange = () => renderDecks();
  for (const id of DECK_IDS) {
    const el = document.querySelector(`.deck[data-deck="${id}"]`);
    el.innerHTML = `
      <div class="deck-head"><b class="deck-id">${id}</b><span class="deck-name"></span><span class="deck-bpm hint"></span></div>
      <canvas class="deck-wave" height="44" title="${t('deck.waveTitle')}"></canvas>
      <div class="deck-body">
        <canvas class="deck-vinyl" width="150" height="150" title="${t('deck.vinylTitle')}"></canvas>
        <div class="deck-side">
          <div class="deck-buttons">
            <button class="deck-play primary"></button>
            <button class="deck-cue" title="${t('deck.cueTitle')}">Cue</button>
            <button class="deck-sync" title="${t('deck.syncTitle')}">Sync</button>
            <button class="deck-loop">${t('deck.loop')}</button>
            <button class="deck-load" title="${t('deck.load.title')}">${t('deck.load')}</button>
          </div>
          <label class="deck-pitch"><span>${t('deck.pitch')}</span><input type="range" min="-0.08" max="0.08" step="0.001"><em></em></label>
          <div class="mini-knobs deck-knobs"></div>
        </div>
      </div>`;
    const els = deckEls[id] = {
      el, name: el.querySelector('.deck-name'), bpm: el.querySelector('.deck-bpm'), wave: el.querySelector('.deck-wave'), vinyl: el.querySelector('.deck-vinyl'),
      play: el.querySelector('.deck-play'), cue: el.querySelector('.deck-cue'), sync: el.querySelector('.deck-sync'), loop: el.querySelector('.deck-loop'),
      load: el.querySelector('.deck-load'), pitch: el.querySelector('.deck-pitch input'), pitchLabel: el.querySelector('.deck-pitch em'), knobs: [], angle: 0,
    };
    const deck = decks.decks[id];
    const s = () => state.decks[id];
    els.play.addEventListener('click', () => { if (deck.playing) deck.pause(); else deck.play(); });
    els.cue.addEventListener('click', () => { deck.cue(); save(); });
    els.sync.addEventListener('click', () => { s().sync = !s().sync; deck.update(); renderDecks(); save(); });
    els.loop.addEventListener('click', () => { s().loop = !s().loop; deck.update(); renderDecks(); save(); });
    els.load.addEventListener('click', () => { if (libSelected) loadDeck(id, libSelected); else toast(t('deck.pickFirst'), 3000); });
    els.pitch.addEventListener('input', () => { s().pitch = +els.pitch.value; deck.update(); renderDecks(); save(); });
    els.pitch.addEventListener('dblclick', () => { s().pitch = 0; deck.update(); renderDecks(); save(); });
    // Forme d'onde : un clic place la lecture (ou le cue à l'arrêt).
    els.wave.addEventListener('pointerdown', e => {
      if (!deck.buffer) return;
      const r = els.wave.getBoundingClientRect();
      deck.seek((e.clientX - r.left) / r.width * deck.duration);
      if (!deck.playing) s().cue = deck.pos;
      renderDecks();
    });
    // Vinyle : la souris tient le disque ; sa vitesse de rotation donne la vitesse de lecture (à l'envers aussi).
    let last = null, idle;
    const angleAt = e => { const r = els.vinyl.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
    els.vinyl.addEventListener('pointerdown', e => {
      if (!deck.buffer) return;
      try { els.vinyl.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      last = { a: angleAt(e), t: performance.now() };
      deck.scratchStart();
    });
    els.vinyl.addEventListener('pointermove', e => {
      if (!last) return;
      const a = angleAt(e);
      const now = performance.now();
      let da = a - last.a;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      const dt = Math.max(1, now - last.t) / 1000;
      deck.scratchMove(rateFromSpin(da / (2 * Math.PI) / dt));
      els.angle += da;
      last = { a, t: now };
      clearTimeout(idle);
      idle = setTimeout(() => deck.scratchMove(0), 60);   // main immobile : le disque s'arrête
    });
    const release = () => { if (!last) return; last = null; clearTimeout(idle); deck.scratchEnd(); };
    els.vinyl.addEventListener('pointerup', release);
    els.vinyl.addEventListener('pointercancel', release);
    // Glisser un fichier audio sur le deck.
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('dragover'); loadDeckFile(id, e.dataTransfer.files[0]); });
    // Potards : volume, basses, médiums, aigus, filtre.
    DECK_KNOBS.forEach(k => {
      const knob = document.createElement('div');
      knob.className = 'knob';
      knob.innerHTML = `
        <svg viewBox="0 0 80 80">
          <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
          <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
        </svg>
        <div class="value"></div><div class="label">${t(`deck.k.${k}`)}</div>`;
      const turn = pos => { s()[k] = Math.min(1, Math.max(0, pos)); deck.update(); renderDecks(); if (state.page === 'decks') renderKnobs(); save(); };
      let y = null;
      knob.addEventListener('pointerdown', e => { y = e.clientY; try { knob.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
      knob.addEventListener('pointermove', e => { if (y === null || Math.abs(y - e.clientY) < 2) return; turn(s()[k] + (y - e.clientY) * 0.005 * (e.shiftKey ? 0.25 : 1)); y = e.clientY; });
      knob.addEventListener('pointerup', () => { y = null; });
      knob.addEventListener('wheel', e => { e.preventDefault(); turn(s()[k] + (e.deltaY < 0 ? 0.02 : -0.02)); }, { passive: false });
      knob.addEventListener('dblclick', () => turn(k === 'vol' ? 0.8 : 0.5));
      el.querySelector('.deck-knobs').appendChild(knob);
      els.knobs.push([k, knob]);
    });
  }
  const xf = $('#deck-xfade');
  xf.addEventListener('input', () => { state.decks.xfade = +xf.value; decks.update(); if (state.page === 'decks') renderKnobs(); save(); });
  xf.addEventListener('dblclick', () => { state.decks.xfade = 0.5; decks.update(); renderDecks(); save(); });
  // Sons déjà chargés (sauvegarde) : remis sur les decks, à l'arrêt.
  for (const id of DECK_IDS) {
    const sid = state.decks[id].sampleId;
    if (sid) ensureBuffer(sid).then(buf => { if (buf) { decks.decks[id].setBuffer(buf); decks.decks[id].update(); drawDeckWave(id); renderDecks(); } });
  }
  renderDecks();
  (function frame() {
    if (wm?.isOpen('decks')) for (const id of DECK_IDS) drawDeck(id);
    requestAnimationFrame(frame);
  })();
}

// Forme d'onde complète du son (dessinée une fois au chargement).
const deckWaves = {};
function drawDeckWave(id) {
  const deck = decks.decks[id];
  const cv = deckEls[id].wave;
  const w = cv.width = Math.max(200, cv.clientWidth * devicePixelRatio);
  const h = cv.height = 44 * devicePixelRatio;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const g = off.getContext('2d');
  if (deck.buffer) {
    const data = deck.buffer.getChannelData(0);
    const step = data.length / w;
    g.fillStyle = id === 'A' ? PALETTE[37] : PALETTE[53];
    for (let x = 0; x < w; x++) {
      let peak = 0;
      for (let i = Math.floor(x * step); i < Math.floor((x + 1) * step); i += 4) peak = Math.max(peak, Math.abs(data[i]));
      g.fillRect(x, (1 - peak) * h / 2, 1, Math.max(1, peak * h));
    }
  }
  deckWaves[id] = off;
}

function drawDeck(id) {
  const deck = decks.decks[id];
  const els = deckEls[id];
  // Position : interpolée entre deux rapports du lecteur.
  const pos = deck.pos;
  const cv = els.wave;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (deckWaves[id]) g.drawImage(deckWaves[id], 0, 0);
  if (deck.buffer) {
    const x = pos / deck.duration * cv.width;
    const cx = state.decks[id].cue / deck.duration * cv.width;
    g.fillStyle = '#ffd23f';
    g.fillRect(cx - 1, 0, 2, cv.height);
    g.fillStyle = '#fff';
    g.fillRect(x - 1, 0, 3, cv.height);
  }
  // Vinyle : tourne avec la position du son (33 ⅓ tours/min).
  const v = els.vinyl;
  const vg = v.getContext('2d');
  const r = v.width / 2;
  const a = vinylTurns(pos) * 2 * Math.PI;
  vg.clearRect(0, 0, v.width, v.height);
  vg.save();
  vg.translate(r, r);
  vg.fillStyle = '#0b0b0e';
  vg.beginPath(); vg.arc(0, 0, r - 2, 0, 2 * Math.PI); vg.fill();
  vg.strokeStyle = '#1d1d24';
  for (let k = 20; k < r - 6; k += 5) { vg.beginPath(); vg.arc(0, 0, k, 0, 2 * Math.PI); vg.stroke(); }
  vg.rotate(a);
  vg.fillStyle = id === 'A' ? PALETTE[37] : PALETTE[53];
  vg.beginPath(); vg.arc(0, 0, r * 0.3, 0, 2 * Math.PI); vg.fill();
  vg.fillStyle = '#fff';
  vg.fillRect(-2, -r + 6, 4, r * 0.4);   // repère sur le disque
  vg.fillStyle = '#0b0b0e';
  vg.beginPath(); vg.arc(0, 0, 4, 0, 2 * Math.PI); vg.fill();
  vg.restore();
}

function renderDecks() {
  if (!deckEls.A) return;
  for (const id of DECK_IDS) {
    const s = state.decks[id];
    const deck = decks.decks[id];
    const els = deckEls[id];
    els.name.textContent = s.name || t('deck.empty');
    els.name.classList.toggle('hint', !s.name);
    const rate = deck.baseRate();
    els.bpm.textContent = s.bpm ? `${Math.round(s.bpm * rate * 10) / 10} BPM` : t('deck.bpmUnknown');
    els.play.textContent = deck.playing ? '❚❚' : '▶';
    els.play.classList.toggle('active', deck.playing);
    els.sync.classList.toggle('active', s.sync);
    els.sync.disabled = !s.bpm;
    els.loop.classList.toggle('active', s.loop);
    els.pitch.value = s.pitch;
    els.pitch.disabled = s.sync && !!s.bpm;
    els.pitchLabel.textContent = s.sync && s.bpm ? `${rate >= 1 ? '+' : ''}${((rate - 1) * 100).toFixed(1)}%` : `${s.pitch >= 0 ? '+' : ''}${(s.pitch * 100).toFixed(1)}%`;
    for (const [k, knob] of els.knobs) {
      const p = s[k];
      knob.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
      knob.querySelector('.value').textContent = k === 'vol' ? `${Math.round(p * 100)}%` : k === 'filter' ? (Math.abs(p - 0.5) < 0.02 ? '—' : p < 0.5 ? 'LP' : 'HP') : p < 0.02 ? 'kill' : `${p > 0.5 ? '+' : ''}${Math.round((p - 0.5) * 24)}`;
    }
  }
  $('#deck-xfade').value = state.decks.xfade;
}

// ---------- Effets de performance ----------

const perfActive = new Set();
const heldRolls = [];
const roll = div => ({ on: () => { heldRolls.push(div); engine.rollOn(div); },
  off: () => {
    const k = heldRolls.lastIndexOf(div);
    if (k >= 0) heldRolls.splice(k, 1);
    if (heldRolls.length) engine.rollOn(heldRolls[heldRolls.length - 1]); else engine.rollOff();
  } });
const PERF = [
  { label: 'Roll 1/8', hint: t('perf.track', { n: 5 }), ...roll(8) },
  { label: 'Roll 1/16', hint: t('perf.track', { n: 6 }), ...roll(16) },
  { label: 'Roll 1/32', hint: t('perf.track', { n: 7 }), ...roll(32) },
  { label: t('perf.filterDown'), hint: t('perf.track', { n: 8 }), on: () => engine.sweep('lp', true), off: () => engine.sweep('lp', false) },
  { label: 'Roll 1/4', hint: t('perf.shift', { n: 5 }), ...roll(4) },
  { label: 'Tape stop', hint: t('perf.shift', { n: 6 }), on: () => engine.tapeStop(), momentary: 900 },
  { label: t('perf.filterUp'), hint: t('perf.shift', { n: 7 }), on: () => engine.sweep('hp', true), off: () => engine.sweep('hp', false) },
  { label: 'Pump', hint: t('perf.shift', { n: 8 }), toggle: true, on: () => engine.setPump(true), off: () => engine.setPump(false) },
];

function perfDown(i) {
  const fx = PERF[i];
  if (fx.toggle && perfActive.has(i)) { perfActive.delete(i); fx.off(); }
  else if (!perfActive.has(i)) {
    perfActive.add(i);
    fx.on();
    if (fx.momentary) setTimeout(() => { perfActive.delete(i); renderPerf(); renderLeds(); }, fx.momentary);
  }
  renderPerf();
  renderLeds();
}

function perfUp(i) {
  const fx = PERF[i];
  if (fx.toggle || fx.momentary || !perfActive.has(i)) return;
  perfActive.delete(i);
  fx.off();
  renderPerf();
  renderLeds();
}

function buildPerf() {
  PERF.forEach((fx, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `${fx.label}<small>${fx.hint}</small>`;
    btn.addEventListener('pointerdown', e => { try { btn.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } perfDown(i); });
    btn.addEventListener('pointerup', () => perfUp(i));
    $('#perf').appendChild(btn);
  });
}

function renderPerf() {
  [...$('#perf').children].forEach((btn, i) => btn.classList.toggle('active', perfActive.has(i)));
}

// ---------- Enregistrement ----------

let recTimer;
async function toggleRecording() {
  const btn = $('#rec');
  if (!recorder.recording) {
    await recorder.start();
    btn.classList.add('active');
    const tick = () => {
      const s = Math.floor(recorder.elapsed);
      btn.textContent = `■ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    recTimer = setInterval(tick, 500);
  } else {
    clearInterval(recTimer);
    btn.classList.remove('active');
    btn.textContent = '● REC';
    const blob = await recorder.stop();
    download(blob, `gabberkey-${stamp()}.wav`);
    toast(t('rec.done'));
  }
  renderLeds();
}
$('#rec').addEventListener('click', () => engine && toggleRecording());

// ---------- Kits (export / import) ----------

// Fichier d'origine d'un pad ; null pour les sons de synthèse (réencodés en WAV).
async function padBytes(pad) {
  if (pad.sampleId?.startsWith('user:')) return (await store.loadSample(pad.sampleId))?.data ?? null;
  if (pad.sampleId?.startsWith('lib:')) {
    const r = await fetch(`sounds/${pad.sampleId.slice(4)}`);
    return r.ok ? r.arrayBuffer() : null;
  }
  return null;
}

async function unpackPad(s) {
  if (!s) return null;
  const id = `user:${crypto.randomUUID()}`;
  await store.saveSample(id, { name: s.name, data: s.bytes });
  const buffer = await engine.ctx.decodeAudioData(s.bytes.slice(0)).catch(() => null);
  return { name: s.name, color: s.color, sampleId: id, bpm: s.bpm || 0, p: { ...defaultPositions('pad'), ...s.p }, buffer };
}

function replaceBank(b, pads) {
  state.banks[b].forEach((old, i) => {
    engine.stopPad(padKey(b, i));
    if (old?.sampleId?.startsWith('user:')) store.deleteSample(old.sampleId).catch(() => {});
  });
  state.banks[b] = pads;
}

function bindKits() {
  $('#kit-export-bank').addEventListener('click', async () => {
    toast(t('kit.exportingBank'));
    const blob = await packBanks([state.banks[state.bank]], padBytes, { kind: 'bank', bpm: state.bpm });
    download(blob, `${t('kit.file.bank', { n: state.bank + 1 })}-${stamp()}.apckit`);
    toast(t('kit.exportedBank'));
  });
  $('#kit-export-all').addEventListener('click', async () => {
    toast(t('kit.exportingAll'));
    const blob = await packBanks(state.banks, padBytes, { kind: 'session', bpm: state.bpm, globals: state.globals, preset: state.preset, tr: state.tr, mix: state.mix, scenes: state.scenes });
    download(blob, `gabberkey-session-${stamp()}.apckit`);
    toast(t('kit.exportedAll'));
  });
  $('#kit-import').addEventListener('click', () => $('#kit-file').click());
  $('#kit-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast(t('kit.importing'));
      const kitData = await unpack(file);
      if (kitData.kind === 'session') {
        if (!confirm(t('kit.confirmSession'))) return;
        for (let b = 0; b < BANKS; b++) replaceBank(b, await Promise.all((kitData.banks[b] ?? new Array(40).fill(null)).map(unpackPad)));
        Object.assign(state.globals, kitData.globals);
        applyGlobals();
        state.preset = migratePreset(kitData.preset);
        synthFamily = presetById(state.preset).family;
        engine.setVoice(presetById(state.preset).voice);
        if (kitData.bpm) setBpm(kitData.bpm);
        if (kitData.scenes) { state.scenes = mergeScenes(kitData.scenes); currentScene = null; renderScenes(); }
        if (kitData.mix) { state.mix = mergeMixState(kitData.mix); mixer.reload(); CHANNELS.forEach(renderFx); renderMixer(); }
        if (kitData.tr) { drum.stop(); state.tr = mergeTrState(kitData.tr); drum.setVolume(state.tr.globals.volume); renderTr(); }
      } else {
        if (state.banks[state.bank].some(Boolean) && !confirm(t('kit.confirmBank', { n: state.bank + 1 }))) return;
        replaceBank(state.bank, await Promise.all(kitData.banks[0].map(unpackPad)));
      }
      renderAll();
      renderPresets();
      save();
      toast(t('kit.imported'));
    } catch (err) {
      alert(t('kit.failed', { msg: err.message }));
    }
  });
}

// ---------- Divers ----------

let toastTimer;
function toast(text, duration = 1800) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function drawMeter() {
  const cv = $('#meter');
  const g = cv.getContext('2d');
  const data = new Float32Array(engine.analyser.fftSize);
  let level = 0;
  (function frame() {
    engine.analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    level = Math.max(peak, level * 0.9);
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = level > 0.95 ? '#ff5a36' : '#3dd68c';
    g.fillRect(0, 0, cv.width * Math.min(1, level), cv.height);
    requestAnimationFrame(frame);
  })();
}

function renderAll() {
  renderPads();
  renderBanks();
  renderEditor();
  renderPages();
  renderKnobs();
  renderLeds();
}

$('#panic').addEventListener('click', () => engine && panic());
$('#reset').addEventListener('click', async () => {
  if (!confirm(t('reset.confirm'))) return;
  await store.clearAll();
  location.reload();
});
