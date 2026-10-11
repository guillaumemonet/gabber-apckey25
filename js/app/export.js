// Enregistrement du master et export rapide (WAV, stems) hors temps réel.
import { Engine } from '../audio.js';
import { KickSynth, prepareKickClips } from '../kicksynth.js';
import { measureLoudness } from '../lufs.js';
import { t } from '../i18n.js';
import { Mixer, defaultMixState } from '../mixer.js';
import { OscSynth } from '../osc.js';
import { Patch, defaultPatch } from '../patch.js';
import { presetById } from '../presets.js';
import { download, encodeWav, stamp } from '../recorder.js';
import { Sidechain } from '../sidechain.js';
import { BEATS_PER_BAR, Timeline, trackAudible } from '../timeline.js';
import { makeZip } from '../zip.js';
import { renderLeds } from './controller.js';
import { $, engine, oscSynth, padKey, recorder, state, timeline } from './core.js';
import { presetPatch } from './gen.js';
import { globalDef, globalValue } from './knobs.js';
import { toast } from './misc.js';
import { fmtDb, fmtLufs, setLastExport } from './master-ui.js';
import { prepareWarp } from './warp.js';
import { oscFor } from './osc-ui.js';
import { clipKicks, isDuckedSound, padCat } from './sidechain-ui.js';
import { clipBuffer, tlRec, tlStopRec } from './tl.js';

// ---------- Export rapide (WAV et stems) ----------

// Le morceau est rejoué dans un contexte audio hors temps réel, avec tout le moteur reconstruit à l'identique
// (synthé, pads, table de mixage et ses effets, sidechain) : le rendu prend quelques secondes au lieu de la durée du morceau.
export const EXPORT_LEAD = 0.1;   // marge de départ (les réglages se posent), retirée du fichier
export const EXPORT_TAIL = 3;     // queue des réverbes et des delays

// Fin du morceau (en temps) : la fin du dernier bloc.
export function songEndBeats() {
  const len = state.tl.bars * BEATS_PER_BAR;
  let end = 0;
  for (const tr of state.tl.tracks) for (const c of tr.clips) if (c.start < len) end = Math.max(end, c.start + timeline.clipBeats(c));
  return end;
}

// Fin des blocs d'une piste (en temps), ou des seuls blocs `ids`.
export function trackEndBeats(tr, ids = null) {
  const len = state.tl.bars * BEATS_PER_BAR;
  let end = 0;
  for (const c of tr.clips) if (c.start < len && (!ids || ids.has(c.id))) end = Math.max(end, c.start + timeline.clipBeats(c));
  return end;
}
// Réglages d'une piste qui restent en direct sur une piste gelée ou rendue en audio (ils ne sont pas dans le son rendu).
export const LIVE_KNOBS = ['vol', 'pan', 'dly', 'rev'];
export const BAKED_AUTO = ['lp', 'hp', 'drive'];

