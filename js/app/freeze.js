// Geler une piste / la rendre en audio. Le navigateur a peu de calcul : une piste lourde (synthés, effets, inserts)
// peut être rendue hors temps réel une fois, puis jouée comme un simple son.
// - Geler : le son rendu (blocs, effets de piste, inserts, filtres, saturation, puis la table de mixage) remplace les blocs
//   à la lecture ; volume, pano, envois, muet / solo et bus de la piste restent en direct (le mixage reste réglable).
//   Les blocs restent visibles mais verrouillés. Le son rendu n'est pas enregistré : seul l'état « gelée » l'est, et le
//   son est refait au chargement (en attendant, la piste joue en direct). Il est refait aussi quand ce qu'il contient
//   change (tempo, blocs, effets…) ; « Regeler » le refait à la demande (instrument, table de mixage, sidechain changés).
// - Rendre en audio : le même rendu (avec une table de mixage neutre) devient un bloc audio sur une piste libre, qui
//   reprend le volume, le pano, les envois et le bus ; la piste d'origine est rendue muette (ou les blocs rendus retirés).
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BEATS_PER_BAR, MAX_TRACKS, newTrack } from '../timeline.js';
import { engine, state, timeline } from './core.js';
import { BAKED_AUTO, LIVE_KNOBS, renderSong, trackEndBeats } from './export.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { growSong, loadTlBuffers, renderTl, tlRec, trackName, trackTouched } from './tl.js';
import { tlPicked, tlSelect } from './tl-select.js';
import { closeFxEditor } from './trackfx-ui.js';

export const frozenCache = new Map();   // empreinte de la piste -> AudioBuffer (son rendu, depuis le temps 0)
const freezePending = new Map();        // empreinte -> rendu en cours (promesse)
const freezeFailed = new Set();         // empreintes sans son (piste vide, erreur) : pas redemandées en boucle
let freezeChain = Promise.resolve();    // un rendu à la fois
export let bouncing = false;

// Empreinte de ce que le son gelé contient : s'il change, le son est refait (en attendant, la piste joue en direct).
export const freezeKey = tr => JSON.stringify([state.bpm, tr.clips, tr.fx, tr.inserts, tr.lp, tr.hp, tr.drive, BAKED_AUTO.map(id => tr.auto?.[id] ?? null)]);

// Pour la timeline : le son gelé de la piste `ti` s'il est prêt ({ buf }), sinon null (jouée en direct, rendu demandé).
export function frozenFor(ti) {
  const tr = state.tl.tracks[ti];
  if (!tr?.frozen) return null;
  const buf = frozenCache.get(freezeKey(tr));
  if (buf) return { buf };
  requestFreeze(tr);
  return null;
}
// État affiché dans l'en-tête : 'ready', 'pending' (rendu en cours) ou null (piste non gelée).
export function freezeState(ti) {
  const tr = state.tl.tracks[ti];
  if (!tr?.frozen) return null;
  if (frozenCache.has(freezeKey(tr))) return 'ready';
  requestFreeze(tr);
  return 'pending';
}

// Rendu du son gelé d'une piste (dans la file : un à la fois). -> promesse de l'AudioBuffer (null si la piste a changé).
export function requestFreeze(tr) {
  const key = freezeKey(tr);
  if (frozenCache.has(key)) return Promise.resolve(frozenCache.get(key));
  if (freezePending.has(key)) return freezePending.get(key);
  if (freezeFailed.has(key)) return Promise.resolve(null);
  const p = freezeChain = freezeChain.then(() => renderFrozen(tr, key)).catch(err => { console.warn('Freeze', err); freezeFailed.add(key); return null; });
  freezePending.set(key, p);
  p.then(() => { freezePending.delete(key); renderTl(); });
  return p;
}

async function renderFrozen(tr, key) {
  const ti = state.tl.tracks.indexOf(tr);
  if (ti < 0 || !tr.frozen || freezeKey(tr) !== key) return null;   // piste retirée, dégelée ou changée entre-temps
  if (!trackEndBeats(tr)) { freezeFailed.add(key); return null; }
  await loadTlBuffers();   // sons et pads de la piste décodés avant le rendu
  const chans = await renderSong(ti, { freeze: true });
  const buf = toBuffer(chans, 0);
  frozenCache.set(key, buf);
  // Sons gelés qui ne servent plus (piste dégelée, modifiée) : la mémoire est libérée.
  const keep = new Set(state.tl.tracks.filter(x => x.frozen).map(freezeKey));
  for (const k of frozenCache.keys()) if (!keep.has(k) && k !== key) frozenCache.delete(k);
  return buf;
}

