// Nouveau morceau : styles (tempo, suite d'accords, kick, batterie, basse, accords, mélodie) et plans de morceau
// (parties et longueurs). Ce module ne fait que décrire et calculer : la fenêtre (js/app/start-ui.js) pose les blocs.

export const SECTION_TYPES = ['intro', 'build', 'drop', 'break', 'outro'];
export const START_PARTS = ['kick', 'drums', 'bass', 'chords', 'lead', 'buildups'];
export const SECTION_BARS = [4, 8, 16, 32];
export const MAX_SECTIONS = 16;

/**
 * Styles. kick : preset du designer de kick ; drums : kit (banque de la bibliothèque), charleston (off = contretemps,
 * 8 = croches, 16 = doubles croches), clap (24 = temps 2 et 4, 4 = temps 4), ride sur les temps ; bass : style du
 * générateur de basse, son et parties où elle joue (null : la queue du kick fait la basse) ; chords : son et rythme
 * du générateur ; lead : son, style et densité de la mélodie (breizh : l'air du Breizh generator).
 */
export const STYLES = {
  early: { bpm: 175, prog: 'Fm Eb Db C', kick: 'early', drums: { kit: 'early', hat: 'off', clap: '24' }, bass: null,
    chords: { preset: 'dark_strings', rhythm: 'hold' }, lead: { preset: 'early_hoover', style: 'riff', density: 'mid' } },
  gabber: { bpm: 185, prog: 'Fm Db Eb Cm', kick: 'rotterdam', drums: { kit: 'early', hat: 'off', clap: '4' }, bass: null,
    chords: { preset: 'dark_pad', rhythm: 'hold' }, lead: { preset: 'hoover', style: 'riff', density: 'mid' } },
  anthem: { bpm: 190, prog: 'Fm Db Ab Eb', kick: 'mainstream', drums: { kit: 'anthem', hat: 'off', clap: '24' }, bass: { style: 'sub', preset: 'sub_bass', in: ['break'] },
    chords: { preset: 'epic_strings', rhythm: 'hold' }, lead: { preset: 'hardstyle_lead', style: 'anthem', density: 'mid' } },
  frenchcore: { bpm: 200, prog: 'Fm Db Eb C', kick: 'frenchcore', drums: { kit: 'anthem', hat: 'off', clap: '24' }, bass: { style: 'offbeat', preset: 'bass', in: ['drop'] },
    chords: { preset: 'staccato_strings', rhythm: 'eighths' }, lead: { preset: 'screech', style: 'riff', density: 'mid' } },
  uptempo: { bpm: 210, prog: 'Fm Bbm Db C', kick: 'uptempo', drums: { kit: 'anthem', hat: '16', clap: '24' }, bass: null,
    chords: { preset: 'dark_choir', rhythm: 'hold' }, lead: { preset: 'screech', style: 'riff', density: 'high' } },
  industrial: { bpm: 160, prog: 'Fm Eb Db C', kick: 'industrial', drums: { kit: 'early', hat: '8', clap: '4', ride: true }, bass: null,
    chords: { preset: 'dark_pad', rhythm: 'hold' }, lead: { preset: 'alarm_lead', style: 'riff', density: 'low' } },
  terror: { bpm: 240, prog: 'Fm Db Eb C', kick: 'terror', drums: { kit: 'early', hat: '16', clap: null }, bass: null,
    chords: { preset: 'dark_strings', rhythm: 'hold' }, lead: { preset: 'screech', style: 'riff', density: 'high' } },
  happy: { bpm: 175, prog: 'Db Ab Eb Fm', kick: 'tr909', drums: { kit: 'anthem', hat: 'off', clap: '24' }, bass: { style: 'octave', preset: 'bass', in: ['drop'] },
    chords: { preset: 'rave_piano', rhythm: 'offbeat' }, lead: { preset: 'supersaw_uplift', style: 'anthem', density: 'high' } },
  rave: { bpm: 145, prog: 'Fm Eb Db Eb', kick: 'tr909', drums: { kit: 'early', hat: 'off', clap: '24' }, bass: { style: 'walk', preset: 'reese', in: ['drop'] },
    chords: { preset: 'belgian', rhythm: 'offbeat' }, lead: { preset: 'mentasm', style: 'riff', density: 'mid' } },
  hardstyle: { bpm: 150, prog: 'Fm Db Ab Eb', kick: 'raw', drums: { kit: 'anthem', hat: 'off', clap: '24' }, bass: { style: 'reverse', preset: 'bass', in: ['drop'] },
    chords: { preset: 'supersaw_pad', rhythm: 'hold' }, lead: { preset: 'hardstyle_lead', style: 'anthem', density: 'mid' } },
  breizhcore: { bpm: 190, prog: 'Fm Eb Db C', kick: 'mainstream', drums: { kit: 'anthem', hat: 'off', clap: '24' }, bass: { style: 'offbeat', preset: 'bass', in: ['drop'] },
    chords: { preset: 'epic_strings', rhythm: 'hold' }, lead: { breizh: true, density: 'mid' } },
};
export const STYLE_IDS = Object.keys(STYLES);

