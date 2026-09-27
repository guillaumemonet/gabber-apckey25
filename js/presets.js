// Presets du synthé joué au clavier, rangés par famille (nom affiché : t(`preset.${id}`)).
// `values` = potards d'expression (voir PAGES.synth), `voice` = caractère du son :
//   layers : couches d'oscillateurs { osc, voices (unisson), spread (centièmes à « Désaccord » = 12),
//            octave (demi-tons), level, formant ('strings' | 'a' | 'o') }
//   fenv (enveloppe du filtre), decay, sustain, sub, bend, bendTime, vibRate, vibDelay, vibRange (demi-tons au max),
//   filterType, lfoRate / lfoDepth (LFO sur la coupure), mono, glide, octave.
// Sur l'APC : Maj + touche blanche = preset de la famille, Maj + do# / ré# = famille précédente / suivante.
import { t } from './i18n.js';

export const FAMILIES = ['strings', 'pads', 'choirs', 'supersaw', 'hoovers', 'leads', 'basses', 'stabs', 'keys', 'fx'];
const MONO_FAMILIES = new Set(['hoovers', 'leads', 'basses', 'fx']);
export const familyGroup = f => (MONO_FAMILIES.has(f) ? 'mono' : 'wide');

const L = (osc, voices = 1, opts = {}) => ({ osc, voices, ...opts });
const saw = (n, o) => L('sawtooth', n, o);
const sq = (n, o) => L('square', n, o);
const tri = (n, o) => L('triangle', n, o);
const sine = (n, o) => L('sine', n, o);
const pulse = (n, o) => L('pulse', n, o);

