// Fenêtre Banques (gestionnaire) : les 25 banques de pads, chacune avec un nom, et la grille des 40 pads de la banque
// choisie, disposée comme l'APC (pads 1-8 en bas). Glisser un pad sur un autre : les échanger (Alt = copier) ; sur une
// banque de la liste : l'y déplacer (première place libre). Clic : écouter ; clic droit : écouter, renommer, couleur,
// éditer, vider. Pour la banque : jouer, renommer, dupliquer, vider, exporter, importer. Tout s'annule avec Ctrl+Z.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { BANKS, $, engine, padKey, pickerColors, state, uiColor, wm } from './core.js';
import { selectPad, setBank } from './actions.js';
import { renderLeds } from './controller.js';
import { libManifest } from './library-ui.js';
import { toast } from './misc.js';
import { renderEditor, renderPad, renderPads } from './pads.js';
import { save } from './save.js';
import { loadPad } from './sounds.js';

const COLS = 8, ROWS = 5;
const DRAG = 'application/x-gk-pad';
let shown = null;   // banque affichée (null = la banque jouée)
export const mgrBank = () => shown ?? state.bank;
// Case de la grille (ligne 0 = en haut) -> pad : comme sur l'APC, les pads 1-8 sont en bas.
const padOf = (row, col) => (ROWS - 1 - row) * COLS + col;

export const cleanBankNames = saved => Array.from({ length: BANKS }, (_, b) => (typeof saved?.[b] === 'string' ? saved[b].slice(0, 32) : ''));

// Nom d'une banque : le sien, sinon celui de la banque de la bibliothèque dont viennent la plupart de ses sons.
export function bankName(b) {
  const own = state.bankNames?.[b];
  if (own) return own;
  const folders = new Map();
  for (const p of state.banks[b] ?? []) {
    const f = p?.sampleId?.startsWith('lib:') ? p.sampleId.slice(4).split('/')[0] : null;
    if (f) folders.set(f, (folders.get(f) ?? 0) + 1);
  }
  const top = [...folders].sort((a, b2) => b2[1] - a[1])[0]?.[0];
  return libManifest?.banks.find(k => k.pads.find(Boolean)?.file.split('/')[0] === top)?.name ?? '';
}

// Après un changement dans la banque `b` : affichage, LED, sauvegarde (et l'historique d'Annuler).
function changed(...banks) {
  if (banks.includes(state.bank)) { renderPads(); renderEditor(); renderLeds(); }
  save();
  renderBankMgr();
}
const stop = (b, i) => engine.stopPad(padKey(b, i));
const copyPad = p => p && { ...p, p: { ...p.p } };

/** Échange deux pads (ou copie le premier sur le second avec `copy`). */
export function movePad(from, to, copy = false) {
  if (from.b === to.b && from.i === to.i) return;
  const a = state.banks[from.b][from.i], b = state.banks[to.b][to.i];
  if (!a) return;
  stop(from.b, from.i); stop(to.b, to.i);
  state.banks[to.b][to.i] = copy ? copyPad(a) : a;
  if (!copy) state.banks[from.b][from.i] = b;
  changed(from.b, to.b);
}
/** Déplace (ou copie) un pad dans une autre banque, à sa première place libre. -> indice, ou -1 si elle est pleine */
export function padToBank(from, bank, copy = false) {
  const i = state.banks[bank].findIndex(p => !p);
  if (i < 0) { toast(t('bm.full', { n: bank + 1 }), 3000); return -1; }
  movePad(from, { b: bank, i }, copy);
  return i;
}
export function clearMgrPad(b, i) {
  if (!state.banks[b][i]) return;
  stop(b, i);
  state.banks[b][i] = null;
  changed(b);
}
// Dupliquer : la banque copiée dans la première banque vide.
export function duplicateBank(b) {
  const to = state.banks.findIndex((bk, k) => k !== b && !bk.some(Boolean));
  if (to < 0) { toast(t('bm.noEmpty'), 3000); return -1; }
  state.banks[to] = state.banks[b].map(copyPad);
  if (state.bankNames[b] || bankName(b)) state.bankNames[to] = t('bm.copyName', { name: bankName(b) || t('bm.bank', { n: b + 1 }) }).slice(0, 32);
  shown = to;
  changed(to);
  toast(t('bm.duplicated', { n: b + 1, to: to + 1 }), 3000);
  return to;
}
export function clearMgrBank(b) {
  const n = state.banks[b].filter(Boolean).length;
  if (!n || !confirm(t('bank.clearConfirm', { n: b + 1, count: n }))) return;
  state.banks[b].forEach((_, i) => stop(b, i));
  state.banks[b] = new Array(40).fill(null);
  changed(b);
}
async function previewPad(b, i) {
  const pad = state.banks[b][i];
  if (!pad) return;
  if (!pad.buffer) await loadPad(pad);
  engine.playPad(padKey(b, i), pad, { oneShot: true });
}

