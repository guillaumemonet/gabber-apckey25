// Fenêtre de la bibliothèque de sons.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { MY_SOUNDS, catColor, familyColor, libraryItems, libraryTree } from '../library.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { FX_FAMILY_COLORS } from '../trackfx.js';
import { loadItemIntoPad } from './actions.js';
import { $, engine, kit, state, uiColor } from './core.js';
import { deleteCurve, openCurve } from './curve-ui.js';
import { loadDeck } from './decks-ui.js';
import { removeUserSound } from './kick-ui.js';
import { padEls } from './pads.js';
import { slotFromLibrary } from './launcher.js';
import { beatPx, ensureBuffer, tlPlaceItem, tlTarget } from './tl.js';
import { FX_FAMILIES, fxColor, fxItems, tlPlaceFx } from './trackfx-ui.js';
import { openSlicer } from './slicer-ui.js';

// ---------- Bibliothèque de sons ----------

export let libManifest = null;
export let libCat = 'Drums';          // famille choisie (sons) ou famille d'effets (effets de piste)
export let libTab = 'sounds';          // onglet de la bibliothèque : sons ou effets de piste
export const libCats = { sounds: 'Drums', fx: 'volume' };
export let libType = '';               // type choisi dans la famille ('' : tous)
export let libKind = 'all';            // all, hit (coups) ou loop (boucles)
export let libQuery = '';
export let libSelected = null;     // dernier son choisi : un clic dans une case vide le pose
export let libPreview = null;      // { src, sampleId }

export function previewSample(item) {
  const same = libPreview?.sampleId === item.sampleId;
  if (libPreview) { try { libPreview.src.stop(); } catch { /* déjà fini */ } libPreview = null; renderLibraryPlaying(); }
  if (same) return;
  ensureBuffer(item.sampleId).then(buf => {
    if (!buf) return;
    const src = engine.ctx.createBufferSource();
    src.buffer = buf;
    if (item.bpm) src.playbackRate.value = state.bpm / item.bpm;
    src.connect(engine.master);
    src.start();
    libPreview = { src, sampleId: item.sampleId };
    src.onended = () => { if (libPreview?.src === src) { libPreview = null; renderLibraryPlaying(); } };
    renderLibraryPlaying();
  });
}

export function buildLibrary() {
  for (const b of $('#lib-tabs').children) b.addEventListener('click', () => setLibTab(b.dataset.tab));
  $('#lib-search').addEventListener('input', e => { libQuery = e.target.value.trim().toLowerCase(); renderLibrary(); });
  for (const b of $('#lib-kind').children) b.addEventListener('click', () => { libKind = b.dataset.kind; renderLibrary(); });
  renderLibrary();
}

export function setLibTab(tab) {
  libTab = tab;
  libCat = libCats[tab];
  libType = '';
  renderLibrary();
}
// Montre un onglet et une famille (après un ajout fait ailleurs : courbe, kick).
export function showLibrary(tab, cat, query = libQuery) {
  libTab = tab;
  libCat = libCats[tab] = cat;
  libType = '';
  libQuery = query;
  renderLibrary();
}

// Bouton d'une famille, d'un type ou d'un filtre : pastille de couleur, nom, nombre de sons.
function chip(cls, label, color, count, active, onClick) {
  const btn = document.createElement('button');
  btn.className = cls + (active ? ' active' : '');
  btn.style.setProperty('--c', color);
  btn.innerHTML = `<i></i>${label}<small>${count}</small>`;
  btn.addEventListener('click', onClick);
  return btn;
}
// Un son correspond à la recherche par son nom, son type, sa famille, sa note ou ses étiquettes.
const matches = (item, q) => [item.name, item.type, item.family, item.note, ...(item.tags ?? [])].some(v => v?.toLowerCase().includes(q));

