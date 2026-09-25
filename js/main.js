import { APC, BTN, PALETTE, PICKER_COLORS, MK1_PICKER_COLORS, mk1Equivalent } from './apc.js';
import { Engine } from './audio.js';
import { PAGES, MODES, toValue, toPos, defaultPositions } from './params.js';
import { renderDefaultKit } from './kit.js';
import { PRESETS, PRESET_KEYS } from './presets.js';
import { Recorder, download, stamp } from './recorder.js';
import { packBanks, unpack } from './kits.js';
import * as store from './storage.js';
import { t, soundName, translatePage } from './i18n.js';

translatePage();

const BANKS = 10;   // SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = banques 6-10
const PAGE_ORDER = ['synth', 'fx', 'pad', 'eq'];   // boutons de piste 1 à 4 (EQ aussi via SUSTAIN)
const $ = sel => document.querySelector(sel);

let engine, apc, kit, recorder;
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
  bindTempo();

  buildPads();
  buildBanks();
  buildEditor();
  buildPages();
  buildKnobs();
  buildPiano();
  buildPresets();
  buildPerf();
  bindKits();
  bindComputerKeyboard();
  drawMeter();
  renderAll();
  $('#start').classList.add('hidden');

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
  await importLibrary();

  // Décodage des fichiers (importés par l'utilisateur ou de la bibliothèque) en parallèle.
  const pending = state.banks.flat().filter(p => p && !p.buffer && /^(user|lib):/.test(p.sampleId));
  let done = 0;
  await Promise.all(pending.map(async pad => {
    let data = null;
    if (pad.sampleId.startsWith('user:')) {
      data = (await store.loadSample(pad.sampleId).catch(() => null))?.data?.slice(0);
    } else {
      data = await fetch(`sounds/${pad.sampleId.slice(4)}`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    }
    if (data) pad.buffer = await engine.ctx.decodeAudioData(data).catch(() => null);
    $('#start-msg').textContent = t('start.loading', { done: ++done, total: pending.length });
  }));
}

// Remplit les banques vides avec la bibliothèque générée par tools/build_banks.py.
async function importLibrary() {
  const lib = await fetch('sounds/banks.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!lib) return;
  const modeDef = PAGES.pad.params[7];
  const firstImport = !state.libBanks.length;
  lib.banks.forEach((bank, k) => {
    const b = k + 1;   // la banque 1 garde le kit de synthèse
    if (b >= BANKS || state.libBanks.includes(bank.name)) return;
    state.libBanks.push(bank.name);
    if (state.banks[b].some(Boolean)) return;   // ne jamais écraser une banque de l'utilisateur
    bank.pads.forEach((s, i) => {
      if (!s) return;
      const pad = newPad(soundName(s.name), s.color, `lib:${s.file}`, null, s.bpm || 0);
      pad.p.mode = s.mode / (modeDef.steps - 1);
      state.banks[b][i] = pad;
    });
  });
  if (firstImport && lib.bpm) state.bpm = lib.bpm;
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
      banks: state.banks.map(bank => bank.map(p => p && { name: p.name, color: p.color, sampleId: p.sampleId, bpm: p.bpm, p: p.p })),
    }).catch(err => console.warn('Save failed', err));
  }, 400);
}

// ---------- Actions (communes souris / contrôleur) ----------

function triggerPad(i) {
  selectPad(i);
  engine.playPad(padKey(state.bank, i), state.banks[state.bank][i]);
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
  engine.stopAllPads();
  engine.allNotesOff();
  for (const i of [...perfActive]) { perfActive.delete(i); PERF[i].off?.(); }
  heldRolls.length = 0;
  engine.rollOff();
  renderPerf();
  renderLeds();
}

function onPadState(key, isPlaying, mode) {
  if (isPlaying) playing.set(key, mode); else playing.delete(key);
  if (Math.floor(key / 40) !== state.bank) return;
  renderPad(key % 40);
  renderLeds();
}

