// Modules de tracker (.mod, .xm) ouverts avec « Ouvrir… » : les samples vont sur les pads d'une banque vide, chaque voie
// du module devient un bloc de notes joué par l'instrument échantillon (js/sampler.js), à partir de la mesure de la tête
// de lecture ; le tempo du module est repris si la timeline est vide.
import { encodeWav } from '../recorder.js';
import { t } from '../i18n.js';
import { catColor, guessCat } from '../library.js';
import { readTracker, trackerKind, TRACKER_EXT } from '../tracker.js';
import { BEATS_PER_BAR } from '../timeline.js';
import * as store from '../storage.js';
import { BANKS, engine, newPad, state } from './core.js';
import { freeTracks } from './midi-files.js';
import { renderLibrary } from './library-ui.js';
import { renderAll, toast } from './misc.js';
import { save } from './save.js';
import { setBpm } from './tempo.js';
import { renderTl } from './tl.js';

export const isTrackerFile = file => TRACKER_EXT.test(file.name);

// Banques vides à la suite pour `n` sons (à partir de la banque affichée). -> première banque, ou -1
function emptyBanks(n) {
  const need = Math.ceil(n / 40);
  for (let k = 0; k < BANKS; k++) {
    const b = (state.bank + k) % BANKS;
    if (b + need > BANKS) continue;
    if (state.banks.slice(b, b + need).every(bank => bank.every(p => !p))) return b;
  }
  return -1;
}

/** Ouvre un module : sons sur les pads, voies en blocs de notes. -> nombre de blocs posés */
export async function importTrackerFile(file) {
  let mod;
  try {
    const buf = await file.arrayBuffer();
    if (!trackerKind(buf, file.name)) throw new Error(t('mod.notModule'));
    mod = readTracker(buf);
  } catch (err) { toast(t('mod.bad', { msg: err.message }), 4000); return 0; }
  const used = mod.samples.map((s, i) => i).filter(i => mod.samples[i].data.length > 1);
  const channels = mod.channels.map((notes, c) => ({ c, notes: notes.filter(n => used.includes(n.s)) })).filter(ch => ch.notes.length);
  if (!channels.length) { toast(t('mod.empty'), 3500); return 0; }
  const bank = emptyBanks(used.length);
  if (bank < 0) { toast(t('mod.noBank', { n: Math.ceil(used.length / 40) }), 5000); return 0; }

  // Sons : un pad chacun, enregistrés dans « Mes sons » avec leur nom.
  const slot = new Map();   // numéro du sample -> { bank, pad }
  used.forEach((s, k) => {
    const smp = mod.samples[s], b = bank + Math.floor(k / 40), i = k % 40;
    const name = (smp.name || t('mod.sample', { n: s + 1 })).slice(0, 24);
    const buffer = engine.ctx.createBuffer(1, smp.data.length, smp.rate);
    buffer.copyToChannel(smp.data, 0);
    const sampleId = `user:${crypto.randomUUID()}`;
    store.saveSample(sampleId, { name, data: encodeWav([smp.data], smp.rate) }).catch(err => console.warn('Module', err));
    const pad = newPad(name, catColor(guessCat(name)), sampleId, buffer);
    pad.smp = { root: Math.round(smp.root * 1000) / 1000, loop: smp.loop ? [smp.loop[0] / smp.rate, smp.loop[1] / smp.rate] : null };
    state.banks[b][i] = pad;
    slot.set(s, { bank: b, pad: i });
  });

  // Tempo : celui du module si la timeline est vide ; sinon le morceau garde le sien.
  const empty = state.tl.tracks.every(tr => !tr.clips.length);
  if (empty && Math.abs(state.bpm - mod.bpm) > 0.01) setBpm(mod.bpm);
  const scale = state.bpm / mod.bpm;   // temps du module -> temps du morceau (même durée)
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const title = mod.title || file.name.replace(TRACKER_EXT, '');
  const blocks = channels.map(({ c, notes }) => {
    const refs = [...new Set(notes.map(n => n.s))];
    const seq = notes.map(n => {
      const e = { ...n, t: +(n.t * scale).toFixed(4), len: +(n.len * scale).toFixed(4), s: refs.indexOf(n.s) };
      if (n.pv) e.pv = n.pv.map(([d, v]) => [+(d * scale).toFixed(4), v]);
      if (n.pp) e.pp = n.pp.map(([d, v]) => [+(d * scale).toFixed(4), v]);
      return e;
    });
    const last = Math.max(...seq.map(n => n.t + n.len));
    const len = Math.max(BEATS_PER_BAR, Math.ceil(last / BEATS_PER_BAR - 1e-6) * BEATS_PER_BAR);
    const name = t('mod.channel', { n: c + 1, name: title }).slice(0, 32);
    return { len, clip: { id: crypto.randomUUID(), type: 'note', seq, pat: len, len, start, name, cat: 'lead', color: catColor('lead'), loop: false,
      smps: refs.map(s => slot.get(s)) } };
  });
  const end = start + Math.max(...blocks.map(b => b.len));
  const lanes = freeTracks(start, end, blocks.length);
  blocks.slice(0, lanes.length).forEach((b, k) => state.tl.tracks[lanes[k]].clips.push(b.clip));
  if (end > state.tl.bars * BEATS_PER_BAR) state.tl.bars = Math.min(256, Math.ceil(end / BEATS_PER_BAR));
  renderAll();
  renderTl();
  renderLibrary();
  save();
  const placed = Math.min(lanes.length, blocks.length);
  const skipped = Object.values(mod.skipped).reduce((a, b) => a + b, 0);
  toast([t('mod.imported', { name: title, n: placed, pads: used.length, bank: bank + 1, bpm: Math.round(mod.bpm * 10) / 10 }),
    ...(placed < blocks.length ? [t('midi.noRoom', { n: blocks.length - placed })] : []),
    ...(skipped ? [t('mod.skipped', { n: skipped, fx: Object.keys(mod.skipped).sort().join(' ') })] : [])].join(' · '), 7000);
  return placed;
}