// Rend la timeline (ou une seule piste, pour un stem) et renvoie ses deux canaux.
// opts.freeze : son d'une piste gelée (js/app/freeze.js) : ses blocs, effets, inserts, filtres et saturation, puis la table
// de mixage (muets et solos ignorés), pris à l'entrée du master, jusqu'à la fin de ses blocs ; volume, pano, envois et bus
// de la piste neutres (ils restent en direct). Les autres pistes ne sonnent pas, mais leurs kicks pompent le sidechain.
// opts.bounce : pareil, avec une table de mixage neutre et le câblage par défaut (le son devient un bloc audio, qui passera
// par la voie Timeline) ; opts.clips : ids des seuls blocs à rendre ; opts.kicks : reçoit les kicks de la piste (en temps).
export async function renderSong(onlyTrack = null, opts = {}) {
  const bd = 60 / state.bpm;
  const solo = !!(opts.freeze || opts.bounce) && onlyTrack !== null;
  const endBeat = solo ? trackEndBeats(state.tl.tracks[onlyTrack], opts.clips) : songEndBeats();
  const sr = engine.ctx.sampleRate;
  const octx = new OfflineAudioContext(2, Math.ceil((EXPORT_LEAD + endBeat * bd + EXPORT_TAIL) * sr), sr);
  // Sons étirés / transposés : tous prêts avant le rendu.
  await prepareWarp(state.tl.tracks.flatMap(tr => tr.clips).filter(c => !c.type && c.warp).map(clip => {
    const buf = clipBuffer(clip.sampleId);
    return buf && { clip, buf: clip.reverse ? timeline.reversed(buf) : buf, rate: clip.bpm ? state.bpm / clip.bpm : 1 };
  }).filter(Boolean));
  await prepareKickClips(state.tl.tracks, sr);   // mélodies de kick : tous les kicks calculés avant le rendu
  const e = new Engine(octx);
  await e.initMaster();
  // Chaîne master du morceau ; un stem sort sans elle (ni compression, ni écrêteur, ni limiteur : c'est au mixage final d'en décider).
  e.setMaster(onlyTrack === null ? state.master : Object.fromEntries(Object.entries(state.master).map(([g, v]) => [g, { ...v, on: false }])));
  for (const [id, p] of Object.entries(state.globals)) if (globalDef(id)) e.set(id, globalValue(id, p));
  if (solo) {
    // Son pris à l'entrée du master : ni volume général, ni égaliseur, ni chaîne du master (ils s'appliquent en direct après).
    e.master.disconnect();
    e.master.gain.cancelScheduledValues(0);
    e.master.gain.value = 1;
    e.master.connect(octx.destination);
  }
  e.setBpm(state.bpm);
  e.setVoice(presetById(state.preset).voice);
  const mix = opts.bounce ? defaultMixState() : opts.freeze ? { ...state.mix, channels: Object.fromEntries(Object.entries(state.mix.channels).map(([id, ch]) => [id, { ...ch, mute: false, solo: false }])) } : state.mix;
  const m = new Mixer(e, () => mix);
  e.padBus.disconnect();
  e.padBus.connect(m.input('pads'));
  const patch = opts.bounce ? defaultPatch() : state.patch;
  const pt = new Patch(e, m, () => patch, false);   // même câblage que le son en direct
  const sc = new Sidechain(e, () => state.sc);
  clearInterval(sc.timer);   // tout est programmé d'avance ci-dessous
  e.pumpGain.disconnect();
  e.pumpGain.connect(sc.synth).connect(m.input('synth'));
  sc.pads.connect(e.padBus);
  sc.tl.connect(m.input('tl'));
  const os = new OscSynth(octx, () => state.bpm);
  os.setValues({ ...oscSynth.values });
  os.out.connect(sc.osc).connect(m.input('osc'));
  e.padOut = pad => (isDuckedSound(pad.sampleId, padCat(pad)) ? sc.pads : e.padBus);
  const ks = new KickSynth(octx, e.padBus);
  // Ce qu'on entend (muet / solo), ou une seule piste pour un stem.
  const tracks = state.tl.tracks.map((tr, i) => ({ ...tr, solo: false, mute: onlyTrack !== null && !solo ? i !== onlyTrack : !trackAudible(state.tl.tracks, i, state.tl.buses) }));
  if (solo) {
    // Piste gelée / rendue : réglages en direct neutres, sans bus ; seuls ses blocs `opts.clips` s'il y en a.
    const tr = state.tl.tracks[onlyTrack];
    tracks[onlyTrack] = { ...tr, ...Object.fromEntries(LIVE_KNOBS.map(k => [k, 0])), vol: 1, bus: null, mute: false, solo: false,
      auto: Object.fromEntries(Object.entries(tr.auto ?? {}).filter(([id]) => BAKED_AUTO.includes(id))),
      clips: opts.clips ? tr.clips.filter(c => opts.clips.has(c.id)) : tr.clips };
  }
  const buses = state.tl.buses.map(b => ({ ...b, solo: false, mute: false }));   // muet / solo des bus déjà dans `mute` ci-dessus
  const tlState = { ...state.tl, tracks, buses };
  const tl = new Timeline(e, () => tlState, clipBuffer, m.input('tl'));
  Object.assign(tl, {
    getPad: (b, i) => state.banks[b]?.[i], padKey, getPatch: presetPatch, getOsc: clip => oscFor(clip, os), getKick: clip => ({ synth: ks, values: clip.kick }), duckOutput: sc.tl,
    isDucked: timeline.isDucked, isKickPad: timeline.isKickPad, kicksOf: clipKicks, warpOf: timeline.warpOf,
    onKick: (time, ti) => { sc.kick(time); if (solo && ti === onlyTrack) opts.kicks?.push((time - EXPORT_LEAD) / bd); },
  });
  if (solo) tl.frozenOf = i => (i === onlyTrack ? null : { buf: null });   // les autres pistes : leurs kicks seulement
  // Lecture linéaire du début à la fin, sans boucle ; toutes les fins de notes programmées d'un coup.
  tl.recording = true;
  tl.playing = true;
  e.origin = EXPORT_LEAD;
  tl.cycles = [{ time: EXPORT_LEAD, beat: 0 }];
  tl.scheduleCycle(EXPORT_LEAD, 0);
  tl.flush(Infinity);
  pt.scheduleAll(EXPORT_LEAD, EXPORT_LEAD + endBeat * bd + EXPORT_TAIL);
  if (state.sc.on && state.sc.source === 'beat') for (let b = 0; b < endBeat; b++) sc.duck(EXPORT_LEAD + b * bd);
  await new Promise(r => setTimeout(r, 30));   // réponses impulsionnelles des réverbes (créées juste après)
  const buf = await octx.startRendering();
  const skip = Math.round(EXPORT_LEAD * sr);
  return [0, 1].map(c => buf.getChannelData(c).subarray(skip));
}

