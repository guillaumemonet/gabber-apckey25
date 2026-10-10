// Lanceur de clips (fenêtre Lanceur, et la grille de l'APC) : 8 colonnes = les 8 premières pistes de la timeline,
// 5 lignes. Une case contient un clip (copie d'un bloc ou son de la bibliothèque) ; la lancer le fait tourner en boucle,
// à partir de la mesure suivante, à la place du clip qui tournait dans sa colonne. Il passe par les réglages de sa piste
// (potentiomètres, effets d'insert). Lancer une ligne lance toutes ses cases ; Stop arrête une colonne ou tout.
// Sur l'APC (« Grille APC = lanceur ») : pads = cases, SCENE LAUNCH 1-5 = lignes, STOP ALL = tout arrêter,
// Maj + pad = arrêter sa colonne.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { BEATS_PER_BAR, Timeline } from '../timeline.js';
import { $, apc, engine, mixer, oscSynth, padKey, state, timeline, uiColor, wm } from './core.js';
import { presetPatch } from './gen.js';
import { toast } from './misc.js';
import { oscFor } from './osc-ui.js';
import { save } from './save.js';
import { clipBuffer, ensureBuffer, trackName } from './tl.js';

export const LN_COLS = 8, LN_ROWS = 5;
export const emptyLauncher = () => ({ slots: Array.from({ length: LN_ROWS }, () => new Array(LN_COLS).fill(null)) });
export function cleanLauncher(saved) {
  const l = emptyLauncher();
  for (let r = 0; r < LN_ROWS; r++) for (let c = 0; c < LN_COLS; c++) {
    const x = saved?.slots?.[r]?.[c];
    if (x && typeof x === 'object' && (x.sampleId || x.type === 'note')) l.slots[r][c] = x;
  }
  return l;
}

export let launcherMode = false;          // grille de l'APC = lanceur
const players = new Map();                // colonne -> { tl, row }
const pending = new Map();                // colonne -> { row (null = arrêt), at, timer }
let origin = null;                        // grille des mesures du lanceur quand rien d'autre ne joue
const slot = (r, c) => state.launcher.slots[r]?.[c] ?? null;
export const lnPlaying = (c) => players.get(c)?.row ?? null;

// Prochaine mesure : sur la grille de la timeline (ou de la 909, des boucles des pads) si elle tourne, sinon sur
// celle du lanceur ; tout de suite si rien ne joue.
function nextBar() {
  const now = engine.ctx.currentTime + 0.03, bar = 240 / state.bpm;
  const busy = timeline.playing || engine.seqRunning || [...engine.padVoices.values()].some(v => v.mode === 'loop');
  const o = busy ? engine.origin : players.size ? origin : null;
  if (o === null || o === undefined) { origin = now + 0.02; return origin; }
  if (!busy) origin = o;
  return o + Math.ceil((now - o) / bar - 1e-6) * bar;
}

function startPlayer(c, row, at) {
  const clip = slot(row, c);
  if (!clip) return;
  const beats = Math.max(1, timeline.clipBeats(clip));
  const one = { ...clip, id: `ln-${c}-${row}`, start: 0, len: beats, loop: clip.type === 'note' ? false : clip.loop };
  const track = state.tl.tracks[c] ?? {};
  const st = { bars: beats / BEATS_PER_BAR, loop: true, playhead: 0, tracks: [{ ...track, mute: false, solo: false, bus: null, auto: {}, clips: [one], fx: [] }], buses: [] };
  const tl = new Timeline(engine, () => st, clipBuffer, mixer.input('tl'));
  Object.assign(tl, { getPad: timeline.getPad, padKey, getPatch: presetPatch, getOsc: x => oscFor(x, oscSynth), keyPrefix: `ln${c}:`,
    duckOutput: timeline.duckOutput, isDucked: timeline.isDucked, isKickPad: timeline.isKickPad, kicksOf: timeline.kicksOf, onKick: timeline.onKick });
  const keep = engine.origin;
  tl.play(0, at);
  if (keep !== null && (timeline.playing || engine.seqRunning)) engine.origin = keep;   // la grille de la timeline et de la 909 reste la leur
  else if (!players.size) origin = at;
  players.set(c, { tl, row });
}

function stopPlayer(c) {
  const p = players.get(c);
  if (!p) return;
  players.delete(c);
  p.tl.stop(true);
}

// Change ce que joue la colonne `c` à l'instant `at` (row = null : arrêt).
function schedule(c, row, at) {
  clearTimeout(pending.get(c)?.timer);
  const delay = Math.max(0, (at - engine.ctx.currentTime - 0.015) * 1000);
  const timer = setTimeout(() => {
    pending.delete(c);
    stopPlayer(c);
    if (row !== null) startPlayer(c, row, at);
    renderLauncher();
  }, delay);
  pending.set(c, { row, at, timer });
  renderLauncher();
}

export async function launch(row, c) {
  const clip = slot(row, c);
  if (!clip) { stopColumn(c); return; }
  if (clip.sampleId && !(await ensureBuffer(clip.sampleId))) { toast(t('lib.loadFail'), 3000); return; }
  schedule(c, row, nextBar());
}
export function launchRow(row) {
  const at = nextBar();
  for (let c = 0; c < LN_COLS; c++) if (slot(row, c)) schedule(c, row, at);
}
export function stopColumn(c) {
  if (!players.has(c) && !pending.has(c)) return;
  schedule(c, null, players.size ? nextBar() : engine.ctx.currentTime);
}
export function stopAllClips() {
  const at = nextBar();
  for (const c of new Set([...players.keys(), ...pending.keys()])) schedule(c, null, at);
}
// Coupe tout, tout de suite (Panique, nouveau projet).
export function haltLauncher() {
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear();
  for (const c of [...players.keys()]) stopPlayer(c);
  renderLauncher();
}

