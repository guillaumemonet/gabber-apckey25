// Plan de morceau : la description complète d'un morceau à construire (tempo, suite d'accords, kick, batterie, basse,
// accords, mélodie, parties et ce qui joue dans chacune). Nouveau morceau en fabrique un à partir du style choisi.
// cleanPlan() vérifie tout ce qui arrive (valeurs connues, bornes, longueurs) : seul un plan nettoyé est construit
// (js/app/compose.js). Ce module ne touche pas à l'état.
import { BASS_OCTAVES, BASS_STYLES } from './bassline.js';
import { parseProgression } from './chords.js';
import { KICK_PARAMS, KICK_PRESETS } from './kickdesign.js';
import { LEAD_DENSITIES, LEAD_REGISTERS, LEAD_STYLES } from './melody.js';
import { OSC_PRESETS, OSC_PRESET_CAT } from './osc.js';
import { PRESETS } from './presets.js';
import { DRUM_KITS, SECTION_TYPES, STYLES, plays, styleBass } from './songstart.js';

export const PLAN_VERSION = 1;
export const PLAN_PARTS = ['kick', 'drums', 'bass', 'chords', 'lead'];
export const PLAN_LIMITS = { sections: 32, bars: [1, 64], totalBars: 512, bpm: [40, 240], notes: 512, phraseBeats: 64, name: 32, prog: 80 };
export const CHORD_REGISTERS = ['low', 'mid', 'high'];
export const CHORD_RHYTHMS = ['hold', 'beats', 'offbeat', 'eighths'];
export const DRUM_HATS = ['off', '8', '16', 'none'];
export const DRUM_CLAPS = ['24', '4', 'none'];
export const LEAD_MOODS = ['full', 'calm'];
export const BASS_OSC = OSC_PRESETS.filter(p => OSC_PRESET_CAT[p.id] === 'bass').map(p => `osc:${p.id}`);

const SYNTH_IDS = PRESETS.map(p => p.id).filter(id => id !== 'init');
const isSynth = v => SYNTH_IDS.includes(v);
const isBass = v => isSynth(v) || BASS_OSC.includes(v);
const int = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Plan de la fenêtre Nouveau morceau (state.start) : le style choisi, ses parties cochées et son plan. */
export function planFromStart(st) {
  const sty = STYLES[st.style] ?? STYLES.anthem, bass = styleBass(sty);
  const on = p => st.parts[p] !== false;
  return {
    version: PLAN_VERSION, style: st.style, bpm: st.bpm, prog: st.prog,
    kick: { preset: sty.kick },
    drums: { ...sty.drums, hat: sty.drums.hat ?? 'none', clap: sty.drums.clap ?? 'none', ride: !!sty.drums.ride },
    bass: { style: bass.style, sound: bass.preset, octave: 'low' },
    chords: { sound: sty.chords.preset, rhythm: sty.chords.rhythm, register: 'mid' },
    lead: sty.lead.breizh ? { breizh: true } : { sound: sty.lead.preset, style: sty.lead.style, density: sty.lead.density, register: 'high' },
    buildups: on('buildups'),
    sections: st.sections.map(s => ({ type: s.type, bars: s.bars, play: PLAN_PARTS.filter(p => on(p) && plays(p, s.type, sty)) })),
  };
}

/**
 * Plan nettoyé : tout ce qui manque ou n'est pas reconnu prend la valeur du style (anthem par défaut), avec un
 * avertissement. opts.isSound / opts.isBassSound : sons acceptés en plus (presets personnels). -> { plan, warnings }
 * (plan = null si rien n'est utilisable : pas de partie, ou aucune suite d'accords reconnue).
 */
