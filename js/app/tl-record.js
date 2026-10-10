// Timeline : enregistrement en jouant (pads et clavier -> blocs posés en direct).
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { engine, state, timeline } from './core.js';
import { oscSound } from './osc-ui.js';
import { armedTrack, tlRec, trackSource } from './tl.js';

// ---------- Enregistrement en jouant (pads et piano -> blocs posés en direct) ----------

export const REC_GRID = 0.25;   // calage des coups : la double-croche
export let lastRecRender = 0;
export const snapRec = v => Math.round(v / REC_GRID) * REC_GRID;
export const noteLabel = n => `${t('notes')[n % 12]}${Math.floor(n / 12) - 1}`;

// Piste libre à cet endroit : la piste armée, sinon la suivante qui ne contient rien à ce moment-là.
// Pendant un enregistrement (`src` donné), une piste armée pour un autre instrument n'est jamais prise.
export function freeTrack(start, len, from = armedTrack(), src = null) {
  const tracks = state.tl.tracks;
  for (let k = 0; k < tracks.length; k++) {
    const i = (from + k) % tracks.length;
    if (src && k > 0 && tracks[i].arm && trackSource(tracks[i]) !== src) continue;
    const busy = tracks[i].clips.some(c => c.start < start + len - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6);
    if (!busy) return i;
  }
  return from;
}

// Piste qui reçoit les notes du clavier : celle du synthé joué (Synthé ou Synthé à oscillateurs), sinon l'autre.
export const noteTrack = () => tlRec?.events[state.keys === 'osc' ? 'osc' : 'synth'] ?? tlRec?.events.synth ?? tlRec?.events.osc;

export function recPosition() {
  const pos = timeline.position();
  return snapRec(timeline.length ? pos % timeline.length : pos);
}

export function tlRecordPad(bank, i, at) {
  const ti = tlRec?.events.pads;
  if (ti === undefined || !timeline.playing) return;
  const pad = state.banks[bank][i];
  if (!pad?.buffer) return;
  // Départ calé sur la grille : le coup est posé là où il sonne vraiment, pas à l'instant de l'appui.
  const ahead = at ? Math.max(0, at - engine.ctx.currentTime) / timeline.beatDur : 0;
  const start = ahead ? snapRec((timeline.position() + ahead) % (timeline.length || Infinity)) : recPosition();
  const len = Math.max(REC_GRID, Math.ceil(pad.buffer.duration / timeline.beatDur / REC_GRID) * REC_GRID);
  const clip = { id: crypto.randomUUID(), type: 'pad', bank, pad: i, sampleId: pad.sampleId, name: pad.name, color: pad.color, cat: 'drums', start, len, loop: false };
  state.tl.tracks[freeTrack(start, len, ti, 'pads')].clips.push(clip);
  tlRec.dirty = true;
}

export function tlRecordNote(note, on, velocity = 0.85) {
  const ti = noteTrack();
  if (ti === undefined || !timeline.playing) return;
  if (on) {
    const start = recPosition();
    const clip = { id: crypto.randomUUID(), type: 'note', note, vel: velocity, name: noteLabel(note), color: catColor('lead'), cat: 'lead', start, len: REC_GRID, loop: false, ...recSound() };
    state.tl.tracks[freeTrack(start, REC_GRID, ti, trackSource(state.tl.tracks[ti]))].clips.push(clip);
    tlRec.notes.push(clip);
    tlRec.open.set(note, clip);   // s'allonge tant que la touche est tenue
  } else {
    const clip = tlRec.open.get(note);
    if (!clip) return;
    tlRec.open.delete(note);
    growHeldNote(clip);
  }
  tlRec.dirty = true;
}

// Note de l'arpège programmée à l'instant `when` (secondes) pour `dur` secondes : calée sur la triple-croche.
export const ARP_GRID = 0.125;
export function tlRecordArpNote(note, vel, when, dur) {
  const ti = noteTrack();
  if (ti === undefined || !timeline.playing) return;
  let pos = timeline.position() + (when - engine.ctx.currentTime) / timeline.beatDur;
  if (timeline.length) pos %= timeline.length;
  const start = Math.round(pos / ARP_GRID) * ARP_GRID;
  const len = Math.max(ARP_GRID, Math.round(dur / timeline.beatDur / ARP_GRID) * ARP_GRID);
  const clip = { id: crypto.randomUUID(), type: 'note', note, vel, name: noteLabel(note), color: catColor('lead'), cat: 'lead', start, len, loop: false, ...recSound() };
  state.tl.tracks[freeTrack(start, len, ti, trackSource(state.tl.tracks[ti]))].clips.push(clip);
  tlRec.notes.push(clip);
  tlRec.dirty = true;
}

export const recSound = () => (state.keys === 'osc' ? { osc: oscSound() } : {});

export function growHeldNote(clip) {
  let end = timeline.position();
  if (timeline.length) { end %= timeline.length; if (end < clip.start) end += timeline.length; }
  clip.len = Math.max(REC_GRID, snapRec(end - clip.start));
}

// Variables modifiées depuis d'autres modules.
export function setLastRecRender(v) { return (lastRecRender = v); }