export let exporting = false;
export async function exportSong(stems) {
  if (exporting) return;
  if (!songEndBeats()) { toast(t('export.empty'), 3000); return; }
  if (tlRec) await tlStopRec();
  exporting = true;
  renderExport();
  const t0 = performance.now();
  try {
    const name = `gabberkey-${stamp()}`;
    if (!stems) {
      toast(t('export.rendering'), 60000);
      const chans = await renderSong();
      download(new Blob([encodeWav(chans, engine.ctx.sampleRate)], { type: 'audio/wav' }), `${name}.wav`);
      // Sonie du fichier : celle que mesureront les plateformes et les autres logiciels.
      const l = measureLoudness(chans, engine.ctx.sampleRate);
      setLastExport(l);
      toast(t('export.loudness', { s: ((performance.now() - t0) / 1000).toFixed(1), lufs: fmtLufs(l.integrated), peak: fmtDb(l.peakDb) }), 8000);
      return;
    } else {
      const list = state.tl.tracks.map((tr, i) => i).filter(i => trackAudible(state.tl.tracks, i, state.tl.buses) && state.tl.tracks[i].clips.length);
      const files = [];
      for (const [k, i] of list.entries()) {
        toast(t('export.stem', { n: k + 1, total: list.length }), 60000);
        const chans = await renderSong(i);
        const first = state.tl.tracks[i].clips.reduce((a, c) => (c.start < a.start ? c : a)).name ?? '';
        const label = `${String(i + 1).padStart(2, '0')} ${t('tl.track', { n: i + 1 })} - ${first}`.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
        files.push({ name: `${label}.wav`, data: encodeWav(chans, engine.ctx.sampleRate) });
      }
      download(makeZip(files), `${name}-stems.zip`);
    }
    toast(t('export.done', { s: ((performance.now() - t0) / 1000).toFixed(1) }), 4000);
  } catch (err) {
    console.error(err);
    toast(t('export.fail', { msg: err.message }), 5000);
  } finally {
    exporting = false;
    renderExport();
  }
}

export function renderExport() {
  for (const id of ['#tl-export', '#tl-stems', '#tl-midi']) $(id).disabled = exporting;
}

// ---------- Enregistrement ----------

export let recTimer;
export async function toggleRecording() {
  const btn = $('#rec');
  if (!recorder.recording) {
    await recorder.start();
    btn.classList.add('active');
    const tick = () => {
      const s = Math.floor(recorder.elapsed);
      btn.textContent = `■ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    recTimer = setInterval(tick, 500);
  } else {
    clearInterval(recTimer);
    btn.classList.remove('active');
    btn.textContent = '● REC';
    const blob = await recorder.stop();
    download(blob, `gabberkey-${stamp()}.wav`);
    toast(t('rec.done'));
  }
  renderLeds();
}
$('#rec').addEventListener('click', () => engine && toggleRecording());
