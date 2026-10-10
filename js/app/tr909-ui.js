// Fenêtre de la TR-909 et grille de l’APC en mode 909.
import { t } from '../i18n.js';
import { PATTERNS, TR_INSTR } from '../tr909.js';
import { setPage } from './actions.js';
import { renderLeds } from './controller.js';
import { $, apc, drum, state } from './core.js';
import { renderKnobs } from './knobs.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { renderScenes, setSceneMode } from './scenes.js';

// ---------- TR-909 ----------

export let trMode = false;          // grille de l'APC transformée en 909
export let pageBeforeTr = 'synth';
export let trAccentMode = false;    // les pas posés depuis l'APC sont accentués
export let trHead = -1;             // pas en cours de lecture
export const trPattern = () => state.tr.patterns[state.tr.pattern];

export function toggleSeq() {
  drum.toggle();
  renderTr();
  renderLeds();
}

export function toggleTrMode(on = !trMode) {
  trMode = on;
  if (on) {
    setSceneMode(false);
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

export function selectTrInstr(id) {
  state.tr.sel = id;
  renderTr();
  renderKnobs();
  renderLeds();
  save();
}

export function cycleTrStep(id, step) {
  const row = trPattern()[id];
  row[step] = (row[step] + 1) % 3;   // silence -> note -> accent -> silence
  renderTr();
  renderLeds();
  save();
}

// Grille de l'APC en mode 909 : rangées 1-2 = 16 pas de l'instrument choisi, rangées 3-4 = instruments
// puis Accent / Effacer / Muet, rangée 5 = patterns.
export function trPad(i) {
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

export function onTrStep(step) {
  trHead = step;
  renderTrHead();
  if (trMode) renderTrLeds();
}

export function renderTrLeds() {
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

export const trCells = [];   // trCells[instrument][pas]
export function buildTr() {
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

export function renderTr() {
  const play = $('#tr-play');
  play.textContent = drum.running ? t('tr.stop') : t('tr.play');
  play.dataset.icon = drum.running ? 'stop' : 'play';
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

export function renderTrHead() {
  trCells.forEach(row => row.forEach((cell, s) => cell.classList.toggle('head', s === trHead)));
}
