// Émulation Roland TR-909 : 11 instruments synthétisés en direct (comme les circuits analogiques de la machine) et
// séquenceur 16 pas calé sur le transport du moteur. L'horloge, la distorsion, les kits et l'état sont communs aux
// boîtes à rythmes (js/drummachine.js).
import { DrumMachine, drumMachineDef } from './drummachine.js';

// Paramètres propres à chaque instrument (K1-K4) ; tous ont en plus Drive et Shape (K5-K6).
export const TR_INSTR = [
  { id: 'bd', params: ['tune', 'attack', 'decay', 'level'] },
  { id: 'sd', params: ['tune', 'tone', 'snappy', 'level'] },
  { id: 'lt', params: ['tune', 'decay', 'level'] },
  { id: 'mt', params: ['tune', 'decay', 'level'] },
  { id: 'ht', params: ['tune', 'decay', 'level'] },
  { id: 'rs', params: ['level'] },
  { id: 'hc', params: ['level'] },
  { id: 'ch', params: ['decay', 'level'] },
  { id: 'oh', params: ['decay', 'level'] },
  { id: 'cr', params: ['tune', 'level'] },
  { id: 'rd', params: ['tune', 'level'] },
];

// Voie de la table de mixage qui reçoit chaque instrument.
export const TR_GROUPS = { bd: 'bd', sd: 'snare', rs: 'snare', hc: 'snare', lt: 'toms', mt: 'toms', ht: 'toms', ch: 'hats', oh: 'hats', cr: 'cym', rd: 'cym' };

// Kits de son : réglages des instruments (positions 0..1) ; ce qui n'est pas donné garde sa valeur par défaut.
export const TR_CATS = ['hard', 'classic', 'fx'];
const ALL = fn => Object.fromEntries(TR_INSTR.map(i => [i.id, fn(i.id)]));
export const TR_KITS = [
  { id: 'gabber', cat: 'hard', v: { bd: { drive: 0.45, shape: 0.5 } } },   // grosse caisse saturée « tube » : le son gabber, par défaut
  { id: 'rotterdam', cat: 'hard', v: { bd: { tune: 0.35, attack: 0.7, decay: 0.75, drive: 0.8, shape: 0.5 }, sd: { drive: 0.3, shape: 0.25 }, oh: { decay: 0.4 } } },
  { id: 'terror', cat: 'hard', v: { bd: { tune: 0.6, attack: 0.9, decay: 0.4, drive: 1, shape: 0.25 }, sd: { tone: 0.7, snappy: 0.8, drive: 0.5, shape: 0.25 }, ch: { decay: 0.3 }, oh: { decay: 0.3 } } },
  // Early hardcore : grosse caisse longue écrêtée, clap et caisse claire saturés (style des grandes salles du milieu des années 90).
  { id: 'early', cat: 'hard', v: { bd: { tune: 0.3, attack: 0.6, decay: 0.85, drive: 0.75, shape: 0.25 }, sd: { tone: 0.45, snappy: 0.7, drive: 0.35, shape: 0.5 }, hc: { drive: 0.4, shape: 0.25, level: 0.85 }, oh: { decay: 0.45 }, cr: { level: 0.7 } } },
  { id: 'doef', cat: 'hard', v: { bd: { tune: 0.4, attack: 0.5, decay: 0.7, drive: 0.9, shape: 0.5 }, sd: { drive: 0.5, shape: 0.25 }, hc: { drive: 0.5, shape: 0.5 }, ch: { decay: 0.35 } } },
  { id: 'clipped', cat: 'hard', v: { bd: { tune: 0.45, attack: 0.8, decay: 0.6, drive: 1, shape: 0.25 }, sd: { drive: 0.7, shape: 0.25 }, hc: { drive: 0.7, shape: 0.25 }, rs: { drive: 0.6, shape: 0.25 }, oh: { drive: 0.3, shape: 0.25 } } },
  { id: 'industrial', cat: 'hard', v: { bd: { drive: 0.9, shape: 1 }, sd: { drive: 0.7, shape: 0.75 }, lt: { drive: 0.6, shape: 1 }, mt: { drive: 0.6, shape: 1 }, ht: { drive: 0.6, shape: 1 }, cr: { drive: 0.5, shape: 0.75 } } },
  { id: 'clean', cat: 'classic', v: {} },
  { id: 'house', cat: 'classic', v: { bd: { tune: 0.45, attack: 0.4, decay: 0.6 }, sd: { tone: 0.4, snappy: 0.5 }, oh: { decay: 0.6 } } },
  { id: 'techno', cat: 'classic', v: { bd: { tune: 0.4, attack: 0.6, decay: 0.55, drive: 0.2, shape: 0 }, ch: { decay: 0.3 }, rd: { level: 0.7 } } },
  { id: 'lofi', cat: 'fx', v: ALL(() => ({ drive: 0.5, shape: 1 })) },
  { id: 'folded', cat: 'fx', v: ALL(() => ({ drive: 0.6, shape: 0.75 })) },
];

