// Définition des paramètres pilotés par les 8 potentiomètres, organisés en pages.
// Chaque paramètre est stocké sous forme de position normalisée p ∈ [0, 1].
import { t } from './i18n.js';

export const WAVES = ['sine', 'triangle', 'sawtooth', 'square'];
const WAVE_LABELS = t('wave');
export const MODES = ['oneshot', 'hold', 'loop'];
const MODE_LABELS = t('mode');

const pct = v => `${Math.round(v * 100)}%`;
const hz = v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) + 'Hz';
const db = v => (Math.abs(v) < 0.25 ? '0 dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
const sec = v => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);

export const PAGES = {
  // Potentiomètres d'expression du synthé ; chaque famille de sons en montre 8 (voir SYNTH_KNOBS).
  synth: {
    label: t('page.synth'),
    params: [
      { id: 'cutoff', min: 80, max: 18000, def: 2400, curve: 'exp', fmt: hz },
      { id: 'reso', min: 0.1, max: 20, def: 1.5, curve: 'exp', fmt: v => v.toFixed(1) },
      { id: 'attack', min: 0.002, max: 3, def: 0.005, curve: 'exp', fmt: sec },
      { id: 'release', min: 0.01, max: 6, def: 0.35, curve: 'exp', fmt: sec },
      { id: 'width', min: 0, max: 1, def: 0.5, fmt: pct },
      { id: 'vibrato', min: 0, max: 1, def: 0, fmt: pct },
      { id: 'chorus', min: 0, max: 1, def: 0, fmt: pct },
      { id: 'rSend', min: 0, max: 1, def: 0.25, fmt: pct },
      { id: 'drive', min: 0, max: 1, def: 0, fmt: pct },
      { id: 'glide', min: 0, max: 0.5, def: 0.05, fmt: sec },
      { id: 'detune', min: 0, max: 50, def: 12, fmt: v => `${Math.round(v)}ct` },
    ],
  },
  fx: {
    label: t('page.fx'),
    params: [
      { id: 'dTime', min: 0.05, max: 1.5, def: 0.375, curve: 'exp', fmt: sec },
      { id: 'dFb', min: 0, max: 0.9, def: 0.35, fmt: pct },
      { id: 'dSend', min: 0, max: 1, def: 0.15, fmt: pct },
      { id: 'rSend', min: 0, max: 1, def: 0.25, fmt: pct },
      { id: 'rSize', min: 0.3, max: 8, def: 2.2, curve: 'exp', fmt: sec },
      { id: 'synthVol', min: 0, max: 1, def: 0.6, fmt: pct },
      { id: 'padVol', min: 0, max: 1, def: 0.8, fmt: pct },
      { id: 'master', min: 0, max: 1, def: 0.8, fmt: pct },
    ],
  },
  eq: {
    label: t('page.eq'),
    params: [
      { id: 'eqLow', min: -15, max: 15, def: 0, fmt: db },
      { id: 'eqLowMid', min: -15, max: 15, def: 0, fmt: db },
      { id: 'eqMid', min: -15, max: 15, def: 0, fmt: db },
      { id: 'eqHiMid', min: -15, max: 15, def: 0, fmt: db },
      { id: 'eqHigh', min: -15, max: 15, def: 0, fmt: db },
      { id: 'eqLP', min: 150, max: 20000, def: 20000, curve: 'exp', fmt: hz },
      { id: 'eqHP', min: 20, max: 4000, def: 20, curve: 'exp', fmt: hz },
      { id: 'eqGain', min: -12, max: 12, def: 0, fmt: db },
    ],
  },
  pad: {
    label: t('page.pad'),
    params: [
      { id: 'volume', min: 0, max: 1.5, def: 1, fmt: pct },
      { id: 'pitch', min: -24, max: 24, def: 0, steps: 49, fmt: v => (v > 0 ? '+' : '') + v + ' ' + t('fmt.semitones') },
      { id: 'pan', min: -1, max: 1, def: 0, fmt: v => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `${t('fmt.left')}${Math.round(-v * 100)}` : `${t('fmt.right')}${Math.round(v * 100)}`) },
      { id: 'cutoff', min: 100, max: 20000, def: 20000, curve: 'exp', fmt: hz },
      { id: 'start', min: 0, max: 0.95, def: 0, fmt: pct },
      { id: 'dSend', min: 0, max: 1, def: 0, fmt: pct },
      { id: 'rSend', min: 0, max: 1, def: 0, fmt: pct },
      { id: 'mode', min: 0, max: 2, def: 0, steps: 3, fmt: v => MODE_LABELS[v] },
    ],
  },
};

// Libellés des potentiomètres dans la langue du navigateur.
for (const [page, { params }] of Object.entries(PAGES)) for (const d of params) d.label = t(`${page}.${d.id}`);

// Potentiomètres du synthé selon la famille : nappes / cordes / chœurs, ou sons monophoniques (basses, leads).
export const SYNTH_KNOBS = {
  wide: ['cutoff', 'reso', 'attack', 'release', 'width', 'vibrato', 'chorus', 'rSend'],
  mono: ['cutoff', 'reso', 'attack', 'release', 'drive', 'glide', 'detune', 'rSend'],
};

export function toValue(def, p) {
  p = Math.min(1, Math.max(0, p));
  if (def.steps) return Math.round(def.min + Math.round(p * (def.steps - 1)) * (def.max - def.min) / (def.steps - 1));
  if (def.curve === 'exp') return def.min * Math.pow(def.max / def.min, p);
  return def.min + p * (def.max - def.min);
}

export function toPos(def, v) {
  if (def.curve === 'exp') return Math.log(v / def.min) / Math.log(def.max / def.min);
  return (v - def.min) / (def.max - def.min);
}

export function defaultPositions(page) {
  return Object.fromEntries(PAGES[page].params.map(d => [d.id, toPos(d, d.def)]));
}
