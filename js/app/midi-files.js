// Fichiers MIDI (.mid) : export des blocs de notes de la timeline (une piste MIDI par piste ; les coups de pads sur le
// canal 10, notes 36 et suivantes), import d'un fichier en blocs de notes (une piste MIDI par piste libre, à la tête
// de lecture), à retoucher dans le piano roll.
import { download, stamp } from '../recorder.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { clipEvents } from '../notes.js';
import { readMidi, writeMidi } from '../smf.js';
import { BEATS_PER_BAR, MAX_TRACKS, newTrack } from '../timeline.js';
import { state, timeline } from './core.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { armedTrack, renderTl, trackName } from './tl.js';

/** Notes de la timeline par piste : [{ name, channel, notes }] (pistes vides ignorées). */
export function timelineMidiTracks() {
  const out = [];
  state.tl.tracks.forEach((tr, i) => {
    const notes = [], drums = [];
    for (const c of tr.clips) {
      if (c.type === 'note') for (const e of clipEvents(c)) notes.push({ t: c.start + e.t, len: e.len, note: e.note, vel: Math.min(1, e.vel * (c.gain ?? 1)) });
      else if (c.type === 'pad') drums.push({ t: c.start, len: 0.25, note: 36 + (c.pad % 40), vel: Math.min(1, (c.vel ?? 1) * (c.gain ?? 1)) });
    }
    if (notes.length) out.push({ name: trackName(i), channel: 0, notes });
    if (drums.length) out.push({ name: `${trackName(i)} (pads)`, channel: 9, notes: drums });
  });
  return out;
}

export function exportMidi() {
  const tracks = timelineMidiTracks();
  if (!tracks.length) { toast(t('midi.noNotes'), 3500); return; }
  download(new Blob([writeMidi(tracks, state.bpm)], { type: 'audio/midi' }), `gabberkey-${stamp()}.mid`);
  toast(t('midi.exported', { n: tracks.length }), 3000);
}

export const isMidiFile = file => /\.(mid|midi|smf)$/i.test(file.name) || file.type === 'audio/midi';

// Pistes libres sur [start, end[, à partir de la piste armée ; ajoute des pistes s'il en manque (jusqu'au maximum).
function freeTracks(start, end, n) {
  const tracks = state.tl.tracks, out = [];
  const free = tr => !tr.clips.some(c => c.start < end - 1e-6 && start < c.start + timeline.clipBeats(c) - 1e-6);
  for (let k = 0; k < tracks.length && out.length < n; k++) { const i = (armedTrack() + k) % tracks.length; if (free(tracks[i])) out.push(i); }
  while (out.length < n && tracks.length < MAX_TRACKS) { tracks.push(newTrack()); out.push(tracks.length - 1); }
  return out;
}

/** Un fichier MIDI devient des blocs de notes, à partir de la mesure de la tête de lecture. -> nombre de blocs */
export async function importMidiFile(file) {
  let midi;
  try { midi = readMidi(await file.arrayBuffer()); } catch (err) { toast(t('midi.bad', { msg: err.message }), 4000); return 0; }
  if (!midi.tracks.length) { toast(t('midi.empty'), 3500); return 0; }
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const blocks = midi.tracks.map((mt, k) => {
    const last = Math.max(...mt.notes.map(n => n.t + n.len));
    const len = Math.max(BEATS_PER_BAR, Math.ceil(last / BEATS_PER_BAR - 1e-6) * BEATS_PER_BAR);
    return { len, clip: { id: crypto.randomUUID(), type: 'note', seq: mt.notes.map(n => ({ t: +n.t.toFixed(4), len: +n.len.toFixed(4), note: n.note, vel: +n.vel.toFixed(3) })),
      pat: len, len, start, name: (mt.name || t('midi.track', { n: k + 1 })).slice(0, 32), cat: 'lead', color: catColor('lead'), loop: false } };
  });
  const end = start + Math.max(...blocks.map(b => b.len));
  const lanes = freeTracks(start, end, blocks.length);
  blocks.slice(0, lanes.length).forEach((b, k) => state.tl.tracks[lanes[k]].clips.push(b.clip));
  if (end > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil(end / BEATS_PER_BAR));
  renderTl();
  save();
  const placed = Math.min(lanes.length, blocks.length);
  toast(t('midi.imported', { n: placed, name: file.name, bpm: Math.round(midi.bpm) }) + (placed < blocks.length ? ` · ${t('midi.noRoom', { n: blocks.length - placed })}` : ''), 5000);
  return placed;
}
