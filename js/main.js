import { APC, BTN, PALETTE, PICKER_COLORS, MK1_PICKER_COLORS, mk1Equivalent } from './apc.js';
import { Engine } from './audio.js';
import { PAGES, MODES, toValue, toPos, defaultPositions } from './params.js';
import { renderDefaultKit } from './kit.js';
import { PRESETS, PRESET_KEYS } from './presets.js';
import { Recorder, download, stamp, encodeWav } from './recorder.js';
import { packBanks, unpack } from './kits.js';
import * as store from './storage.js';
import { WindowManager, WINDOWS, mergeWindows } from './windows.js';
import { LIB_CATS, catColor, libraryItems } from './library.js';
import { Mixer, CHANNELS, MIX_FIELDS, FX_TYPES, MAX_FX, defaultMixState, mergeMixState, mixKnobDefs, newFx, fxParamLabel } from './mixer.js';
import { Timeline, TL_TRACKS, BEATS_PER_BAR, defaultTlState, mergeTlState } from './timeline.js';
import { TR909, TR_INSTR, PATTERNS, trKnobDefs, defaultTrState, mergeTrState } from './tr909.js';
import { t, soundName, translatePage } from './i18n.js';

translatePage();

const BANKS = 10;   // SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = banques 6-10
const PAGE_ORDER = ['synth', 'fx', 'pad', 'eq'];   // boutons de piste 1 à 4 (EQ aussi via SUSTAIN)
const UI_PAGES = [...PAGE_ORDER, 'tr', ...MIX_FIELDS.map(f => `mix_${f}`)];   // + TR-909 (Maj + PLAY) et mixeur (Maj + piste 1-4)
const $ = sel => document.querySelector(sel);

let engine, apc, kit, recorder, drum, mixer, wm, timeline;
let libAdded = [];   // banques de la bibliothèque ajoutées à ce démarrage
const state = {
  bank: 0,
  page: 'synth',
  selected: 0,
  bpm: 120,
  preset: 0,        // preset du synthé (js/presets.js)
  libBanks: [],     // noms des banques de la bibliothèque déjà importées
  model: null,      // dernier modèle d'APC vu ('mk1' | 'mk2')
  globals: { ...defaultPositions('synth'), ...defaultPositions('fx'), ...defaultPositions('eq') },
  banks: [],        // banks[b][i] = { name, color, sampleId, p, buffer } | null
  tr: defaultTrState(),   // TR-909 : réglages, patterns, instrument choisi
  mix: defaultMixState(), // table de mixage : voies, envois, effets d'insert
  windows: mergeWindows(null), // fenêtres des plugins : ouverte ou non, position, taille
  tl: defaultTlState(),        // timeline : pistes de clips (sons posés ou enregistrements d'outils)
  scenes: new Array(40).fill(null),   // 40 scènes (instantanés rappelés à la mesure suivante)
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
  for (const [id, p] of Object.entries(state.globals)) engine.set(id, globalValue(id, p));
  engine.setBpm(state.bpm);
  engine.setVoice(PRESETS[state.preset]?.voice ?? {});
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
  engine.pumpGain.disconnect();
  engine.pumpGain.connect(mixer.input('synth'));
  drum.setDestinations(Object.fromEntries(['bd', 'snare', 'toms', 'hats', 'cym'].map(g => [g, mixer.input('tr')])));
  timeline = new Timeline(engine, () => state.tl, clipBuffer, mixer.input('tl'));
  timeline.getPad = (b, i) => state.banks[b]?.[i];
  timeline.padKey = padKey;
  await loadTlBuffers();
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
  buildMixer();
  buildTl();
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

// ---------- Sauvegarde ----------

async function restore() {
  const saved = await store.loadState().catch(() => null);
  const firstRun = !saved;
  state.banks = Array.from({ length: BANKS }, () => new Array(40).fill(null));
  if (!saved) {
    kit.forEach((s, i) => { state.banks[0][i] = newPad(soundName(s.name), s.color, `builtin:${i}`, s.buffer); });
  } else {
    Object.assign(state.globals, saved.globals);
    state.bank = Math.min(saved.bank ?? 0, BANKS - 1);
    state.page = saved.page ?? 'synth';
    state.bpm = saved.bpm ?? 120;
    state.preset = saved.preset ?? 0;
    // Anciennes sauvegardes : les 5 premières banques de la bibliothèque étaient déjà importées.
    state.libBanks = saved.libBanks ?? (saved.libImported ? ['Batterie', 'Électro', 'Boucles', 'Textures', 'Tabla & divers'] : []);
    state.model = saved.model ?? null;
    state.tr = mergeTrState(saved.tr);
    state.mix = mergeMixState(saved.mix);
    state.windows = mergeWindows(saved.windows);
    state.tl = mergeTlState(saved.tl);
    state.scenes = mergeScenes(saved.scenes);
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
      banks: state.banks.map(bank => bank.map(p => p && { name: p.name, color: p.color, sampleId: p.sampleId, bpm: p.bpm, p: p.p })),
    }).catch(err => console.warn('Save failed', err));
  }, 400);
}

