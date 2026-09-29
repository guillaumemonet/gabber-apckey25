// Entrée du clavier vers le synthé : mode accords et arpégiateur calé sur le tempo.
// Les notes produites passent par les rappels `onNote` / `onNoteAt` (enregistrement dans la timeline).

// Accords : intervalles en demi-tons ; « key » = accord de la gamme de fa mineur sur la touche jouée.
export const CHORDS = { off: [0], min: [0, 3, 7], maj: [0, 4, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], min7: [0, 3, 7, 10], power: [0, 7, 12], oct: [0, 12], key: null };
export const CHORD_MODES = Object.keys(CHORDS);
export const ARP_MODES = ['up', 'down', 'updown', 'random', 'played'];
export const ARP_RATES = [8, 16, 32];
const F_MINOR = [5, 7, 8, 10, 0, 1, 3];   // fa, sol, lab, sib, do, réb, mib

export function defaultPlayState() {
  return { chord: 'off', arp: false, rate: 16, mode: 'up', octaves: 1, gate: 0.6, latch: false };
}

// Réglages sauvegardés : les valeurs inconnues (autres versions) reprennent leur valeur par défaut.
export function mergePlayState(saved) {
  const d = defaultPlayState();
  if (!saved || typeof saved !== 'object') return d;
  return {
    chord: CHORD_MODES.includes(saved.chord) ? saved.chord : d.chord,
    arp: !!saved.arp,
    rate: ARP_RATES.includes(saved.rate) ? saved.rate : d.rate,
    mode: ARP_MODES.includes(saved.mode) ? saved.mode : d.mode,
    octaves: [1, 2, 3].includes(saved.octaves) ? saved.octaves : d.octaves,
    gate: Number.isFinite(saved.gate) ? Math.min(1, Math.max(0.1, saved.gate)) : d.gate,
    latch: !!saved.latch,
  };
}

export function chordNotes(note, mode) {
  if (mode !== 'key') return (CHORDS[mode] ?? [0]).map(i => note + i);
  // Ramène la note sur la gamme (vers le bas), puis empile les degrés 1-3-5.
  let root = note;
  while (!F_MINOR.includes(((root % 12) + 12) % 12)) root--;
  const degree = F_MINOR.indexOf(((root % 12) + 12) % 12);
  const out = [];
  for (const step of [0, 2, 4]) {
    const d = degree + step;
    const pc = F_MINOR[d % 7];
    let n = root + (((pc - (root % 12)) % 12) + 12) % 12 + (d >= 7 ? 12 : 0);
    if (out.length && n <= out[out.length - 1]) n += 12;
    out.push(n);
  }
  return out;
}

export class Performer {
  constructor(engine, getState) {
    this.engine = engine;
    this.synth = () => engine;   // synthé joué (celui de la fenêtre active) ; branché par l'application
    this.getState = getState;
    this.pressed = new Map();   // touche -> notes produites
    this.held = [];             // notes de l'arpège, dans l'ordre joué
    this.releasedAll = false;   // tenue : la prochaine touche remplace l'arpège
    this.timer = null;
    this.idx = 0;
    this.lastVel = 0.85;
    this.onNote = () => {};     // (note, vélocité, on) — notes jouées directement
    this.onNoteAt = () => {};   // (note, vélocité, instant, durée) — notes de l'arpège
  }

  get st() { return this.getState(); }

  noteOn(note, vel = 0.85) {
    const s = this.st;
    if (this.pressed.has(note)) this.noteOff(note);
    const notes = chordNotes(note, s.chord);
    this.lastVel = vel;
    if (s.arp) {
      this.pressed.set(note, { notes, arp: true });
      if (s.latch && this.releasedAll) { this.held = []; this.releasedAll = false; }
      for (const n of notes) if (!this.held.includes(n)) this.held.push(n);
      this.startArp();
      return;
    }
    // Sans accord, la voix garde la clé de la note (pédale de sustain) ; sinon une clé par note de l'accord.
    const keys = notes.map(n => (s.chord === 'off' ? note : `k:${note}:${n}`));
    const syn = this.synth();
    this.pressed.set(note, { notes, keys, arp: false, syn });
    notes.forEach((n, i) => {
      syn.noteOn(n, vel, undefined, keys[i]);
      this.onNote(n, vel, true);
    });
  }

  noteOff(note) {
    const entry = this.pressed.get(note);
    if (!entry) return;
    this.pressed.delete(note);
    if (entry.arp) {
      if (this.st.latch && this.st.arp) { if (![...this.pressed.values()].some(e => e.arp)) this.releasedAll = true; return; }
      const still = [...this.pressed.values()].flatMap(e => (e.arp ? e.notes : []));
      this.held = this.held.filter(n => !entry.notes.includes(n) || still.includes(n));
      if (!this.held.length) this.stopArp();
      return;
    }
    entry.notes.forEach((n, i) => {
      entry.syn.noteOff(n, false, undefined, entry.keys[i]);
      this.onNote(n, 0, false);
    });
  }

  allOff() {
    this.pressed.clear();
    this.releasedAll = false;
    this.held = [];
    this.stopArp();
  }

  // Arpège dans l'ordre demandé, étendu sur plusieurs octaves.
  sequence() {
    const s = this.st;
    const base = s.mode === 'played' ? [...this.held] : [...this.held].sort((a, b) => a - b);
    const notes = [];
    for (let o = 0; o < s.octaves; o++) for (const n of base) notes.push(n + 12 * o);
    if (s.mode === 'down') notes.reverse();
    if (s.mode === 'updown' && notes.length > 2) notes.push(...notes.slice(1, -1).reverse());
    return notes;
  }

  stepDur() { return 240 / this.engine.bpm / this.st.rate; }

  startArp() {
    if (this.timer) return;
    this.idx = 0;
    this.next = this.engine.gridTime(this.st.rate);   // premier pas sur la grille (calé sur les boucles)
    this.timer = setInterval(() => this.tick(), 20);
    this.tick();
  }

  stopArp() {
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const now = this.engine.ctx.currentTime;
    if (this.next < now - 0.1) this.next = this.engine.gridTime(this.st.rate);   // onglet en veille : on se recale
    while (this.next < now + 0.1) {
      const seq = this.sequence();
      if (!seq.length) { this.stopArp(); return; }
      const n = this.st.mode === 'random' ? seq[Math.floor(Math.random() * seq.length)] : seq[this.idx % seq.length];
      const dur = this.stepDur() * this.st.gate;
      const key = `arp:${n}`;
      const syn = this.synth();
      syn.noteOn(n, this.lastVel, this.next, key);
      syn.noteOff(n, false, this.next + dur, key);
      this.onNoteAt(n, this.lastVel, this.next, dur);
      this.idx++;
      this.next += this.stepDur();
    }
  }

  // Changement de réglage pendant qu'on joue : l'arpège s'arrête si on le coupe.
  refresh() {
    if (!this.st.arp || (!this.st.latch && !this.pressed.size)) { this.held = []; this.stopArp(); }
  }
}
