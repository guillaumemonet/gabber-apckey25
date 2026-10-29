// Menu « Charger dans… » d'un son de la bibliothèque (clic droit) : un pad de n'importe quelle banque, une platine, le
// lanceur, la timeline, le découpeur ou l'instrument échantillon (le son joué en notes dans le piano roll).
import { PALETTE } from '../apc.js';
import { DECK_IDS } from '../decks.js';
import { t } from '../i18n.js';
import { catColor, noteClass } from '../library.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { guessRoot } from '../sampler.js';
import { loadItemIntoPad } from './actions.js';
import { state, timeline, uiColor } from './core.js';
import { bankName } from './banks-ui.js';
import { loadDeck } from './decks-ui.js';
import { removeUserSound } from './kick-ui.js';
import { LN_COLS, slotFromLibrary } from './launcher.js';
import { previewSample } from './library-ui.js';
import { freeTracks } from './midi-files.js';
import { toast } from './misc.js';
import { openRoll } from './roll-ui.js';
import { save } from './save.js';
import { openSlicer } from './slicer-ui.js';
import { armedTrack, ensureBuffer, growSong, renderTl, tlPlaceItem, trackName } from './tl.js';
import { tlSelect } from './tl-select.js';

let menu = null;
function closeMenu() { menu?.remove(); menu = null; window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', onKey, true); }
const outside = e => { if (menu && !menu.contains(e.target)) closeMenu(); };
const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } };

// Mesure de la tête de lecture (là où la timeline et l'instrument posent leur bloc).
const playheadBar = () => Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;

// Timeline : sur la piste armée à la mesure de la tête de lecture, ou sur la prochaine piste libre à cet endroit.
async function toTimeline(item) {
  const start = playheadBar();
  const buf = await ensureBuffer(item.sampleId);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  const beats = item.loop && item.bars ? item.bars * BEATS_PER_BAR : Math.max(1, Math.ceil((item.bpm ? buf.duration * item.bpm / 60 : buf.duration / timeline.beatDur) - 0.05));
  const [track] = freeTracks(start, start + beats, 1);
  if (track === undefined) { toast(t('lib.menu.noTrack'), 3000); return; }
  await tlPlaceItem(item, track, start);
  toast(t('lib.menu.placed', { name: item.name, track: trackName(track), bar: start / BEATS_PER_BAR + 1 }), 2500);
}

// Lanceur : première case libre de la colonne de la piste armée.
async function toLauncher(item) {
  const c = armedTrack();
  if (c >= LN_COLS) { toast(t('ln.tooFar', { n: LN_COLS }), 3000); return; }
  const row = state.launcher.slots.findIndex(r => !r[c]);
  if (row < 0) { toast(t('ln.full', { track: trackName(c) }), 3000); return; }
  await slotFromLibrary(row, c, item);
  toast(t('ln.sent', { track: trackName(c), row: row + 1 }), 2500);
}

// Instrument échantillon : le son va sur le premier pad libre de la banque affichée (accordé sur sa note quand le
// catalogue la donne), et un bloc de notes qui le joue est posé à la tête de lecture puis ouvert dans le piano roll.
async function toInstrument(item) {
  const b = state.bank;
  const i = state.banks[b].findIndex(p => !p);
  if (i < 0) { toast(t('lib.menu.bankFull', { n: b + 1 }), 3500); return; }
  const buf = await ensureBuffer(item.sampleId);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  await loadItemIntoPad({ ...item, loop: false }, i, b, false);
  const pad = state.banks[b][i];
  const root = guessRoot(buf, noteClass(item.note));
  pad.smp = { root, loop: null };
  const start = playheadBar();
  const [track] = freeTracks(start, start + BEATS_PER_BAR, 1);
  if (track === undefined) { toast(t('lib.menu.noTrack'), 3000); save(); return; }
  const clip = { id: crypto.randomUUID(), type: 'note', seq: [{ t: 0, len: 1, note: Math.round(root), vel: 0.85, s: 0 }], pat: BEATS_PER_BAR, len: BEATS_PER_BAR,
    start, name: item.name.slice(0, 32), cat: item.cat, color: catColor(item.cat), loop: false, smps: [{ bank: b, pad: i }] };
  state.tl.tracks[track].clips.push(clip);
  growSong(clip);
  tlSelect(track, clip);
  renderTl();
  openRoll(clip, true);
  save();
  toast(t('lib.menu.instrument', { n: i + 1, bank: b + 1, track: trackName(track) }), 4000);
}