export const PRESETS = [
  // --- Cordes ---
  { id: 'epic_strings', family: 'strings',
    values: { cutoff: 3400, reso: 1.2, attack: 0.35, release: 1.2, width: 0.9, vibrato: 0.35, chorus: 0.6, rSend: 0.45 },
    voice: { layers: [saw(5, { spread: 18, formant: 'strings' }), saw(3, { spread: 12, octave: 12, level: 0.35, formant: 'strings' }), sq(2, { octave: -12, level: 0.25 })], fenv: 0.1, decay: 0.6, sustain: 0.9, vibDelay: 0.3 } },
  { id: 'dark_strings', family: 'strings',
    values: { cutoff: 1500, reso: 1.5, attack: 0.4, release: 1.5, width: 0.8, vibrato: 0.3, chorus: 0.5, rSend: 0.5 },
    voice: { layers: [saw(5, { spread: 16, formant: 'strings' }), saw(3, { spread: 10, octave: -12, level: 0.6 })], fenv: 0.05, decay: 0.8, sustain: 0.9, vibDelay: 0.4 } },
  { id: 'staccato_strings', family: 'strings',
    values: { cutoff: 4200, reso: 1.2, attack: 0.004, release: 0.12, width: 0.8, vibrato: 0, chorus: 0.4, rSend: 0.3 },
    voice: { layers: [saw(5, { spread: 16, formant: 'strings' }), saw(3, { spread: 10, octave: 12, level: 0.3 })], fenv: 0.3, decay: 0.12, sustain: 0 } },
  { id: 'solina', family: 'strings',
    values: { cutoff: 3000, reso: 0.8, attack: 0.08, release: 0.8, width: 0.6, vibrato: 0, chorus: 0.95, rSend: 0.35 },
    voice: { layers: [saw(1), sq(1, { octave: 12, level: 0.5 })], fenv: 0, decay: 0.5, sustain: 1 } },
  { id: 'high_strings', family: 'strings',
    values: { cutoff: 6000, reso: 1, attack: 0.3, release: 1.4, width: 1, vibrato: 0.4, chorus: 0.6, rSend: 0.55 },
    voice: { layers: [saw(5, { spread: 16, octave: 12, formant: 'strings' }), tri(2, { octave: 24, level: 0.3 })], fenv: 0.05, decay: 0.6, sustain: 0.9, vibDelay: 0.25 } },

  // --- Nappes ---
  { id: 'thunder_pad', family: 'pads',
    values: { cutoff: 1800, reso: 3, attack: 0.6, release: 2, width: 0.9, vibrato: 0, chorus: 0.5, rSend: 0.6, detune: 20 },
    voice: { layers: [saw(4, { spread: 14 }), sq(2, { octave: -12, level: 0.5 })], fenv: 0, decay: 1, sustain: 1, lfoRate: 0.12, lfoDepth: 0.35 } },
  { id: 'dark_pad', family: 'pads',
    values: { cutoff: 900, reso: 1.5, attack: 0.8, release: 2.5, width: 0.7, vibrato: 0, chorus: 0.4, rSend: 0.6 },
    voice: { layers: [tri(2, { octave: -12, spread: 8 }), sine(1, { octave: -24, level: 0.7 }), saw(2, { level: 0.3 })], fenv: 0, decay: 1, sustain: 1 } },
  { id: 'warm_pad', family: 'pads',
    values: { cutoff: 2200, reso: 1.2, attack: 0.5, release: 1.8, width: 0.8, vibrato: 0.1, chorus: 0.5, rSend: 0.5 },
    voice: { layers: [tri(3, { spread: 15 }), saw(2, { level: 0.4 })], fenv: 0.05, decay: 1, sustain: 1 } },
  { id: 'glass_pad', family: 'pads',
    values: { cutoff: 7000, reso: 1, attack: 0.25, release: 2.5, width: 1, vibrato: 0.2, chorus: 0.6, rSend: 0.7 },
    voice: { layers: [sine(2, { octave: 12, spread: 8 }), sq(2, { octave: 24, level: 0.15 })], fenv: 0, decay: 1, sustain: 0.9 } },
  { id: 'sweep_pad', family: 'pads',
    values: { cutoff: 700, reso: 8, attack: 0.4, release: 2, width: 0.9, vibrato: 0, chorus: 0.4, rSend: 0.5 },
    voice: { layers: [saw(5, { spread: 22 })], fenv: 0, decay: 1, sustain: 1, lfoRate: 0.1, lfoDepth: 1.6 } },

  // --- Chœurs ---
  { id: 'rave_choir', family: 'choirs',
    values: { cutoff: 5000, reso: 1, attack: 0.15, release: 1, width: 0.8, vibrato: 0.45, chorus: 0.6, rSend: 0.55 },
    voice: { layers: [saw(3, { spread: 10, formant: 'a' }), saw(2, { octave: 12, level: 0.4, formant: 'a' })], fenv: 0, decay: 0.6, sustain: 0.9, vibDelay: 0.2 } },
  { id: 'ooh_choir', family: 'choirs',
    values: { cutoff: 3500, reso: 1, attack: 0.3, release: 1.4, width: 0.8, vibrato: 0.4, chorus: 0.5, rSend: 0.6 },
    voice: { layers: [saw(3, { spread: 10, formant: 'o' }), tri(2, { octave: -12, level: 0.4 })], fenv: 0, decay: 0.8, sustain: 0.9, vibDelay: 0.3 } },
  { id: 'dark_choir', family: 'choirs',
    values: { cutoff: 2500, reso: 1, attack: 0.4, release: 1.6, width: 0.9, vibrato: 0.35, chorus: 0.6, rSend: 0.7 },
    voice: { layers: [saw(3, { spread: 10, octave: -12, formant: 'a' }), saw(2, { spread: 8, level: 0.6, formant: 'o' })], fenv: 0, decay: 0.8, sustain: 0.9, vibDelay: 0.3 } },

  // --- Supersaw ---
  { id: 'supersaw_uplift', family: 'supersaw',
    values: { cutoff: 6500, reso: 1, attack: 0.01, release: 0.5, width: 1, vibrato: 0, chorus: 0.35, rSend: 0.35, detune: 16 },
    voice: { layers: [saw(9, { spread: 26 }), saw(3, { spread: 15, octave: -12, level: 0.45 })], fenv: 0.15, decay: 0.4, sustain: 0.85 } },
  { id: 'hardstyle_lead', family: 'supersaw',
    values: { cutoff: 5000, reso: 1.5, attack: 0.005, release: 0.25, width: 0.9, vibrato: 0, chorus: 0.2, rSend: 0.25, drive: 0.5 },
    voice: { layers: [saw(7, { spread: 30 })], fenv: 0.3, decay: 0.3, sustain: 0.8 } },
  { id: 'supersaw_pad', family: 'supersaw',
    values: { cutoff: 3500, reso: 1, attack: 0.45, release: 1.8, width: 1, vibrato: 0.1, chorus: 0.5, rSend: 0.5 },
    voice: { layers: [saw(9, { spread: 30 })], fenv: 0, decay: 1, sustain: 1 } },
  { id: 'supersaw_stab', family: 'supersaw',
    values: { cutoff: 2600, reso: 3, attack: 0.003, release: 0.2, width: 1, vibrato: 0, chorus: 0.2, rSend: 0.35, drive: 0.3 },
    voice: { layers: [saw(9, { spread: 32 }), sq(2, { octave: -12, level: 0.4 })], fenv: 0.9, decay: 0.18, sustain: 0 } },

  // --- Hoovers ---
  { id: 'hoover', family: 'hoovers',
    values: { cutoff: 3800, reso: 1.2, attack: 0.004, release: 0.35, drive: 0.35, glide: 0.05, detune: 12, rSend: 0.25, vibrato: 0.5 },
    voice: { layers: [saw(7, { spread: 28 }), pulse(1, { level: 0.6 })], sub: 0.6, bend: -7, bendTime: 0.07, vibRate: 5.5, vibDelay: 0.25, fenv: 0.15, decay: 0.4, sustain: 0.85 } },
  { id: 'mentasm', family: 'hoovers',
    values: { cutoff: 3500, reso: 1.5, attack: 0.005, release: 0.4, drive: 0.5, glide: 0.05, detune: 12, rSend: 0.3, vibrato: 0.3, chorus: 0.7, width: 0.8 },
    voice: { layers: [pulse(5, { spread: 20 }), saw(2, { spread: 10, octave: -12, level: 0.6 })], bend: 2, bendTime: 0.08, fenv: 0.2, decay: 0.4, sustain: 0.7 } },

  // --- Leads ---
  { id: 'init', family: 'leads',
    values: { cutoff: 2400, reso: 2, attack: 0.005, release: 0.35, drive: 0, glide: 0.05, detune: 12, rSend: 0.25 },
    voice: { layers: [saw(2, { spread: 12 })], fenv: 0.4, decay: 0.25, sustain: 0.75 } },
  { id: 'acid', family: 'leads',
    values: { cutoff: 380, reso: 16, attack: 0.002, release: 0.08, drive: 0.6, glide: 0.07, detune: 0, rSend: 0.15 },
    voice: { layers: [saw(1)], mono: true, fenv: 0.9, decay: 0.18, sustain: 0.5, octave: -12 } },
  { id: 'screech', family: 'leads',
    values: { cutoff: 2200, reso: 7, attack: 0.01, release: 0.15, drive: 0.95, glide: 0.05, detune: 8, rSend: 0.2, vibrato: 0.6 },
    voice: { layers: [saw(2, { spread: 12 })], filterType: 'bandpass', lfoRate: 7, lfoDepth: 0.6, vibRate: 7, vibDelay: 0, fenv: 0.2, sustain: 0.95 } },
  { id: 'horn', family: 'leads',
    values: { cutoff: 2600, reso: 1.5, attack: 0.02, release: 0.3, drive: 0.4, glide: 0.05, detune: 18, rSend: 0.3 },
    voice: { layers: [saw(4, { spread: 12 })], sub: 0.3, bend: -2, bendTime: 0.05, fenv: 0.3, sustain: 0.8 } },
  { id: 'gabber_lead', family: 'leads',
    values: { cutoff: 4500, reso: 2, attack: 0.002, release: 0.15, drive: 0.9, glide: 0.03, detune: 10, rSend: 0.2 },
    voice: { layers: [sq(2, { spread: 12 }), saw(1, { octave: 12, level: 0.5 })], fenv: 0.4, decay: 0.2, sustain: 0.7 } },

  // --- Basses ---
  { id: 'bass', family: 'basses',
    values: { cutoff: 700, reso: 4, attack: 0.002, release: 0.1, drive: 0.85, glide: 0.02, detune: 6, rSend: 0 },
    voice: { layers: [sq(2, { spread: 12 })], sub: 0.8, mono: true, octave: -12, fenv: 0.5, sustain: 0.8 } },
  { id: 'reese', family: 'basses',
    values: { cutoff: 800, reso: 3, attack: 0.01, release: 0.2, drive: 0.4, glide: 0.04, detune: 15, rSend: 0.05 },
    voice: { layers: [saw(2, { spread: 12 })], sub: 0.9, mono: true, octave: -12, lfoRate: 0.5, lfoDepth: 0.6, fenv: 0.1, sustain: 0.9 } },
  { id: 'sub_bass', family: 'basses',
    values: { cutoff: 400, reso: 0.7, attack: 0.005, release: 0.15, drive: 0.2, glide: 0.03, detune: 0, rSend: 0 },
    voice: { layers: [sine(1)], mono: true, octave: -12, fenv: 0, sustain: 1 } },

  // --- Stabs ---
  { id: 'stab', family: 'stabs',
    values: { cutoff: 900, reso: 3, attack: 0.002, release: 0.25, width: 0.6, chorus: 0.2, rSend: 0.3, drive: 0.5, detune: 14 },
    voice: { layers: [saw(3, { spread: 12 })], fenv: 0.9, decay: 0.18, sustain: 0 } },
  { id: 'belgian', family: 'stabs',
    values: { cutoff: 1200, reso: 5, attack: 0.002, release: 0.2, width: 0.6, chorus: 0.3, rSend: 0.35, drive: 0.6 },
    voice: { layers: [saw(2, { spread: 8 }), sq(2, { spread: 8, level: 0.8 })], fenv: 1, decay: 0.15, sustain: 0 } },
  { id: 'orch_hit', family: 'stabs',
    values: { cutoff: 3500, reso: 1.2, attack: 0.002, release: 0.4, width: 0.9, chorus: 0.3, rSend: 0.6 },
    voice: { layers: [saw(5, { spread: 16, formant: 'strings' }), sq(3, { spread: 10, octave: -12, level: 0.6 })], fenv: 0.6, decay: 0.35, sustain: 0 } },

  // --- Claviers ---
  { id: 'rave_piano', family: 'keys',
    values: { cutoff: 2500, reso: 1, attack: 0.002, release: 0.4, width: 0.5, chorus: 0.2, rSend: 0.35 },
    voice: { layers: [tri(2, { spread: 6 }), sq(1, { octave: 12, level: 0.25 })], fenv: 0.9, decay: 1, sustain: 0 } },
  { id: 'organ', family: 'keys',
    values: { cutoff: 8000, reso: 0.7, attack: 0.01, release: 0.1, width: 0.6, vibrato: 0.2, chorus: 0.5, rSend: 0.3 },
    voice: { layers: [sine(1), sine(1, { octave: 12, level: 0.7 }), sine(1, { octave: 19, level: 0.4 }), sine(1, { octave: 24, level: 0.3 })], fenv: 0, sustain: 1, vibRate: 6.5, vibDelay: 0 } },

  // --- Effets ---
  { id: 'kick', family: 'fx',
    values: { cutoff: 6000, reso: 0.7, attack: 0.001, release: 0.15, drive: 1, glide: 0.05, detune: 0, rSend: 0 },
    voice: { layers: [sine(1)], bend: 36, bendTime: 0.035, decay: 0.35, sustain: 0, octave: -24, fenv: 0 } },
  { id: 'siren_fx', family: 'fx',
    values: { cutoff: 5000, reso: 1, attack: 0.1, release: 0.4, drive: 0.4, glide: 0.05, detune: 6, rSend: 0.35, vibrato: 1 },
    voice: { layers: [sq(1), saw(1, { level: 0.5 })], vibRange: 7, vibRate: 0.7, vibDelay: 0, fenv: 0, sustain: 1 } },
  { id: 'laser', family: 'fx',
    values: { cutoff: 6000, reso: 2, attack: 0.001, release: 0.1, drive: 0.5, glide: 0.05, detune: 0, rSend: 0.4 },
    voice: { layers: [saw(1)], bend: 36, bendTime: 0.12, decay: 0.15, sustain: 0, fenv: 0 } },
];

for (const p of PRESETS) p.name = t(`preset.${p.id}`);

export const presetById = id => PRESETS.find(p => p.id === id) ?? PRESETS.find(p => p.id === 'init');

// Anciennes sauvegardes : le preset était un numéro (8 presets d'origine).
const OLD_ORDER = ['init', 'hoover', 'acid', 'screech', 'stab', 'bass', 'horn', 'kick'];
export const migratePreset = saved => (typeof saved === 'number' ? OLD_ORDER[saved] ?? 'init' : saved && PRESETS.some(p => p.id === saved) ? saved : 'init');

// Touches blanches (do, ré, mi, fa, sol, la, si) -> rang du preset dans la famille.
export const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];
