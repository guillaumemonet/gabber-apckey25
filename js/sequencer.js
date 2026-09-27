// Séquenceur global : 8 pistes de pads (chacune joue un pad de n'importe quelle banque) et une
// piste de synthé en piano roll. Il suit l'horloge de la 909 (même tempo, même grille de mesures).

export const SEQ_TRACKS = 8;
export const SEQ_PATTERNS = 8;
export const ROLL_NOTES = 24;   // hauteur du piano roll : 2 octaves

const emptyPattern = () => ({ pads: Array.from({ length: SEQ_TRACKS }, () => new Array(16).fill(0)), synth: [] });

export function defaultSeqState() {
  return {
    tracks: new Array(SEQ_TRACKS).fill(null),   // { bank, pad } assigné à chaque piste
    patterns: Array.from({ length: SEQ_PATTERNS }, emptyPattern),
    pattern: 0,
    mutes: {},        // index de piste ou 'synth' -> true
    sel: 0,           // piste choisie (grille de l'APC)
    rollBase: 48,     // note la plus grave du piano roll (do3)
  };
}

export function mergeSeqState(saved) {
  const base = defaultSeqState();
  if (!saved) return base;
  if (Array.isArray(saved.tracks)) base.tracks = base.tracks.map((t, i) => saved.tracks[i] ?? t);
  if (Array.isArray(saved.patterns)) {
    base.patterns = base.patterns.map((p, k) => {
      const s = saved.patterns[k];
      if (!s) return p;
      return {
        pads: p.pads.map((row, i) => (Array.isArray(s.pads?.[i]) ? [...s.pads[i], ...row].slice(0, 16) : row)),
        synth: Array.isArray(s.synth) ? s.synth.filter(n => Number.isFinite(n.step) && Number.isFinite(n.note)) : [],
      };
    });
  }
  base.pattern = saved.pattern ?? 0;
  base.mutes = saved.mutes ?? {};
  base.sel = saved.sel ?? 0;
  base.rollBase = saved.rollBase ?? 48;
  return base;
}

export const patternUsed = pat => pat.synth.length > 0 || pat.pads.some(row => row.some(Boolean));

export class StepSequencer {
  // getPad(bank, index) -> pad ; padKey(bank, index) -> clé de voix du moteur.
  constructor(engine, getState, getPad, padKey) {
    this.engine = engine;
    this.getState = getState;
    this.getPad = getPad;
    this.padKey = padKey;
    this.queued = null;
    this.offs = [];               // fins de notes du synthé programmées
    this.onPattern = () => {};
  }

  get st() { return this.getState(); }

  // Changement de pattern : immédiat à l'arrêt, sinon au début de la mesure suivante.
  selectPattern(k, running) {
    if (!running) { this.st.pattern = k; this.queued = null; }
    else this.queued = k === this.st.pattern ? null : k;
    this.onPattern();
  }

  // Appelé par l'horloge pour chaque pas programmé (quelques dizaines de ms à l'avance).
  schedule(step, time, stepDur) {
    this.flush(time + 1e-4);   // les notes qui se terminent avant ce pas d'abord
    if (step === 0 && this.queued !== null) {
      this.st.pattern = this.queued;
      this.queued = null;
      this.onPattern();
    }
    const st = this.st;
    const pat = st.patterns[st.pattern];
    st.tracks.forEach((tr, i) => {
      const v = pat.pads[i][step];
      if (!tr || !v || st.mutes[i]) return;
      const pad = this.getPad(tr.bank, tr.pad);
      if (pad?.buffer) this.engine.playPad(this.padKey(tr.bank, tr.pad), pad, { when: time, vel: v === 2 ? 1 : 0.7, oneShot: true });
    });
    if (st.mutes.synth) return;
    for (const n of pat.synth) {
      if (n.step !== step) continue;
      const key = `seq:${n.note}`;
      this.engine.noteOn(n.note, n.vel ?? 0.85, time, key);
      this.offs.push({ note: n.note, key, time: time + n.len * stepDur - 0.005 });
    }
  }

  flush(horizon) {
    this.offs.sort((a, b) => a.time - b.time);
    while (this.offs.length && this.offs[0].time < horizon) {
      const o = this.offs.shift();
      this.engine.noteOff(o.note, false, o.time, o.key);
    }
  }

  stop() {
    for (const o of this.offs) this.engine.noteOff(o.note, true, undefined, o.key);
    this.offs = [];
  }

  // Édition du piano roll.
  noteAt(step, note) {
    return this.st.patterns[this.st.pattern].synth.find(n => n.note === note && step >= n.step && step < n.step + n.len);
  }
  addNote(step, note, len = 1) {
    const n = { step, note, len, vel: 0.85 };
    this.st.patterns[this.st.pattern].synth.push(n);
    return n;
  }
  removeNote(n) {
    const list = this.st.patterns[this.st.pattern].synth;
    list.splice(list.indexOf(n), 1);
  }
}