// Canaux rendus -> AudioBuffer, à partir de l'échantillon `from`, sans le silence de la fin.
export function toBuffer(chans, from) {
  let end = chans[0].length;
  while (end > from && Math.abs(chans[0][end - 1]) < 1e-5 && Math.abs(chans[1][end - 1]) < 1e-5) end--;
  const n = Math.max(1, end - from);
  const buf = engine.ctx.createBuffer(2, n, engine.ctx.sampleRate);
  chans.forEach((c, i) => buf.copyToChannel(c.subarray(from, from + n), i));
  return buf;
}

// La lecture en cours reprend au même endroit (une piste gelée / dégelée change ce qui est programmé).
function replay() {
  if (!timeline.playing || tlRec) return;
  const pos = timeline.position();
  timeline.play(state.tl.loop ? pos % timeline.length : pos);
}

/** Geler la piste `i` : son rendu hors temps réel, joué à la place de ses blocs. */
export async function freezeTrack(i) {
  const tr = state.tl.tracks[i];
  if (!tr || tr.frozen || tlRec) return;
  if (!trackEndBeats(tr)) { toast(t('frz.empty'), 3000); return; }
  closeFxEditor();
  freezeFailed.clear();   // geler à la main : un rendu raté peut être retenté
  tr.frozen = true;
  for (const c of tr.clips) tlPicked.delete(c);
  renderTl();
  save();
  toast(t('frz.rendering', { track: trackName(i) }), 60000);
  const buf = await requestFreeze(tr);
  if (!buf || !tr.frozen) return;
  toast(t('frz.done', { track: trackName(i) }), 3000);
  replay();
}

export function unfreezeTrack(i) {
  const tr = state.tl.tracks[i];
  if (!tr?.frozen) return;
  closeFxEditor();
  tr.frozen = false;
  renderTl();
  save();
  toast(t('frz.unfrozen', { track: trackName(i) }), 2500);
  replay();
}

// Regeler : le son est refait (un instrument, la table de mixage ou le sidechain ont changé).
export async function refreezeTrack(i) {
  const tr = state.tl.tracks[i];
  if (!tr?.frozen) return;
  frozenCache.delete(freezeKey(tr));
  freezeFailed.clear();
  renderTl();
  toast(t('frz.rendering', { track: trackName(i) }), 60000);
  if (await requestFreeze(tr)) { toast(t('frz.done', { track: trackName(i) }), 3000); replay(); }
}

// Piste libre pour le rendu audio : la première vide et sans réglages après `i`, sinon une nouvelle. -> indice ou -1
export function bounceTarget(i) {
  const tracks = state.tl.tracks;
  const free = k => { const tr = tracks[k]; return !tr.clips.length && !tr.fx.length && !tr.frozen && !trackTouched(tr) && !Object.keys(tr.auto ?? {}).length && tr.bus === null && !tr.mute && !tr.solo; };
  for (let k = i + 1; k < tracks.length; k++) if (free(k)) return k;
  if (tracks.length < MAX_TRACKS) { tracks.push(newTrack()); return tracks.length - 1; }
  for (let k = 0; k < i; k++) if (free(k)) return k;
  return -1;
}

/**
 * Rendre en audio la piste `i` (ou ses seuls blocs `ids`) : un bloc audio sur une piste libre, qui reprend le volume,
 * le pano, les envois, le bus et leur automation. La piste d'origine devient muette ; les blocs rendus d'une sélection
 * sont retirés. « Annuler » revient en arrière. -> { track, clip } ou null
 */