// Tourne un potard : delta relatif (mk2, souris) ou position absolue (mk1).
function turnKnob(index, { delta, value }) {
  const def = PAGES[state.page].params[index];
  const pad = currentPad();
  const target = state.page === 'pad' ? pad?.p : state.globals;
  if (!def || !target) return;

  if (value !== undefined) {
    target[def.id] = value;
  } else {
    const stepSize = def.steps ? Math.max(0.01, 1 / (def.steps - 1) / 3) : 0.01;
    target[def.id] = Math.min(1, Math.max(0, target[def.id] + delta * stepSize * (shiftHeld && !def.steps ? 0.25 : 1)));
  }

  if (state.page === 'pad') {
    engine.updatePadVoice(padKey(state.bank, state.selected), pad);
    if (def.id === 'mode') { renderPad(state.selected); renderEditor(); }
  } else {
    engine.set(def.id, toValue(def, target[def.id]));
  }
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
    if (name.startsWith('scene')) setBank(+name.slice(5) - 1 + (shiftHeld ? 5 : 0));
    else if (name.startsWith('track')) setPage(PAGE_ORDER[+name.slice(5) - 1]);
    else if (name === 'stopAll') panic();
    else if (name === 'record') toggleRecording();
  });

  apc.addEventListener('knob', ({ detail }) => turnKnob(detail.index, detail));

  apc.addEventListener('key', ({ detail: { note, velocity, on } }) => {
    // Maj + touche : choisir un preset au lieu de jouer.
    if (on && shiftHeld && PRESET_KEYS[note % 12] !== undefined) { applyPreset(PRESET_KEYS[note % 12]); return; }
    if (on) engine.noteOn(note, velocity); else engine.noteOff(note);
    setPianoKey(note, on);
  });

  apc.addEventListener('sustain', ({ detail }) => onSustainButton(detail.on));

  const log = $('#log');
  const lines = [];
  apc.addEventListener('raw', ({ detail }) => {
    if (!$('.monitor').open) return;
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
  for (let i = 0; i < 40; i++) {
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
    ? (PAGE_ORDER[t] === state.page ? 1 : 0)
    : (perfActive.has(t - 4) || perfActive.has(t) ? 1 : 0)));
  apc.setButton(BTN.record, recorder?.recording ? 2 : 0);
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
      el.innerHTML = `<span class="num">${i + 1}</span><span class="name"></span>`;
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

// ---------- Interface : potentiomètres ----------

function buildPages() {
  const wrap = $('#pages');
  PAGE_ORDER.forEach((page, k) => {
    const btn = document.createElement('button');
    btn.textContent = PAGES[page].label;
    btn.title = t('page.title', { n: k + 1 });
    btn.addEventListener('click', () => setPage(page));
    wrap.appendChild(btn);
  });
}

function renderPages() {
  [...$('#pages').children].forEach((btn, t) => btn.classList.toggle('active', PAGE_ORDER[t] === state.page));
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
    el.addEventListener('pointerdown', e => { lastY = e.clientY; el.setPointerCapture(e.pointerId); });
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
      const def = PAGES[state.page].params[k];
      const target = state.page === 'pad' ? currentPad()?.p : state.globals;
      if (!target) return;
      turnKnob(k, { value: defaultPositions(state.page)[def.id] });
    });
    knobEls[k] = el;
    wrap.appendChild(el);
  }
}

const flashTimers = [];
function renderKnob(k, flash = false) {
  const def = PAGES[state.page].params[k];
  const el = knobEls[k];
  const target = state.page === 'pad' ? currentPad()?.p : state.globals;
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
      el.setPointerCapture(e.pointerId);
      playNote(n, 0.8, true);
    });
    el.addEventListener('pointerup', () => playNote(n, 0, false));
    piano.appendChild(el);
  }
}

function playNote(note, velocity, on) {
  if (on) engine.noteOn(note, velocity); else engine.noteOff(note);
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
    btn.addEventListener('pointerdown', e => { btn.setPointerCapture(e.pointerId); perfDown(i); });
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
    const blob = await packBanks(state.banks, padBytes, { kind: 'session', bpm: state.bpm, globals: state.globals, preset: state.preset });
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
function toast(text) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
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
