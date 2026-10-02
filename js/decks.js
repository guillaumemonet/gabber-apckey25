// Platines : deux decks A et B (lecteur à vitesse variable pour le scratch, voir deck-worklet.js),
// égaliseur 3 bandes et filtre DJ par deck, crossfader à puissance constante, synchro sur le tempo global.
import { t } from './i18n.js';

export const DECK_IDS = ['A', 'B'];
const WORKLET = 'js/deck-worklet.js?v=2';
const RPM = 100 / 3;   // 33 ⅓ tours par minute : un tour de vinyle = 1,8 s de son à vitesse normale

// Réglages d'un deck (positions 0..1, sauf pitch en fraction : ±0,08).
const deckDefaults = () => ({ sampleId: null, name: '', bpm: 0, cue: 0, loop: true, sync: true, pitch: 0, vol: 0.8, low: 0.5, mid: 0.5, high: 0.5, filter: 0.5 });
export const DECK_KNOBS = ['vol', 'low', 'mid', 'high', 'filter'];

export function defaultDecksState() {
  return { A: deckDefaults(), B: deckDefaults(), xfade: 0.5 };
}

export function mergeDecksState(saved) {
  const base = defaultDecksState();
  if (!saved || typeof saved !== 'object') return base;
  for (const id of DECK_IDS) {
    const s = saved[id];
    if (!s || typeof s !== 'object') continue;
    const d = base[id];
    if (typeof s.sampleId === 'string') { d.sampleId = s.sampleId; d.name = String(s.name ?? ''); }
    if (Number.isFinite(s.bpm) && s.bpm > 0) d.bpm = s.bpm;
    if (Number.isFinite(s.cue) && s.cue >= 0) d.cue = s.cue;
    for (const k of ['loop', 'sync']) if (typeof s[k] === 'boolean') d[k] = s[k];
    if (Number.isFinite(s.pitch)) d.pitch = Math.max(-0.08, Math.min(0.08, s.pitch));
    for (const k of DECK_KNOBS) if (Number.isFinite(s[k])) d[k] = Math.min(1, Math.max(0, s[k]));
  }
  if (Number.isFinite(saved.xfade)) base.xfade = Math.min(1, Math.max(0, saved.xfade));
  return base;
}

// Page de potards (APC : Maj + REC, 2e appui) : volume, basses, filtre de chaque deck, crossfader.
export function deckKnobDefs() {
  const pct = v => `${Math.round(v * 100)}%`;
  const eq = v => (v < 0.02 ? 'kill' : `${v > 0.5 ? '+' : ''}${Math.round((v - 0.5) * 24)} dB`);
  const flt = v => (Math.abs(v - 0.5) < 0.02 ? '—' : v < 0.5 ? `LP ${Math.round((0.5 - v) * 200)}%` : `HP ${Math.round((v - 0.5) * 200)}%`);
  const d = (deck, id, fmt) => ({ id, deck, label: `${deck} · ${t(`deck.k.${id}`)}`, min: 0, max: 1, def: deckDefaults()[id], fmt });
  return [d('A', 'vol', pct), d('A', 'low', eq), d('A', 'filter', flt), d('B', 'vol', pct), d('B', 'low', eq), d('B', 'filter', flt),
    { id: 'xfade', deck: 'x', label: t('deck.xfade'), min: 0, max: 1, def: 0.5, fmt: v => (Math.abs(v - 0.5) < 0.02 ? 'A = B' : v < 0.5 ? `A ${Math.round((0.5 - v) * 200)}%` : `B ${Math.round((v - 0.5) * 200)}%`) }];
}

const eqDb = v => (v < 0.02 ? -40 : (v - 0.5) * 24);   // tout à gauche : bande coupée (« kill »)

class Deck {
  constructor(decks, id) {
    this.decks = decks;
    this.id = id;
    const ctx = this.ctx = decks.ctx;
    this.node = new AudioWorkletNode(ctx, 'deck', { numberOfInputs: 0, outputChannelCount: [2] });
    const biquad = (type, freq, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = freq; b.Q.value = q; return b; };
    this.low = biquad('lowshelf', 220);
    this.mid = biquad('peaking', 1100, 0.8);
    this.high = biquad('highshelf', 4500);
    this.lp = biquad('lowpass', 20000, 1.2);
    this.hp = biquad('highpass', 10, 1.2);
    this.vol = ctx.createGain();
    this.xf = ctx.createGain();
    this.node.connect(this.low).connect(this.mid).connect(this.high).connect(this.lp).connect(this.hp).connect(this.vol).connect(this.xf).connect(decks.out);
    this.buffer = null;
    this.playing = false;
    this.pos = 0;              // position (secondes), renvoyée par le lecteur
    this.at = 0;               // instant (horloge audio) de cette position
    this.speed = 0;            // vitesse à cet instant (1 = normale)
    this.scratching = false;
    this.node.port.onmessage = e => {
      if (e.data.pos !== undefined) { this.pos = e.data.pos; this.at = e.data.at ?? this.ctx.currentTime; this.speed = e.data.speed ?? 0; decks.onPos(this.id); }
      if (e.data.ended) { this.playing = false; decks.onChange(this.id); }
    };
  }

  get st() { return this.decks.st[this.id]; }
  get duration() { return this.buffer?.duration ?? 0; }
  // Position estimée à l'instant `t` (horloge audio), entre deux rapports du lecteur.
  posAt(t = this.ctx.currentTime) {
    const d = this.duration;
    if (!d) return 0;
    let p = this.pos + Math.max(0, Math.min(0.1, t - this.at)) * this.speed;
    if (this.st.loop) p = ((p % d) + d) % d; else p = Math.max(0, Math.min(d, p));
    return p;
  }

