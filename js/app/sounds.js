// Sons à la demande : un son n'est téléchargé et décodé que lorsqu'il sert (banque affichée, bloc de la timeline,
// scène, platine, écoute…). Au démarrage : la banque affichée, les pads joués par la timeline et par les scènes ;
// les autres banques se chargent quand on les affiche, et un pad pas encore chargé part dès qu'il est décodé.
import * as store from '../storage.js';
import { engine, kit, state } from './core.js';

export const bufferCache = new Map();   // sampleId -> AudioBuffer : sons décodés, partagés (pads, blocs, platines)
const loading = new Map();              // sampleId -> Promise<AudioBuffer|null> : décodages en cours

/**
 * Décode un son une seule fois, même s'il est demandé plusieurs fois en même temps.
 * @param {string} id  'lib:…' (bibliothèque), 'user:…' / 'rec:…' (navigateur), 'builtin:n' (kit de départ)
 * @returns {Promise<AudioBuffer|null>} null si le son est introuvable ou illisible
 */
export function loadSound(id) {
  if (!id) return Promise.resolve(null);
  if (bufferCache.has(id)) return Promise.resolve(bufferCache.get(id));
  if (id.startsWith('builtin:')) {
    const b = kit?.[+id.slice(8)]?.buffer ?? null;
    if (b) bufferCache.set(id, b);
    return Promise.resolve(b);
  }
  if (!loading.has(id)) {
    loading.set(id, readSound(id).then(buf => {
      loading.delete(id);
      if (buf) bufferCache.set(id, buf);
      return buf;
    }));
  }
  return loading.get(id);
}

async function readSound(id) {
  let data = null;
  if (id.startsWith('lib:')) data = await fetch(`sounds/${id.slice(4)}`, { cache: 'no-cache' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  else data = (await store.loadSample(id).catch(() => null))?.data?.slice(0);
  return data ? engine.ctx.decodeAudioData(data).catch(() => null) : null;
}

/**
 * Son d'un pad, décodé à la première demande (le pad le garde ensuite).
 * @param {import('./core.js').Pad|null} pad
 * @returns {Promise<AudioBuffer|null>}
 */
export async function loadPad(pad) {
  if (!pad || pad.buffer) return pad?.buffer ?? null;
  const id = pad.sampleId;
  const buf = await loadSound(id);
  if (buf && pad.sampleId === id && !pad.buffer) pad.buffer = buf;   // le son du pad a pu changer entre-temps
  return pad.buffer;
}

export const loadPads = pads => Promise.all(pads.filter(Boolean).map(loadPad));
export const loadBank = b => loadPads(state.banks[b] ?? []);
export const bankLoaded = b => (state.banks[b] ?? []).every(p => !p || p.buffer);

// Pads qui servent hors de la banque affichée : coups de pads posés sur la timeline, boucles des scènes.
export function padsInUse() {
  const pads = new Set();
  const add = (b, i) => { const p = state.banks[b]?.[i]; if (p) pads.add(p); };
  for (const clip of state.tl.tracks.flatMap(tr => tr.clips)) if (clip.type === 'pad') add(clip.bank, clip.pad);
  for (const sc of state.scenes) for (const key of sc?.loops ?? []) add(Math.floor(key / 40), key % 40);
  return [...pads];
}
