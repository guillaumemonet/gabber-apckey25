// Moteur audio : synthé polyphonique (clavier), sampler (pads), delay et reverb en départs,
// effets de performance (roll, filtres, tape-stop, pump) et égaliseur général.
import { PAGES, WAVES, MODES, toValue } from './params.js';

const PAD_DEFS = Object.fromEntries(PAGES.pad.params.map(d => [d.id, d]));
const midiToFreq = n => 440 * Math.pow(2, (n - 69) / 12);

// Caractère d'une voix de synthé (réglé par les presets, non exposé aux potards).
export const DEFAULT_VOICE = {
  unison: 2,          // oscillateurs empilés, écartés par le potard « Désaccord »
  sub: 0,             // niveau du sous-oscillateur (octave en dessous)
  bend: 0,            // demi-tons de départ, qui glissent vers la note (hoover, kick)
  bendTime: 0.06,
  vib: 0,             // vibrato en demi-tons
  vibRate: 5.5,
  vibDelay: 0.25,
  filterType: 'lowpass',
  lfoRate: 0,         // LFO sur la coupure (screech)
  lfoDepth: 0,
  decay: 0.25,
  sustain: 0.75,
  mono: false,        // monophonique avec glissé entre notes liées (acid)
  glide: 0,
  octave: 0,          // transposition en demi-tons
};

function makeImpulse(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function driveCurve(amount) {
  const k = amount * 60;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = k ? ((1 + k) * x) / (1 + k * Math.abs(x)) : x;
  }
  return curve;
}

export class Engine {
  constructor() {
    const ctx = this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.values = {};
    this.voiceCfg = { ...DEFAULT_VOICE };
    this.voices = new Map();      // note -> voix synthé ('mono' pour la voix monophonique)
    this.monoStack = [];          // notes tenues en mode mono (la dernière joue)
    this.sustained = new Set();   // notes relâchées mais tenues par la pédale
    this.sustain = false;
    this.padVoices = new Map();   // index pad -> voix sampler
    this.onPadState = () => {};
    this.bpm = 120;
    this.origin = null;           // instant (ctx) du temps 1 de la mesure de référence

    const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const band = (type, freq, q = 1) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };

    this.master = gain();

    // Roll / beat-repeat : une ligne à retard qui enregistre en continu et boucle sur elle-même à l'engagement.
    this.stDry = gain(1);
    this.stIn = gain(1);
    this.stDelay = ctx.createDelay(4);
    this.stFb = gain(0);
    this.stWet = gain(0);
    this.perfIn = gain();
    this.master.connect(this.stDry).connect(this.perfIn);
    this.master.connect(this.stIn).connect(this.stDelay).connect(this.stWet).connect(this.perfIn);
    this.stDelay.connect(this.stFb).connect(this.stDelay);

    // Filtres de performance, puis égaliseur, gain, limiteur.
    this.perfLP = band('lowpass', 20000, 1.2);
    this.perfHP = band('highpass', 10, 1.2);
    this.eq = {
      eqLow: band('lowshelf', 100),
      eqLowMid: band('peaking', 350, 0.9),
      eqMid: band('peaking', 1200, 0.9),
      eqHiMid: band('peaking', 3500, 0.9),
      eqHigh: band('highshelf', 9000),
      eqLP: band('lowpass', 20000, 0.9),
      eqHP: band('highpass', 20, 0.9),
    };
    this.eqGain = gain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.1;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    let node = this.perfIn.connect(this.perfLP).connect(this.perfHP);
    for (const f of Object.values(this.eq)) node = node.connect(f);
    node.connect(this.eqGain).connect(this.limiter);
    this.output = this.limiter;   // point d'écoute de l'enregistreur
    this.limiter.connect(this.analyser).connect(ctx.destination);

    // Delay avec filtre dans la boucle de réinjection.
    this.delayIn = gain();
    this.delay = ctx.createDelay(2);
    this.delayFb = gain();
    const dTone = band('lowpass', 4500, 0.7);
    this.delayIn.connect(this.delay).connect(dTone).connect(this.delayFb).connect(this.delay);
    dTone.connect(this.master);

