// Fenêtres des boîtes à rythmes (TR-909, TR-808) et grille de l'APC en mode boîte à rythmes. Les deux fenêtres sont
// construites par le même code : `id` = 'tr' (909) ou 'tr8' (808), les éléments de la page sont `#<id>-…`.
import { t } from '../i18n.js';
import { PATTERNS } from '../drummachine.js';
import { TR8_DEF } from '../tr808.js';
import { TR_DEF } from '../tr909.js';
import { setPage } from './actions.js';
import { renderLeds } from './controller.js';
import { $, apc, drum, drum808, state } from './core.js';
import { renderKnobs } from './knobs.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { renderScenes, setSceneMode } from './scenes.js';

export const DRUM_IDS = ['tr', 'tr8'];
export const DRUM_DEFS = { tr: TR_DEF, tr8: TR8_DEF };
export const drumOf = id => (id === 'tr8' ? drum808 : drum);
export const drumPattern = id => state[id].patterns[state[id].pattern];

export let trMode = false;          // grille de l'APC transformée en boîte à rythmes
export let trTarget = 'tr';         // celle que la grille pilote : la dernière dont on a utilisé la fenêtre
export let pageBeforeTr = 'synth';
export let trAccentMode = false;    // les pas posés depuis l'APC sont accentués
export const drumHeads = { tr: -1, tr8: -1 };   // pas en cours de lecture

export function setTrTarget(id) {
  if (trTarget === id) return;
  trTarget = id;
  if (trMode) { setPage(id); renderTrLeds(); }
}

export function toggleDrum(id = 'tr') {
  drumOf(id).toggle();
  renderTr();
  renderLeds();
}

export function toggleTrMode(on = !trMode, id = trTarget) {
  trMode = on;
  trTarget = id;
  if (on) {
    setSceneMode(false);
    renderScenes();
    if (!DRUM_IDS.includes(state.page)) pageBeforeTr = state.page;
    setPage(id);
    toast(t(`${id}.modeOn`), 5000);
  } else if (DRUM_IDS.includes(state.page)) {
    setPage(pageBeforeTr);
  }
  renderTr();
  renderLeds();
}

export function selectDrumInstr(id, inst) {
  state[id].sel = inst;
  renderTr();
  if (state.page === id) renderKnobs();
  renderLeds();
  save();
}

export function cycleDrumStep(id, inst, step) {
  const row = drumPattern(id)[inst];
  row[step] = (row[step] + 1) % 3;   // silence -> note -> accent -> silence
  renderTr();
  renderLeds();
  save();
}

// Grille de l'APC : rangées 1-2 = 16 pas de l'instrument choisi, rangées 3-4 = instruments puis Accent / Effacer / Muet,
// rangée 5 = patterns.
export const drumInstruments = id => DRUM_DEFS[id].instruments;
export const drumApcKeys = id => { const n = drumInstruments(id).length; return { accent: 16 + n, clear: 17 + n, mute: 18 + n }; };
export function trPad(i) {
  const id = trTarget, st = state[id], sel = st.sel;
  const row = drumPattern(id)[sel];
  const keys = drumApcKeys(id), list = drumInstruments(id);
  if (i < 16) {
    row[i] = row[i] ? 0 : (trAccentMode ? 2 : 1);
  } else if (i < 16 + list.length) {
    const inst = list[i - 16].id;
    drumOf(id).trigger(inst);
    selectDrumInstr(id, inst);
    return;
  } else if (i === keys.accent) {
    trAccentMode = !trAccentMode;
  } else if (i === keys.clear) {
    row.fill(0);
  } else if (i === keys.mute) {
    st.mutes[sel] = !st.mutes[sel];
  } else if (i >= 32) {
    drumOf(id).selectPattern(i - 32);
    return;
  } else return;
  renderTr();
  renderLeds();
  save();
}

export function onDrumStep(id, step) {
  drumHeads[id] = step;
  renderDrumHead(id);
  if (trMode && trTarget === id) renderTrLeds();
}

