// Émulation Roland TR-808 : 13 instruments synthétisés en direct, d'après les circuits de la machine (grosse caisse à
// résonateur et longue tenue, caisse claire à deux oscillateurs, charleys et cymbale à six oscillateurs carrés, cowbell,
// claves, maracas…). Même séquenceur, mêmes patterns, kits et distorsion que la TR-909 (js/drummachine.js).
import { DrumMachine, drumMachineDef } from './drummachine.js';

export const TR8_INSTR = [
  { id: 'bd', params: ['tune', 'tone', 'decay', 'level'] },
  { id: 'sd', params: ['tune', 'tone', 'snappy', 'level'] },
  { id: 'lt', params: ['tune', 'decay', 'level'] },
  { id: 'mt', params: ['tune', 'decay', 'level'] },
  { id: 'ht', params: ['tune', 'decay', 'level'] },
  { id: 'rs', params: ['tune', 'level'] },
  { id: 'cp', params: ['decay', 'level'] },
  { id: 'ch', params: ['decay', 'level'] },
  { id: 'oh', params: ['decay', 'level'] },
  { id: 'cy', params: ['tone', 'decay', 'level'] },
  { id: 'cb', params: ['tune', 'level'] },
  { id: 'cl', params: ['tune', 'level'] },
  { id: 'ma', params: ['level'] },
];

// Les six oscillateurs carrés des charleys et de la cymbale (Hz).
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export const TR8_CATS = ['hard', 'classic', 'fx'];
const ALL = fn => Object.fromEntries(TR8_INSTR.map(i => [i.id, fn(i.id)]));
export const TR8_KITS = [
  { id: 'clean', cat: 'classic', v: {} },
  { id: 'electro', cat: 'classic', v: { bd: { decay: 0.6, tone: 0.6 }, sd: { tone: 0.6, snappy: 0.7 }, ch: { decay: 0.3 } } },
  { id: 'hiphop', cat: 'classic', v: { bd: { tune: 0.4, tone: 0.35, decay: 0.8 }, sd: { tune: 0.4, tone: 0.4, snappy: 0.4 }, oh: { decay: 0.35 } } },
  { id: 'bass', cat: 'classic', v: { bd: { tune: 0.3, tone: 0.25, decay: 1 }, sd: { snappy: 0.6 }, ch: { decay: 0.25 } } },
  // Grosse caisse longue saturée : le « boom » des morceaux hardcore et speedcore faits à la 808.
  { id: 'boom', cat: 'hard', v: { bd: { tune: 0.35, tone: 0.3, decay: 0.85, drive: 0.55, shape: 0.5 }, cp: { drive: 0.3, shape: 0.5 } } },
  { id: 'gabber', cat: 'hard', v: { bd: { tune: 0.55, tone: 0.8, decay: 0.5, drive: 0.9, shape: 0.25 }, cp: { drive: 0.4, shape: 0.25 }, sd: { drive: 0.35, shape: 0.25 } } },
  { id: 'distorted', cat: 'hard', v: ALL(() => ({ drive: 0.45, shape: 0.5 })) },
  { id: 'lofi', cat: 'fx', v: ALL(() => ({ drive: 0.5, shape: 1 })) },
  { id: 'folded', cat: 'fx', v: ALL(() => ({ drive: 0.6, shape: 0.75 })) },
];

export const TR8_DEF = drumMachineDef({
  prefix: 'tr8',
  instruments: TR8_INSTR,
  paramDefaults: { tune: 0.5, attack: 0.5, decay: 0.5, level: 0.8, drive: 0, shape: 0, tone: 0.5, snappy: 0.5 },
  globalDefaults: { accent: 0.6, shuffle: 0, volume: 0.8 },
  kits: TR8_KITS,
  cats: TR8_CATS,
  kitDefault: 'clean',
  init(set, all) {
    const even = all.filter(s => s % 2 === 0);
    // 1 : électro
    set(0, 'bd', [0, 6, 10]); set(0, 'bd', [0], 2); set(0, 'cp', [4, 12]); set(0, 'ch', even); set(0, 'oh', [14]);
    // 2 : boom bap
    set(1, 'bd', [0, 7, 8]); set(1, 'sd', [4, 12], 2); set(1, 'ch', even); set(1, 'ma', all.filter(s => s % 2));
    // 3 : hardcore à la 808
    set(2, 'bd', [0, 4, 8, 12], 2); set(2, 'cp', [4, 12]); set(2, 'oh', [2, 6, 10, 14]); set(2, 'ch', [1, 3, 5, 7, 9, 11, 13, 15]);
    // 4 : percussions (cowbell, claves, toms, maracas)
    set(3, 'bd', [0, 8]); set(3, 'cb', [0, 3, 6, 10, 12]); set(3, 'cl', [3, 7, 11]); set(3, 'lt', [12]); set(3, 'mt', [14]); set(3, 'ma', all);
  },
});
export const tr8KitParams = TR8_DEF.kitParams;
export const defaultTr8State = TR8_DEF.defaultState;
export const mergeTr8State = TR8_DEF.mergeState;
export const tr8KnobDefs = TR8_DEF.knobDefs;

export class TR808 extends DrumMachine {
  constructor(engine, getState) { super(engine, getState, TR8_INSTR); }

