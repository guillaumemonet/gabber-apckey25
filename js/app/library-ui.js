// Fenêtre de la bibliothèque de sons.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { LIB_CATS, catColor, libraryItems } from '../library.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { FX_FAMILY_COLORS } from '../trackfx.js';
import { loadItemIntoPad } from './actions.js';
import { $, engine, kit, state, uiColor } from './core.js';
import { deleteCurve, openCurve } from './curve-ui.js';
import { loadDeck } from './decks-ui.js';
import { removeUserSound } from './kick-ui.js';
import { padEls } from './pads.js';
import { slotFromLibrary } from './launcher.js';
import { save } from './save.js';
import { beatPx, ensureBuffer, tlPlaceItem, tlTarget } from './tl.js';
import { FX_FAMILIES, fxColor, fxItems, tlPlaceFx } from './trackfx-ui.js';

// ---------- Bibliothèque de sons ----------

export let libManifest = null;
export let libCat = 'kick';
export let libTab = 'sounds';          // onglet de la bibliothèque : sons ou effets de piste
export const libCats = { sounds: 'kick', fx: 'volume' };
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
  $('#lib-archives').addEventListener('change', e => { state.libArchives = e.target.checked; renderLibrary(); save(); });
  renderLibrary();
}

export function setLibTab(tab) {
  libTab = tab;
  libCat = libCats[tab];
  renderLibrary();
}
// Montre un onglet et une catégorie (après un ajout fait ailleurs : courbe, kick).
export function showLibrary(tab, cat, query = libQuery) {
  libTab = tab;
  libCat = libCats[tab] = cat;
  libQuery = query;
  renderLibrary();
}

export function renderLibrary() {
  const list = $('#lib-list');
  if (!list || !kit) return;
  // Deux onglets : les sons (par catégorie) et les effets de piste (par famille).
  const items = libTab === 'fx' ? fxItems() : libraryItems({ manifest: libManifest, kit, banks: state.banks, tl: state.tl, userSounds: state.userSounds, archives: state.libArchives });
  $('#lib-archives').checked = state.libArchives;
  for (const b of $('#lib-tabs').children) b.classList.toggle('active', b.dataset.tab === libTab);
  const cats = libTab === 'fx' ? FX_FAMILIES.map(id => ({ id, color: FX_FAMILY_COLORS[id], label: t(`tfx.family.${id}`) })) : LIB_CATS.map(c => ({ ...c, label: t(`lib.cat.${c.id}`) }));
  const counts = Object.fromEntries(cats.map(c => [c.id, items.filter(i => i.cat === c.id).length]));
  $('#lib-cats').innerHTML = '';
  for (const c of cats) {
    if (!counts[c.id] && (c.id === 'mine' || c.id === 'rec')) continue;
    const btn = document.createElement('button');
    btn.className = 'lib-cat' + (c.id === libCat && !libQuery ? ' active' : '');
    btn.style.setProperty('--c', PALETTE[uiColor(c.color)]);
    btn.innerHTML = `<i></i>${c.label}<small>${counts[c.id]}</small>`;
    btn.addEventListener('click', () => { libCat = libCats[libTab] = c.id; libQuery = ''; $('#lib-search').value = ''; renderLibrary(); });
    $('#lib-cats').appendChild(btn);
  }
  const shown = libQuery ? items.filter(i => i.name.toLowerCase().includes(libQuery)) : items.filter(i => i.cat === libCat);
  list.innerHTML = '';
  for (const item of shown) {
    const row = document.createElement('div');
    row.className = 'lib-item' + (libSelected?.sampleId === item.sampleId ? ' selected' : '');
    row.dataset.id = item.sampleId;
    row.style.setProperty('--c', item.kind === 'fx' ? fxColor(item) : PALETTE[uiColor(catColor(item.cat))]);
    const small = item.kind === 'fx' ? t(`tfx.family.${item.family}`) : item.loop ? t('lib.bars', { n: item.bars || '↻' }) : t('lib.oneshot');
    row.innerHTML = `<i></i><span>${item.name}</span><small>${small}</small>`;
    if (item.kind === 'fx') row.title = t(item.curveId ? 'curve.libTitle' : 'tfx.libTitle');
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
    for (const d of document.querySelectorAll('.deck.dragover, #pads .pad.dragover, .ln-slot.dragover')) if (d !== deckEl && d !== padEl && d !== slotEl) d.classList.remove('dragover');
    (deckEl ?? padEl ?? slotEl)?.classList.add('dragover');
    target = deckEl ? { deck: deckEl.dataset.deck } : padEl ? { pad: padEls.indexOf(padEl) } : slotEl ? { slot: [+slotEl.dataset.row, +slotEl.dataset.col] } : tlTarget(ev);
    if (target && !target.deck && target.pad === undefined && !target.slot) {
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
    for (const d of document.querySelectorAll('.deck.dragover, #pads .pad.dragover, .ln-slot.dragover')) d.classList.remove('dragover');
    if (target?.slot) slotFromLibrary(...target.slot, item);
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