  // Vitesse de lecture : synchro sur le tempo global (si le tempo du son est connu), sinon pitch.
  baseRate() {
    const s = this.st;
    if (s.sync && s.bpm) return this.decks.engine.bpm / s.bpm;
    return 1 + s.pitch;
  }

  setBuffer(buffer) {
    this.buffer = buffer;
    this.playing = false;
    const chans = [0, Math.min(1, buffer.numberOfChannels - 1)].map(c => buffer.getChannelData(c).slice());
    this.node.port.postMessage({ buffer: chans, sampleRate: buffer.sampleRate, rate: 0, loop: this.st.loop });
    this.seek(this.st.cue);
  }

  seek(sec) {
    this.pos = Math.max(0, Math.min(this.duration, sec));
    this.at = this.ctx.currentTime;
    this.node.port.postMessage({ pos: this.pos, sampleRate: this.buffer?.sampleRate });
  }

  // Lecture : avec la synchro, le son part au début de la mesure suivante de la grille (s'il joue déjà quelque chose).
  play(at) {
    if (!this.buffer || this.playing) return;
    this.playing = true;
    let startAt = at;
    if (startAt === undefined && this.st.sync && this.st.bpm) {
      const e = this.decks.engine;
      const busy = e.seqRunning || this.decks.busy() || [...e.padVoices.values()].some(v => v.mode === 'loop');
      if (busy && e.origin !== null) startAt = e.nextBar();
    }
    this.node.port.postMessage({ rate: this.baseRate(), startAt });
    this.decks.onChange(this.id);
  }

  pause() {
    this.playing = false;
    this.node.port.postMessage({ rate: 0 });
    this.decks.onChange(this.id);
  }

  // Cue : en lecture, retour au point de cue et pause ; à l'arrêt, le point de cue devient la position actuelle.
  cue() {
    if (this.playing) { this.pause(); this.seek(this.st.cue); }
    else { this.st.cue = this.pos; }
    this.decks.onChange(this.id);
  }

  // Scratch : la main pose le disque, le fait tourner (de `sec` secondes de son, en avant ou en arrière), puis le relâche.
  scratchStart() { this.scratching = true; this.node.port.postMessage({ hold: true }); }
  scratchMove(sec) { if (this.scratching) this.node.port.postMessage({ scrub: sec }); }
  scratchEnd() {
    this.scratching = false;
    this.node.port.postMessage({ hold: false, rate: this.playing ? this.baseRate() : 0 });
  }

  // Réglages : égaliseur, filtre DJ (gauche = passe-bas, droite = passe-haut), volume, vitesse.
  update() {
    this.updateTone();
    this.node.port.postMessage({ loop: this.st.loop });
    if (this.playing && !this.scratching) this.node.port.postMessage({ rate: this.baseRate() });
  }

  // Égaliseur, filtre et volume seulement (sans toucher à la vitesse : un départ programmé reste à son instant).
  updateTone() {
    const s = this.st;
    const now = this.ctx.currentTime;
    this.low.gain.setTargetAtTime(eqDb(s.low), now, 0.01);
    this.mid.gain.setTargetAtTime(eqDb(s.mid), now, 0.01);
    this.high.gain.setTargetAtTime(eqDb(s.high), now, 0.01);
    const f = s.filter;
    this.lp.frequency.setTargetAtTime(f < 0.48 ? 200 * Math.pow(100, f / 0.48) : 20000, now, 0.02);
    this.hp.frequency.setTargetAtTime(f > 0.52 ? 10 * Math.pow(400, (f - 0.52) / 0.48) : 10, now, 0.02);
    this.vol.gain.setTargetAtTime(s.vol * s.vol * 1.2, now, 0.01);
  }
}

export class Decks {
  static async load(ctx) {
    await ctx.audioWorklet.addModule(WORKLET);
  }

  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.out = this.ctx.createGain();   // sortie : voie « Platines » de la table de mixage
    this.decks = Object.fromEntries(DECK_IDS.map(id => [id, new Deck(this, id)]));
    this.busy = () => false;            // la timeline joue (branché par l'application)
    this.onPos = () => {};
    this.onChange = () => {};
    this.update();
  }

  get st() { return this.getState(); }
  get playing() { return DECK_IDS.some(id => this.decks[id].playing); }

  update() {
    this.updateXfade();
    for (const d of Object.values(this.decks)) d.update();
  }

  // Crossfader à puissance constante.
  updateXfade() {
    const x = this.st.xfade;
    const now = this.ctx.currentTime;
    this.decks.A.xf.gain.setTargetAtTime(Math.cos(x * Math.PI / 2), now, 0.01);
    this.decks.B.xf.gain.setTargetAtTime(Math.sin(x * Math.PI / 2), now, 0.01);
  }

  stopAll() { for (const d of Object.values(this.decks)) if (d.playing) d.pause(); }
}

// Tempo d'un son : connu (boucle de la bibliothèque), sinon deviné en supposant un nombre entier de mesures.
export function guessBpm(duration, knownBpm, globalBpm) {
  if (knownBpm) return knownBpm;
  if (!(duration > 0.5)) return 0;
  const bars = Math.max(1, Math.round(duration * globalBpm / 240));
  const bpm = bars * 240 / duration;
  return bpm >= 60 && bpm <= 260 ? Math.round(bpm * 100) / 100 : 0;
}

export const vinylTurns = sec => (sec * RPM) / 60;   // tours du disque pour une durée de son
export const rateFromSpin = turnsPerSecond => (turnsPerSecond * 60) / RPM;
export const secFromTurns = turns => (turns * 60) / RPM;   // secondes de son pour des tours de disque
