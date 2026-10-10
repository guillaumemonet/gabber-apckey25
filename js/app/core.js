// Socle partagé : état de l'application (state), moteurs créés au démarrage, constantes et petits utilitaires.
import { defaultAcidState } from '../acid.js';
import { defaultMasterState } from '../audio.js';
import { MK1_PICKER_COLORS, PICKER_COLORS, mk1Equivalent } from '../apc.js';
import { defaultDecksState } from '../decks.js';
import { translatePage } from '../i18n.js';
import { defaultKickState } from '../kickdesign.js';
import { defaultMetroState } from '../metronome.js';
import { MIX_FIELDS, defaultMixState } from '../mixer.js';
import { defaultOscState } from '../osc.js';
import { defaultPositions } from '../params.js';
import { defaultPatch } from '../patch.js';
import { defaultPlayState } from '../performer.js';
import { defaultScState } from '../sidechain.js';
import { defaultTlState } from '../timeline.js';
import { defaultTrState } from '../tr909.js';
import { mergeWindows } from '../windows.js';

translatePage();

export const BANKS = 25;   // SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = banques 6-10, puis 11-15, 16-20 et 21-25 à chaque nouvel appui
export const PAGE_ORDER = ['synth', 'fx', 'pad', 'eq'];   // boutons de piste 1 à 4 (EQ aussi via SUSTAIN)
export const UI_PAGES = [...PAGE_ORDER, 'tr', 'acid', 'decks', 'osc', 'viz', ...MIX_FIELDS.map(f => `mix_${f}`)];   // + TR-909 (Maj + PLAY) et mixeur (Maj + piste 1-4)
export const $ = sel => document.querySelector(sel);

// Moteurs créés au démarrage par js/main.js (provide), ou à la première ouverture de leur fenêtre.
/** @type {import('../audio.js').Engine} */ export let engine;
/** @type {import('../apc.js').APC} */ export let apc;
/** @type {{ name: string, color: number, buffer: AudioBuffer }[]} kit de départ (synthétisé) */ export let kit;
/** @type {import('../recorder.js').Recorder} */ export let recorder;
/** @type {import('../tr909.js').TR909} */ export let drum;
/** @type {import('../mixer.js').Mixer} */ export let mixer;
/** @type {import('../windows.js').WindowManager} */ export let wm;
/** @type {import('../timeline.js').Timeline} */ export let timeline;
/** @type {import('../performer.js').Performer} */ export let performer;
/** @type {import('../sidechain.js').Sidechain} */ export let sidechain;
/** @type {import('../history.js').History} */ export let tlHistory;
/** @type {import('../acid.js').Acid303} */ export let acid;
/** @type {import('../decks.js').Decks} */ export let decks;
/** @type {import('../patch.js').Patch} */ export let patch;
/** @type {import('../osc.js').OscSynth} */ export let oscSynth;
/** @type {import('../visualizer.js').Visualizer} */ export let viz;
/** @type {import('../metronome.js').Metronome} */ export let metro;
export let libAdded = [];   // banques de la bibliothèque ajoutées à ce démarrage
/**
 * Un pad d'une banque.
 * @typedef {object} Pad
 * @property {string} name
 * @property {number} color     couleur de la LED (palette de l'APC)
 * @property {string} sampleId  'lib:banque/fichier', 'user:…' (importé), 'rec:…' (enregistrement), 'kit:…'
 * @property {AudioBuffer|null} buffer
 * @property {number} bpm       tempo d'origine d'une boucle (0 = un coup)
 * @property {Object<string, number>} p  positions des potentiomètres de la page « Pad » (0..1)
 */