// Grille de pads d'une banque (même disposition que la fenêtre des pads : le pad 1 en bas à gauche).
function padPicker(item, box) {
  box.innerHTML = '';
  const sel = document.createElement('select');
  state.banks.forEach((_, b) => sel.add(new Option(`${b + 1} · ${bankName(b) || t('bm.bank', { n: b + 1 })}`, b)));
  sel.value = state.bank;
  const grid = document.createElement('div');
  grid.className = 'lm-pads';
  const draw = () => {
    grid.innerHTML = '';
    const b = +sel.value;
    for (let row = 4; row >= 0; row--) for (let col = 0; col < 8; col++) {
      const i = row * 8 + col, pad = state.banks[b][i];
      const btn = document.createElement('button');
      btn.textContent = i + 1;
      btn.title = pad ? t('lib.menu.replace', { n: i + 1, name: pad.name }) : t('bm.pad', { n: i + 1 });
      if (pad) btn.style.setProperty('--c', PALETTE[uiColor(pad.color)]);
      btn.classList.toggle('used', !!pad);
      btn.addEventListener('click', () => { closeMenu(); loadItemIntoPad(item, i, b); });
      grid.appendChild(btn);
    }
  };
  sel.addEventListener('change', draw);
  sel.addEventListener('keydown', e => e.stopPropagation());
  const row = document.createElement('label');
  row.className = 'cm-row';
  row.append(Object.assign(document.createElement('span'), { textContent: t('lib.menu.bank') }), sel);
  box.append(row, grid);
  draw();
}

export function openLibMenu(item, x, y) {
  closeMenu();
  menu = document.createElement('div');
  menu.className = 'clip-menu lib-menu';
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = item.name;
  head.title = item.type ? `${item.family} › ${item.type}` : '';
  menu.appendChild(head);
  const add = (label, icon, fn, keep = false) => {
    const btn = document.createElement('button');
    btn.className = 'cm-item';
    btn.textContent = label;
    btn.dataset.icon = icon;
    btn.addEventListener('click', () => { if (!keep) closeMenu(); fn(btn); });
    menu.appendChild(btn);
    return btn;
  };
  const sep = label => { const h = document.createElement('div'); h.className = 'lm-sep'; h.textContent = label; menu.appendChild(h); };
  add(t('bm.listen'), 'play', () => previewSample(item));
  sep(t('lib.menu.loadInto'));
  const box = document.createElement('div');
  box.className = 'lm-box';
  box.hidden = true;
  add(t('lib.menu.pad'), 'pads', () => { box.hidden = !box.hidden; if (!box.hidden) padPicker(item, box); place(); }, true);
  menu.appendChild(box);
  for (const d of DECK_IDS) add(t('lib.menu.deck', { deck: d }), 'decks', () => loadDeck(d, item));
  add(t('lib.menu.launcher', { track: trackName(armedTrack()) }), 'scenes', () => toLauncher(item));
  add(t('lib.menu.timeline'), 'tr', () => toTimeline(item));
  add(t('lib.menu.slicer'), 'slice', () => openSlicer({ sampleId: item.sampleId, name: item.name, bpm: item.loop ? item.bpm : 0 }));
  add(t('lib.menu.instrumentItem'), 'keys', () => toInstrument(item));
  if (item.own) { menu.appendChild(document.createElement('hr')); add(t('lib.menu.remove'), 'trash', () => removeUserSound(item)); }
  document.body.appendChild(menu);
  const place = () => {
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  };
  place();
  setTimeout(() => { window.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', onKey, true); });
}
