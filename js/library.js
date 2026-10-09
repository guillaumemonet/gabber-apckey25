// Bibliothèque de sons façon eJay : tous les sons disponibles (banques, kit de départ, sons importés,
// enregistrements de la timeline) rangés par catégorie, prêts à glisser sur la timeline.
import { soundName } from './i18n.js';

// Couleurs = indices de la palette LED (ramenées aux 3 couleurs du mk1 à l'affichage si besoin).
export const LIB_CATS = [
  { id: 'kick', color: 5 },
  { id: 'drums', color: 9 },
  { id: 'bass', color: 41 },
  { id: 'lead', color: 49 },
  { id: 'keys', color: 57 },
  { id: 'pad', color: 37 },
  { id: 'voice', color: 13 },
  { id: 'fx', color: 3 },
  { id: 'guitar', color: 108 },
  { id: 'mine', color: 21 },
  { id: 'rec', color: 53 },
];
export const catColor = cat => (LIB_CATS.find(c => c.id === cat) ?? LIB_CATS[1]).color;

// Catégorie d'un son sans étiquette (kit de départ, anciens sons) d'après son nom.
export function guessCat(name = '') {
  const n = name.toLowerCase();
  const has = (...w) => w.some(x => n.includes(x));
  if (has('guitar', 'guitare')) return 'guitar';
  if (has('kick', '808', 'bd ', 'doef', 'rotterdam', 'terror')) return 'kick';
  if (has('bass', 'basse', 'reese')) return 'bass';
  if (has('hoover', 'screech', 'acid', 'lead', 'bell', 'cloche', 'arp')) return 'lead';
  if (has('stab', 'piano', 'chord', 'cm', 'fm', 'd#', 'g#', 'a#')) return 'keys';
  if (has('string', 'cordes', 'pad', 'nappe', 'drone')) return 'pad';
  if (has('choir', 'chœur', 'vox', 'voix')) return 'voice';
  if (has('riser', 'montée', 'zap', 'laser', 'siren', 'sirène', 'impact', 'fx', 'noise')) return 'fx';
  return 'drums';
}

// Archives : les anciennes banques (banks.json : archive) et le kit de départ, masqués par défaut ;
// leurs voix restent visibles (les cris : les nouvelles banques n'en ont pas).
const ALWAYS_SHOWN = new Set(['voice']);

// Construit la liste des sons : { sampleId, name, cat, bpm, bars, loop }.
// userSounds : sons créés dans l'application (designer de kick) : { sampleId, name, cat }.
// archives : montrer aussi les sons archivés. Les nouvelles banques passent en tête de chaque catégorie.
export function libraryItems({ manifest, kit, banks, tl, userSounds = [], archives = false }) {
  const items = new Map();
  const add = item => { if (!items.has(item.sampleId) && (archives || !item.archive)) items.set(item.sampleId, item); };
  const rank = b => (b.external ? 0 : b.archive ? 2 : 1);
  for (const bank of [...(manifest?.banks ?? [])].sort((a, b) => rank(a) - rank(b))) {
    for (const p of bank.pads) {
      if (!p) continue;
      const cat = p.cat ?? guessCat(p.name);
      add({ sampleId: `lib:${p.file}`, name: soundName(p.name), cat, bpm: p.bpm || 0, bars: p.bars || 0, loop: p.mode === 2, archive: !!bank.archive && !ALWAYS_SHOWN.has(cat) });
    }
  }
  kit?.forEach((s, i) => add({ sampleId: `builtin:${i}`, name: soundName(s.name), cat: guessCat(s.name), bpm: 0, bars: 0, loop: false, archive: true }));
  // Sons perso : un kick du designer (coup), ou une boucle importée avec son tempo et sa longueur en mesures.
  for (const s of userSounds) add({ sampleId: s.sampleId, name: s.name, cat: s.cat, bpm: s.bpm || 0, bars: s.bars || 0, loop: !!s.loop, own: true });
  for (const pad of banks.flat()) {
    if (!pad?.sampleId?.startsWith('user:')) continue;
    add({ sampleId: pad.sampleId, name: pad.name, cat: 'mine', bpm: pad.bpm || 0, bars: 0, loop: !!pad.bpm });
  }
  for (const clip of tl.tracks.flatMap(tr => tr.clips)) {
    if (clip.sampleId?.startsWith('rec:')) add({ sampleId: clip.sampleId, name: clip.name, cat: 'rec', bpm: 0, bars: 0, loop: false });
  }
  return [...items.values()];
}