export function cleanPlan(raw, opts = {}) {
  const warnings = [];
  const warn = (path, value) => warnings.push(`${path}: ${JSON.stringify(value)?.slice(0, 40)}`);
  if (!raw || typeof raw !== 'object') return { plan: null, warnings: ['plan: not an object'] };
  const styleId = raw.style in STYLES ? raw.style : 'anthem';
  if (raw.style !== undefined && styleId !== raw.style) warn('style', raw.style);
  const sty = STYLES[styleId], base = planFromStart({ style: styleId, bpm: sty.bpm, prog: sty.prog, parts: {}, sections: [] });
  const okSound = v => isSynth(v) || !!opts.isSound?.(v);
  const okBass = v => isBass(v) || !!opts.isBassSound?.(v);
  const pick = (path, v, ok, def) => {
    if (v === undefined || v === null) return def;
    if (ok(v)) return v;
    warn(path, v);
    return def;
  };
  const inList = list => v => list.includes(v);

  const plan = { version: PLAN_VERSION, style: styleId };
  const title = str(raw.title, PLAN_LIMITS.name);
  if (title) plan.title = title;
  plan.bpm = int(raw.bpm, ...PLAN_LIMITS.bpm) ?? base.bpm;
  if (raw.bpm !== undefined && plan.bpm !== raw.bpm) warn('bpm', raw.bpm);
  const progOk = v => typeof v === 'string' && parseProgression(v.slice(0, PLAN_LIMITS.prog)).chords.length > 0;
  plan.prog = pick('prog', raw.prog, progOk, base.prog).slice(0, PLAN_LIMITS.prog);

  const k = raw.kick && typeof raw.kick === 'object' ? raw.kick : {};
  plan.kick = { preset: pick('kick.preset', k.preset, v => v in KICK_PRESETS, base.kick.preset) };
  if (k.params && typeof k.params === 'object') {
    const params = {};
    for (const [id, v] of Object.entries(k.params)) {
      if (KICK_PARAMS.includes(id) && Number.isFinite(v)) params[id] = Math.min(1, Math.max(0, v));
      else warn(`kick.params.${id}`, v);
    }
    if (Object.keys(params).length) plan.kick.params = params;
  }

  const d = raw.drums && typeof raw.drums === 'object' ? raw.drums : {};
  plan.drums = {
    kit: pick('drums.kit', d.kit, v => v in DRUM_KITS, base.drums.kit),
    hat: pick('drums.hat', d.hat, inList(DRUM_HATS), base.drums.hat),
    clap: pick('drums.clap', d.clap, inList(DRUM_CLAPS), base.drums.clap),
    ride: typeof d.ride === 'boolean' ? d.ride : base.drums.ride,
  };

  const b = raw.bass && typeof raw.bass === 'object' ? raw.bass : {};
  plan.bass = {
    style: pick('bass.style', b.style, inList(BASS_STYLES), base.bass.style),
    sound: pick('bass.sound', b.sound, okBass, base.bass.sound),
    octave: pick('bass.octave', b.octave, v => v in BASS_OCTAVES, 'low'),
  };
  if (Number.isInteger(b.seed) && b.seed > 0) plan.bass.seed = b.seed;

  const c = raw.chords && typeof raw.chords === 'object' ? raw.chords : {};
  plan.chords = {
    sound: pick('chords.sound', c.sound, okSound, base.chords.sound),
    rhythm: pick('chords.rhythm', c.rhythm, inList(CHORD_RHYTHMS), base.chords.rhythm),
    register: pick('chords.register', c.register, inList(CHORD_REGISTERS), 'mid'),
  };

  const l = raw.lead && typeof raw.lead === 'object' ? raw.lead : {};
  if (l.breizh === true || (base.lead.breizh && l.sound === undefined && l.notes === undefined)) plan.lead = { breizh: true };
  else {
    const bl = base.lead.breizh ? planFromStart({ style: 'anthem', bpm: 0, prog: '', parts: {}, sections: [] }).lead : base.lead;
    plan.lead = {
      sound: pick('lead.sound', l.sound, okSound, bl.sound),
      style: pick('lead.style', l.style, inList(LEAD_STYLES), bl.style),
      density: pick('lead.density', l.density, inList(LEAD_DENSITIES), bl.density),
      register: pick('lead.register', l.register, v => v in LEAD_REGISTERS, 'high'),
    };
    if (Number.isInteger(l.seed) && l.seed > 0) plan.lead.seed = l.seed;
    if (l.notes !== undefined) {
      const notes = cleanNotes(l.notes);
      if (notes.length) plan.lead.notes = notes;
      else warn('lead.notes', '[]');
    }
  }

  plan.buildups = typeof raw.buildups === 'boolean' ? raw.buildups : true;

  const secs = Array.isArray(raw.sections) ? raw.sections : [];
  if (secs.length > PLAN_LIMITS.sections) warn('sections', secs.length);
  plan.sections = [];
  let total = 0;
  for (const [i, s] of secs.slice(0, PLAN_LIMITS.sections).entries()) {
    if (!s || !SECTION_TYPES.includes(s.type)) { warn(`sections.${i}.type`, s?.type); continue; }
    const bars = int(s.bars, ...PLAN_LIMITS.bars);
    if (!bars) { warn(`sections.${i}.bars`, s.bars); continue; }
    if (total + bars > PLAN_LIMITS.totalBars) { warn(`sections.${i}`, 'too long'); break; }
    total += bars;
    const out = { type: s.type, bars };
    const play = Array.isArray(s.play) ? s.play.filter(p => PLAN_PARTS.includes(p)) : PLAN_PARTS.filter(p => plays(p, s.type, sty));
    if (Array.isArray(s.play) && play.length !== s.play.length) warn(`sections.${i}.play`, s.play);
    out.play = [...new Set(play)];
    const name = str(s.name, PLAN_LIMITS.name);
    if (name) out.name = name;
    if (s.prog !== undefined) {
      if (progOk(s.prog)) out.prog = s.prog.slice(0, PLAN_LIMITS.prog);
      else warn(`sections.${i}.prog`, s.prog);
    }
    out.lead = pick(`sections.${i}.lead`, s.lead, inList(LEAD_MOODS), s.type === 'break' ? 'calm' : 'full');
    plan.sections.push(out);
  }
  if (!plan.sections.length) return { plan: null, warnings: [...warnings, 'sections: none'] };
  return { plan, warnings };
}

/** Notes d'une phrase (temps depuis son début) : valides, triées, bornées. */
export function cleanNotes(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, PLAN_LIMITS.notes)
    .filter(n => [n?.t, n?.len, n?.note].every(Number.isFinite) && n.t >= 0 && n.t < PLAN_LIMITS.phraseBeats && n.len > 0 && n.note >= 24 && n.note <= 108)
    .map(n => ({ t: Math.round(n.t * 96) / 96, len: Math.min(16, Math.max(1 / 16, n.len)), note: Math.round(n.note), vel: Number.isFinite(n.vel) ? Math.min(1, Math.max(0.1, n.vel)) : 0.85 }))
    .sort((a, b) => a.t - b.t || a.note - b.note);
}

/** Version calme d'une phrase (les breaks) : les notes sur les temps, un peu moins fort. */
export const calmNotes = seq => {
  const on = seq.filter(n => Math.abs(n.t - Math.round(n.t)) < 1e-6);
  return (on.length >= 2 ? on : seq).map(n => ({ ...n, vel: Math.max(0.1, n.vel * 0.85) }));
};
