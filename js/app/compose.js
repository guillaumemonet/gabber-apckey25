// Construction d'un morceau à partir d'un plan nettoyé (js/songplan.js) : la timeline est remplacée par un bloc par
// partie sur des pistes nommées (kick, batterie, basse, accords, lead), les montées du designer de montée avant
// chaque drop et un repère par partie ; le générateur, le designer de kick et le synthé du clavier prennent les
// réglages du plan. Une seule étape d'annulation.
import { BU_BARS } from '../buildup.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { KICK_PRESETS, kickDefaults, kickTailNote } from '../kickdesign.js';
import { prepareKickClips } from '../kicksynth.js';
import { catColor } from '../library.js';
import { PLAN_PARTS, calmNotes } from '../songplan.js';
import { DRUM_KITS, drumHits, kickLine, layoutSections } from '../songstart.js';
import { BEATS_PER_BAR, newTrack } from '../timeline.js';
import { breizhDraft, breizhParts, refreshBreizh, renderBreizh } from './breizh-ui.js';
import { generateBuildup } from './buildup-ui.js';
import { $, engine, newPad, state, timeline, tlHistory } from './core.js';
import { bassSeq, chordsSeq, leadSeq, refreshDraft, renderGen, soundFields } from './gen.js';
import { renderKick } from './kick-ui.js';
import { libManifest, renderLibrary } from './library-ui.js';
import { renderMarkers } from './markers.js';
import { renderAll, toast } from './misc.js';
import { save } from './save.js';
import { applyPreset } from './synth-ui.js';
import { setBpm } from './tempo.js';
import { TL_HEAD, ensureBuffer, loadTlBuffers, renderTl } from './tl.js';

const BUILDUP_TRACKS = 6;   // pistes laissées libres pour les éléments des montées
const BASS_GAIN = 0.7;      // la basse reste sous le kick, qui tient le grave
const CHORD_BARS = 2;       // mesures par accord

// Pad qui joue un son de la bibliothèque (banque `bankName`, son `name`) : celui des banques s'il y est, sinon posé sur
// le premier pad libre. -> { bank, pad } | null
async function libraryPad(bankName, name) {
  const lb = libManifest?.banks.find(b => b.name === bankName);
  const p = lb?.pads.find(x => x?.name === name);
  if (!p) return null;
  const sampleId = `lib:${p.file}`;
  for (let b = 0; b < state.banks.length; b++) {
    const i = state.banks[b].findIndex(x => x?.sampleId === sampleId);
    if (i >= 0) return { bank: b, pad: i };
  }
  const buffer = await ensureBuffer(sampleId);
  if (!buffer) return null;
  for (let b = 0; b < state.banks.length; b++) {
    const i = state.banks[b].findIndex(x => !x);
    if (i < 0) continue;
    state.banks[b][i] = newPad(name, catColor(p.cat ?? 'drums'), sampleId, buffer, p.bpm || 0);
    return { bank: b, pad: i };
  }
  return null;
}

/**
 * Remplace la timeline par le morceau du plan (nettoyé par cleanPlan) en une seule étape d'annulation, après
 * confirmation si elle n'est pas vide. -> résumé { bars, blocks, markers }, ou null.
 */
export async function composeSong(plan) {
  if (state.tl.tracks.some(tr => tr.clips.length) && !confirm(t('start.confirm'))) return null;
  tlHistory.commit();
  tlHistory.paused = true;
  try { return await buildSong(plan); } finally {
    tlHistory.paused = false;
    save();
  }
}