/** État de l'application : tout ce qui est enregistré (navigateur et fichier projet). */
export const state = {
  bank: 0,
  page: 'synth',
  selected: 0,
  bpm: 190,         // tempo d'un nouveau projet : celui de la bibliothèque Anthem et des démos
  preset: 'init',   // preset du synthé (identifiant, voir js/presets.js)
  libBanks: [],     // noms des banques de la bibliothèque déjà importées
  model: null,      // dernier modèle d'APC vu ('mk1' | 'mk2')
  globals: { ...defaultPositions('synth'), ...defaultPositions('fx'), ...defaultPositions('eq') },
  /** @type {(Pad|null)[][]} */
  banks: [],        // banks[b][i] = pad, ou null pour un pad vide
  tr: defaultTrState(),   // TR-909 : réglages, patterns, instrument choisi
  mix: defaultMixState(), // table de mixage : voies, envois, effets d'insert
  windows: mergeWindows(null), // fenêtres des plugins : ouverte ou non, position, taille
  tl: defaultTlState(),        // timeline : pistes de clips (sons posés ou enregistrements d'outils)
  scenes: new Array(40).fill(null),   // 40 scènes (instantanés rappelés à la mesure suivante)
  play: defaultPlayState(),           // jeu du clavier : mode accords, arpégiateur
  gen: null,                          // générateur d'accords et de mélodie (voir js/app/gen.js)
  sc: defaultScState(),               // sidechain : les kicks font respirer synthé, nappes et basses
  acid: defaultAcidState(),           // TB-303 : réglages et patterns
  kick: defaultKickState(),           // designer de kick
  decks: defaultDecksState(),         // platines : sons chargés et réglages des deux decks
  patch: defaultPatch(),              // câblage : boîtes à effets et câbles (tout sur le master par défaut)
  userSounds: [],                     // sons créés dans l'application (kicks du designer) : { sampleId, name, cat }
  libArchives: false,                 // bibliothèque : montrer aussi les anciens sons (archives)
  padQuant: 0,                        // départ des pads joués à la main : 0 = libre, sinon grille en temps (1, 2, 3, 4, 8, 16)
  curves: [],                         // tes courbes du designer d'effet (js/curves.js) : { id: 'u:…', name, target, beats, points… }
  roll: defaultRoll(),                // piano roll : bloc édité, grille, saisie pas à pas
  osc: defaultOscState(),             // synthé à oscillateurs : réglages, preset, presets perso
  synthUser: [],                      // presets perso du synthé en couches : { id, name, cat, base, values }
  synthPick: null,                    // preset perso en cours (sinon state.preset)
  synthDirty: false,                  // potentiomètres du synthé tournés depuis le preset
  keys: 'synth',                      // synthé joué au clavier : 'synth' ou 'osc' (celui de la fenêtre active)
  viz: null,                          // visualiseur : mode, réglages, mots (préparé au démarrage)
  metro: defaultMetroState(),         // métronome : allumé, quand, décompte, volume
  master: defaultMasterState(),       // chaîne master : compresseur, limiteur (js/audio.js)
  midiMap: [],                        // MIDI learn : [{ port, ch, kind, n, target }] (js/app/midi-ui.js)
  midiClock: { out: '', in: '' },     // horloge MIDI : sortie qui la reçoit, entrée suivie (noms des ports)
};
export const playing = new Map();   // clé voix (banque*40 + pad) -> mode
export let shiftHeld = false;

export const padKey = (bank, i) => bank * 40 + i;
// Le mk1 n'a que 3 couleurs : l'interface montre la couleur réelle de la LED.
export const uiColor = c => (state.model === 'mk1' ? mk1Equivalent(c) : c);
export const pickerColors = () => (state.model === 'mk1' ? MK1_PICKER_COLORS : PICKER_COLORS);
export const currentPad = () => state.banks[state.bank][state.selected];
export const newPad = (name, color, sampleId, buffer, bpm = 0) => ({ name, color, sampleId, buffer, bpm, p: defaultPositions('pad') });

export function defaultRoll() { return { clip: null, grid: 0.25, step: false }; }

// Moteurs et fenêtres créés au démarrage (ou plus tard) : provide({ engine: new Engine() }).
export function provide(services) {
  if ('engine' in services) engine = services.engine;
  if ('apc' in services) apc = services.apc;
  if ('kit' in services) kit = services.kit;
  if ('recorder' in services) recorder = services.recorder;
  if ('drum' in services) drum = services.drum;
  if ('mixer' in services) mixer = services.mixer;
  if ('wm' in services) wm = services.wm;
  if ('timeline' in services) timeline = services.timeline;
  if ('performer' in services) performer = services.performer;
  if ('sidechain' in services) sidechain = services.sidechain;
  if ('tlHistory' in services) tlHistory = services.tlHistory;
  if ('acid' in services) acid = services.acid;
  if ('decks' in services) decks = services.decks;
  if ('patch' in services) patch = services.patch;
  if ('oscSynth' in services) oscSynth = services.oscSynth;
  if ('viz' in services) viz = services.viz;
  if ('metro' in services) metro = services.metro;
}

// Variables modifiées depuis d'autres modules.
export function setLibAdded(v) { return (libAdded = v); }
export function setShiftHeld(v) { return (shiftHeld = v); }