// ---------- Menu d'un pad (clic droit) ----------

let menu = null;
function closeMenu() { menu?.remove(); menu = null; window.removeEventListener('pointerdown', outside, true); }
const outside = e => { if (menu && !menu.contains(e.target)) closeMenu(); };
function padMenu(b, i, x, y) {
  closeMenu();
  const pad = state.banks[b][i];
  if (!pad) return;
  menu = document.createElement('div');
  menu.className = 'clip-menu bm-menu';
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = `${t('bm.pad', { n: i + 1 })} · ${pad.name}`;
  menu.appendChild(head);
  const item = (label, icon, fn) => {
    const btn = document.createElement('button');
    btn.className = 'cm-item';
    btn.textContent = label;
    btn.dataset.icon = icon;
    btn.addEventListener('click', () => { closeMenu(); fn(); });
    menu.appendChild(btn);
  };
  item(t('bm.listen'), 'play', () => previewPad(b, i));
  const name = document.createElement('input');
  name.className = 'bm-rename';
  name.value = pad.name;
  name.maxLength = 24;
  name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') closeMenu(); });
  name.addEventListener('change', () => { pad.name = name.value || pad.name; changed(b); });
  const row = document.createElement('label');
  row.className = 'cm-row';
  row.append(Object.assign(document.createElement('span'), { textContent: t('bm.rename') }), name);
  menu.appendChild(row);
  const colors = document.createElement('div');
  colors.className = 'bm-colors';
  for (const c of pickerColors()) {
    const sw = document.createElement('button');
    sw.style.background = PALETTE[c];
    sw.classList.toggle('active', pad.color === c);
    sw.addEventListener('click', () => { pad.color = c; changed(b); closeMenu(); });
    colors.appendChild(sw);
  }
  menu.appendChild(colors);
  item(t('bm.edit'), 'editor', () => { if (state.bank !== b) setBank(b); selectPad(i); wm.toggle('editor', true); wm.bring?.('editor'); });
  item(t('bm.clear'), 'trash', () => clearMgrPad(b, i));
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  setTimeout(() => window.addEventListener('pointerdown', outside, true));
}

// ---------- Fenêtre ----------

const dragData = e => { try { return JSON.parse(e.dataTransfer.getData(DRAG)); } catch { return null; } };

