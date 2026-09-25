// Kit de départ généré par synthèse (aucun fichier nécessaire).
// Rangée du bas = pads 0-7, rangée du haut = pads 32-39.

const SR = 44100;

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx, node, t0, attack, decay, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g);
  return g;
}

function osc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function filt(ctx, type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function noise(ctx, seconds) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, seconds);
  return s;
}

// Oscillateurs carrés aux rapports inharmoniques, base des cymbales (façon TR-808).
function metal(ctx, out, dur) {
  const mix = ctx.createGain();
  mix.gain.value = 0.3;
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const o = osc(ctx, 'square', 40 * r);
    o.connect(mix);
    o.start(0);
    o.stop(dur);
  }
  const bp = filt(ctx, 'bandpass', 10000, 0.8);
  const hp = filt(ctx, 'highpass', 7000);
  mix.connect(bp).connect(hp).connect(out);
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

const SOUNDS = {
  kick(ctx, out) {
    const o = osc(ctx, 'sine', 150);
    o.frequency.setValueAtTime(160, 0);
    o.frequency.exponentialRampToValueAtTime(45, 0.12);
    env(ctx, o, 0, 0.002, 0.45).connect(out);
    const click = osc(ctx, 'square', 1200);
    env(ctx, click, 0, 0.001, 0.012, 0.25).connect(out);
    o.start(0); click.start(0); click.stop(0.02);
    return 0.6;
  },
  kick808(ctx, out) {
    const o = osc(ctx, 'sine', 60);
    o.frequency.setValueAtTime(90, 0);
    o.frequency.exponentialRampToValueAtTime(43, 0.08);
    const ws = ctx.createWaveShaper();
    ws.curve = Float32Array.from({ length: 256 }, (_, i) => Math.tanh(((i / 255) * 2 - 1) * 2.5));
    env(ctx, o, 0, 0.003, 1.6).connect(ws).connect(out);
    o.start(0);
    return 1.8;
  },
  snare(ctx, out) {
    const n = noise(ctx, 0.3);
    env(ctx, n.connect(filt(ctx, 'highpass', 1200)), 0, 0.001, 0.2, 0.7).connect(out);
    const t = osc(ctx, 'triangle', 190);
    t.frequency.exponentialRampToValueAtTime(150, 0.08);
    env(ctx, t, 0, 0.001, 0.1, 0.6).connect(out);
    n.start(0); t.start(0);
    return 0.35;
  },
  clap(ctx, out) {
    const bp = filt(ctx, 'bandpass', 1400, 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0);
    for (const s of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(1, s);
      g.gain.exponentialRampToValueAtTime(0.1, s + 0.009);
    }
    g.gain.setValueAtTime(0.9, 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, 0.3);
    const n = noise(ctx, 0.35);
    n.connect(bp).connect(g).connect(out);
    n.start(0);
    return 0.35;
  },
  rim(ctx, out) {
    const o = osc(ctx, 'square', 820);
    env(ctx, o.connect(filt(ctx, 'bandpass', 1700, 3)), 0, 0.001, 0.035, 1.5).connect(out);
    o.start(0);
    return 0.08;
  },
  tom(ctx, out, f) {
    const o = osc(ctx, 'sine', f);
    o.frequency.setValueAtTime(f * 1.6, 0);
    o.frequency.exponentialRampToValueAtTime(f, 0.06);
    env(ctx, o, 0, 0.002, 0.45).connect(out);
    o.start(0);
    return 0.55;
  },
  shaker(ctx, out) {
    const n = noise(ctx, 0.2);
    env(ctx, n.connect(filt(ctx, 'highpass', 5500)), 0, 0.03, 0.1, 0.6).connect(out);
    n.start(0);
    return 0.18;
  },
  cowbell(ctx, out) {
    const bp = filt(ctx, 'bandpass', 800, 2);
    const g = env(ctx, bp, 0, 0.001, 0.35, 0.8);
    g.connect(out);
    for (const f of [540, 800]) { const o = osc(ctx, 'square', f); o.connect(bp); o.start(0); }
    return 0.4;
  },
  clave(ctx, out) {
    const o = osc(ctx, 'sine', 2500);
    env(ctx, o, 0, 0.001, 0.06).connect(out);
    o.start(0);
    return 0.1;
  },
  zap(ctx, out) {
    const o = osc(ctx, 'sawtooth', 2000);
    o.frequency.exponentialRampToValueAtTime(60, 0.18);
    env(ctx, o.connect(filt(ctx, 'lowpass', 3000)), 0, 0.001, 0.2, 0.5).connect(out);
    o.start(0);
    return 0.25;
  },
  riser(ctx, out) {
    const n = noise(ctx, 2);
    const bp = filt(ctx, 'bandpass', 200, 4);
    bp.frequency.exponentialRampToValueAtTime(9000, 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(1.2, 1.75);
    g.gain.linearRampToValueAtTime(0, 1.9);
    n.connect(bp).connect(g).connect(out);
    n.start(0);
    return 2;
  },
  bass(ctx, out, note) {
    const lp = filt(ctx, 'lowpass', 2500, 6);
    lp.frequency.exponentialRampToValueAtTime(180, 0.35);
    for (const d of [0, 7]) { const o = osc(ctx, 'sawtooth', midi(note)); o.detune.value = d; o.connect(lp); o.start(0); }
    env(ctx, lp, 0, 0.003, 0.7, 0.45).connect(out);
    return 0.8;
  },
  chord(ctx, out, notes) {
    const lp = filt(ctx, 'lowpass', 4000, 2);
    lp.frequency.exponentialRampToValueAtTime(700, 0.6);
    for (const n of notes) {
      for (const d of [-9, 9]) { const o = osc(ctx, 'sawtooth', midi(n)); o.detune.value = d; o.connect(lp); o.start(0); }
    }
    env(ctx, lp, 0, 0.004, 0.9, 0.16).connect(out);
    return 1;
  },
  bell(ctx, out, note) {
    const f = midi(note);
    const car = osc(ctx, 'sine', f);
    const mod = osc(ctx, 'sine', f * 3.5);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 2, 0);
    modGain.gain.exponentialRampToValueAtTime(1, 1.2);
    mod.connect(modGain).connect(car.frequency);
    env(ctx, car, 0, 0.002, 1.6, 0.5).connect(out);
    car.start(0); mod.start(0);
    return 1.7;
  },
};