export function renderTrLeds() {
  const GREEN = 21, RED = 5, YELLOW = 13;
  const id = trTarget, st = state[id], sel = st.sel, m = drumOf(id);
  const pat = drumPattern(id), list = drumInstruments(id), keys = drumApcKeys(id);
  for (let i = 0; i < 16; i++) {
    const v = pat[sel][i];
    if (i === drumHeads[id]) apc.setPad(i, RED, 'on');
    else apc.setPad(i, v === 2 ? YELLOW : v ? GREEN : 0, v ? 'dim' : 'off');
  }
  for (let i = 16; i < 32; i++) apc.setPad(i, 0, 'off');
  list.forEach(({ id: inst }, k) => {
    if (inst === sel) apc.setPad(16 + k, YELLOW, 'on');
    else apc.setPad(16 + k, st.mutes[inst] ? RED : GREEN, 'dim');
  });
  apc.setPad(keys.accent, YELLOW, trAccentMode ? 'on' : 'dim');
  apc.setPad(keys.clear, RED, 'dim');
  apc.setPad(keys.mute, RED, st.mutes[sel] ? 'on' : 'dim');
  for (let k = 0; k < PATTERNS; k++) {
    const used = list.some(({ id: inst }) => st.patterns[k][inst].some(Boolean));
    if (k === st.pattern) apc.setPad(32 + k, RED, 'on');
    else if (k === m.queued) apc.setPad(32 + k, YELLOW, 'blink');
    else apc.setPad(32 + k, GREEN, used ? 'dim' : 'off');
  }
}

// Boutons des 8 patterns (boîtes à rythmes, séquenceur pas à pas) : celui qui joue, celui qui attend la mesure, ceux
// qui contiennent des pas.
export function buildPatternButtons(el, select) {
  for (let k = 0; k < PATTERNS; k++) {
    const btn = document.createElement('button');
    btn.textContent = k + 1;
    btn.title = t('tr.pattern', { n: k + 1 });
    btn.addEventListener('click', () => select(k));
    el.appendChild(btn);
  }
}
export function renderPatternButtons(el, current, queued, used) {
  [...el.children].forEach((btn, k) => {
    btn.classList.toggle('active', k === current);
    btn.classList.toggle('queued', k === queued);
    btn.classList.toggle('used', used(k));
  });
}

export const drumCells = { tr: [], tr8: [] };   // drumCells[machine][instrument][pas]
export function buildDrum(id) {
  const win = document.querySelector(`[data-win="${id}"]`);
  win.addEventListener('pointerdown', () => setTrTarget(id));   // la grille de l'APC pilote la machine qu'on utilise
  $(`#${id}-play`).addEventListener('click', () => toggleDrum(id));
  $(`#${id}-apc`).addEventListener('click', () => toggleTrMode(!(trMode && trTarget === id), id));
  $(`#${id}-accent`).addEventListener('input', e => { state[id].globals.accent = e.target.value / 100; save(); });
  buildPatternButtons($(`#${id}-patterns`), k => drumOf(id).selectPattern(k));
  const grid = $(`#${id}-grid`);
  drumInstruments(id).forEach(({ id: inst }, r) => {
    const name = document.createElement('button');
    name.className = 'tr-name';
    name.textContent = inst.toUpperCase();
    name.title = t(`${id}.n.${inst}`);
    name.addEventListener('click', () => { drumOf(id).trigger(inst); selectDrumInstr(id, inst); });
    grid.appendChild(name);
    drumCells[id][r] = [];
    for (let s = 0; s < 16; s++) {
      const cell = document.createElement('button');
      cell.className = 'tr-cell' + (s % 4 === 0 ? ' beat' : '');
      cell.addEventListener('click', () => cycleDrumStep(id, inst, s));
      grid.appendChild(cell);
      drumCells[id][r][s] = cell;
    }
  });
  renderDrum(id);
}

export function renderDrum(id) {
  const st = state[id], m = drumOf(id);
  if (!m || !drumCells[id].length) return;
  const play = $(`#${id}-play`);
  play.textContent = m.running ? t('tr.stop') : t('tr.play');
  play.dataset.icon = m.running ? 'stop' : 'play';
  play.classList.toggle('active', m.running);
  $(`#${id}-apc`).classList.toggle('active', trMode && trTarget === id);
  $(`#${id}-accent`).value = Math.round(st.globals.accent * 100);
  const list = drumInstruments(id);
  renderPatternButtons($(`#${id}-patterns`), st.pattern, m.queued, k => list.some(({ id: inst }) => st.patterns[k][inst].some(Boolean)));
  const pat = drumPattern(id);
  const names = $(`#${id}-grid`).querySelectorAll('.tr-name');
  list.forEach(({ id: inst }, r) => {
    names[r].classList.toggle('selected', inst === st.sel);
    names[r].classList.toggle('muted', !!st.mutes[inst]);
    drumCells[id][r].forEach((cell, s) => {
      cell.classList.toggle('on', pat[inst][s] === 1);
      cell.classList.toggle('accent', pat[inst][s] === 2);
    });
  });
  renderDrumHead(id);
}

// Les deux boîtes à rythmes.
export function renderTr() { for (const id of DRUM_IDS) renderDrum(id); }

export function renderDrumHead(id) {
  drumCells[id].forEach(row => row.forEach((cell, s) => cell.classList.toggle('head', s === drumHeads[id])));
}