// Remplir une case : copie d'un bloc de la timeline, ou son de la bibliothèque.
export function setSlot(row, c, clip) {
  state.launcher.slots[row][c] = clip ? JSON.parse(JSON.stringify({ ...clip, start: 0 })) : null;
  if (!clip && players.get(c)?.row === row) stopColumn(c);
  save();
  renderLauncher();
}
// Un bloc de la timeline envoyé au lanceur : dans la colonne de sa piste, première case libre. -> ligne, ou -1
export function sendToLauncher(track, clip) {
  if (track >= LN_COLS) { toast(t('ln.tooFar', { n: LN_COLS }), 3000); return -1; }
  const row = state.launcher.slots.findIndex(r => !r[track]);
  if (row < 0) { toast(t('ln.full', { track: trackName(track) }), 3000); return -1; }
  setSlot(row, track, clip);
  toast(t('ln.sent', { track: trackName(track), row: row + 1 }), 2500);
  return row;
}
export async function slotFromLibrary(row, c, item) {
  const buf = await ensureBuffer(item.sampleId);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  const natural = item.bpm ? buf.duration * item.bpm / 60 : buf.duration / timeline.beatDur;
  const len = item.loop ? (item.bars ? item.bars * BEATS_PER_BAR : Math.max(BEATS_PER_BAR, Math.round(natural / BEATS_PER_BAR) * BEATS_PER_BAR)) : Math.max(1, Math.ceil(natural - 0.05));
  setSlot(row, c, { id: crypto.randomUUID(), len, sampleId: item.sampleId, name: item.name, cat: item.cat, color: catColor(item.cat), bpm: item.bpm, loop: item.loop });
}

// ---- APC ----
export function toggleLauncherMode(on = !launcherMode) {
  launcherMode = on;
  renderLauncher();
  window.dispatchEvent(new CustomEvent('gk-grid-mode'));
}
// Pad de l'APC (0 = en bas à gauche) -> case (la ligne du haut de l'APC = ligne 1).
export const padSlot = i => ({ row: LN_ROWS - 1 - Math.floor(i / LN_COLS), col: i % LN_COLS });
export function launcherPad(i, shift) {
  const { row, col } = padSlot(i);
  if (shift) stopColumn(col); else launch(row, col);
}
export function renderLauncherLeds() {
  if (!apc?.connected || !launcherMode) return;
  const blink = Math.floor(performance.now() / 110) % 2;
  for (let i = 0; i < 40; i++) {
    const { row, col } = padSlot(i);
    const clip = slot(row, col);
    const p = pending.get(col);
    let led = clip ? 'dim' : 'off';
    if (p && (p.row === row || (p.row === null && players.get(col)?.row === row))) led = blink ? 'on' : 'off';
    else if (players.get(col)?.row === row) led = 'pulse';
    apc.setPad(i, clip ? clip.color ?? catColor(clip.cat) : 0, led);
  }
}

// ---- Fenêtre ----
export function buildLauncher() {
  $('#ln-mode').addEventListener('click', () => toggleLauncherMode());
  $('#ln-stop-all').addEventListener('click', stopAllClips);
  renderLauncher();
  // Clignotement des cases en attente (écran et APC).
  setInterval(() => { if (pending.size) { renderLauncher(); } }, 110);
}

export function renderLauncher() {
  const grid = $('#launcher');
  if (!grid) return;
  $('#ln-mode')?.classList.toggle('active', launcherMode);
  grid.innerHTML = '';
  const cell = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; grid.appendChild(d); return d; };
  for (let c = 0; c < LN_COLS; c++) {
    const h = cell('ln-head');
    const name = document.createElement('span');
    name.textContent = state.tl.tracks[c] ? trackName(c) : '—';
    const stop = document.createElement('button');
    stop.className = 'ln-stop icon-only';
    stop.dataset.icon = 'stop';
    stop.title = t('ln.stopCol');
    stop.classList.toggle('active', players.has(c));
    stop.addEventListener('click', () => stopColumn(c));
    h.append(name, stop);
  }
  cell('ln-head ln-corner');
  const blink = Math.floor(performance.now() / 220) % 2;
  for (let r = 0; r < LN_ROWS; r++) {
    for (let c = 0; c < LN_COLS; c++) {
      const clip = slot(r, c);
      const b = document.createElement('button');
      b.className = 'ln-slot' + (clip ? ' full' : '');
      b.dataset.row = r;
      b.dataset.col = c;
      if (clip) {
        b.style.setProperty('--c', PALETTE[uiColor(clip.color ?? catColor(clip.cat))]);
        b.textContent = clip.name;
        b.title = t('ln.slotTitle');
      } else b.title = t('ln.emptyTitle');
      const p = pending.get(c);
      if (players.get(c)?.row === r) b.classList.add('playing');
      if (p && (p.row === r || (p.row === null && players.get(c)?.row === r)) && blink) b.classList.add('pending');
      b.addEventListener('click', () => launch(r, c));
      b.addEventListener('contextmenu', e => { e.preventDefault(); if (clip) setSlot(r, c, null); });
      grid.appendChild(b);
    }
    const row = document.createElement('button');
    row.className = 'ln-row';
    row.dataset.icon = 'play';
    row.textContent = t('ln.row', { n: r + 1 });
    row.addEventListener('click', () => launchRow(r));
    grid.appendChild(row);
  }
  renderLauncherLeds();
}

export const launcherWinOpen = () => wm?.isOpen('launcher');
