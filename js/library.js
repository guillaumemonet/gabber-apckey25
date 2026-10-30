// Bibliothèque de sons : tous les sons disponibles (banques, kit de départ, sons importés, enregistrements de la
// timeline) rangés en arbre famille › type › sons (catalogue sounds/library.json, tenu par tools/catalog.py), prêts à
// glisser sur la timeline, un pad, une platine, le lanceur ou le découpeur. `cat` reste la catégorie de mixage du son
// (sidechain, couleur des blocs).
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

// ---- Arbre : familles › types (noms anglais dans les deux langues, comme les bibliothèques de sons du métier) ----

// Familles du catalogue (l'ordre et les types viennent de sounds/library.json : `tree`), puis les sons de l'utilisateur.
export const MY_SOUNDS = 'My Sounds';
export const RECORDINGS = 'Recordings';
// Couleur d'une famille = celle de sa catégorie de mixage.
const FAMILY_CAT = { Drums: 'drums', Bass: 'bass', Leads: 'lead', Keys: 'keys', 'Pads & Strings': 'pad', Vocals: 'voice', FX: 'fx', Guitars: 'guitar',
  [MY_SOUNDS]: 'mine', [RECORDINGS]: 'rec' };
export const familyColor = family => catColor(FAMILY_CAT[family] ?? 'drums');
// Place dans l'arbre d'un son sans entrée au catalogue (kit de départ, son importé) d'après sa catégorie de mixage.
const CAT_PLACE = { kick: ['Drums', 'Kicks'], drums: ['Drums', 'Percussion'], bass: ['Bass', 'Synth Bass'], lead: ['Leads', 'Synth Leads'],
  keys: ['Keys', 'Stabs'], pad: ['Pads & Strings', 'Pads'], voice: ['Vocals', 'Vocal FX'], fx: ['FX', 'Bleeps'], guitar: ['Guitars', 'Riffs'] };
// Types de « My Sounds » : la catégorie du son (un kick du designer, une boucle importée…).
const MINE_TYPE = { kick: 'Kicks', drums: 'Drums', bass: 'Bass', lead: 'Leads', keys: 'Keys', pad: 'Pads & Strings', voice: 'Vocals', fx: 'FX', guitar: 'Guitars', mine: 'Imports' };

/** Familles et types à afficher : [{ family, types: [type] }] (celles du catalogue, puis les sons de l'utilisateur). */
export function libraryTree(manifest, items) {
  const tree = Object.entries(manifest?.catalog?.tree ?? {}).map(([family, types]) => ({ family, types: [...types] }));
  for (const item of items) {
    let node = tree.find(n => n.family === item.family);
    if (!node) tree.push(node = { family: item.family, types: [] });
    if (!node.types.includes(item.type)) node.types.push(item.type);
  }
  const rank = f => (f === RECORDINGS ? 2 : f === MY_SOUNDS ? 1 : 0);
  return tree.sort((a, b) => rank(a.family) - rank(b.family));
}

// Construit la liste des sons : { sampleId, name, cat, family, type, note, tags, bpm, bars, loop }.
// Les sons du catalogue qui ne sont dans aucune banque (ils portent leur nom, leur tempo et leurs mesures) passent en tête :
// ce sont les plus récents ; on les charge par glisser-déposer ou « Charger dans… ».
// userSounds : sons créés dans l'application (designer de kick, imports) : { sampleId, name, cat }.
// Les anciens sons (banques archivées, kit de départ) ne sont montrés que s'ils sont dans une banque de pads : la
// bibliothèque contient tout ce que jouent les banques. Les nouvelles banques passent en tête de chaque type.
export function libraryItems({ manifest, kit, banks, tl, userSounds = [] }) {
  const items = new Map();
  const inBanks = new Set(banks.flat().map(p => p?.sampleId).filter(Boolean));
  const add = item => { if (!items.has(item.sampleId) && (!item.archive || inBanks.has(item.sampleId))) items.set(item.sampleId, item); };
  const place = (cat, fallback) => fallback ?? { family: CAT_PLACE[cat]?.[0] ?? 'FX', type: CAT_PLACE[cat]?.[1] ?? 'Bleeps' };
  const rank = b => (b.external ? 0 : b.archive ? 2 : 1);
  const catalog = manifest?.catalog?.byFile;
  const inManifest = new Set((manifest?.banks ?? []).flatMap(b => b.pads.filter(Boolean).map(p => p.file)));
  for (const s of catalog?.values() ?? []) {
    if (!s.name || inManifest.has(s.file)) continue;
    const cat = s.cat ?? (s.type === 'Kicks' ? 'kick' : FAMILY_CAT[s.family] ?? 'fx');
    add({ sampleId: `lib:${s.file}`, name: soundName(s.name), cat, family: s.family, type: s.type, note: s.note ?? '', tags: s.tags ?? [],
      bpm: s.bpm || 0, bars: s.bars || 0, loop: !!s.loop });
  }
  for (const bank of [...(manifest?.banks ?? [])].sort((a, b) => rank(a) - rank(b))) {
    for (const p of bank.pads) {
      if (!p) continue;
      const cat = p.cat ?? guessCat(p.name);
      const entry = catalog?.get(p.file);
      add({ sampleId: `lib:${p.file}`, name: soundName(p.name), cat, ...place(cat, entry && { family: entry.family, type: entry.type }),
        note: entry?.note ?? '', tags: entry?.tags ?? [], bpm: p.bpm || 0, bars: p.bars || 0, loop: p.mode === 2, archive: !!bank.archive && cat !== 'voice' });
    }
  }
  kit?.forEach((s, i) => { const cat = guessCat(s.name); add({ sampleId: `builtin:${i}`, name: soundName(s.name), cat, ...place(cat), tags: [], bpm: 0, bars: 0, loop: false, archive: true }); });
  // Sons perso : un kick du designer (coup), ou une boucle importée avec son tempo et sa longueur en mesures.
  for (const s of userSounds) add({ sampleId: s.sampleId, name: s.name, cat: s.cat, family: MY_SOUNDS, type: MINE_TYPE[s.cat] ?? 'Imports', tags: [], bpm: s.bpm || 0, bars: s.bars || 0, loop: !!s.loop, own: true });
  for (const pad of banks.flat()) {
    if (!pad?.sampleId?.startsWith('user:')) continue;
    add({ sampleId: pad.sampleId, name: pad.name, cat: 'mine', family: MY_SOUNDS, type: 'Imports', tags: [], bpm: pad.bpm || 0, bars: 0, loop: !!pad.bpm });
  }
  for (const clip of tl.tracks.flatMap(tr => tr.clips)) {
    if (clip.sampleId?.startsWith('rec:')) add({ sampleId: clip.sampleId, name: clip.name, cat: 'rec', family: RECORDINGS, type: 'Takes', tags: [], bpm: 0, bars: 0, loop: false });
  }
  return [...items.values()];
}

// Classe de hauteur (0 = do) d'une note du catalogue (« F », « G# », « Db », « Fm », « Gdim »…), ou null.
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteClass(note) {
  const m = /^([A-G])([#b]?)/.exec(note ?? '');
  return m ? (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12 : null;
}

/** Catalogue lu (sounds/library.json) -> { tree, byFile: Map(fichier -> entrée) }. */
export const readCatalog = json => ({ tree: json?.tree ?? {}, byFile: new Map((json?.sounds ?? []).map(s => [s.file, s])) });
