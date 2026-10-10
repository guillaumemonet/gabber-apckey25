// Sons étirés / transposés des blocs audio (« Garder la hauteur », transposition) : calculés une fois dans un Worker
// (js/stretch-worker.js), gardés en cache. Tant qu'un son n'est pas prêt, le bloc joue l'ancienne façon (la hauteur suit
// le tempo) ; l'export WAV attend qu'ils soient tous prêts.
import { engine, state, timeline } from './core.js';
import { clipBuffer } from './tl.js';

const WORKER = 'js/stretch-worker.js?v=1';
const cache = new Map();     // clé -> AudioBuffer
const waiting = new Map();   // clé -> Promise<AudioBuffer|null>
let worker = null, nextId = 0;
const jobs = new Map();      // id -> resolve

// Le bloc a-t-il besoin d'un son recalculé ? `rate` : vitesse de lecture qu'il aurait sans cela (tempo / tempo du son).
export const needsWarp = (clip, rate) => !!clip.warp && (Math.abs(rate - 1) > 0.002 || !!clip.semi);
const keyOf = (clip, buf, rate) => `${clip.sampleId}|${clip.reverse ? 'r' : ''}|${buf.length}|${(1 / rate).toFixed(5)}|${clip.semi ?? 0}|${clip.loop ? 'l' : ''}`;

function run(chans, factor, semis, loop) {
  if (!worker) {
    worker = new Worker(WORKER, { type: 'module' });
    worker.onmessage = e => { jobs.get(e.data.id)?.(e.data.chans); jobs.delete(e.data.id); };
  }
  const id = ++nextId;
  return new Promise(res => { jobs.set(id, res); worker.postMessage({ id, chans, factor, semis, loop }); });
}

/** Son prêt pour ce bloc (ou null : pas encore calculé ; le calcul est alors lancé). */
export function warpedBuffer(clip, buf, rate, ctx = engine.ctx) {
  const key = keyOf(clip, buf, rate);
  const done = cache.get(key);
  if (done) return done.sampleRate === ctx.sampleRate ? done : null;
  if (!waiting.has(key)) waiting.set(key, compute(key, clip, buf, rate, ctx));
  return null;
}

async function compute(key, clip, buf, rate, ctx) {
  const chans = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c).slice());
  const out = await run(chans, 1 / rate, clip.semi ?? 0, !!clip.loop);
  const ab = ctx.createBuffer(out.length, out[0].length, buf.sampleRate);
  out.forEach((c, i) => ab.copyToChannel(c, i));
  cache.set(key, ab);
  waiting.delete(key);
  if (cache.size > 64) cache.delete(cache.keys().next().value);   // les plus anciens s'en vont
  return ab;
}

// Lance le calcul des sons de tous les blocs qui en ont besoin (bloc posé, tempo changé…) : ils seront prêts à la lecture.
export function requestWarps(bpm = engine.bpm) {
  for (const tr of state.tl.tracks) for (const clip of tr.clips) {
    if (clip.type || !clip.warp) continue;
    const buf = clipBuffer(clip.sampleId);
    const rate = clip.bpm ? bpm / clip.bpm : 1;
    if (buf && needsWarp(clip, rate)) warpedBuffer(clip, clip.reverse ? timeline.reversed(buf) : buf, rate);
  }
}

/** Attend les sons de ces blocs (export WAV : tout doit être prêt avant le rendu). */
export async function prepareWarp(items) {
  for (const { clip, buf, rate } of items) if (needsWarp(clip, rate)) warpedBuffer(clip, buf, rate);
  await Promise.all([...waiting.values()]);
}
