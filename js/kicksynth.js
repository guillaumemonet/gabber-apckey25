// Mélodie de kick : un bloc de notes joué par un kick du designer, dont la queue est accordée sur chaque note.
// Chaque (réglages, note) est calculé une fois (contexte hors temps réel, quelques dizaines de ms) et gardé en cache ;
// la timeline demande les kicks d'un bloc à l'avance (prepareKick) pour qu'ils soient prêts quand ils jouent.
// Un kick coupe le précédent du même bloc (comme en frenchcore : chaque kick s'arrête au suivant).
import { cleanKickParams, renderKick } from './kickdesign.js';
import { clipNotes } from './notes.js';

const cache = new Map();     // clé -> Float32Array (ou Promise pendant le calcul)
const MAX_CACHE = 400;
const keyOf = (params, note) => `${JSON.stringify(params)}|${note}`;   // params déjà nettoyés (cleanKickParams)

// Calcule (si besoin) les kicks des notes `notes` avec les réglages `params`.
export function prepareKick(params, notes, sampleRate) {
  params = cleanKickParams(params);   // réglages d'un fichier : jamais de valeur invalide dans le calcul
  const jobs = [];
  for (const note of new Set(notes)) {
    const key = keyOf(params, note);
    const hit = cache.get(key);
    if (hit) { if (hit instanceof Promise) jobs.push(hit); continue; }
    const job = renderKick(params, sampleRate, { note }).then(data => { cache.set(key, data); return data; }, () => cache.delete(key));
    cache.set(key, job);
    jobs.push(job);
  }
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return Promise.all(jobs);
}
export const kickReady = (params, note) => { const d = cache.get(keyOf(cleanKickParams(params), note)); return d && !(d instanceof Promise) ? d : null; };

export class KickSynth {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out ?? ctx.createGain();
    this.voices = new Map();   // clé -> { src, gain, block }
    this.buffers = new WeakMap();
    this.pending = new Set();   // notes jouées en direct dont le kick est en cours de calcul
  }
  isMono() { return false; }
  buffer(data) {
    let b = this.buffers.get(data);
    if (!b) { b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate); b.copyToChannel(data, 0); this.buffers.set(data, b); }
    return b;
  }
  // `params` : réglages du kick (positions) ; même interface que les autres synthés de la timeline.
  noteOn(note, vel = 1, when, key = note, params, out = this.out) {
    const now = this.ctx.currentTime;
    const t0 = Math.max(when ?? now, now);
    const data = kickReady(params, note);
    if (!data) {
      // Pas encore calculé : programmé, il joue s'il est prêt à temps ; joué en direct (piano roll, clavier), il part
      // dès qu'il est prêt (quelques dizaines de ms) si la touche est encore tenue.
      const live = when === undefined;
      if (live) this.pending.add(key);
      prepareKick(params, [note], this.ctx.sampleRate).then(() => {
        if (live) { if (this.pending.delete(key)) this.noteOn(note, vel, undefined, key, params, out); }
        else if (this.ctx.currentTime < t0 - 0.005) this.noteOn(note, vel, t0, key, params, out);
      });
      return;
    }
    const block = String(key).slice(0, String(key).lastIndexOf(':') + 1) || String(key);
    for (const [k, v] of this.voices) if (v.block === block) { this.stop(v, t0); this.voices.delete(k); }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(data);
    const gain = this.ctx.createGain();
    gain.gain.value = vel;
    src.connect(gain).connect(out);
    src.start(t0);
    src.onended = () => { try { gain.disconnect(); } catch { /* déjà débranché */ } };
    this.voices.set(key, { src, gain, block, t0 });
  }
  stop(v, t, fade = 0.006) {
    const at = Math.max(t, v.t0);
    v.gain.gain.cancelScheduledValues(at);
    v.gain.gain.setValueAtTime(v.gain.gain.value, at);
    v.gain.gain.linearRampToValueAtTime(0, at + fade);
    try { v.src.stop(at + fade + 0.005); } catch { /* déjà arrêté */ }
  }
  // Fin de la note : le kick s'arrête (une note courte = une queue courte).
  noteOff(note, immediate = false, when, key = note) {
    this.pending.delete(key);
    const v = this.voices.get(key);
    if (!v) return;
    this.voices.delete(key);
    this.stop(v, Math.max(when ?? this.ctx.currentTime, this.ctx.currentTime), immediate ? 0.004 : 0.012);
  }
  allNotesOff() {
    this.pending.clear();
    for (const v of this.voices.values()) this.stop(v, this.ctx.currentTime);
    this.voices.clear();
  }
  cut(prefix) {
    for (const [k, v] of this.voices) if (String(k).startsWith(prefix)) { this.stop(v, this.ctx.currentTime, 0.004); this.voices.delete(k); }
  }
}

// Calcule à l'avance les kicks de tous les blocs de mélodie de kick des pistes (projet ouvert, export).
export function prepareKickClips(tracks, sampleRate) {
  return Promise.all(tracks.flatMap(tr => tr.clips).filter(c => c.type === 'note' && c.kick)
    .map(c => prepareKick(c.kick, clipNotes(c).map(n => n.note), sampleRate)));
}