// Cymbales : enveloppe placée après la source métallique.
SOUNDS.hat = (ctx, out, dur) => {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.8, 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, dur);
  g.connect(out);
  metal(ctx, g, dur + 0.05);
  return dur + 0.05;
};
SOUNDS.crash = (ctx, out) => {
  SOUNDS.hat(ctx, out, 1.8);
  const n = noise(ctx, 2);
  env(ctx, n.connect(filt(ctx, 'highpass', 4000)), 0, 0.002, 1.6, 0.3).connect(out);
  n.start(0);
  return 2;
};

// Couleurs : indices de la palette APC mk2.
const RED = 5, ORANGE = 9, YELLOW = 13, BLUE = 41, CYAN = 37, PURPLE = 49, GREEN = 21, PINK = 57;

const Cm = [48, 51, 55], Ds = [51, 55, 58], Fm = [53, 56, 60], Gm = [55, 58, 62],
  Gs = [56, 60, 63], As = [58, 62, 65], Cm7 = [48, 51, 55, 58], Fm9 = [53, 56, 60, 67];
const BASS_NOTES = [36, 39, 41, 43, 46, 48, 51, 53];
const BELL_NOTES = [72, 75, 77, 79, 82, 84, 87, 89];

export const DEFAULT_KIT = [
  ['Kick', RED, c => SOUNDS.kick(...c)],
  ['808', RED, c => SOUNDS.kick808(...c)],
  ['Snare', ORANGE, c => SOUNDS.snare(...c)],
  ['Clap', ORANGE, c => SOUNDS.clap(...c)],
  ['Rim', ORANGE, c => SOUNDS.rim(...c)],
  ['Tom low', PINK, c => SOUNDS.tom(...c, 90)],
  ['Tom mid', PINK, c => SOUNDS.tom(...c, 130)],
  ['Tom high', PINK, c => SOUNDS.tom(...c, 180)],
  ['Closed HH', YELLOW, c => SOUNDS.hat(...c, 0.06)],
  ['Open HH', YELLOW, c => SOUNDS.hat(...c, 0.45)],
  ['Shaker', YELLOW, c => SOUNDS.shaker(...c)],
  ['Crash', YELLOW, c => SOUNDS.crash(...c)],
  ['Cowbell', GREEN, c => SOUNDS.cowbell(...c)],
  ['Clave', GREEN, c => SOUNDS.clave(...c)],
  ['Zap', GREEN, c => SOUNDS.zap(...c)],
  ['Riser', GREEN, c => SOUNDS.riser(...c)],
  ...BASS_NOTES.map((n, i) => [`Bass ${i + 1}`, BLUE, c => SOUNDS.bass(...c, n)]),
  ...[['Cm', Cm], ['D#', Ds], ['Fm', Fm], ['Gm', Gm], ['G#', Gs], ['A#', As], ['Cm7', Cm7], ['Fm9', Fm9]]
    .map(([name, notes]) => [name, PURPLE, c => SOUNDS.chord(...c, notes)]),
  ...BELL_NOTES.map((n, i) => [`Bell ${i + 1}`, CYAN, c => SOUNDS.bell(...c, n)]),
];

async function render(fn) {
  // Premier passage court pour connaître la durée, puis rendu à la bonne longueur.
  const probe = new OfflineAudioContext(1, 1, SR);
  const dur = fn([probe, probe.destination]);
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  fn([ctx, out]);
  return ctx.startRendering();
}

export async function renderDefaultKit() {
  return Promise.all(DEFAULT_KIT.map(async ([name, color, fn]) => ({ name, color, buffer: await render(fn) })));
}
