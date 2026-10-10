// Menu contextuel d'un bloc de la timeline (clic droit) : écouter, gain, fondus, inverser, transposer (notes),
// dupliquer, ouvrir dans le piano roll, supprimer. Sur un bloc sélectionné, les réglages s'appliquent à toute la sélection.
import { t } from '../i18n.js';
import { clipEvents } from '../notes.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { state, timeline } from './core.js';
import { sendToLauncher } from './launcher.js';
import { openRoll } from './roll-ui.js';
import { save } from './save.js';
import { tlDelete, renderTl } from './tl.js';
import { tlPreviewClip } from './tl-listen.js';
import { tlPicked, tlSelect } from './tl-select.js';

export const FADES = [0, 0.25, 0.5, 1, 2, 4, 8, 16];   // durées de fondu proposées (en temps)
const dbOf = g => (g > 0 ? 20 * Math.log10(g) : -60);
const fmtDb = db => `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
let menu = null;

export function closeClipMenu() {
  menu?.remove();
  menu = null;
  window.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('keydown', onKey, true);
}
const outside = e => { if (menu && !menu.contains(e.target)) closeClipMenu(); };
const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeClipMenu(); } };

// Blocs visés : la sélection si le bloc en fait partie, sinon le bloc seul. -> [{ track, clip }]
function targets(track, clip) {
  if (!tlPicked.has(clip)) return [{ track, clip }];
  const out = [];
  state.tl.tracks.forEach((tr, i) => { for (const c of tr.clips) if (tlPicked.has(c)) out.push({ track: i, clip: c }); });
  return out;
}

// Bloc qu'on peut couper à `at` (temps de la timeline) : un son ou un bloc de notes, et `at` strictement à l'intérieur.
export const canSplit = (clip, at) => clip.type !== 'pad' && at > clip.start + 1e-6 && at < clip.start + timeline.clipBeats(clip) - 1e-6;

/**
 * Coupe un bloc en deux à `at` : le premier garde le début (et son fondu d'entrée), le second la suite (et le fondu de sortie).
 * Un son continue au bon endroit (décalage `offset`) ; un bloc de notes garde ses notes de chaque côté.
 * @returns {object|null} le nouveau bloc (la seconde moitié)
 */
export function splitClip(track, clip, at) {
  if (!canSplit(clip, at)) return null;
  const cut = +(at - clip.start).toFixed(4);
  const total = timeline.clipBeats(clip);
  const second = JSON.parse(JSON.stringify(clip));
  second.id = crypto.randomUUID();
  second.start = +(clip.start + cut).toFixed(4);
  second.len = +(total - cut).toFixed(4);
  if (clip.type === 'note') {
    // Seconde moitié : les notes qui commencent après la coupe (motif déplié), à partir de 0.
    second.seq = clipEvents(clip).filter(e => e.t >= cut - 1e-6).map(e => ({ t: +(e.t - cut).toFixed(4), len: e.len, note: e.note, vel: e.vel }));
    second.pat = second.len;
    delete second.notes; delete second.note; delete second.vel;
  } else {
    second.offset = +((clip.offset ?? 0) + cut).toFixed(4);
  }
  clip.len = cut;
  delete clip.fadeOut;
  delete second.fadeIn;
  state.tl.tracks[track].clips.push(second);
  return second;
}

// Coupe à la tête de lecture les blocs sélectionnés (sinon tous ceux qu'elle traverse sur les pistes armées).
export function splitAtPlayhead() {
  const at = timeline.playing ? timeline.position() : state.tl.playhead;
  let list = [];
  state.tl.tracks.forEach((tr, i) => { for (const c of tr.clips) if (tlPicked.has(c)) list.push({ track: i, clip: c }); });
  if (!list.length) state.tl.tracks.forEach((tr, i) => { if (tr.arm) for (const c of tr.clips) list.push({ track: i, clip: c }); });
  list = list.filter(l => canSplit(l.clip, at));
  for (const l of list) splitClip(l.track, l.clip, at);
  if (list.length) { renderTl(); save(); }
  return list.length;
}

export function openClipMenu(track, clip, x, y, at = null) {
  closeClipMenu();
  if (!tlPicked.has(clip)) tlSelect(track, clip);
  const list = targets(track, clip);
  const clips = list.map(l => l.clip);
  const audio = clips.every(c => !c.type);
  const notes = clips.every(c => c.type === 'note');
  menu = document.createElement('div');
  menu.className = 'clip-menu';
  menu.setAttribute('role', 'menu');
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = clips.length > 1 ? t('cm.many', { n: clips.length }) : clip.name;
  menu.appendChild(head);
  const changed = (commit = true) => { renderTl(); if (commit) save(); };
  const item = (label, fn, cls = '', icon = '') => {
    const b = document.createElement('button');
    b.className = `cm-item ${cls}`;
    b.textContent = label;
    if (icon) b.dataset.icon = icon;
    b.addEventListener('click', () => { fn(); });
    menu.appendChild(b);
    return b;
  };
  const row = (label, el) => {
    const r = document.createElement('label');
    r.className = 'cm-row';
    const s = document.createElement('span');
    s.textContent = label;
    r.append(s, el);
    menu.appendChild(r);
    return r;
  };

  if (clips.length === 1) item(t('cm.listen'), () => { closeClipMenu(); tlPreviewClip(track, clip); }, '', 'play');

  // Gain (dB) : -24 à +12.
  const gain = document.createElement('input');
  gain.type = 'range'; gain.min = -24; gain.max = 12; gain.step = 0.5;
  gain.value = Math.max(-24, Math.min(12, dbOf(clip.gain ?? 1)));
  const gv = document.createElement('em');
  const showGain = () => { gv.textContent = fmtDb(+gain.value); };
  showGain();
  gain.addEventListener('input', () => { for (const c of clips) c.gain = +Math.pow(10, gain.value / 20).toFixed(4); showGain(); changed(false); });
  gain.addEventListener('change', () => save());
  gain.addEventListener('dblclick', () => { gain.value = 0; for (const c of clips) delete c.gain; showGain(); changed(); });
  const gr = row(t('cm.gain'), gain);
  gr.appendChild(gv);
  gr.classList.add('cm-gain');

  if (audio) {
    // Fondus d'entrée et de sortie (en temps), inverser.
    const fadeSel = key => {
      const sel = document.createElement('select');
      sel.dataset.key = key;
      for (const f of FADES) sel.add(new Option(f ? t('cm.beats', { n: f < 1 ? `1/${1 / f}` : f }) : t('cm.none'), f));
      sel.value = String(FADES.includes(clip[key]) ? clip[key] : 0);
      sel.addEventListener('change', () => { for (const c of clips) { if (+sel.value) c[key] = +sel.value; else delete c[key]; } changed(); });
      return sel;
    };
    row(t('cm.fadeIn'), fadeSel('fadeIn'));
    row(t('cm.fadeOut'), fadeSel('fadeOut'));
    const rev = document.createElement('input');
    rev.type = 'checkbox';
    rev.checked = !!clip.reverse;
    rev.addEventListener('change', () => { for (const c of clips) { if (rev.checked) c.reverse = true; else delete c.reverse; } changed(); });
    row(t('cm.reverse'), rev).classList.add('cm-check');
  }
  if (notes) {
    // Transposer les notes (demi-ton, octave).
    const tr = document.createElement('div');
    tr.className = 'cm-transpose';
    for (const [d, label] of [[-12, '−12'], [-1, '−1'], [1, '+1'], [12, '+12']]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = t('cm.transposeTitle', { n: d });
      b.addEventListener('click', () => { for (const c of clips) transposeClip(c, d); changed(); });
      tr.appendChild(b);
    }
    row(t('cm.transpose'), tr);
  }

  const sep = () => { const h = document.createElement('hr'); menu.appendChild(h); };
  sep();
  // Couper : à l'endroit du clic, ou à la tête de lecture.
  const playAt = timeline.playing ? timeline.position() : state.tl.playhead;
  if (at !== null && list.some(l => canSplit(l.clip, at))) {
    item(t('cm.splitHere'), () => { closeClipMenu(); for (const l of list) splitClip(l.track, l.clip, at); renderTl(); save(); });
  }
  if (list.some(l => canSplit(l.clip, playAt))) {
    item(t('cm.splitHead'), () => { closeClipMenu(); for (const l of list) splitClip(l.track, l.clip, playAt); renderTl(); save(); });
  }
  item(t('cm.duplicate'), () => { closeClipMenu(); duplicateClips(list); }, '', 'plus');
  if (clips.length === 1 && clip.type !== 'pad') item(t('cm.launcher'), () => { closeClipMenu(); sendToLauncher(track, clip); }, '', 'grid');
  if (notes && clips.length === 1) item(t('cm.roll'), () => { closeClipMenu(); openRoll(clip, true); }, '', 'roll');
  item(t('cm.delete'), () => { closeClipMenu(); for (const l of list) tlDelete(l.track, l.clip); }, 'cm-danger', 'trash');

  document.body.appendChild(menu);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y))}px`;
  setTimeout(() => { window.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', onKey, true); }, 0);
}

// Transpose un bloc de notes (format du piano roll ou ancien format), sans sortir du clavier.
export function transposeClip(clip, d) {
  const move = n => Math.max(0, Math.min(127, n + d));
  if (clip.seq) for (const n of clip.seq) n.note = move(n.note);
  if (Array.isArray(clip.notes)) clip.notes = clip.notes.map(move);
  if (Number.isFinite(clip.note)) clip.note = move(clip.note);
}

// Copie des blocs juste après eux (à la mesure suivante libre dans leur piste).
export function duplicateClips(list) {
  const added = [];
  for (const { track, clip } of list) {
    const len = timeline.clipBeats(clip);
    const start = Math.ceil((clip.start + len) / BEATS_PER_BAR) * BEATS_PER_BAR;
    const copy = JSON.parse(JSON.stringify(clip));
    copy.id = crypto.randomUUID();
    copy.start = start;
    state.tl.tracks[track].clips.push(copy);
    added.push(copy);
    if (start + len > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil((start + len) / BEATS_PER_BAR));
  }
  renderTl();
  save();
  return added;
}
