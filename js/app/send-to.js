// « Envoyer vers… » (menu d'un bloc de la timeline) : le bloc va dans une case choisie du lanceur, ou sur un pad choisi
// d'une banque. Une grille de 8 × 5 comme celle de l'APC montre ce qui est déjà occupé (nom, couleur) ; un clic pose
// le bloc. Un bloc de notes, ou un passage d'un son (début décalé, gain, fondus…), est d'abord rendu en audio pour le pad.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { PAGES } from '../params.js';
import { encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BANKS, engine, newPad, padKey, state, timeline, uiColor } from './core.js';
import { renderSong } from './export.js';
import { toBuffer } from './freeze.js';
import { LN_COLS, LN_ROWS, setSlot } from './launcher.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { renderEditor, renderPad } from './pads.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { loadTlBuffers } from './tl.js';

let menu = null;
let target = 'pads';      // dernier onglet choisi
let bankSel = null;       // banque montrée (null = celle en cours)
let withFx = false;       // pad : inclure les effets de la piste (décoché à chaque ouverture)

export function closeSendTo() {
  menu?.remove();
  menu = null;
  window.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('keydown', onKey, true);
}
const outside = e => { if (menu && !menu.contains(e.target)) closeSendTo(); };
const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeSendTo(); } };

const colorOf = c => (Number.isInteger(c) ? PALETTE[uiColor(c)] : null);
// Pad de la grille (ligne 0 = en haut) : comme sur l'APC, les pads 1-8 sont en bas.
export const padAt = (row, col) => (LN_ROWS - 1 - row) * LN_COLS + col;

/**
 * Ouvre le choix de la destination du bloc `clip` (piste `track`), au point (x, y). `sound` : un son fabriqué par un
 * outil (designer de kick…) au lieu d'un bloc : { name, toPad(banque, pad) } ; seulement les pads.
 */
export function openSendTo(track, clip, x, y, sound = null) {
  closeSendTo();
  if (sound) { clip = { name: sound.name }; target = 'pads'; }
  withFx = false;
  menu = document.createElement('div');
  menu.className = 'clip-menu send-menu';
  document.body.appendChild(menu);
  const fill = () => {
    menu.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'cm-head';
    head.textContent = t('send.head', { name: clip.name ?? '' });
    const tabs = document.createElement('div');
    tabs.className = 'send-tabs';
    for (const k of sound ? ['pads'] : ['pads', 'launcher']) {
      const b = document.createElement('button');
      b.textContent = t(`send.${k}`);
      b.dataset.target = k;
      b.classList.toggle('active', target === k);
      b.addEventListener('click', () => { target = k; fill(); });
      tabs.appendChild(b);
    }
    menu.append(head, tabs);
    const bank = bankSel ?? state.bank;
    if (target === 'pads') {
      const sel = document.createElement('select');
      sel.className = 'send-bank';
      for (let b = 0; b < BANKS; b++) {
        const n = (state.banks[b] ?? []).filter(Boolean).length;
        sel.add(new Option(t('send.bankItem', { n: b + 1, used: n }), b));
      }
      sel.value = bank;
      sel.addEventListener('change', () => { bankSel = +sel.value; fill(); });
      const row = document.createElement('label');
      row.className = 'cm-row';
      row.append(Object.assign(document.createElement('span'), { textContent: t('send.bank') }), sel);
      menu.appendChild(row);
      if (!sound) {
      // Les effets de la piste (effets, inserts, filtres, saturation, reverb et delay) dans le son du pad, ou non.
      const fx = document.createElement('input');
      fx.type = 'checkbox';
      fx.className = 'send-fx';
      fx.checked = withFx;
      fx.addEventListener('change', () => { withFx = fx.checked; });
      const fl = document.createElement('label');
      fl.className = 'send-fx-row';
      fl.title = t('send.fxTitle');
      fl.append(fx, Object.assign(document.createElement('span'), { textContent: t('send.fx') }));
      menu.appendChild(fl);
      }
    }
    const grid = document.createElement('div');
    grid.className = 'send-grid';
    for (let r = 0; r < LN_ROWS; r++) for (let c = 0; c < LN_COLS; c++) {
      const cell = document.createElement('button');
      cell.className = 'send-cell';
      const item = target === 'pads' ? state.banks[bank]?.[padAt(r, c)] : state.launcher.slots[r][c];
      const label = target === 'pads' ? `${padAt(r, c) + 1}` : `${r + 1}·${c + 1}`;
      cell.dataset.cell = target === 'pads' ? padAt(r, c) : `${r}:${c}`;
      cell.title = item ? t('send.replace', { where: label, name: item.name ?? '' }) : t('send.put', { where: label });
      cell.textContent = item ? (item.name ?? '').slice(0, 7) : label;
      cell.classList.toggle('used', !!item);
      const col = item && colorOf(item.color);
      if (col) cell.style.setProperty('--c', col);
      cell.addEventListener('click', async () => {
        closeSendTo();
        if (sound) await sound.toPad(bank, padAt(r, c));
        else if (target === 'pads') await sendToPad(track, clip, bank, padAt(r, c), { fx: withFx });
        else { setSlot(r, c, clip); toast(t('send.launcherDone', { row: r + 1, col: c + 1 }), 2500); }
      });
      grid.appendChild(cell);
    }
    menu.appendChild(grid);
    const hint = document.createElement('div');
    hint.className = 'hint send-hint';
    hint.textContent = t(target === 'pads' ? 'send.padsHint' : 'send.launcherHint');
    menu.appendChild(hint);
  };
  fill();
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  setTimeout(() => {
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
  });
}

