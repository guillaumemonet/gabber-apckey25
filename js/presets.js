// Presets du synthé joué au clavier (nom affiché : t(`preset.${id}`)). `values` = potards (pages Synthé / Effets), `voice` = caractère.
// Sur l'APC : Maj + touche blanche do, ré, mi, fa, sol, la, si = presets 2 à 8 ; Maj + do# = Init.

import { t } from './i18n.js';

export const PRESETS = [
  {
    id: 'init',
    values: { wave: 2, detune: 12, cutoff: 2400, reso: 2, fenv: 0.4, attack: 0.005, release: 0.35, drive: 0 },
    voice: {},
  },
  {
    id: 'hoover',
    values: { wave: 2, detune: 28, cutoff: 3800, reso: 1.2, fenv: 0.15, attack: 0.004, release: 0.35, drive: 0.35 },
    voice: { unison: 7, sub: 0.6, bend: -7, bendTime: 0.07, vib: 0.25, vibRate: 5.5, vibDelay: 0.25, decay: 0.4, sustain: 0.85 },
  },
  {
    id: 'acid',
    values: { wave: 2, detune: 0, cutoff: 380, reso: 16, fenv: 0.9, attack: 0.002, release: 0.08, drive: 0.6 },
    voice: { unison: 1, mono: true, glide: 0.07, decay: 0.18, sustain: 0.5, octave: -12 },
  },
  {
    id: 'screech',
    values: { wave: 2, detune: 8, cutoff: 2200, reso: 7, fenv: 0.2, attack: 0.01, release: 0.15, drive: 0.95 },
    voice: { unison: 2, filterType: 'bandpass', lfoRate: 7, lfoDepth: 0.6, vib: 0.3, vibRate: 7, vibDelay: 0, sustain: 0.95 },
  },
  {
    id: 'stab',
    values: { wave: 2, detune: 14, cutoff: 900, reso: 3, fenv: 0.9, attack: 0.002, release: 0.25, drive: 0.5 },
    voice: { unison: 3, decay: 0.18, sustain: 0 },
  },
  {
    id: 'bass',
    values: { wave: 3, detune: 6, cutoff: 700, reso: 4, fenv: 0.5, attack: 0.002, release: 0.1, drive: 0.85 },
    voice: { unison: 2, sub: 0.8, mono: true, glide: 0.02, octave: -12, sustain: 0.8 },
  },
  {
    id: 'horn',
    values: { wave: 2, detune: 18, cutoff: 2600, reso: 1.5, fenv: 0.3, attack: 0.02, release: 0.3, drive: 0.4 },
    voice: { unison: 4, sub: 0.3, bend: -2, bendTime: 0.05, sustain: 0.8 },
  },
  {
    id: 'kick',
    values: { wave: 0, detune: 0, cutoff: 6000, reso: 0.7, fenv: 0, attack: 0.001, release: 0.15, drive: 1 },
    voice: { unison: 1, bend: 36, bendTime: 0.035, decay: 0.35, sustain: 0, octave: -24 },
  },
];

for (const p of PRESETS) p.name = t(`preset.${p.id}`);

// Note (modulo 12) -> preset : touches blanches do..si = presets 2..8, do# = Init.
export const PRESET_KEYS = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7, 1: 0 };