    this.reverbIn = gain();
    this.reverb = ctx.createConvolver();
    this.reverbIn.connect(this.reverb).connect(this.master);

    // Bus synthé : saturation -> volume -> pump -> sortie, départs avant le pump.
    this.synthIn = gain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    this.synthBus = gain();
    this.pumpGain = gain();
    this.synthDSend = gain(0);
    this.synthRSend = gain(0);
    this.synthIn.connect(this.shaper).connect(this.synthBus).connect(this.pumpGain).connect(this.master);
    this.synthBus.connect(this.synthDSend).connect(this.delayIn);
    this.synthBus.connect(this.synthRSend).connect(this.reverbIn);

    this.padBus = gain();
    this.padBus.connect(this.master);
  }

  resume() { return this.ctx.resume(); }

  // --- Paramètres globaux (pages Synthé, Effets, EQ) ---
  set(id, v) {
    const prev = this.values[id];
    this.values[id] = v;
    const t = this.ctx.currentTime;
    const smooth = (param, val) => param.setTargetAtTime(val, t, 0.015);
    switch (id) {
      case 'synthVol': smooth(this.synthBus.gain, v * v); break;
      case 'padVol': smooth(this.padBus.gain, v * v * 1.2); break;
      case 'master': smooth(this.master.gain, v * v); break;
      case 'dTime': this.delay.delayTime.setTargetAtTime(v, t, 0.05); break;
      case 'dFb': smooth(this.delayFb.gain, v); break;
      case 'dSend': smooth(this.synthDSend.gain, v); break;
      case 'rSend': smooth(this.synthRSend.gain, v); break;
      case 'drive':
        this.shaper.curve = driveCurve(v);
        smooth(this.synthIn.gain, 1 / (1 + v * 2));
        break;
      case 'rSize':
        // Régénérer une réponse impulsionnelle coûte cher : on attend la fin du geste.
        clearTimeout(this._irTimer);
        this._irTimer = setTimeout(() => { this.reverb.buffer = makeImpulse(this.ctx, v); }, prev === undefined ? 0 : 150);
        break;
      case 'cutoff':
        for (const voice of this.voices.values()) voice.filter.frequency.setTargetAtTime(v, t, 0.02);
        break;
      case 'reso':
        for (const voice of this.voices.values()) voice.filter.Q.setTargetAtTime(v, t, 0.02);
        break;
      case 'detune':
        for (const voice of this.voices.values()) {
          for (const o of voice.oscs) o.osc.detune.setTargetAtTime(o.spread * v, t, 0.02);
        }
        break;
      case 'eqLow': case 'eqLowMid': case 'eqMid': case 'eqHiMid': case 'eqHigh':
        smooth(this.eq[id].gain, v);
        break;
      case 'eqLP': case 'eqHP':
        this.eq[id].frequency.setTargetAtTime(v, t, 0.02);
        break;
      case 'eqGain': smooth(this.eqGain.gain, Math.pow(10, v / 20)); break;
    }
  }

  setVoice(cfg) {
    this.allNotesOff();
    this.voiceCfg = { ...DEFAULT_VOICE, ...cfg };
  }

  // --- Synthé ---
  makeVoice(f, velocity, fromFreq) {
    const { ctx, values: p, voiceCfg: c } = this;
    const t = ctx.currentTime;
    const wave = WAVES[p.wave] || 'sawtooth';

    const filter = ctx.createBiquadFilter();
    filter.type = c.filterType;
    filter.Q.value = p.reso;
    const peak = Math.min(18000, p.cutoff * (1 + p.fenv * 10 * (0.4 + velocity * 0.6)));
    filter.frequency.setValueAtTime(peak, t);
    filter.frequency.setTargetAtTime(p.cutoff, t + p.attack, 0.12 + p.fenv * 0.3);

    const amp = ctx.createGain();
    const level = 0.22 * (0.25 + velocity * 0.75);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level, t + p.attack);
    amp.gain.setTargetAtTime(level * c.sustain, t + p.attack, c.decay / 3);

    const n = Math.max(1, c.unison);
    const mix = ctx.createGain();
    mix.gain.value = 1 / Math.sqrt(n);
    const oscs = [];
    for (let k = 0; k < n; k++) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      const spread = n > 1 ? (2 * k) / (n - 1) - 1 : 0;
      osc.detune.value = spread * p.detune;
      osc.connect(mix);
      oscs.push({ osc, spread, ratio: 1 });
    }
    if (c.sub) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const g = ctx.createGain();
      g.gain.value = c.sub * 0.6;
      osc.connect(g).connect(filter);
      oscs.push({ osc, spread: 0, ratio: 0.5 });
    }

    // Hauteur : glissé depuis la note précédente (mono) ou depuis un décalage (bend).
    const start = fromFreq ?? (c.bend ? f * Math.pow(2, c.bend / 12) : f);
    const time = fromFreq ? Math.max(0.005, c.glide) : c.bendTime;
    for (const o of oscs) {
      o.osc.frequency.setValueAtTime(start * o.ratio, t);
      if (start !== f) o.osc.frequency.exponentialRampToValueAtTime(f * o.ratio, t + time);
    }

    const lfos = [];
    if (c.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = c.vibRate;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(c.vib * 100, t + c.vibDelay + 0.2);
      lfo.connect(depth);
      for (const o of oscs) depth.connect(o.osc.detune);
      lfos.push(lfo);
    }
    if (c.lfoRate) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = c.lfoRate;
      const depth = ctx.createGain();
      depth.gain.value = p.cutoff * c.lfoDepth;
      lfo.connect(depth).connect(filter.frequency);
      lfos.push(lfo);
    }

    mix.connect(filter).connect(amp).connect(this.synthIn);
    for (const o of oscs) o.osc.start(t);
    for (const l of lfos) l.start(t);
    return { oscs, lfos, filter, amp, freq: f };
  }

  glideVoice(voice, f) {
    const t = this.ctx.currentTime;
    const time = Math.max(0.005, this.voiceCfg.glide);
    for (const o of voice.oscs) {
      const param = o.osc.frequency;
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.exponentialRampToValueAtTime(f * o.ratio, t + time);
    }
    voice.freq = f;
  }

  releaseVoice(voice, rel) {
    const t = this.ctx.currentTime;
    voice.amp.gain.cancelScheduledValues(t);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, t);
    voice.amp.gain.setTargetAtTime(0, t, rel / 4);
    const end = t + rel * 1.5 + 0.05;
    for (const o of voice.oscs) o.osc.stop(end);
    for (const l of voice.lfos) l.stop(end);
  }

  noteOn(note, velocity) {
    const f = midiToFreq(note + this.voiceCfg.octave);
    if (this.voiceCfg.mono) {
      this.monoStack = this.monoStack.filter(n => n !== note).concat(note);
      const voice = this.voices.get('mono');
      if (voice) this.glideVoice(voice, f);   // notes liées : glissé sans redéclencher
      else this.voices.set('mono', this.makeVoice(f, velocity));
      return;
    }
    this.noteOff(note, true);
    this.voices.set(note, this.makeVoice(f, velocity));
  }

  noteOff(note, immediate = false) {
    if (this.voiceCfg.mono && !immediate) {
      this.monoStack = this.monoStack.filter(n => n !== note);
      const voice = this.voices.get('mono');
      if (!voice) return;
      if (this.monoStack.length) {
        this.glideVoice(voice, midiToFreq(this.monoStack[this.monoStack.length - 1] + this.voiceCfg.octave));
      } else {
        this.voices.delete('mono');
        this.releaseVoice(voice, this.values.release);
      }
      return;
    }
    const voice = this.voices.get(note);
    if (!voice) return;
    if (this.sustain && !immediate) { this.sustained.add(note); return; }
    this.voices.delete(note);
    this.sustained.delete(note);
    this.releaseVoice(voice, immediate ? 0.01 : this.values.release);
  }

  setSustain(on) {
    this.sustain = on;
    if (!on) for (const n of [...this.sustained]) this.noteOff(n);
  }

  allNotesOff() {
    this.sustained.clear();
    this.monoStack = [];
    for (const [key, voice] of [...this.voices]) {
      this.voices.delete(key);
      this.releaseVoice(voice, 0.01);
    }
  }

  // --- Tempo ---
  setBpm(bpm) {
    const t = this.ctx.currentTime;
    // Garder la position dans la mesure pour que les boucles en cours restent calées.
    if (this.origin !== null) this.origin = t - ((t - this.origin) * this.bpm / 60) * 60 / bpm;
    this.bpm = bpm;
    for (const v of this.padVoices.values()) {
      if (v.syncBpm) v.src.playbackRate.setTargetAtTime(v.pitchRate * bpm / v.syncBpm, t, 0.01);
    }
  }

  // Début de la prochaine mesure ; sans boucle en cours, on démarre tout de suite.
  nextBar() {
    const t = this.ctx.currentTime + 0.01;
    const looping = [...this.padVoices.values()].some(v => v.mode === 'loop');
    if (!looping || this.origin === null) { this.origin = t; return t; }
    const bar = 240 / this.bpm;
    return this.origin + Math.ceil((t - this.origin) / bar - 1e-6) * bar;
  }

  // Prochain instant de la grille (div = 16 pour les doubles-croches).
  gridTime(div) {
    const t = this.ctx.currentTime + 0.005;
    if (this.origin === null) { this.origin = t; return t; }
    const step = 240 / this.bpm / div;
    return this.origin + Math.ceil((t - this.origin) / step - 1e-6) * step;
  }

  // --- Effets de performance ---
  rollOn(div) {
    const len = 240 / this.bpm / div;
    const t = this.gridTime(Math.max(16, div));
    const ramp = (param, v) => { param.setTargetAtTime(v, t, 0.002); };
    this.stDelay.delayTime.setValueAtTime(len, t);
    ramp(this.stIn.gain, 0);
    ramp(this.stFb.gain, 1);
    ramp(this.stWet.gain, 1);
    ramp(this.stDry.gain, 0);
  }

  rollOff() {
    const t = this.ctx.currentTime;
    for (const [g, v] of [[this.stDry, 1], [this.stWet, 0], [this.stFb, 0], [this.stIn, 1]]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(v, t, 0.003);
    }
  }

  // Filtre qui se ferme (passe-bas) ou monte (passe-haut) sur une mesure tant qu'on tient.
  sweep(kind, on) {
    const t = this.ctx.currentTime;
    const f = kind === 'lp' ? this.perfLP.frequency : this.perfHP.frequency;
    const [rest, end] = kind === 'lp' ? [20000, 220] : [10, 2200];
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    if (on) f.exponentialRampToValueAtTime(end, t + 240 / this.bpm);
    else f.setTargetAtTime(rest, t, 0.04);
  }

  // Ralentit tout jusqu'à l'arrêt, comme une platine qu'on coupe.
  tapeStop(duration = 0.9) {
    const t = this.ctx.currentTime;
    for (const v of this.padVoices.values()) {
      v.src.playbackRate.cancelScheduledValues(t);
      v.src.playbackRate.setValueAtTime(v.src.playbackRate.value, t);
      v.src.playbackRate.exponentialRampToValueAtTime(0.02, t + duration);
    }
    for (const voice of this.voices.values()) {
      for (const o of voice.oscs) {
        o.osc.frequency.cancelScheduledValues(t);
        o.osc.frequency.setValueAtTime(o.osc.frequency.value, t);
        o.osc.frequency.exponentialRampToValueAtTime(8, t + duration);
      }
    }
    setTimeout(() => { this.stopAllPads(); this.allNotesOff(); }, duration * 1000);
  }

  // Le synthé s'efface à chaque temps puis remonte (effet « sidechain »).
  setPump(on) {
    clearInterval(this._pumpTimer);
    const g = this.pumpGain.gain;
    const t0 = this.ctx.currentTime;
    g.cancelScheduledValues(t0);
    g.setTargetAtTime(1, t0, 0.02);
    if (!on) return;
    let next = this.gridTime(4);
    const schedule = () => {
      const beat = 60 / this.bpm;
      while (next < this.ctx.currentTime + 0.12) {
        g.setValueAtTime(1, next - 0.002);
        g.linearRampToValueAtTime(0.08, next + 0.004);
        g.setTargetAtTime(1, next + 0.02, beat * 0.22);
        next += beat;
      }
    };
    schedule();
    this._pumpTimer = setInterval(schedule, 25);
  }

  // --- Sampler ---
  padValue(pad, id) { return toValue(PAD_DEFS[id], pad.p[id]); }
  padMode(pad) { return MODES[this.padValue(pad, 'mode')]; }
  syncRate(pad, mode) { return mode === 'loop' && pad.bpm ? this.bpm / pad.bpm : 1; }

  playPad(index, pad) {
    if (!pad?.buffer) return;
    const mode = this.padMode(pad);
    if (mode === 'loop' && this.padVoices.has(index)) { this.stopPad(index); return; }
    this.stopPad(index, 0.005);

    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = pad.buffer;
    const pitchRate = Math.pow(2, this.padValue(pad, 'pitch') / 12);
    src.playbackRate.value = pitchRate * this.syncRate(pad, mode);
    src.loop = mode === 'loop';
    const offset = this.padValue(pad, 'start') * pad.buffer.duration;
    if (src.loop) { src.loopStart = offset; src.loopEnd = pad.buffer.duration; }
    const startAt = src.loop ? this.nextBar() : t;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.padValue(pad, 'cutoff');
    const amp = ctx.createGain();
    amp.gain.value = this.padValue(pad, 'volume');
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.padValue(pad, 'pan');
    const dSend = ctx.createGain();
    dSend.gain.value = this.padValue(pad, 'dSend');
    const rSend = ctx.createGain();
    rSend.gain.value = this.padValue(pad, 'rSend');

    src.connect(filter).connect(amp).connect(pan).connect(this.padBus);
    pan.connect(dSend).connect(this.delayIn);
    pan.connect(rSend).connect(this.reverbIn);

    const voice = { src, amp, filter, pan, dSend, rSend, mode, pitchRate, syncBpm: src.loop ? pad.bpm : 0 };
    src.onended = () => {
      if (this.padVoices.get(index) === voice) {
        this.padVoices.delete(index);
        this.onPadState(index, false);
      }
    };
    src.start(startAt, offset);
    this.padVoices.set(index, voice);
    this.onPadState(index, true, mode);
  }

  releasePad(index) {
    const v = this.padVoices.get(index);
    if (v && v.mode === 'hold') this.stopPad(index);
  }

  stopPad(index, fade = 0.03) {
    const v = this.padVoices.get(index);
    if (!v) return;
    this.padVoices.delete(index);
    const t = this.ctx.currentTime;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + fade);
    v.src.stop(t + fade + 0.01);
    this.onPadState(index, false);
  }

  stopAllPads() {
    for (const i of [...this.padVoices.keys()]) this.stopPad(i);
  }

  // Met à jour en direct la voix d'un pad pendant qu'on tourne un potard.
  updatePadVoice(index, pad) {
    const v = this.padVoices.get(index);
    if (!v) return;
    const t = this.ctx.currentTime;
    v.pitchRate = Math.pow(2, this.padValue(pad, 'pitch') / 12);
    v.src.playbackRate.setTargetAtTime(v.pitchRate * (v.syncBpm ? this.bpm / v.syncBpm : 1), t, 0.01);
    v.filter.frequency.setTargetAtTime(this.padValue(pad, 'cutoff'), t, 0.02);
    v.amp.gain.setTargetAtTime(this.padValue(pad, 'volume'), t, 0.02);
    v.pan.pan.setTargetAtTime(this.padValue(pad, 'pan'), t, 0.02);
    v.dSend.gain.setTargetAtTime(this.padValue(pad, 'dSend'), t, 0.02);
    v.rSend.gain.setTargetAtTime(this.padValue(pad, 'rSend'), t, 0.02);
  }
}