async function buildSong(plan) {
  const { chords } = parseProgression(plan.prog);
  const breizh = !!plan.lead.breizh;
  if (timeline.playing) timeline.stop();
  toast(t('start.creating'), 30000);
  setBpm(plan.bpm);

  // Le générateur, le designer de kick et le synthé prennent les réglages du plan.
  const g = state.gen;
  Object.assign(g, { prog: plan.prog, bars: CHORD_BARS, preset: plan.chords.sound, rhythm: plan.chords.rhythm, register: plan.chords.register });
  if (!breizh) {
    Object.assign(g.lead, { preset: plan.lead.sound, style: plan.lead.style, density: plan.lead.density, register: plan.lead.register });
    if (plan.lead.seed) g.lead.seed = plan.lead.seed;
  }
  Object.assign(g.bassline, { style: plan.bass.style, preset: plan.bass.sound, octave: plan.bass.octave });
  if (plan.bass.seed) g.bassline.seed = plan.bass.seed;
  for (const tab of ['chords', 'lead', 'bass']) refreshDraft(tab, true);
  if (plan.lead.notes) g.draft.lead = { seq: plan.lead.notes.map(n => ({ ...n })), edited: true, pat: 0, len: 0 };
  state.kick.params = { ...kickDefaults(), ...KICK_PRESETS[plan.kick.preset], ...plan.kick.params };
  state.kick.preset = plan.kick.preset;
  if (breizh) {
    Object.assign(state.breizh, { tonic: chords[0].root, mode: chords[0].intervals.includes(3) ? 'minor' : 'major', dance: 'andro' });
    refreshBreizh(true);
  }

  // Timeline neuve : une piste par élément qui joue quelque part, puis des pistes libres pour les montées.
  const parts = PLAN_PARTS.filter(p => plan.sections.some(s => s.play.includes(p)));
  state.tl.tracks = Array.from({ length: Math.max(1, parts.length) + BUILDUP_TRACKS }, () => newTrack());
  parts.forEach((p, i) => { state.tl.tracks[i].name = t(`start.track.${p}`); });
  state.tl.tracks[0].arm = true;
  const secs = layoutSections(plan.sections, BEATS_PER_BAR).map((s, i) => ({ ...s, ...plan.sections[i] }));
  const total = secs.reduce((s, x) => s + x.len, 0);
  state.tl.bars = Math.max(4, Math.ceil(total / BEATS_PER_BAR));
  state.tl.playhead = 0;
  const multi = type => secs.filter(s => s.type === type).length > 1;
  const secName = s => s.name ?? (multi(s.type) ? `${t(`start.sec.${s.type}`)} ${s.n}` : t(`start.sec.${s.type}`));
  state.tl.markers = secs.map(s => ({ id: crypto.randomUUID(), beat: s.start, name: secName(s).slice(0, 32) }));

  // Notes de chaque suite d'accords (celle du morceau, ou celle d'une partie) : un passage, 2 mesures par accord.
  const kickTail = kickTailNote(state.kick.params);
  const music = new Map();
  const musicOf = prog => {
    if (music.has(prog)) return music.get(prog);
    const ch = parseProgression(prog).chords;
    const phrase = ch.length * CHORD_BARS * BEATS_PER_BAR;
    const leadFull = () => {
      if (prog === plan.prog && plan.lead.notes) return { seq: plan.lead.notes, pat: Math.max(phrase, Math.ceil(Math.max(...plan.lead.notes.map(n => n.t + n.len)) / BEATS_PER_BAR) * BEATS_PER_BAR) };
      return { seq: leadSeq(ch), pat: phrase };
    };
    const lead = breizh ? null : leadFull();
    const m = {
      phrase, kick: kickLine(ch, CHORD_BARS * BEATS_PER_BAR, kickTail), chords: chordsSeq(ch), bass: bassSeq(ch),
      lead: lead && { full: lead, calm: { seq: calmNotes(lead.seq), pat: lead.pat } },
    };
    music.set(prog, m);
    return m;
  };
  const breizhLead = () => {
    const d = breizhDraft(), p = breizhParts()[0];
    return { seq: p.seq, pat: d.pat, preset: p.preset, ...(p.tune ? { tune: p.tune } : {}), name: t('start.track.lead') };
  };
  const kit = DRUM_KITS[plan.drums.kit];
  const drumPads = {};
  if (parts.includes('drums')) for (const s of ['clap', 'hat', 'off', 'ride', 'crash']) drumPads[s] = await libraryPad(kit.bank, kit[s]);

  let blocks = 0;
  const note = (track, sec, fields) => {
    state.tl.tracks[track].clips.push({ id: crypto.randomUUID(), type: 'note', start: sec.start, len: sec.len, loop: false, ...fields });
    blocks++;
  };
  for (const sec of secs) {
    const prog = sec.prog ?? plan.prog, m = musicOf(prog);
    parts.forEach((p, track) => {
      if (!sec.play.includes(p)) return;
      if (p === 'kick') note(track, sec, { seq: m.kick.map(n => ({ ...n })), pat: m.phrase, kick: { ...state.kick.params }, kickSrc: `p:${plan.kick.preset}`, name: t('kick.melodyName'), cat: 'kick', color: catColor('kick') });
      else if (p === 'chords') note(track, sec, { seq: m.chords.map(n => ({ ...n })), pat: m.phrase, preset: plan.chords.sound, name: prog.slice(0, 32), cat: 'pad', color: catColor('pad') });
      else if (p === 'bass') note(track, sec, { seq: m.bass.map(n => ({ ...n })), pat: m.phrase, ...soundFields(plan.bass.sound), gain: BASS_GAIN, name: t(`gen.bstyle.${plan.bass.style}`), cat: 'bass', color: catColor('bass') });
      else if (p === 'lead') {
        const l = breizh ? breizhLead() : { ...m.lead[sec.lead], preset: plan.lead.sound, name: t(`gen.style.${plan.lead.style}`) };
        note(track, sec, { seq: l.seq.map(n => ({ ...n })), pat: l.pat, preset: l.preset, ...(l.tune ? { tune: l.tune } : {}), name: l.name, cat: 'lead', color: catColor('lead') });
      } else if (p === 'drums') {
        for (const h of drumHits(plan.drums, sec.len, sec.type === 'drop')) {
          const ref = drumPads[h.sound], pad = ref && state.banks[ref.bank][ref.pad];
          if (!pad) continue;
          state.tl.tracks[track].clips.push({ id: crypto.randomUUID(), type: 'pad', bank: ref.bank, pad: ref.pad, sampleId: pad.sampleId, name: pad.name, color: pad.color,
            cat: 'drums', start: sec.start + h.t, len: 0.5, loop: false });
          blocks++;
        }
      }
    });
  }

  // Montées : le designer de montée avant chaque drop (ses éléments sur les pistes libres, après celles des parties).
  if (plan.buildups) {
    const free = Math.max(1, parts.length);
    state.tl.tracks[0].arm = false;
    state.tl.tracks[free].arm = true;
    const keep = state.buildup.bars;
    for (const [k, sec] of secs.entries()) {
      const drop = secs.slice(k + 1).find(s => s.type !== 'cut');   // une coupure peut séparer la montée du drop
      if (sec.type !== 'build' || drop?.type !== 'drop') continue;
      state.buildup.bars = [...BU_BARS].reverse().find(b => b <= sec.bars) ?? BU_BARS[0];
      state.tl.playhead = drop.start;
      const made = await generateBuildup();
      if (made) blocks += made.tracks.length;
    }
    state.buildup.bars = keep;
    state.tl.playhead = 0;
    state.tl.tracks[free].arm = false;
    state.tl.tracks[0].arm = true;
  }

  applyPreset(breizh ? breizhParts()[0].preset : plan.lead.sound);   // le clavier joue le son du lead
  await prepareKickClips(state.tl.tracks, engine.ctx.sampleRate);
  await loadTlBuffers();
  timeline.updateAllTracks();
  renderAll();
  renderGen();
  renderKick();
  if (breizh) renderBreizh();
  // Zoom : le plus de morceau possible dans la timeline, depuis le début.
  const scroll = $('#tl-scroll');
  if (scroll?.clientWidth) { state.tl.zoom = Math.max(16, Math.min(64, (scroll.clientWidth - TL_HEAD - 24) / state.tl.bars)); scroll.scrollLeft = 0; }
  renderMarkers();
  renderTl();
  renderLibrary();
  save();
  const sec = Math.round(total * 60 / plan.bpm);
  const summary = { bars: total / BEATS_PER_BAR, blocks, markers: secs.length };
  toast(t('start.done', { style: plan.title ?? t(`start.style.${plan.style}`), bars: summary.bars, bpm: plan.bpm, min: Math.floor(sec / 60), sec: String(sec % 60).padStart(2, '0'), n: blocks }), 6000);
  return summary;
}
