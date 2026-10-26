// Séquenceur pas à pas : n'importe quel son de pad, sur une grille de 16 à 64 pas. Chaque pattern a ses lignes (un pad
// par ligne : banque, pad, muet, pas) et sa longueur ; même horloge, même shuffle et mêmes changements de pattern à la
// mesure que les boîtes à rythmes (js/drummachine.js). Le moteur ne connaît pas les pads : l'application joue chaque coup
// (onHit).
import { PATTERNS, StepClock } from './drummachine.js';

export const SEQ_LENS = [16, 32, 64];   // pas : 1, 2 ou 4 mesures
export const SEQ_ROWS_MAX = 32;
const BANKS = 25;

export const seqRow = (bank, pad, len = 16) => ({ bank, pad, mute: false, steps: new Array(len).fill(0) });
export const emptySeqPattern = () => ({ len: 16, rows: [] });
export const seqPatternUsed = p => p.rows.some(r => r.steps.some(Boolean));

// Départ : les sons de la banque 1 (kit de départ : kick, clap, caisse claire, charleys, shaker, tom, crash) et un motif.
export function defaultSeqState() {
  const pads = [0, 3, 2, 8, 9, 10, 5, 11];
  const first = { len: 16, rows: pads.map(p => seqRow(0, p)) };
  const set = (r, steps, v = 1) => steps.forEach(s => { first.rows[r].steps[s] = v; });
  set(0, [0, 4, 8, 12], 2); set(1, [4, 12]); set(3, [2, 6, 10, 14]); set(5, [1, 3, 5, 7, 9, 11, 13, 15]);
  const patterns = [first, ...Array.from({ length: PATTERNS - 1 }, () => ({ len: 16, rows: pads.map(p => seqRow(0, p)) }))];
  return { patterns, pattern: 0, globals: { accent: 0.6, shuffle: 0 }, page: 0, times: 1 };
}

// Fusionne un état sauvegardé avec les valeurs par défaut ; écarte ce qui est invalide.
export function mergeSeqState(saved) {
  const base = defaultSeqState();
  if (!saved || typeof saved !== 'object') return base;
  const int = (v, max) => Number.isInteger(v) && v >= 0 && v < max;
  if (Array.isArray(saved.patterns)) {
    base.patterns = base.patterns.map((def, k) => {
      const p = saved.patterns[k];
      if (!p || !Array.isArray(p.rows)) return def;
      const len = SEQ_LENS.includes(p.len) ? p.len : 16;
      const rows = p.rows.filter(r => int(r?.bank, BANKS) && int(r?.pad, 40)).slice(0, SEQ_ROWS_MAX)
        .map(r => ({ bank: r.bank, pad: r.pad, mute: !!r.mute, steps: Array.from({ length: len }, (_, s) => ([0, 1, 2].includes(r.steps?.[s]) ? r.steps[s] : 0)) }));
      return { len, rows };
    });
  }
  base.pattern = int(saved.pattern, PATTERNS) ? saved.pattern : 0;
  if ([1, 2, 4, 8].includes(saved.times)) base.times = saved.times;
  for (const g of ['accent', 'shuffle']) if (Number.isFinite(saved.globals?.[g])) base.globals[g] = Math.min(1, Math.max(0, saved.globals[g]));
  return base;
}

// Change la longueur d'un pattern : en l'allongeant, ce qui est écrit se répète (16 -> 32 recopie la mesure).
export function setSeqLength(p, len) {
  if (!SEQ_LENS.includes(len) || p.len === len) return;
  for (const r of p.rows) r.steps = Array.from({ length: len }, (_, s) => r.steps[s % p.len] ?? 0);
  p.len = len;
}

export class StepSeq extends StepClock {
  constructor(engine, getState) {
    super(engine, getState);
    this.onHit = () => {};   // (ligne, instant, vélocité) : l'application joue le pad
  }

  get length() { return this.st.patterns[this.st.pattern].len; }

  playStep(step, time) {
    const pat = this.st.patterns[this.st.pattern];
    const accent = this.st.globals.accent;
    for (const row of pat.rows) {
      const v = row.steps[step];
      if (v && !row.mute) this.onHit(row, time, v === 2 ? 1 : 1 - accent * 0.45);
    }
  }
}
