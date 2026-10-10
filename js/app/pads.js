// Fenêtre des pads et éditeur de pad.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { MODES, PAGES, toPos, toValue } from '../params.js';
import { clearPad, loadFileIntoPad, padPending, releasePad, selectPad, setBank, setPage, triggerPad } from './actions.js';
import { renderLeds } from './controller.js';
import { $, BANKS, currentPad, engine, padKey, pickerColors, playing, state, uiColor, wm } from './core.js';
import { arcPath, knobRows, renderKnobRow, renderKnobs } from './knobs.js';
import { save } from './save.js';

// ---------- Interface : pads ----------

export const padEls = [];

export function buildPads() {
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

export function renderPad(i) {
  const pad = state.banks[state.bank][i];
  const el = padEls[i];
  const mode = playing.get(padKey(state.bank, i));
  el.classList.toggle('empty', !pad);
  el.classList.toggle('playing', !!mode && !padPending(padKey(state.bank, i)));
  el.classList.toggle('pending', padPending(padKey(state.bank, i)));
  el.classList.toggle('selected', i === state.selected);
  el.classList.toggle('loop', !!pad && MODES[toValue(PAGES.pad.params[7], pad.p.mode)] === 'loop');
  el.style.setProperty('--c', pad ? PALETTE[uiColor(pad.color)] : '#444');
  el.querySelector('.name').textContent = pad ? pad.name : t('pad.empty');
}

export function renderPads() { for (let i = 0; i < 40; i++) renderPad(i); renderPadKnobs(); }

// Potentiomètres du pad sélectionné, sous la grille de la fenêtre des pads (les mêmes que dans l'éditeur).
export function renderPadKnobs() {
  if (!knobRows.pad) return;
  renderKnobRow('pad');
  const pad = currentPad();
  $('#pad-knobs-name').textContent = pad ? `Pad ${state.selected + 1} · ${pad.name}` : t('pads.knobsEmpty', { n: state.selected + 1 });
}

export function buildBanks() {
  const wrap = $('#banks');
  for (let b = 0; b < BANKS; b++) {
    const btn = document.createElement('button');
    btn.textContent = `${b + 1}`;
    btn.title = b < 5 ? t('bank.title1', { n: b + 1 }) : b < 10 ? t('bank.title2', { n: b + 1, m: b - 4 }) : b < 15 ? t('bank.title3', { n: b + 1, m: b - 9 }) : b < 20 ? t('bank.title4', { n: b + 1, m: b - 14 }) : t('bank.title5', { n: b + 1, m: b - 19 });
    btn.addEventListener('click', () => setBank(b));
    wrap.appendChild(btn);
  }
}

export function renderBanks() {
  [...$('#banks').children].forEach((btn, b) => btn.classList.toggle('active', b === state.bank));
}

// ---------- Interface : éditeur de pad ----------

export function buildSwatches() {
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

export function buildEditor() {
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

export function renderEditor() {
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

export function drawWave(pad) {
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


// Potentiomètres du pad dans l'éditeur (les mêmes que la page « Pad » des potentiomètres de l'APC).
export const edKnobEls = [];
export function buildEditorKnobs() {
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

export function turnPadParam(k, { delta, value }) {
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

export function renderEditorKnobs() {
  const pad = currentPad();
  PAGES.pad.params.forEach((def, k) => {
    const el = edKnobEls[k];
    if (!el) return;
    const p = pad ? pad.p[def.id] : 0;
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = pad ? def.fmt(toValue(def, p)) : '—';
    el.style.opacity = pad ? 1 : 0.4;
  });
  renderPadKnobs();
}

// Crayon d'un pad : ouvre l'éditeur sur ce pad, et les potentiomètres de l'APC passent sur ses réglages.
export function openPadEditor(i) {
  selectPad(i);
  if (!wm.isOpen('editor')) wm.toggle('editor', true); else wm.bring('editor');
  setPage('pad');
  renderEditor();
}
