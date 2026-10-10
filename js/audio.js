// Moteur audio : synthé polyphonique (clavier), sampler (pads), delay et reverb en départs,
// effets de performance (roll, filtres, tape-stop, pump) et égaliseur général.
import { PAGES, WAVES, MODES, toValue } from './params.js';
import { kWeighting } from './lufs.js';

const MASTER_WORKLET = 'js/master-worklet.js?v=2';

const PAD_DEFS = Object.fromEntries(PAGES.pad.params.map(d => [d.id, d]));
const midiToFreq = n => 440 * Math.pow(2, (n - 69) / 12);

// Caractère d'une voix de synthé (réglé par les presets, non exposé aux potentiomètres).
export const DEFAULT_VOICE = {
  unison: 2,          // oscillateurs empilés, écartés par le potentiomètre « Désaccord »
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
  layers: null,       // couches d'oscillateurs (voir js/presets.js) ; null = scies en unisson
  fenv: 0.4,          // enveloppe du filtre
  vibRange: 0.5,      // vibrato maximal (demi-tons) quand le potentiomètre est au bout
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

// Chaîne master : compresseur puis limiteur. Valeurs par défaut du compresseur = l'ancien limiteur du moteur.
export const MASTER_PARAMS = {
  comp: { threshold: [-40, 0, 0.5, -3], ratio: [1, 20, 0.5, 20], knee: [0, 40, 1, 30], attack: [0.5, 100, 0.5, 2], release: [20, 1000, 5, 100], makeup: [0, 12, 0.5, 0] },
  limit: { gain: [0, 18, 0.5, 0], ceiling: [-6, 0, 0.1, -0.3], release: [10, 500, 5, 80] },
};
export function defaultMasterState() {
  const pick = g => Object.fromEntries(Object.entries(MASTER_PARAMS[g]).map(([k, v]) => [k, v[3]]));
  return { comp: { on: true, ...pick('comp') }, limit: { on: true, ...pick('limit') } };
}
export function mergeMasterState(saved) {
  const m = defaultMasterState();
  for (const g of ['comp', 'limit']) {
    if (typeof saved?.[g]?.on === 'boolean') m[g].on = saved[g].on;
    for (const [k, [min, max]] of Object.entries(MASTER_PARAMS[g])) {
      const v = saved?.[g]?.[k];
      if (Number.isFinite(v)) m[g][k] = Math.min(max, Math.max(min, v));
    }
  }
  return m;
}

export class Engine {
  // ctx : contexte audio (par défaut celui de la carte son ; un OfflineAudioContext pour l'export rapide).
  constructor(ctx = new AudioContext({ latencyHint: 'interactive' })) {
    this.ctx = ctx;
    this.values = {};
    this.voiceCfg = { ...DEFAULT_VOICE };
    this.voices = new Map();      // note -> voix synthé ('mono' pour la voix monophonique)
    this.monoStack = [];          // notes tenues en mode mono (la dernière joue)
    this.sustained = new Set();   // notes relâchées mais tenues par la pédale
    this.sustain = false;
    this.padVoices = new Map();   // index pad -> voix sampler
    this.onPadState = () => {};
    // Départ des pads : 0 = libre, sinon calé sur une grille de `padQuant` temps (2 = deux temps, 4 = une mesure…).
    this.padQuant = 0;
    this.gridBusy = () => false;   // la timeline joue (branché par l'application) : la grille est la sienne
    this.bpm = 120;
    this.origin = null;           // instant (ctx) du temps 1 de la mesure de référence
    this.seqs = new Set();        // séquenceurs en marche (TR-909, TB-303) : la grille des mesures est occupée

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
    // Chaîne master : compresseur (réglé par défaut comme l'ancien limiteur : le son ne change pas), puis limiteur
    // à anticipation et compteur de sonie (js/master-worklet.js, branché par initMaster ; en attendant : passage direct).
    this.comp = ctx.createDynamicsCompressor();
    this.compMakeup = gain();
    this.compWet = gain(1);
    this.compDry = gain(0);
    this.limitIn = gain();
    this.limitOut = gain();
    this.eqGain.connect(this.comp).connect(this.compMakeup).connect(this.compWet).connect(this.limitIn);
    this.eqGain.connect(this.compDry).connect(this.limitIn);
    this.limitIn.connect(this.limitOut);
    this.limiterNode = null;
    this.onMeter = () => {};   // { e (énergie pondérée K de 100 ms), peak, gr } : voir js/lufs.js
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    let node = this.perfIn.connect(this.perfLP).connect(this.perfHP);
    for (const f of Object.values(this.eq)) node = node.connect(f);
    node.connect(this.eqGain);
    this.output = this.limitOut;   // point d'écoute de l'enregistreur
    this.limitOut.connect(this.analyser).connect(ctx.destination);
    this.masterSettings = defaultMasterState();
    this.setMaster(this.masterSettings);

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
    this.synthIn.connect(this.shaper);
    // Ensemble stéréo façon Solina : trois lignes à retard modulées lentement, à gauche, au centre, à droite.
    this.chorusDry = gain(1);
    this.chorusWet = gain(0);
    this.shaper.connect(this.chorusDry).connect(this.synthBus);
    for (const [rate, fast, side] of [[0.43, 5.9, -0.9], [0.61, 6.7, 0], [0.79, 6.2, 0.9]]) {
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.012;
      for (const [f, depth] of [[rate, 0.004], [fast, 0.0003]]) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = f;
        lfo.connect(gain(depth)).connect(d.delayTime);
        lfo.start();
      }
      const pan = ctx.createStereoPanner();
      pan.pan.value = side;
      this.shaper.connect(d).connect(pan).connect(this.chorusWet);
    }
    this.chorusWet.connect(this.synthBus);
    this.synthBus.connect(this.pumpGain).connect(this.master);
    // Onde en impulsion (25 %) pour les hoovers.
    const harmonics = 64;
    const real = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    this.pulseWave = ctx.createPeriodicWave(real, new Float32Array(harmonics));
    this.synthBus.connect(this.synthDSend).connect(this.delayIn);
    this.synthBus.connect(this.synthRSend).connect(this.reverbIn);

    this.padBus = gain();
    this.padBus.connect(this.master);
    this.padOut = () => this.padBus;   // bus de sortie d'un pad (le sidechain en fournit un autre)
  }

  get seqRunning() { return this.seqs.size > 0; }

  resume() { return this.ctx.resume(); }

  // Branche le limiteur et le compteur de sonie (module du fil audio, chargé une fois par contexte).
  async initMaster() {
    try {
      await this.ctx.audioWorklet.addModule(MASTER_WORKLET);
      const node = new AudioWorkletNode(this.ctx, 'gk-master', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { k: kWeighting(this.ctx.sampleRate) } });
      node.port.onmessage = e => this.onMeter(e.data);
      this.limitIn.disconnect();
      this.limitIn.connect(node).connect(this.limitOut);
      this.limiterNode = node;
      this.setMaster(this.masterSettings);
    } catch (err) {
      console.warn('Limiteur master indisponible', err);   // le son passe sans limiteur
    }
  }

  // Réglages de la chaîne master (voir defaultMasterState).
  setMaster(m) {
    this.masterSettings = m;
    const c = m.comp, t = this.ctx.currentTime;
    this.compWet.gain.setTargetAtTime(c.on ? 1 : 0, t, 0.01);
    this.compDry.gain.setTargetAtTime(c.on ? 0 : 1, t, 0.01);
    this.comp.threshold.setTargetAtTime(c.threshold, t, 0.02);
    this.comp.ratio.setTargetAtTime(c.ratio, t, 0.02);
    this.comp.knee.setTargetAtTime(c.knee, t, 0.02);
    this.comp.attack.setTargetAtTime(c.attack / 1000, t, 0.02);
    this.comp.release.setTargetAtTime(c.release / 1000, t, 0.02);
    this.compMakeup.gain.setTargetAtTime(Math.pow(10, c.makeup / 20), t, 0.02);
    this.limiterNode?.port.postMessage({ on: m.limit.on, gain: m.limit.gain, ceiling: m.limit.ceiling, release: m.limit.release });
  }

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
        for (const voice of this.liveVoices()) voice.filter.frequency.setTargetAtTime(v, t, 0.02);
        break;
      case 'reso':
        for (const voice of this.liveVoices()) voice.filter.Q.setTargetAtTime(v, t, 0.02);
        break;
      case 'detune':
        for (const voice of this.liveVoices()) {
          for (const o of voice.oscs) o.osc.detune.setTargetAtTime((o.cents ?? 0) * v / 12, t, 0.02);
        }
        break;
      case 'width':
        for (const voice of this.liveVoices()) for (const o of voice.oscs) o.pan?.pan.setTargetAtTime(o.spread * v, t, 0.02);
        break;
      case 'vibrato':
        for (const voice of this.liveVoices()) voice.vibGain?.gain.setTargetAtTime(v * (this.voiceCfg.vibRange ?? 0.5) * 100, t, 0.05);
        break;
      case 'chorus':
        smooth(this.chorusWet.gain, v * 0.9);
        smooth(this.chorusDry.gain, 1 - v * 0.35);
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

  // Voix du preset en cours (les blocs de la timeline qui ont leur propre preset n'en font pas partie).
  *liveVoices() { for (const v of this.voices.values()) if (!v.patched) yield v; }

  setVoice(cfg) {
    this.allNotesOff(true);
    this.voiceCfg = { ...DEFAULT_VOICE, ...cfg };
  }

  // --- Synthé ---
  // Formants posés après une couche : caisse de résonance des cordes, ou voyelles d'un chœur.
  formant(input, kind) {
    const { ctx } = this;
    if (kind === 'strings') {
      let node = input;
      for (const [f, g, q] of [[350, 4, 1], [1100, 5, 1.2], [2700, 3, 1.5]]) {
        const b = ctx.createBiquadFilter();
        b.type = 'peaking';
        b.frequency.value = f;
        b.gain.value = g;
        b.Q.value = q;
        node = node.connect(b);
      }
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 6000;
      shelf.gain.value = -4;
      return node.connect(shelf);
    }
    const vowels = { a: [[800, 1, 8], [1150, 0.6, 9], [2900, 0.25, 10]], o: [[450, 1, 8], [800, 0.5, 9], [2830, 0.15, 10]] };
    const sum = ctx.createGain();
    for (const [f, g, q] of vowels[kind] ?? vowels.a) {
      const b = ctx.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = f;
      b.Q.value = q;
      const level = ctx.createGain();
      level.gain.value = g * 2.5;
      input.connect(b).connect(level).connect(sum);
    }
    return sum;
  }

  // `when` : instant (horloge audio) de départ, pour les notes programmées par la timeline.
  // `patch` : { cfg, values } d'un autre preset que celui en cours (blocs de nappes de la timeline).
  makeVoice(f, velocity, fromFreq, when, patch, out) {
    const { ctx } = this;
    const c = patch ? { ...DEFAULT_VOICE, ...patch.cfg } : this.voiceCfg;
    const p = patch ? { ...this.values, ...patch.values } : this.values;
    const t = Math.max(ctx.currentTime, when ?? 0);
    const attack = p.attack ?? 0.005;
    const fenv = c.fenv ?? 0.4;

    const filter = ctx.createBiquadFilter();
    filter.type = c.filterType;
    filter.Q.value = p.reso;
    const peak = Math.min(18000, p.cutoff * (1 + fenv * 10 * (0.4 + velocity * 0.6)));
    filter.frequency.setValueAtTime(peak, t);
    filter.frequency.setTargetAtTime(p.cutoff, t + attack, 0.12 + fenv * 0.3);

    const amp = ctx.createGain();
    const level = 0.34 * (0.25 + velocity * 0.75);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level, t + attack);
    amp.gain.setTargetAtTime(level * c.sustain, t + attack, c.decay / 3);

    // Couches d'oscillateurs : unisson désaccordé (« Désaccord ») et étalé dans la stéréo (« Largeur »).
    const layers = c.layers ?? [{ osc: WAVES[p.wave] || 'sawtooth', voices: c.unison, spread: 12 }];
    const width = p.width ?? 0.5;
    const detune = (p.detune ?? 12) / 12;
    const total = layers.reduce((sum, l) => sum + (l.level ?? 1), 0);
    const oscs = [];
    for (const layer of layers) {
      const n = Math.max(1, layer.voices ?? 1);
      const lg = ctx.createGain();
      lg.gain.value = (layer.level ?? 1) / Math.sqrt(n) / Math.max(1, total * 0.8);
      (layer.formant ? this.formant(lg, layer.formant) : lg).connect(filter);
      for (let k = 0; k < n; k++) {
        const osc = ctx.createOscillator();
        if (layer.osc === 'pulse') osc.setPeriodicWave(this.pulseWave); else osc.type = layer.osc ?? 'sawtooth';
        const spread = n > 1 ? (2 * k) / (n - 1) - 1 : 0;
        const cents = spread * (layer.spread ?? 12);
        osc.detune.value = cents * detune;
        const pan = ctx.createStereoPanner();
        pan.pan.value = spread * width;
        osc.connect(pan).connect(lg);
        oscs.push({ osc, spread, cents, pan, ratio: Math.pow(2, (layer.octave ?? 0) / 12) });
      }
    }
    if (c.sub) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const g = ctx.createGain();
      g.gain.value = c.sub * 0.6;
      osc.connect(g).connect(filter);
      oscs.push({ osc, spread: 0, cents: 0, ratio: 0.5 });
    }

    // Hauteur : glissé depuis la note précédente (mono) ou depuis un décalage (bend).
    const start = fromFreq ?? (c.bend ? f * Math.pow(2, c.bend / 12) : f);
    const time = fromFreq ? Math.max(0.005, p.glide ?? c.glide) : c.bendTime;
    for (const o of oscs) {
      o.osc.frequency.setValueAtTime(start * o.ratio, t);
      if (start !== f) o.osc.frequency.exponentialRampToValueAtTime(f * o.ratio, t + time);
    }

    // Vibrato (potentiomètre « Vibrato »), qui arrive après un instant comme sur un instrument joué.
    // Une note de la timeline sans vibrato n'en a pas besoin (au clavier, le potentiomètre peut le monter pendant la note).
    const lfos = [];
    let vibGain = null;
    if (!patch || (p.vibrato ?? 0) > 0) {
      const vib = ctx.createOscillator();
      vib.frequency.value = c.vibRate;
      vibGain = ctx.createGain();
      vibGain.gain.setValueAtTime(0, t);
      vibGain.gain.linearRampToValueAtTime((p.vibrato ?? 0) * (c.vibRange ?? 0.5) * 100, t + c.vibDelay + 0.3);
      vib.connect(vibGain);
      for (const o of oscs) vibGain.connect(o.osc.detune);
      lfos.push(vib);
    }
    if (c.lfoRate) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = c.lfoRate;
      const depth = ctx.createGain();
      depth.gain.value = p.cutoff * c.lfoDepth;
      lfo.connect(depth).connect(filter.frequency);
      lfos.push(lfo);
    }

    filter.connect(amp).connect(out ?? this.synthIn);   // out : chaîne d'effets d'une piste de la timeline
    for (const o of oscs) o.osc.start(t);
    for (const l of lfos) l.start(t);
    return { oscs, lfos, filter, amp, vibGain, freq: f, patched: !!patch, release: p.release };
  }

  glideVoice(voice, f, when) {
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    const time = Math.max(0.005, this.values.glide ?? this.voiceCfg.glide);
    for (const o of voice.oscs) {
      const param = o.osc.frequency;
      param.cancelScheduledValues(t);
      param.setTargetAtTime(f * o.ratio, t, time / 3);
    }
    voice.freq = f;
  }

  releaseVoice(voice, rel, when) {
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    voice.amp.gain.cancelScheduledValues(t);
    voice.amp.gain.setTargetAtTime(0, t, rel / 4);
    const end = t + rel * 1.5 + 0.05;
    for (const o of voice.oscs) o.osc.stop(end);
    for (const l of voice.lfos) l.stop(end);
    // Voix éteinte : on la débranche (le moteur n'a plus à la parcourir).
    if (voice.oscs[0]) voice.oscs[0].osc.onended = () => { try { voice.amp.disconnect(); voice.filter.disconnect(); } catch { /* déjà fait */ } };
  }

  // `when` : instant de départ (séquenceur) ; `key` : identifiant de la voix (le séquenceur
  // utilise ses propres clés pour ne pas couper les notes jouées à la main).
  noteOn(note, velocity, when, key = note, patch, out) {
    if (patch) {   // preset propre au bloc : toujours polyphonique
      this.noteOff(note, true, when, key);
      this.voices.set(key, this.makeVoice(midiToFreq(note + (patch.cfg.octave ?? DEFAULT_VOICE.octave)), velocity, undefined, when, patch, out));
      return;
    }
    const f = midiToFreq(note + this.voiceCfg.octave);
    if (this.voiceCfg.mono) {
      this.monoStack = this.monoStack.filter(n => n !== note).concat(note);
      const voice = this.voices.get('mono');
      if (voice) this.glideVoice(voice, f, when);   // notes liées : glissé sans redéclencher
      else this.voices.set('mono', this.makeVoice(f, velocity, undefined, when));
      return;
    }
    this.noteOff(note, true, when, key);
    this.voices.set(key, this.makeVoice(f, velocity, undefined, when, undefined, out));
  }

  noteOff(note, immediate = false, when, key = note) {
    if (this.voiceCfg.mono && !immediate && !this.voices.get(key)?.patched) {
      this.monoStack = this.monoStack.filter(n => n !== note);
      const voice = this.voices.get('mono');
      if (!voice) return;
      if (this.monoStack.length) {
        this.glideVoice(voice, midiToFreq(this.monoStack[this.monoStack.length - 1] + this.voiceCfg.octave), when);
      } else {
        this.voices.delete('mono');
        this.releaseVoice(voice, this.values.release, when);
      }
      return;
    }
    const voice = this.voices.get(key);
    if (!voice) return;
    if (this.sustain && !immediate && when === undefined) { this.sustained.add(key); return; }
    this.voices.delete(key);
    this.sustained.delete(key);
    this.releaseVoice(voice, immediate ? 0.01 : voice.patched ? voice.release : this.values.release, when);
  }

  setSustain(on) {
    this.sustain = on;
    if (!on) for (const n of [...this.sustained]) this.noteOff(n);
  }

  // keepPatched : garder les notes de la timeline jouées avec leur propre preset (changement de preset).
  allNotesOff(keepPatched = false) {
    this.sustained.clear();
    this.monoStack = [];
    for (const [key, voice] of [...this.voices]) {
      if (keepPatched && voice.patched) continue;
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
      if (v.syncBpm) { this.retrack(v, t, v.pitchRate * bpm / v.syncBpm); v.src.playbackRate.setTargetAtTime(v.track.rate, t, 0.01); }
    }
  }

  // Position d'une voix de pad dans son son (secondes) à l'instant t, d'après sa vitesse.
  padPos(v, t) {
    const { pos, rate } = v.track;
    let p = pos + (t - v.track.t) * rate;   // t peut précéder le repère (départ programmé un peu plus tard)
    if (v.src.loop) {
      const a = v.src.loopStart, b = v.src.loopEnd || v.src.buffer.duration;
      if (b > a && p >= b) p = a + ((p - a) % (b - a));   // avant le départ, p peut être sous le début : il y reviendra
    }
    return p;
  }
  retrack(v, t, rate) { v.track = { t, pos: this.padPos(v, t), rate }; }

  // Début changé pendant qu'une boucle joue : le son passe tout de suite à la nouvelle position (fondu de 8 ms).
  // Boucle calée : décalage de phase, la grille est gardée ; boucle libre : reprise à partir du nouveau début.
  movePadStart(index, pad) {
    const v = this.padVoices.get(index);
    if (!v || v.mode !== 'loop' || v.stopAt) return;
    const dur = pad.buffer.duration;
    const offset = this.padValue(pad, 'start') * dur;
    if (Math.abs(offset - v.offset) < 0.002) return;
    const { ctx } = this;
    const t = Math.max(ctx.currentTime + 0.01, v.startAt);
    let pos = v.synced ? this.padPos(v, t) + (offset - v.offset) : t > v.startAt ? Math.max(offset, this.padPos(v, t)) : offset;
    pos = v.synced ? ((pos % dur) + dur) % dur : Math.min(dur - 0.001, pos);
    const src = ctx.createBufferSource();
    src.buffer = pad.buffer;
    src.loop = true;
    src.loopStart = v.synced ? 0 : offset;
    src.loopEnd = dur;
    src.playbackRate.value = v.track.rate;
    const g = ctx.createGain();
    src.connect(g).connect(v.filter);
    const fade = 0.008;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + fade);
    const old = v.src, oldG = v.srcGain;
    old.onended = null;
    oldG.gain.setValueAtTime(1, t);
    oldG.gain.linearRampToValueAtTime(0, t + fade);
    try { old.stop(t + fade + 0.005); } catch { /* déjà arrêtée */ }
    src.onended = v.ended;
    src.start(t, pos);
    Object.assign(v, { src, srcGain: g, offset, track: { t, pos, rate: v.track.rate } });
  }

  // Début de la prochaine mesure ; sans boucle en cours, on démarre tout de suite.
  nextBar() {
    const t = this.ctx.currentTime + 0.01;
    // La grille est « occupée » si une boucle tourne ou si le séquenceur 909 joue.
    const looping = this.seqRunning || [...this.padVoices.values()].some(v => v.mode === 'loop');
    if (!looping || this.origin === null) { this.origin = t; return t; }
    const bar = 240 / this.bpm;
    return this.origin + Math.ceil((t - this.origin) / bar - 1e-6) * bar;
  }

  // Prochain multiple de `beats` temps sur la grille ; si rien ne tourne, maintenant (et la grille part de là).
  quantTime(beats) {
    const t = this.ctx.currentTime + 0.01;
    const busy = this.seqRunning || this.gridBusy() || this.padVoices.size > 0;   // un pad sonne encore (ou attend)
    if (!busy || this.origin === null) { this.origin = t; return t; }
    const q = (beats * 60) / this.bpm;
    return this.origin + Math.ceil((t - this.origin) / q - 1e-6) * q;
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

  // opts : { when, vel, oneShot } — le séquenceur joue les pads à un instant précis, toujours en one-shot.
  playPad(index, pad, opts = {}) {
    if (!pad?.buffer) return;
    const mode = opts.oneShot ? 'oneshot' : this.padMode(pad);
    // Joué à la main (pas par la timeline ni le séquenceur) : départ et arrêt calés sur la grille choisie.
    const q = opts.when === undefined && !opts.oneShot ? this.padQuant : 0;
    if (mode === 'loop' && this.padVoices.has(index)) {
      const v = this.padVoices.get(index);
      if (!q) this.stopPad(index);
      else if (!(v.stopAt > this.ctx.currentTime)) this.stopPadAt(index, Math.max(this.quantTime(q), v.startAt + 0.01));
      return;
    }
    const { ctx } = this;
    const t = q ? this.quantTime(q) : Math.max(ctx.currentTime, opts.when ?? 0);
    this.stopPad(index, 0.005, t);

    const src = ctx.createBufferSource();
    src.buffer = pad.buffer;
    const pitchRate = Math.pow(2, this.padValue(pad, 'pitch') / 12);
    src.playbackRate.value = pitchRate * this.syncRate(pad, mode);
    src.loop = mode === 'loop';
    const offset = this.padValue(pad, 'start') * pad.buffer.duration;
    // Boucle calée au tempo : Début déplace le point de départ dans la boucle, qui garde toute sa longueur (elle reste
    // calée sur les mesures) ; boucle libre : elle reprend à partir de Début.
    const synced = src.loop && !!pad.bpm;
    if (src.loop) { src.loopStart = synced ? 0 : offset; src.loopEnd = pad.buffer.duration; }
    const startAt = q ? t : src.loop ? this.nextBar() : t;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.padValue(pad, 'cutoff');
    const amp = ctx.createGain();
    amp.gain.value = this.padValue(pad, 'volume') * (opts.vel ?? 1);
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.padValue(pad, 'pan');
    const dSend = ctx.createGain();
    dSend.gain.value = this.padValue(pad, 'dSend');
    const rSend = ctx.createGain();
    rSend.gain.value = this.padValue(pad, 'rSend');

    const srcGain = ctx.createGain();   // fondu de la source seule (changement de Début en cours de lecture)
    src.connect(srcGain).connect(filter).connect(amp).connect(pan).connect(opts.out ?? this.padOut(pad) ?? this.padBus);   // out : chaîne d'effets d'une piste
    pan.connect(dSend).connect(this.delayIn);
    pan.connect(rSend).connect(this.reverbIn);

    // startBeat : temps de la grille où la boucle démarre (pour placer ses kicks, voir js/sidechain.js).
    const startBeat = this.origin === null ? 0 : (startAt - this.origin) * this.bpm / 60;
    const voice = { src, srcGain, amp, filter, pan, dSend, rSend, mode, pitchRate, syncBpm: src.loop ? pad.bpm : 0, pad, startBeat, startAt,
      offset, synced, track: { t: startAt, pos: offset, rate: src.playbackRate.value } };
    voice.ended = () => {
      if (this.padVoices.get(index) === voice) {
        this.padVoices.delete(index);
        this.onPadState(index, false);
      }
    };
    src.onended = voice.ended;
    src.start(startAt, offset);
    this.padVoices.set(index, voice);
    this.onPadState(index, true, mode);
    // En attente du départ : l'affichage repasse en « joue » à l'instant où le son part.
    if (startAt > ctx.currentTime + 0.02) setTimeout(() => { if (this.padVoices.get(index) === voice) this.onPadState(index, true, mode); }, (startAt - ctx.currentTime) * 1000 + 5);
    return voice;
  }

  // Arrêt programmé à l'instant `when` (grille) : la voix reste là jusqu'à cet instant (le pad clignote en attendant).
  stopPadAt(index, when, fade = 0.01) {
    const v = this.padVoices.get(index);
    if (!v) return;
    v.stopAt = when;
    v.amp.gain.cancelScheduledValues(when);
    v.amp.gain.setValueAtTime(v.amp.gain.value, when);
    v.amp.gain.linearRampToValueAtTime(0, when + fade);
    try { v.src.stop(when + fade + 0.01); } catch { /* déjà arrêtée */ }
    this.onPadState(index, true, v.mode);
    setTimeout(() => {
      if (this.padVoices.get(index) !== v) return;
      this.padVoices.delete(index);
      this.onPadState(index, false);
    }, (when - this.ctx.currentTime) * 1000 + 5);
  }

  // Coupe une voix de pad précise, même si un coup plus récent du même pad l'a remplacée
  // (la timeline programme d'avance tous les coups d'un cycle : ils doivent tous se taire à l'arrêt).
  stopVoice(v, fade = 0.01) {
    const t = this.ctx.currentTime;
    try {
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setValueAtTime(v.amp.gain.value, t);
      v.amp.gain.linearRampToValueAtTime(0, t + fade);
      v.src.stop(t + fade + 0.01);
    } catch { /* déjà terminée */ }
  }

  releasePad(index) {
    const v = this.padVoices.get(index);
    if (!v || v.mode !== 'hold') return;
    // Calé : le son tenu s'arrête sur la grille, au plus tôt une division après son départ.
    if (this.padQuant) this.stopPadAt(index, Math.max(this.quantTime(this.padQuant), v.startAt + (this.padQuant * 60) / this.bpm));
    else this.stopPad(index);
  }

  stopPad(index, fade = 0.03, when) {
    const v = this.padVoices.get(index);
    if (!v) return;
    this.padVoices.delete(index);
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + fade);
    v.src.stop(t + fade + 0.01);
    this.onPadState(index, false);
  }

  stopAllPads() {
    for (const i of [...this.padVoices.keys()]) this.stopPad(i);
  }

  // Met à jour en direct la voix d'un pad pendant qu'on tourne un potentiomètre.
  updatePadVoice(index, pad) {
    const v = this.padVoices.get(index);
    if (!v) return;
    const t = this.ctx.currentTime;
    v.pitchRate = Math.pow(2, this.padValue(pad, 'pitch') / 12);
    this.retrack(v, t, v.pitchRate * (v.syncBpm ? this.bpm / v.syncBpm : 1));
    v.src.playbackRate.setTargetAtTime(v.track.rate, t, 0.01);
    this.movePadStart(index, pad);
    v.filter.frequency.setTargetAtTime(this.padValue(pad, 'cutoff'), t, 0.02);
    v.amp.gain.setTargetAtTime(this.padValue(pad, 'volume'), t, 0.02);
    v.pan.pan.setTargetAtTime(this.padValue(pad, 'pan'), t, 0.02);
    v.dSend.gain.setTargetAtTime(this.padValue(pad, 'dSend'), t, 0.02);
    v.rSend.gain.setTargetAtTime(this.padValue(pad, 'rSend'), t, 0.02);
  }
}