export function buildBankMgr() {
  const box = $('#bank-mgr');
  if (!box) return;
  box.innerHTML = `<div class="bm-list"></div>
    <div class="bm-main">
      <div class="bm-head"><input class="bm-name" maxlength="32"><button class="bm-play" data-icon="play"></button>
        <button class="bm-dup" data-icon="plus"></button><button class="bm-clear" data-icon="trash"></button>
        <button class="bm-export" data-icon="download"></button><button class="bm-import" data-icon="upload"></button></div>
      <div class="bm-grid"></div>
      <div class="hint bm-hint"></div>
    </div>`;
  const name = box.querySelector('.bm-name');
  name.placeholder = t('bm.namePh');
  name.addEventListener('keydown', e => e.stopPropagation());
  name.addEventListener('input', () => { state.bankNames[mgrBank()] = name.value.slice(0, 32); save(); renderBankList(); });
  const btn = (sel, label, title, fn) => { const b = box.querySelector(sel); b.textContent = label; b.title = title; b.addEventListener('click', fn); };
  btn('.bm-play', t('bm.play'), t('bm.playTitle'), () => { setBank(mgrBank()); renderBankMgr(); });
  btn('.bm-dup', t('bm.dup'), t('bm.dupTitle'), () => duplicateBank(mgrBank()));
  btn('.bm-clear', t('bm.clearBank'), t('bm.clearBankTitle'), () => clearMgrBank(mgrBank()));
  // Exporter / importer : les fonctions de kit de la fenêtre Pads, sur cette banque (elle devient la banque jouée).
  btn('.bm-export', t('bm.export'), t('kit.exportBank.title'), () => { setBank(mgrBank()); $('#kit-export-bank').click(); });
  btn('.bm-import', t('bm.import'), t('bm.importTitle'), () => { setBank(mgrBank()); $('#kit-import').click(); });
  box.querySelector('.bm-hint').textContent = t('bm.hint');
  renderBankMgr();
}

function renderBankList() {
  const list = $('#bank-mgr .bm-list');
  if (!list) return;
  list.innerHTML = '';
  for (let b = 0; b < BANKS; b++) {
    const row = document.createElement('button');
    row.className = 'bm-bank';
    row.dataset.bank = b;
    row.classList.toggle('active', b === mgrBank());
    row.classList.toggle('playing', b === state.bank);
    const n = state.banks[b].filter(Boolean).length;
    const nm = bankName(b);
    row.innerHTML = `<b>${b + 1}</b><span></span><em>${n}/40</em>`;
    row.querySelector('span').textContent = nm || t('bm.bank', { n: b + 1 });
    row.title = t('bm.bankTitle');
    row.addEventListener('click', () => { shown = b; renderBankMgr(); });
    row.addEventListener('dragover', e => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); row.classList.add('drop'); } });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drop');
      const from = dragData(e);
      if (from && from.b !== b) padToBank(from, b, e.altKey);
    });
    list.appendChild(row);
  }
}

export function renderBankMgr() {
  const box = $('#bank-mgr');
  if (!box || !box.firstChild) return;
  const b = mgrBank();
  const name = box.querySelector('.bm-name');
  if (document.activeElement !== name) name.value = state.bankNames[b] ?? '';
  name.placeholder = bankName(b) || t('bm.bank', { n: b + 1 });
  box.querySelector('.bm-play').classList.toggle('active', b === state.bank);
  renderBankList();
  const grid = box.querySelector('.bm-grid');
  grid.innerHTML = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = padOf(r, c), pad = state.banks[b][i];
    const cell = document.createElement('div');
    cell.className = 'bm-pad';
    cell.dataset.pad = i;
    cell.innerHTML = `<small>${i + 1}</small><span></span>`;
    if (pad) {
      cell.querySelector('span').textContent = pad.name;
      cell.title = pad.name;
      cell.classList.add('used');
      cell.style.setProperty('--c', PALETTE[uiColor(pad.color)] ?? '#888');
      cell.draggable = true;
      cell.addEventListener('dragstart', e => { e.dataTransfer.setData(DRAG, JSON.stringify({ b, i })); e.dataTransfer.effectAllowed = 'copyMove'; });
      cell.addEventListener('click', () => { previewPad(b, i); if (b === state.bank) selectPad(i); });
      cell.addEventListener('contextmenu', e => { e.preventDefault(); padMenu(b, i, e.clientX, e.clientY); });
    }
    cell.addEventListener('dragover', e => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); cell.classList.add('drop'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop'));
    cell.addEventListener('drop', e => {
      e.preventDefault();
      cell.classList.remove('drop');
      const from = dragData(e);
      if (from) movePad(from, { b, i }, e.altKey);
    });
    grid.appendChild(cell);
  }
}