export async function bounceTrack(i, ids = null) {
  const tr = state.tl.tracks[i];
  if (!tr || bouncing || tlRec) return null;
  const end = trackEndBeats(tr, ids);
  if (!end) { toast(t('frz.empty'), 3000); return null; }
  closeFxEditor();
  bouncing = true;
  try {
    toast(t('frz.bouncing', { track: trackName(i) }), 60000);
    await loadTlBuffers();
    const len = state.tl.bars * BEATS_PER_BAR;
    const start = Math.min(...tr.clips.filter(c => c.start < len && (!ids || ids.has(c.id))).map(c => c.start));
    const kicks = [];
    const chans = await renderSong(i, { bounce: true, clips: ids, kicks });
    const sr = engine.ctx.sampleRate, bpm = state.bpm;
    const buf = toBuffer(chans, Math.round(start * 60 / bpm * sr));
    if (buf.length < sr * 0.01) { toast(t('frz.silent'), 3000); return null; }
    const j = bounceTarget(i);
    if (j < 0) { toast(t('frz.noTrack'), 3500); return null; }
    const id = `rec:${crypto.randomUUID()}`;
    const name = t('frz.bounceName', { name: trackName(i) }).slice(0, 24);
    bufferCache.set(id, buf);
    const clip = { id: crypto.randomUUID(), start, len: Math.max(1, Math.ceil(buf.duration * bpm / 60 - 1e-3)), sampleId: id, name, cat: 'rec', color: catColor('rec'), bpm, loop: false };
    // Kicks de la piste : le bloc audio pompe le sidechain comme elle (et n'est pas baissé une seconde fois).
    const kb = kicks.map(b => +(b - start).toFixed(3)).filter(b => b >= 0 && b < clip.len);
    if (kb.length) clip.kickBeats = kb;
    const dst = state.tl.tracks[j];
    for (const k of LIVE_KNOBS) dst[k] = tr[k];
    Object.assign(dst, { name, color: tr.color, bus: tr.bus, auto: Object.fromEntries(Object.entries(tr.auto ?? {}).filter(([k]) => !BAKED_AUTO.includes(k))) });
    dst.clips.push(clip);
    if (ids) tr.clips = tr.clips.filter(c => !ids.has(c.id)); else tr.mute = true;
    growSong(clip);
    tlSelect(j, clip);
    for (const k of [i, j]) { timeline.updateTrack(k); timeline.routeTrack(k); }
    timeline.updateMutes();
    renderTl();
    save();
    toast(t('frz.bounced', { track: trackName(j) }), 3500);
    // Enregistré comme une prise (« rec: ») : sauvegardé avec le projet, effacé au démarrage s'il ne sert plus.
    store.saveSample(id, { name, data: encodeWav([0, 1].map(c => buf.getChannelData(c)), sr) }).then(renderLibrary).catch(err => console.warn('Bounce', err));
    renderLibrary();
    replay();
    return { track: j, clip };
  } catch (err) {
    console.error(err);
    toast(t('export.fail', { msg: err.message }), 5000);
    return null;
  } finally {
    bouncing = false;
  }
}

// ---------- Menu d'une piste (clic droit sur son en-tête, ou son badge « gelée ») ----------

let trackMenu = null;
export function closeTrackMenu() {
  trackMenu?.remove();
  trackMenu = null;
  window.removeEventListener('pointerdown', trackMenuOutside, true);
  window.removeEventListener('keydown', trackMenuKey, true);
}
const trackMenuOutside = e => { if (trackMenu && !trackMenu.contains(e.target)) closeTrackMenu(); };
const trackMenuKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeTrackMenu(); } };

// Blocs sélectionnés sur la piste `i` (ids), ou null.
export function pickedOn(i) {
  const ids = new Set((state.tl.tracks[i]?.clips ?? []).filter(c => tlPicked.has(c)).map(c => c.id));
  return ids.size ? ids : null;
}

export function openTrackMenu(i, x, y) {
  closeTrackMenu();
  const tr = state.tl.tracks[i];
  if (!tr) return;
  trackMenu = document.createElement('div');
  trackMenu.className = 'clip-menu track-menu';
  trackMenu.setAttribute('role', 'menu');
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = trackName(i);
  trackMenu.appendChild(head);
  const item = (label, fn, icon, title = '') => {
    const b = document.createElement('button');
    b.className = 'cm-item';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.dataset.icon = icon;
    if (title) b.title = title;
    b.addEventListener('click', () => { closeTrackMenu(); fn(); });
    trackMenu.appendChild(b);
    return b;
  };
  if (!tr.frozen) item(t('frz.freeze'), () => freezeTrack(i), 'freeze', t('frz.freezeTitle'));
  else {
    item(t('frz.unfreeze'), () => unfreezeTrack(i), 'freeze', t('frz.unfreezeTitle'));
    item(t('frz.refreeze'), () => refreezeTrack(i), 'reset', t('frz.refreezeTitle'));
  }
  item(t('frz.bounce'), () => bounceTrack(i), 'bounce', t('frz.bounceTitle'));
  const ids = !tr.frozen && pickedOn(i);
  if (ids) item(t('frz.bounceSel', { n: ids.size }), () => bounceTrack(i, ids), 'bounce', t('frz.bounceSelTitle'));
  for (const b of trackMenu.querySelectorAll('.cm-item')) b.disabled = bouncing || !!tlRec;
  document.body.appendChild(trackMenu);
  const w = trackMenu.offsetWidth, h = trackMenu.offsetHeight;
  trackMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x))}px`;
  trackMenu.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y))}px`;
  trackMenu.querySelector('.cm-item')?.focus();
  setTimeout(() => { window.addEventListener('pointerdown', trackMenuOutside, true); window.addEventListener('keydown', trackMenuKey, true); }, 0);
}

// Branché au démarrage : la timeline demande le son gelé de chaque piste.
export function buildFreeze() {
  timeline.frozenOf = frozenFor;
}