  voice(id, time, out) {
    const tune = this.p(id, 'tune');
    const decay = this.p(id, 'decay');
    const tone = this.p(id, 'tone');
    switch (id) {
      case 'bd': {
        // Résonateur : une sinusoïde qui descend légèrement au départ, puis tient (Decay : du coup sec au long boom).
        const f0 = 42 + tune * 26;
        const dec = 0.08 + decay * decay * 2.2;
        const o = this.osc('sine', f0 * 1.9, time, dec * 2.5 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f0, time + 0.035);
        o.connect(this.env(this.gain(), time, 1, dec, 0.0015)).connect(out);
        // Tone : le clic d'attaque, plus ou moins brillant.
        const click = this.env(this.gain(), time, 0.25 + tone * 0.5, 0.006);
        this.osc('triangle', f0 * 8, time, 0.03).connect(this.filter('lowpass', 900 + tone * 5000)).connect(click);
        click.connect(out);
        break;
      }
      case 'sd': {
        // Deux oscillateurs (238 et 476 Hz) et du bruit ; Tone règle leur équilibre, Snappy le bruit du timbre.
        const k = 0.85 + tune * 0.35;
        const body = this.env(this.gain(), time, 1, 0.11);
        const lo = this.osc('sine', 238 * k * 1.15, time, 0.4);
        lo.frequency.exponentialRampToValueAtTime(238 * k, time + 0.015);
        lo.connect(this.gain(1 - tone * 0.5)).connect(body);
        this.osc('sine', 476 * k, time, 0.3).connect(this.env(this.gain(), time, 0.3 + tone * 0.6, 0.06)).connect(body);
        const snappy = this.p('sd', 'snappy');
        const wires = this.env(this.gain(), time, 0.15 + snappy * 0.9, 0.12 + snappy * 0.12);
        this.noiseSrc(time, 0.5).connect(this.filter('highpass', 1800)).connect(this.filter('lowpass', 5000 + tone * 8000)).connect(wires);
        body.connect(out);
        wires.connect(out);
        break;
      }
      case 'lt': case 'mt': case 'ht': {
        const f = { lt: 82, mt: 122, ht: 168 }[id] * (0.8 + tune * 0.45);
        const dec = 0.18 + decay * 0.7;
        const o = this.osc('sine', f * 1.25, time, dec * 2.5 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f, time + 0.1);
        o.connect(this.env(this.gain(), time, 1, dec)).connect(out);
        this.noiseSrc(time, 0.05).connect(this.filter('bandpass', f * 6, 1)).connect(this.env(this.gain(), time, 0.12, 0.02)).connect(out);
        break;
      }
      case 'rs': {
        const k = 0.85 + tune * 0.3;
        const g = this.env(this.gain(), time, 1.4, 0.018);
        this.osc('sine', 455 * k, time, 0.08).connect(g);
        this.osc('sine', 1667 * k, time, 0.08).connect(this.gain(0.8)).connect(g);
        g.connect(this.filter('highpass', 300)).connect(out);
        break;
      }
      case 'cp': {
        // Trois salves de bruit rapprochées puis la queue (Decay), filtrées autour de 1 kHz.
        const g = this.gain(0);
        g.gain.setValueAtTime(0, time);
        for (const b of [0, 0.01, 0.02]) {
          g.gain.setValueAtTime(1, time + b);
          g.gain.setTargetAtTime(0.05, time + b, 0.0025);
        }
        g.gain.setValueAtTime(0.8, time + 0.03);
        g.gain.setTargetAtTime(0, time + 0.03, 0.03 + decay * 0.12);
        this.noiseSrc(time, 1).connect(this.filter('bandpass', 1050, 2.2)).connect(this.filter('highpass', 600)).connect(g).connect(this.gain(2.2)).connect(out);
        break;
      }
      case 'ch': case 'oh': {
        this.chokeHat(time);
        const dec = id === 'ch' ? 0.025 + decay * 0.07 : 0.15 + decay * 0.75;
        const g = this.env(this.gain(), time, 1.6, dec);
        this.metal(time, dec * 2.5 + 0.05, METAL).connect(this.filter('bandpass', 10000, 1)).connect(this.filter('highpass', 7500)).connect(g);
        g.connect(out);
        if (id === 'oh') this.openHat = g;
        break;
      }
      case 'cy': {
        // Deux bandes : le corps (3,4 kHz, plus court) et le chuintement aigu (long) ; Tone les équilibre.
        const dec = 0.5 + decay * 1.6;
        const m = this.metal(time, dec * 2.5, METAL);
        m.connect(this.filter('bandpass', 3400, 1.2)).connect(this.env(this.gain(), time, 0.8 * (1 - tone * 0.6), dec * 0.35)).connect(out);
        m.connect(this.filter('highpass', 7000)).connect(this.env(this.gain(), time, 0.6 + tone * 0.9, dec)).connect(out);
        break;
      }
      case 'cb': {
        const k = 0.85 + tune * 0.3;
        const g = this.gain(0);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(1, time + 0.001);
        g.gain.setTargetAtTime(0.35, time + 0.001, 0.008);
        g.gain.setTargetAtTime(0, time + 0.03, 0.08);
        for (const f of [540, 800]) this.osc('square', f * k, time, 0.6).connect(g);
        g.connect(this.filter('bandpass', 2640 * k, 1.4)).connect(this.gain(1.4)).connect(out);
        break;
      }
      case 'cl': {
        const g = this.env(this.gain(), time, 1, 0.03);
        this.osc('sine', 2500 * (0.8 + tune * 0.4), time, 0.12).connect(g).connect(out);
        break;
      }
      case 'ma': {
        const g = this.env(this.gain(), time, 0.9, 0.03, 0.004);
        this.noiseSrc(time, 0.15).connect(this.filter('highpass', 5000)).connect(g).connect(out);
        break;
      }
    }
  }
}
