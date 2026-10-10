// Sauvegarde dans le navigateur, restauration au démarrage, import des banques de la bibliothèque.
import { mergeAcidState } from '../acid.js';
import { mergeMasterState } from '../audio.js';
import { cleanCurve } from '../curves.js';
import { mergeDecksState } from '../decks.js';
import { soundName, t } from '../i18n.js';
import { mergeKickState } from '../kickdesign.js';
import { mergeMetroState } from '../metronome.js';
import { mergeMixState } from '../mixer.js';
import { mergeOscState } from '../osc.js';
import { PAGES, defaultPositions } from '../params.js';
import { mergePatch } from '../patch.js';
import { mergePlayState } from '../performer.js';
import { FAMILIES, PRESETS, migratePreset, presetById } from '../presets.js';
import { mergeScState } from '../sidechain.js';
import * as store from '../storage.js';
import { mergeTlState } from '../timeline.js';
import { mergeTrState } from '../tr909.js';
import { mergeWindows } from '../windows.js';
import { $, BANKS, kit, newPad, setLibAdded, state, tlHistory } from './core.js';
import { PAD_QUANTS } from './files.js';
import { defaultGen, mergeGen } from './gen.js';
import { libManifest, setLibManifest } from './library-ui.js';
import { mergeRoll } from './roll-ui.js';
import { mergeScenes } from './scenes.js';
import { tlRec } from './tl.js';
import { loadPad, padsInUse } from './sounds.js';
import { mergeViz } from './viz-ui.js';

// ---------- Sauvegarde ----------

export async function restore() {
  const saved = await store.loadState().catch(() => null);
  const firstRun = !saved;
  state.gen = defaultGen();
  state.viz = mergeViz(saved?.viz);
  state.banks = Array.from({ length: BANKS }, () => new Array(40).fill(null));
  if (!saved) {
    kit.forEach((s, i) => { state.banks[0][i] = newPad(soundName(s.name), s.color, `builtin:${i}`, s.buffer); });
  } else {
    Object.assign(state.globals, saved.globals);
    state.bank = Math.min(saved.bank ?? 0, BANKS - 1);
    state.page = saved.page ?? 'synth';
    state.bpm = Number.isFinite(saved.bpm) ? saved.bpm : 190;
    state.preset = migratePreset(saved.preset);
    // Anciennes sauvegardes : les 5 premières banques de la bibliothèque étaient déjà importées.
    state.libBanks = saved.libBanks ?? (saved.libImported ? ['Batterie', 'Électro', 'Boucles', 'Textures', 'Tabla & divers'] : []);
    state.model = saved.model ?? null;
    state.tr = mergeTrState(saved.tr);
    state.mix = mergeMixState(saved.mix);
    state.windows = mergeWindows(saved.windows);
    state.tl = mergeTlState(saved.tl);
    state.scenes = mergeScenes(saved.scenes);
    state.play = mergePlayState(saved.play);
    state.gen = mergeGen(saved.gen);
    state.sc = mergeScState(saved.sc);
    state.acid = mergeAcidState(saved.acid);
    state.kick = mergeKickState(saved.kick);
    state.decks = mergeDecksState(saved.decks);
    state.patch = mergePatch(saved.patch);
    state.roll = mergeRoll(saved.roll);
    state.osc = mergeOscState(saved.osc);
    state.synthUser = Array.isArray(saved.synthUser) ? saved.synthUser.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && typeof u.name === 'string' && u.values && PRESETS.some(p => p.id === u.base))
      .map(u => ({ id: u.id, name: u.name.slice(0, 24), cat: FAMILIES.includes(u.cat) ? u.cat : presetById(u.base).family, base: u.base, values: u.values })) : [];
    state.synthPick = state.synthUser.some(u => u.id === saved.synthPick) ? saved.synthPick : null;
    state.synthDirty = !!saved.synthDirty;
    state.keys = saved.keys === 'osc' ? 'osc' : 'synth';
    state.metro = mergeMetroState(saved.metro);
    state.master = mergeMasterState(saved.master);
    state.padQuant = PAD_QUANTS.includes(saved.padQuant) ? saved.padQuant : 0;
    state.libArchives = !!saved.libArchives;
    state.curves = (Array.isArray(saved.curves) ? saved.curves : []).map(cleanCurve).filter(c => c?.id?.startsWith('u:'));
    state.userSounds = Array.isArray(saved.userSounds) ? saved.userSounds.filter(s => typeof s?.sampleId === 'string' && s.sampleId.startsWith('user:')) : [];
    for (let b = 0; b < BANKS; b++) {
      for (let i = 0; i < 40; i++) {
        const s = saved.banks?.[b]?.[i];
        if (!s) continue;
        const pad = { bpm: 0, ...s, p: { ...defaultPositions('pad'), ...s.p }, buffer: null };
        state.banks[b][i] = pad;
        if (s.sampleId?.startsWith('builtin:')) pad.buffer = kit[+s.sampleId.slice(8)]?.buffer ?? null;
      }
    }
  }
  const added = await importLibrary();
  refreshLibNames();
  setLibAdded(firstRun ? [] : added);   // au premier lancement, tout est nouveau : pas de message

  // Sons décodés tout de suite : la banque affichée et les pads joués par la timeline ou les scènes.
  // Les autres banques se chargent quand on les affiche (js/app/sounds.js).
  const pending = [...new Set([...state.banks[state.bank], ...padsInUse()])].filter(p => p && !p.buffer);
  let done = 0;
  await Promise.all(pending.map(pad => loadPad(pad).then(() => {
    $('#start-msg').textContent = t('start.loading', { done: ++done, total: pending.length });
  })));
}