// Un bloc audio qu'un pad peut jouer tel quel : le son entier, sans décalage, gain, fondus, inversion ni transposition
// (ni hauteur gardée à un autre tempo).
function plainSample(clip) {
  if (clip.type || !clip.sampleId) return false;
  if (clip.offset > 0 || clip.reverse || clip.fadeIn || clip.fadeOut || (clip.gain ?? 1) !== 1 || clip.semi) return false;
  if (clip.warp && clip.bpm && Math.abs(clip.bpm - state.bpm) > 0.01) return false;   // « Garder la hauteur » : un pad, lui, suit le tempo par la vitesse
  const natural = timeline.naturalBeats(clip);
  return clip.loop || !(clip.len < natural - 0.05);
}

/** Pose un son (AudioBuffer) sur le pad `i` de la banque `b`, enregistré comme une prise (ses réglages gardés s'il était occupé). */
export function bufferToPad(buffer, name, color, b, i, { loop = false, bpm = 0 } = {}) {
  const sampleId = `rec:${crypto.randomUUID()}`;
  bufferCache.set(sampleId, buffer);
  store.saveSample(sampleId, { name, data: encodeWav([0, 1].map(c => buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1))), buffer.sampleRate) })
    .then(renderLibrary).catch(err => console.warn('Pad', err));
  return placePad({ name, color, sampleId, buffer, bpm, loop }, b, i);
}
function placePad({ name, color, sampleId, buffer, bpm, loop }, b, i) {
  const old = state.banks[b][i];
  engine.stopPad(padKey(b, i));
  const pad = newPad((name ?? '').slice(0, 24), Number.isInteger(color) ? color : old?.color ?? 0, sampleId, buffer, bpm);
  if (old) pad.p = { ...old.p };
  pad.p.mode = (loop ? 2 : 0) / (PAGES.pad.params[7].steps - 1);
  state.banks[b][i] = pad;
  if (b === state.bank) { renderPad(i); renderEditor(); }
  save();
  toast(t('send.padDone', { n: i + 1, bank: b + 1 }), 3000);
  return pad;
}

/**
 * Pose le son du bloc sur le pad `i` de la banque `b` (ses réglages gardés s'il était occupé).
 * opts.fx : avec les effets de la piste (effets, inserts, filtres, saturation, reverb et delay) ; sinon le son du bloc seul.
 */
export async function sendToPad(track, clip, b, i, opts = {}) {
  let sampleId = clip.sampleId, buffer = bufferCache.get(clip.sampleId), bpm = clip.bpm || 0;
  if (opts.fx || !plainSample(clip) || !buffer) {
    // Rendu du bloc seul (avec les effets de sa piste), comme « Rendre en audio ».
    toast(t('send.rendering'), 60000);
    await loadTlBuffers();
    const chans = await renderSong(track, { bounce: true, clips: new Set([clip.id]), ...(opts.fx ? { sends: true } : { dry: true }) });
    buffer = toBuffer(chans, Math.round(clip.start * 60 / state.bpm * engine.ctx.sampleRate));
    if (buffer.length < engine.ctx.sampleRate * 0.01) { toast(t('frz.silent'), 3000); return null; }
    sampleId = `rec:${crypto.randomUUID()}`;
    bufferCache.set(sampleId, buffer);
    bpm = clip.loop ? state.bpm : 0;
    store.saveSample(sampleId, { name: clip.name ?? '', data: encodeWav([0, 1].map(c => buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1))), buffer.sampleRate) })
      .then(renderLibrary).catch(err => console.warn('Pad', err));
  }
  return placePad({ name: clip.name, color: clip.color, sampleId, buffer, bpm, loop: clip.loop }, b, i);
}