// Sons des kits de batterie : banque de la bibliothèque et nom des pads.
export const DRUM_KITS = {
  anthem: { bank: 'Anthem drums', clap: 'Clap', hat: 'Closed hat', off: 'Open hat', ride: 'Ride', crash: 'Crash' },
  early: { bank: 'Early hardcore', clap: 'Hall clap', hat: 'Tight hat', off: 'Offbeat hat', ride: 'Hall ride', crash: 'Hall crash' },
};

// Plans de départ : [type, mesures].
export const PLANS = {
  club: [['intro', 16], ['build', 16], ['drop', 32], ['break', 32], ['build', 16], ['drop', 32], ['outro', 16]],
  short: [['intro', 8], ['drop', 16], ['break', 16], ['build', 8], ['drop', 16]],
  dj: [['intro', 32], ['build', 16], ['drop', 32], ['break', 32], ['build', 16], ['drop', 32], ['outro', 32]],
};
export const PLAN_IDS = Object.keys(PLANS);

// Ce qui joue dans chaque partie (la basse suit son style : bass.in).
const PLAYS = {
  kick: ['intro', 'drop', 'outro'],
  drums: ['intro', 'drop', 'outro'],
  chords: ['build', 'drop', 'break'],
  lead: ['drop', 'break'],
};
export const plays = (part, type, style) => (part === 'bass' ? !!style.bass?.in.includes(type) : !!PLAYS[part]?.includes(type));

export const defaultStart = () => ({ style: 'anthem', bpm: STYLES.anthem.bpm, prog: STYLES.anthem.prog, plan: 'club', sections: PLANS.club.map(([type, bars]) => ({ type, bars })),
  parts: Object.fromEntries(START_PARTS.map(p => [p, true])) });

export function mergeStart(saved) {
  const s = defaultStart();
  if (!saved || typeof saved !== 'object') return s;
  if (saved.style in STYLES) Object.assign(s, { style: saved.style, bpm: STYLES[saved.style].bpm, prog: STYLES[saved.style].prog });
  if (Number.isFinite(saved.bpm) && saved.bpm >= 40 && saved.bpm <= 240) s.bpm = Math.round(saved.bpm);
  if (typeof saved.prog === 'string' && saved.prog.trim()) s.prog = saved.prog.slice(0, 80);
  if (saved.plan in PLANS) s.plan = saved.plan;
  const secs = Array.isArray(saved.sections) ? saved.sections.filter(x => SECTION_TYPES.includes(x?.type) && SECTION_BARS.includes(x.bars)).slice(0, MAX_SECTIONS) : [];
  if (secs.length) s.sections = secs.map(x => ({ type: x.type, bars: x.bars }));
  for (const p of START_PARTS) if (typeof saved.parts?.[p] === 'boolean') s.parts[p] = saved.parts[p];
  return s;
}

/** Parties placées : [{ type, bars, start, len, n }] (temps), n = numéro de la partie de ce type (1, 2…). */
export function layoutSections(sections, beatsPerBar = 4) {
  const count = {};
  let at = 0;
  return sections.map(s => {
    const out = { type: s.type, bars: s.bars, start: at, len: s.bars * beatsPerBar, n: (count[s.type] = (count[s.type] ?? 0) + 1) };
    at += out.len;
    return out;
  });
}

/** Coups de batterie d'une partie de `beats` temps : [{ t, sound }] (sound : clap, hat, off, ride, crash). */
export function drumHits(drums, beats, crash = false) {
  const hits = [];
  if (crash) hits.push({ t: 0, sound: 'crash' });
  for (let b = 0; b < beats; b++) {
    if (drums.hat === 'off') hits.push({ t: b + 0.5, sound: 'off' });
    else if (drums.hat === '8') hits.push({ t: b + 0.5, sound: 'hat' });
    else if (drums.hat === '16') for (const o of [0.25, 0.5, 0.75]) hits.push({ t: b + o, sound: 'hat' });
    if ((drums.clap === '24' && b % 2 === 1) || (drums.clap === '4' && b % 4 === 3)) hits.push({ t: b, sound: 'clap' });
    if (drums.ride) hits.push({ t: b, sound: 'ride' });
  }
  return hits.sort((a, b) => a.t - b.t);
}

/**
 * Mélodie de kick d'un passage de la suite (un kick par temps) : la fondamentale de chaque accord, au plus près de la
 * note de la queue du kick. -> [{ t, len, note, vel }]
 */
export function kickLine(chords, beatsPerChord, tailNote) {
  const near = pc => tailNote + ((pc - tailNote) % 12 + 18) % 12 - 6;
  const len = Math.max(1, chords.length) * beatsPerChord;
  return Array.from({ length: len }, (_, b) => ({
    t: b, len: 1, note: chords.length ? near(chords[Math.floor(b / beatsPerChord) % chords.length].root) : tailNote, vel: b % 4 === 0 ? 1 : 0.9,
  }));
}
