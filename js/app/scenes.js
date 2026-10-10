// Scènes : instantanés rappelés à la mesure suivante.
import { t } from '../i18n.js';
import { CHANNELS } from '../mixer.js';
import { migratePreset } from '../presets.js';
import { renderAcid } from './acid-ui.js';
import { renderLeds } from './controller.js';
import { $, acid, apc, drum, engine, mixer, state } from './core.js';
import { toast } from './misc.js';
import { renderMixer } from './mixer-ui.js';
import { save } from './save.js';
import { applyPreset } from './synth-ui.js';
import { setBpm } from './tempo.js';
import { renderTr, toggleTrMode, trMode } from './tr909-ui.js';

// ---------- Scènes ----------

export const SCENES = 40;
export let sceneMode = false;        // grille de l'APC = 40 scènes
export let sceneSaveMode = false;    // à l'écran : un clic enregistre au lieu de lancer
export let currentScene = null;
export let queuedScene = null;

export function mergeScenes(saved) {
  const out = new Array(SCENES).fill(null);
  if (Array.isArray(saved)) saved.slice(0, SCENES).forEach((s, i) => { out[i] = s ?? null; });
  return out;
}

export function toggleSceneMode(on = !sceneMode) {
  sceneMode = on;
  if (on) {
    if (trMode) toggleTrMode(false);
    toast(t('scene.modeOn'), 5000);
  }
  renderScenes();
  renderLeds();
}

// Mémorise l'état actuel : boucles lancées, patterns, pistes muettes, mixeur, preset, tempo, lecture.
export function captureScene(n) {
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
export function launchScene(n) {
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

export function clearScene(n) {
  if (!state.scenes[n] || !confirm(t('scene.confirmClear', { n: n + 1 }))) return;
  state.scenes[n] = null;
  if (currentScene === n) currentScene = null;
  renderScenes();
  renderLeds();
  save();
}

export function renderSceneLeds() {
  const GREEN = 21, RED = 5, YELLOW = 13;
  for (let i = 0; i < SCENES; i++) {
    if (i === queuedScene) apc.setPad(i, YELLOW, 'blink');
    else if (i === currentScene) apc.setPad(i, RED, 'on');
    else apc.setPad(i, GREEN, state.scenes[i] ? 'dim' : 'off');
  }
}

export const sceneEls = [];
export function buildScenes() {
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

export function renderScenes() {
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

// Variables modifiées depuis d'autres modules.
export function setSceneMode(v) { return (sceneMode = v); }
export function setCurrentScene(v) { return (currentScene = v); }
export function setQueuedScene(v) { return (queuedScene = v); }