export const TR_DEF = drumMachineDef({
  prefix: 'tr',
  instruments: TR_INSTR,
  paramDefaults: { tune: 0.5, attack: 0.5, decay: 0.5, level: 0.8, drive: 0, shape: 0, tone: 0.5, snappy: 0.6 },
  globalDefaults: { accent: 0.6, shuffle: 0, volume: 0.8 },
  kits: TR_KITS,
  cats: TR_CATS,
  kitDefault: 'gabber',
  init(set, all) {
    // 1 : gabber
    set(0, 'bd', [0, 4, 8, 12], 2); set(0, 'oh', [2, 6, 10, 14]); set(0, 'hc', [4, 12]);
    // 2 : rave
    set(1, 'bd', [0, 4, 8, 12], 2); set(1, 'sd', [4, 12]); set(1, 'ch', all.filter(s => s % 4 !== 2));
    set(1, 'oh', [2, 6, 10, 14]); set(1, 'rd', [0, 4, 8, 12]);
    // 3 : breakbeat
    set(2, 'bd', [0, 2, 10, 11]); set(2, 'sd', [7, 9, 15]); set(2, 'sd', [4, 12], 2); set(2, 'ch', all.filter(s => s % 2 === 0));
    // 4 : roll de grosse caisse
    set(3, 'bd', all); set(3, 'bd', [0, 4, 8, 12], 2); set(3, 'cr', [0]);
  },
});
export const kitParams = TR_DEF.kitParams;
export const defaultTrState = TR_DEF.defaultState;
export const mergeTrState = TR_DEF.mergeState;
export const trKnobDefs = TR_DEF.knobDefs;

export class TR909 extends DrumMachine {
  constructor(engine, getState) { super(engine, getState, TR_INSTR, TR_GROUPS); }

  metal909(time, dur, base) { return this.metal(time, dur, [2, 3, 4.16, 5.43, 6.79, 8.21].map(r => base * r)); }

  voice(id, time, out, level) {
    const tune = this.p(id, 'tune');
    const decay = this.p(id, 'decay');
    switch (id) {
      case 'bd': {
        const f0 = 42 + tune * 30;
        const dec = 0.12 + decay * 1.1;
        const o = this.osc('sine', f0 * 6, time, dec * 2 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.6, time + 0.012);
        o.frequency.exponentialRampToValueAtTime(f0, time + 0.09);
        const body = this.env(this.gain(), time, 1, dec, 0.002);
        const click = this.env(this.gain(), time, this.p('bd', 'attack') * 0.9, 0.01);
        this.noiseSrc(time, 0.03).connect(this.filter('bandpass', 3200, 0.8)).connect(click);
        o.connect(body).connect(out);
        click.connect(out);
        break;
      }
      case 'sd': {
        const k = 0.8 + tune * 0.5;
        const body = this.env(this.gain(), time, 0.8, 0.09);
        for (const f of [180 * k, 330 * k]) {
          const o = this.osc('triangle', f * 1.5, time, 0.3);
          o.frequency.exponentialRampToValueAtTime(f, time + 0.02);
          o.connect(body);
        }
        const snappy = this.p('sd', 'snappy');
        const wires = this.env(this.gain(), time, 0.2 + snappy, 0.1 + snappy * 0.18);
        this.noiseSrc(time, 0.5).connect(this.filter('highpass', 1500)).connect(this.filter('lowpass', 4000 + this.p('sd', 'tone') * 9000)).connect(wires);
        body.connect(out);
        wires.connect(out);
        break;
      }
      case 'lt': case 'mt': case 'ht': {
        const f = { lt: 95, mt: 135, ht: 185 }[id] * (0.75 + tune * 0.5);
        const dec = 0.15 + decay * 0.8;
        const o = this.osc('sine', f * 1.35, time, dec * 2 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f, time + 0.08);
        o.connect(this.env(this.gain(), time, 1, dec)).connect(out);
        this.noiseSrc(time, 0.1).connect(this.filter('lowpass', 2000)).connect(this.env(this.gain(), time, 0.15, 0.03)).connect(out);
        break;
      }
      case 'rs': {
        const g = this.env(this.gain(), time, 1, 0.025);
        this.osc('triangle', 1700, time, 0.1).connect(g);
        this.osc('triangle', 500, time, 0.1).connect(g);
        g.connect(this.filter('bandpass', 1800, 2)).connect(out);
        break;
      }
      case 'hc': {
        const g = this.gain(0);
        const bursts = [0, 0.011, 0.023, 0.034];
        g.gain.setValueAtTime(0, time);
        for (const b of bursts) {
          g.gain.setValueAtTime(1, time + b);
          g.gain.setTargetAtTime(0.1, time + b, 0.003);
        }
        g.gain.setValueAtTime(0.9, time + 0.045);
        g.gain.setTargetAtTime(0, time + 0.045, 0.05);
        this.noiseSrc(time, 0.4).connect(this.filter('bandpass', 1100, 1.5)).connect(g).connect(out);
        out.gain.value = level * 1.6;
        break;
      }
      case 'ch': case 'oh': {
        this.chokeHat(time);
        const dec = id === 'ch' ? 0.02 + decay * 0.12 : 0.12 + decay * 0.9;
        const g = this.env(this.gain(), time, 1, dec);
        this.metal909(time, dec * 2 + 0.05, 40).connect(this.filter('bandpass', 10000, 0.8)).connect(this.filter('highpass', 7000)).connect(g);
        this.noiseSrc(time, dec * 2).connect(this.filter('highpass', 8000)).connect(this.gain(0.3)).connect(g);
        g.connect(out);
        if (id === 'oh') this.openHat = g;
        break;
      }
      case 'cr': case 'rd': {
        const k = 0.8 + tune * 0.4;
        const dec = id === 'cr' ? 1.6 : 1.1;
        const g = this.env(this.gain(), time, 1, dec);
        const base = (id === 'cr' ? 47 : 58) * k;
        this.metal909(time, dec * 2, base).connect(this.filter('bandpass', id === 'cr' ? 8000 : 9500, id === 'cr' ? 0.5 : 2)).connect(g);
        if (id === 'cr') this.noiseSrc(time, dec * 2).connect(this.filter('highpass', 4000 * k)).connect(this.gain(0.5)).connect(g);
        g.connect(out);
        break;
      }
    }
  }
}