// ---------- Actions (communes souris / contrôleur) ----------

function triggerPad(i) {
  selectPad(i);
  engine.playPad(padKey(state.bank, i), state.banks[state.bank][i]);
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
  engine.stopAllPads();
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
  return state.page === 'tr' ? trKnobDefs(state.tr.sel) : PAGES[state.page].params;
}
function knobTarget(def) {
  if (!def) return null;
  if (def.ch) return state.mix.channels[def.ch];
  if (mixField(state.page)) return state.globals;   // K8 = volume général
  if (state.page === 'pad') return currentPad()?.p;
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
  } else {
    engine.set(def.id, toValue(def, target[def.id]));
  }
  if (def.id === 'master') renderMixer();
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
      setBank(+name.slice(5) - 1 + (shiftHeld ? 5 : 0));
    }
    else if (name.startsWith('track')) setPage((shiftHeld ? MIX_PAGES : PAGE_ORDER)[+name.slice(5) - 1]);
    else if (name === 'stopAll') { if (shiftHeld) toggleSceneMode(); else panic(); }
    else if (name === 'record') tlRecToggle();
  });

  apc.addEventListener('knob', ({ detail }) => turnKnob(detail.index, detail));

  apc.addEventListener('key', ({ detail: { note, velocity, on } }) => {
    // Maj + touche : choisir un preset au lieu de jouer.
    if (on && shiftHeld && PRESET_KEYS[note % 12] !== undefined) { applyPreset(PRESET_KEYS[note % 12]); return; }
    if (on) engine.noteOn(note, velocity); else engine.noteOff(note);
    tlRecordNote(note, on, velocity);
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
  // Banques 1-5 : LED fixe ; banques 6-10 : LED clignotante.
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
    btn.title = b < 5 ? t('bank.title1', { n: b + 1 }) : t('bank.title2', { n: b + 1, m: b - 4 });
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
    btn.title = page === 'tr' ? t('tr.pageTitle')
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
  if (on) engine.noteOn(note, velocity); else engine.noteOff(note);
  tlRecordNote(note, on, velocity);
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
const TL_SOURCES = ['pads', 'synth', 'tr'];
const bufferCache = new Map();   // sampleId -> AudioBuffer des blocs
const peaksCache = new Map();    // sampleId -> crêtes pour dessiner la forme d'onde
let tlRecorder = null;
let tlRec = null;                // enregistrement en cours : { beat, time, track, source, startedDrum, bpm }
let tlSel = null;                // bloc sélectionné : { track, clip }

const beatPx = () => state.tl.zoom / BEATS_PER_BAR;
const snapBeat = (v, fine) => (fine ? Math.round(v) : Math.round(v / BEATS_PER_BAR) * BEATS_PER_BAR);

// Buffer d'un son : cache, sinon pad qui utilise ce son.
function clipBuffer(sampleId) {
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
const loadTlBuffers = () => loadBuffers(state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)));
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
  if (source !== 'tr') {
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
  tlRec = { beat, time, track: state.tl.armed, source, startedDrum, bpm: state.bpm };
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
  const sr = raw.sampleRate;
  // Retire ce qui a été capté avant le temps de départ.
  const skip = Math.max(0, Math.round((rec.time - raw.startedAt) * sr));
  const chans = raw.channels.map(c => c.subarray(skip));
  if (chans[0].length > sr * 0.05) {
    const buffer = engine.ctx.createBuffer(2, chans[0].length, sr);
    chans.forEach((c, i) => buffer.copyToChannel(c, i));
    const id = `rec:${crypto.randomUUID()}`;
    const n = state.tl.tracks.flatMap(tr => tr.clips).filter(c => c.sampleId.startsWith('rec:')).length + 1;
    const name = `${t(`tl.src.${rec.source}`)} ${n}`;
    await store.saveSample(id, { name, data: encodeWav(chans, sr) });
    bufferCache.set(id, buffer);
    const len = Math.max(1, Math.round(buffer.duration * rec.bpm / 60));
    const clip = { id: crypto.randomUUID(), start: rec.beat, len, sampleId: id, name, cat: 'rec', color: catColor('rec'), bpm: rec.bpm, loop: false };
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
  // Un enregistrement qui n'est plus utilisé nulle part est effacé de la sauvegarde.
  if (clip.sampleId.startsWith('rec:') && !state.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === clip.sampleId))) {
    store.deleteSample(clip.sampleId).catch(() => {});
    bufferCache.delete(clip.sampleId);
    renderLibrary();
  }
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
  el.title = `${clip.name} — ${t('tl.clipTitle')}`;
  const cv = document.createElement('canvas');
  const label = document.createElement('span');
  label.textContent = clip.name;
  const grip = document.createElement('div');
  grip.className = 'tl-grip';
  el.append(cv, label, grip);
  requestAnimationFrame(() => drawClip(cv, clip));
  el.addEventListener('contextmenu', e => { e.preventDefault(); tlDelete(track, clip); });
  el.addEventListener('dblclick', () => {
    if (clip.type === 'note') { engine.noteOn(clip.note, clip.vel ?? 0.85, undefined, 'preview'); setTimeout(() => engine.noteOff(clip.note, false, undefined, 'preview'), 250); }
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
  // Les enregistrements remplacés ne servent plus : on les efface de la sauvegarde.
  for (const c of state.tl.tracks.flatMap(tr => tr.clips)) if (c.sampleId.startsWith('rec:')) store.deleteSample(c.sampleId).catch(() => {});
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
  const items = libraryItems({ manifest: libManifest, kit, banks: state.banks, tl: state.tl });
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
    target = tlTarget(ev);
    if (target) {
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
    if (target) tlPlaceItem(item, target.track, target.beat);
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
  const apply = () => {
    if (queuedScene !== n) return;   // une autre scène a été demandée entre-temps
    state.tr.mutes = { ...sc.tr.mutes };
    for (const id of CHANNELS) if (sc.mix?.[id]) Object.assign(state.mix.channels[id], sc.mix[id]);
    mixer.update();
    renderMixer();
    if (sc.preset !== undefined && sc.preset !== state.preset) applyPreset(sc.preset);
    if (!sc.running && drum.running) drum.stop();
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

function applyPreset(i) {
  const preset = PRESETS[i];
  if (!preset) return;
  state.preset = i;
  for (const [id, v] of Object.entries(preset.values)) {
    const def = globalDef(id);
    state.globals[id] = Math.min(1, Math.max(0, toPos(def, v)));
    engine.set(id, toValue(def, state.globals[id]));
  }
  engine.setVoice(preset.voice);
  renderPresets();
  renderKnobs();
  toast(t('preset.toast', { name: preset.name }));
  save();
}

function buildPresets() {
  const keyName = Object.fromEntries(Object.entries(PRESET_KEYS).map(([k, i]) => [i, t('notes')[k]]));
  PRESETS.forEach((preset, i) => {
    const btn = document.createElement('button');
    btn.textContent = preset.name;
    btn.title = t('preset.title', { key: keyName[i] });
    btn.addEventListener('click', () => applyPreset(i));
    $('#presets').appendChild(btn);
  });
  renderPresets();
}

function renderPresets() {
  [...$('#presets').children].forEach((btn, i) => btn.classList.toggle('active', i === state.preset));
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
        for (const [id, p] of Object.entries(state.globals)) engine.set(id, globalValue(id, p));
        state.preset = kitData.preset ?? 0;
        engine.setVoice(PRESETS[state.preset]?.voice ?? {});
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