export function refreshLibNames() {
  if (!libManifest) return;
  const byId = new Map(libManifest.banks.flatMap(b => b.pads.filter(Boolean).map(p => [`lib:${p.file}`, p])));
  for (const pad of state.banks.flat()) {
    const p = pad && byId.get(pad.sampleId);
    if (p) { pad.name = soundName(p.name); pad.bpm = p.bpm || 0; }
  }
  for (const clip of state.tl.tracks.flatMap(tr => tr.clips)) {
    const p = byId.get(clip.sampleId);
    if (p) { clip.name = soundName(p.name); clip.cat = p.cat; if (clip.bpm) clip.bpm = p.bpm || clip.bpm; }
  }
}

// Ajoute les banques de la bibliothèque (tools/build_banks.py) qui ne sont encore nulle part.
// Une banque va à son emplacement prévu s'il est vide, sinon dans la première banque vide.
// Renvoie la liste des banques ajoutées : [{ name, bank }].
export async function importLibrary() {
  const lib = await fetch('sounds/banks.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!lib) return [];
  setLibManifest(lib);   // sert aussi à la bibliothèque de sons
  const modeDef = PAGES.pad.params[7];
  const added = [];
  lib.banks.forEach((bank, k) => {
    const folder = `lib:${bank.pads.find(Boolean)?.file.split('/')[0]}/`;
    const present = state.banks.some(bk => bk.some(p => p?.sampleId?.startsWith(folder)));
    if (present) {
      if (!state.libBanks.includes(bank.name)) state.libBanks.push(bank.name);
      return;
    }
    if (state.libBanks.includes(bank.name)) return;
    const isFree = b => b > 0 && b < BANKS && !state.banks[b].some(Boolean);
    const slot = isFree(k + 1) ? k + 1 : state.banks.findIndex((_, b) => isFree(b));
    if (slot < 0) return;   // aucune banque libre : réessayé au prochain démarrage
    bank.pads.forEach((s, i) => {
      if (!s) return;
      const pad = newPad(soundName(s.name), s.color, `lib:${s.file}`, null, s.bpm || 0);
      pad.p.mode = s.mode / (modeDef.steps - 1);
      state.banks[slot][i] = pad;
    });
    if (!state.libBanks.includes(bank.name)) state.libBanks.push(bank.name);
    added.push({ name: bank.name, bank: slot + 1 });
  });
  // (le tempo du projet n'est jamais changé par l'import : un nouveau projet part à 190, une sauvegarde garde le sien)
  return added;
}

export let saveTimer;
// État enregistré (dans le navigateur, et dans un fichier projet).
export function stateSnapshot() {
  return {
    bank: state.bank,
    page: state.page,
    bpm: state.bpm,
    preset: state.preset,
    libBanks: state.libBanks,
    model: state.model,
    globals: state.globals,
    tr: state.tr,
    mix: state.mix,
    windows: state.windows,
    tl: state.tl,
    scenes: state.scenes,
    play: state.play,
    gen: state.gen,
    sc: state.sc,
    acid: state.acid,
    kick: state.kick,
    decks: state.decks,
    patch: state.patch,
    userSounds: state.userSounds,
    curves: state.curves,
    padQuant: state.padQuant,
    libArchives: state.libArchives,
    roll: state.roll,
    osc: state.osc,
    synthUser: state.synthUser,
    synthPick: state.synthPick,
    synthDirty: state.synthDirty,
    keys: state.keys,
    viz: state.viz,
    metro: state.metro,
    master: state.master,
    banks: state.banks.map(bank => bank.map(p => p && { name: p.name, color: p.color, sampleId: p.sampleId, bpm: p.bpm, p: p.p })),
  };
}

export let projectLoading = false;   // un projet ouvert remplace tout : plus rien n'est enregistré avant le redémarrage
export function save() {
  if (projectLoading) return;
  if (!tlRec) tlHistory?.commit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.saveState(stateSnapshot()).catch(err => console.warn('Save failed', err));
  }, 400);
}

// Variables modifiées depuis d'autres modules.
export function setProjectLoading(v) { return (projectLoading = v); }