export function renderLibrary() {
  const list = $('#lib-list');
  if (!list || !kit) return;
  // Deux onglets : les sons (par catégorie) et les effets de piste (par famille).
  const items = libTab === 'fx' ? fxItems() : libraryItems({ manifest: libManifest, kit, banks: state.banks, tl: state.tl, userSounds: state.userSounds });
  for (const b of $('#lib-tabs').children) b.classList.toggle('active', b.dataset.tab === libTab);
  const sounds = libTab === 'sounds';
  const tree = sounds ? libraryTree(libManifest, items) : null;
  const cats = sounds ? tree.map(n => ({ id: n.family, color: familyColor(n.family), label: n.family }))
    : FX_FAMILIES.map(id => ({ id, color: FX_FAMILY_COLORS[id], label: t(`tfx.family.${id}`) }));
  const kindOk = i => !sounds || libKind === 'all' || (libKind === 'loop') === !!i.loop;
  const inCat = i => (sounds ? i.family : i.cat) === libCat;
  const pick = () => { libQuery = ''; $('#lib-search').value = ''; renderLibrary(); };
  // Familles (sons) ou familles d'effets.
  $('#lib-cats').innerHTML = '';
  for (const c of cats) {
    const n = items.filter(i => (sounds ? i.family : i.cat) === c.id && kindOk(i)).length;
    if (!n && (c.id === MY_SOUNDS || c.id === 'Recordings')) continue;
    $('#lib-cats').appendChild(chip('lib-cat', c.label, PALETTE[uiColor(c.color)], n, c.id === libCat && !libQuery, () => { libCat = libCats[libTab] = c.id; libType = ''; pick(); }));
  }
  // Types de la famille choisie, et le filtre coups / boucles.
  const types = $('#lib-types');
  types.innerHTML = '';
  types.hidden = !sounds || !!libQuery;
  $('#lib-kind').hidden = !sounds;
  for (const b of $('#lib-kind').children) b.classList.toggle('active', b.dataset.kind === libKind);
  if (sounds && !libQuery) {
    const node = tree.find(n => n.family === libCat);
    const color = PALETTE[uiColor(familyColor(libCat))];
    const inFamily = items.filter(i => inCat(i) && kindOk(i));
    if (libType && !inFamily.some(i => i.type === libType)) libType = '';
    types.appendChild(chip('lib-type', t('lib.all'), color, inFamily.length, !libType, () => { libType = ''; renderLibrary(); }));
    for (const type of node?.types ?? []) {
      const n = inFamily.filter(i => i.type === type).length;
      if (n) types.appendChild(chip('lib-type', type, color, n, type === libType, () => { libType = type; renderLibrary(); }));
    }
  }
  const shown = (libQuery ? items.filter(i => matches(i, libQuery)) : items.filter(i => inCat(i) && (!sounds || !libType || i.type === libType))).filter(kindOk);
  list.innerHTML = '';
  for (const item of shown) {
    const row = document.createElement('div');
    row.className = 'lib-item' + (libSelected?.sampleId === item.sampleId ? ' selected' : '');
    row.dataset.id = item.sampleId;
    row.style.setProperty('--c', item.kind === 'fx' ? fxColor(item) : PALETTE[uiColor(catColor(item.cat))]);
    const small = item.kind === 'fx' ? t(`tfx.family.${item.family}`) : [item.note, item.loop ? t('lib.bars', { n: item.bars || '↻' }) : t('lib.oneshot')].filter(Boolean).join(' · ');
    row.innerHTML = `<i></i><span>${item.name}</span><small>${small}</small>`;
    if (item.kind === 'fx') row.title = t(item.curveId ? 'curve.libTitle' : 'tfx.libTitle');
    else row.title = [`${item.family} › ${item.type}`, item.bpm ? `${item.bpm} BPM` : '', (item.tags ?? []).join(', ')].filter(Boolean).join(' · ');
    if (item.curveId) {
      row.addEventListener('dblclick', () => openCurve(item.curveId));
      if (item.ownCurve) row.addEventListener('contextmenu', e => { e.preventDefault(); deleteCurve(item.curveId); });
    }
    row.addEventListener('pointerdown', e => startLibDrag(e, item));
    if (item.own) { row.title = t('lib.ownTitle'); row.addEventListener('contextmenu', e => { e.preventDefault(); removeUserSound(item); }); }
    list.appendChild(row);
  }
  if (!shown.length) list.innerHTML = `<p class="hint">${t('lib.empty')}</p>`;
  renderLibraryPlaying();
}

export function renderLibraryPlaying() {
  for (const row of $('#lib-list').querySelectorAll('.lib-item')) row.classList.toggle('playing', row.dataset.id === libPreview?.sampleId);
}

// Glisser un son de la bibliothèque vers la timeline ; un simple clic le pré-écoute et le choisit.
export function startLibDrag(e, item) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX;
  const sy = e.clientY;
  let ghost = null;
  let target = null;
  const drop = document.createElement('div');
  drop.className = 'tl-drop';
  const onMove = ev => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'lib-ghost';
      ghost.textContent = item.name;
      ghost.style.setProperty('--c', PALETTE[uiColor(catColor(item.cat))]);
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${ev.clientX + 12}px`;
    ghost.style.top = `${ev.clientY + 8}px`;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const deckEl = item.kind !== 'fx' ? under?.closest('.deck') : null;
    const padEl = item.kind !== 'fx' ? under?.closest('#pads .pad') : null;
    const slotEl = item.kind !== 'fx' ? under?.closest('.ln-slot') : null;
    const slicerEl = item.kind !== 'fx' ? under?.closest('#sl-wave-wrap') : null;
    for (const d of document.querySelectorAll('.deck.dragover, #pads .pad.dragover, .ln-slot.dragover, #sl-wave-wrap.dragover')) if (d !== deckEl && d !== padEl && d !== slotEl && d !== slicerEl) d.classList.remove('dragover');
    (deckEl ?? padEl ?? slotEl ?? slicerEl)?.classList.add('dragover');
    target = deckEl ? { deck: deckEl.dataset.deck } : padEl ? { pad: padEls.indexOf(padEl) } : slotEl ? { slot: [+slotEl.dataset.row, +slotEl.dataset.col] } : slicerEl ? { slicer: true } : tlTarget(ev);
    if (target && !target.deck && target.pad === undefined && !target.slot && !target.slicer) {
      const bars = item.kind === 'fx' ? item.len / BEATS_PER_BAR : item.loop && item.bars ? item.bars : 1;
      Object.assign(drop.style, { left: `${target.beat * beatPx()}px`, width: `${bars * state.tl.zoom}px` });
      target.lane.appendChild(drop);
    } else drop.remove();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    drop.remove();
    ghost?.remove();
    libSelected = item;
    if (!ghost) { if (item.kind !== 'fx') previewSample(item); renderLibrary(); return; }
    for (const d of document.querySelectorAll('.deck.dragover, #pads .pad.dragover, .ln-slot.dragover, #sl-wave-wrap.dragover')) d.classList.remove('dragover');
    if (target?.slicer) openSlicer({ sampleId: item.sampleId, name: item.name, bpm: item.loop ? item.bpm : 0 });
    else if (target?.slot) slotFromLibrary(...target.slot, item);
    else if (target?.deck) loadDeck(target.deck, item);
    else if (target?.pad >= 0) loadItemIntoPad(item, target.pad);
    else if (target) (item.kind === 'fx' ? tlPlaceFx : tlPlaceItem)(item, target.track, target.beat);
    renderLibrary();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// Variables modifiées depuis d'autres modules.
export function setLibManifest(v) { return (libManifest = v); }
