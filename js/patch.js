// Page de câblage : les sorties des voies de mixage (un outil = une voie) et des boîtes à effets sont reliées
// librement, vers le master ou vers d'autres boîtes. Par défaut, chaque outil est câblé sur le master.
// État : { boxes: [{ id, type, p, name }], links: [{ from, to }], pos: { nœud: { x, y } } }.
// Nœuds : les voies (CHANNELS : pads, synth, tr, tl, acid, decks, osc), 'box:…' pour les boîtes, 'master'.
import { CHANNELS, impulse } from './mixer.js';
import { distCurve, SHAPES } from './tr909.js';
import { PCF_PATTERNS } from './trackfx.js';

const S = (def, options) => ['select', def, options];
const R = (def, min, max, step) => ['range', def, min, max, step];
const LEVEL = R(0.9, 0, 1.5, 0.01);

export const BOX_TYPES = {
  dist: { color: 5, params: { drive: R(0.55, 0, 1, 0.01), shape: S('tube', SHAPES), tone: R(9000, 500, 18000, 50), mix: R(1, 0, 1, 0.01), level: LEVEL } },
  pcf: { color: 37, params: { mode: S('lp', ['lp', 'bp']), pattern: S('eighths', Object.keys(PCF_PATTERNS)), freq: R(300, 60, 4000, 10), q: R(8, 0.7, 20, 0.1), amt: R(0.7, 0, 1, 0.01), dec: R(0.12, 0.02, 0.8, 0.01), level: LEVEL } },
  filter: { color: 41, params: { mode: S('lp', ['lp', 'hp', 'bp']), cutoff: R(1200, 40, 18000, 10), reso: R(1.5, 0.5, 20, 0.1), lfo: S(0, [0, 1, 2, 4, 8, 16]), depth: R(0.5, 0, 1, 0.01), level: LEVEL } },
  delay: { color: 49, params: { div: S(6, [4, 8, 16, 6, 3]), feedback: R(0.45, 0, 0.92, 0.01), mix: R(0.35, 0, 1, 0.01), tone: R(5000, 500, 16000, 50), level: LEVEL } },
  reverb: { color: 53, params: { size: R(2.5, 0.3, 8, 0.1), mix: R(0.35, 0, 1, 0.01), level: LEVEL } },
  comp: { color: 13, params: { threshold: R(-20, -60, 0, 1), ratio: R(4, 1, 20, 0.5), makeup: R(6, 0, 24, 0.5), level: LEVEL } },
  crush: { color: 57, params: { bits: R(6, 2, 12, 1), mix: R(1, 0, 1, 0.01), level: LEVEL } },
};
export const BOX_ORDER = Object.keys(BOX_TYPES);
export const SOURCE_COLORS = { pads: 21, synth: 49, tr: 5, tl: 37, acid: 57, decks: 53, osc: 45 };

export const boxDefaults = type => Object.fromEntries(Object.entries(BOX_TYPES[type].params).map(([k, v]) => [k, v[1]]));

export function defaultPatch() {
  // known : voies déjà vues ; une voie débranchée volontairement le reste, une voie nouvelle va sur le master.
  return { boxes: [], links: CHANNELS.map(id => ({ from: id, to: 'master' })), pos: {}, known: CHANNELS.slice() };
}

// Sauvegarde : boîtes et câbles valides seulement ; une voie apparue depuis (nouvel outil) est câblée sur le master.
export function mergePatch(saved) {
  if (!saved || typeof saved !== 'object') return defaultPatch();
  const boxes = (Array.isArray(saved.boxes) ? saved.boxes : []).filter(b => b && BOX_TYPES[b.type] && typeof b.id === 'string' && b.id.startsWith('box:')).map(b => {
    const p = boxDefaults(b.type);
    for (const [k, [kind, , a, max]] of Object.entries(BOX_TYPES[b.type].params)) {
      const v = b.p?.[k];
      if (kind === 'select' ? a.includes(v) : Number.isFinite(v) && v >= a && v <= max) p[k] = v;
    }
    return { id: b.id, type: b.type, p, name: String(b.name ?? '') };
  });
  const ids = new Set([...CHANNELS, 'master', ...boxes.map(b => b.id)]);
  const links = [];
  for (const l of Array.isArray(saved.links) ? saved.links : []) {
    if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === 'master' || CHANNELS.includes(l.to) || l.from === l.to) continue;
    if (!links.some(x => x.from === l.from && x.to === l.to)) links.push({ from: l.from, to: l.to });
  }
  const known = new Set(Array.isArray(saved.known) ? saved.known : CHANNELS.filter(id => links.some(l => l.from === id)));
  for (const id of CHANNELS) if (!known.has(id) && !links.some(l => l.from === id)) links.push({ from: id, to: 'master' });
  const pos = {};
  for (const [k, v] of Object.entries(saved.pos ?? {})) if (ids.has(k) && Number.isFinite(v?.x) && Number.isFinite(v?.y)) pos[k] = { x: v.x, y: v.y };
  return { boxes, links, pos, known: CHANNELS.slice() };
}

// Relier `from` à `to` créerait-il une boucle ?
export function wouldLoop(links, from, to) {
  const seen = new Set();
  const stack = [to];
  while (stack.length) {
    const n = stack.pop();
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const l of links) if (l.from === n) stack.push(l.to);
  }
  return false;
}

// Une boîte : { input, output, update(p), schedule(t0, t1) } (le PCF suit la grille du tempo).
function buildBox(ctx, engine, box) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const now = () => ctx.currentTime;
  const smooth = (param, v) => param.setTargetAtTime(v, now(), 0.02);
  const dryWet = () => {
    const dry = gain(0), wet = gain(1);
    input.connect(dry).connect(output);
    wet.connect(output);
    return { dry, wet, mix(m) { smooth(dry.gain, 1 - m); smooth(wet.gain, m); } };
  };
  let update = () => {};
  let schedule = () => {};
  switch (box.type) {
    case 'dist': {
      const pre = gain(1), sh = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), trim = gain(1);
      sh.oversample = '2x';
      tone.type = 'lowpass';
      const x = dryWet();
      input.connect(pre).connect(sh).connect(tone).connect(trim).connect(x.wet);
      let key = '';
      update = p => {
        const k = `${p.drive}:${p.shape}`;
        if (k !== key) { key = k; sh.curve = distCurve(Math.max(0.02, p.drive), p.shape); }
        smooth(tone.frequency, p.tone);
        smooth(trim.gain, 1 - p.drive * 0.4);
        x.mix(p.mix);
        smooth(output.gain, p.level);
      };
      break;
    }
    case 'pcf': {
      const f = ctx.createBiquadFilter();
      input.connect(f).connect(output);
      let cur = null;
      let next = null;   // prochain pas programmé (horloge audio)
      update = p => {
        cur = p;
        f.type = p.mode === 'bp' ? 'bandpass' : 'lowpass';
        smooth(f.Q, p.q);
        smooth(output.gain, p.level);
      };
      // Déclenche l'enveloppe du filtre à chaque pas actif du motif, sur la grille des doubles-croches.
      schedule = (t0, t1) => {
        const p = cur;
        const e = engine;
        if (!p || e.origin === null) return;
        const step = 60 / e.bpm / 4;
        if (next === null || next < t0 - 0.05 || next > t1 + step) next = e.origin + Math.ceil((t0 - e.origin) / step - 1e-6) * step;
        const pat = PCF_PATTERNS[p.pattern] ?? PCF_PATTERNS.eighths;
        const peak = Math.min(18000, p.freq * (1 + p.amt * 14));
        for (; next < t1; next += step) {
          const k = ((Math.round((next - e.origin) / step) % 16) + 16) % 16;
          if (pat[k] !== 'x') continue;
          f.frequency.setValueAtTime(peak, next);
          f.frequency.setTargetAtTime(p.freq, next + 0.001, p.dec / 3);
        }
      };
      break;
    }
    case 'filter': {
      const f = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const depth = gain(0);
      lfo.connect(depth).connect(f.detune);
      lfo.start();
      input.connect(f).connect(output);
      update = p => {
        f.type = { lp: 'lowpass', hp: 'highpass', bp: 'bandpass' }[p.mode];
        smooth(f.frequency, p.cutoff);
        smooth(f.Q, p.reso);
        // LFO calé sur le tempo : `lfo` cycles par mesure (0 = coupé), jusqu'à ±2 octaves.
        lfo.frequency.setTargetAtTime(p.lfo ? p.lfo * engine.bpm / 240 : 0, now(), 0.02);
        smooth(depth.gain, p.lfo ? p.depth * 2400 : 0);
        smooth(output.gain, p.level);
      };
      break;
    }
    case 'delay': {
      const d = ctx.createDelay(4), fb = gain(0.4), tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      const x = dryWet();
      smooth(x.dry.gain, 1);
      input.connect(d).connect(tone).connect(x.wet);
      tone.connect(fb).connect(d);
      update = p => {
        const beat = 60 / engine.bpm;
        const time = p.div === 6 ? beat * 0.75 : p.div === 3 ? beat * 2 / 3 : beat * 4 / p.div;   // 6 = croche pointée, 3 = noire de triolet
        d.delayTime.setTargetAtTime(Math.min(3.9, time), now(), 0.05);
        smooth(fb.gain, p.feedback);
        smooth(tone.frequency, p.tone);
        smooth(x.dry.gain, 1);
        smooth(x.wet.gain, p.mix);
        smooth(output.gain, p.level);
      };
      break;
    }
    case 'reverb': {
      const conv = ctx.createConvolver();
      const x = dryWet();
      input.connect(conv).connect(x.wet);
      let size = null;
      update = p => {
        if (p.size !== size) { size = p.size; conv.buffer = impulse(ctx, size); }
        smooth(x.dry.gain, 1 - p.mix * 0.5);
        smooth(x.wet.gain, p.mix);
        smooth(output.gain, p.level);
      };
      break;
    }
    case 'comp': {
      const c = ctx.createDynamicsCompressor();
      c.attack.value = 0.005;
      c.release.value = 0.12;
      const makeup = gain(1);
      input.connect(c).connect(makeup).connect(output);
      update = p => {
        smooth(c.threshold, p.threshold);
        smooth(c.ratio, p.ratio);
        smooth(makeup.gain, Math.pow(10, p.makeup / 20));
        smooth(output.gain, p.level);
      };
      break;
    }
    case 'crush': {
      const sh = ctx.createWaveShaper();
      const x = dryWet();
      input.connect(sh).connect(x.wet);
      let bits = null;
      update = p => {
        if (p.bits !== bits) {
          bits = p.bits;
          const steps = Math.pow(2, bits - 1);
          const n = 4096;
          const curve = new Float32Array(n);
          for (let i = 0; i < n; i++) { const v = (i / (n - 1)) * 2 - 1; curve[i] = Math.round(v * steps) / steps; }
          sh.curve = curve;
        }
        x.mix(p.mix);
        smooth(output.gain, p.level);
      };
      break;
    }
  }
  return { input, output, update, schedule };
}

export class Patch {
  // live : false pour l'export (tout est programmé d'avance, pas de minuterie).
  constructor(engine, mixer, getState, live = true) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.mixer = mixer;
    this.getState = getState;
    this.boxes = new Map();   // id -> boîte audio
    this.rebuild();
    if (live) this.timer = setInterval(() => this.tick(), 25);
  }

  get st() { return this.getState(); }

  out(id) { return CHANNELS.includes(id) ? this.mixer.strips[id]?.out : this.boxes.get(id)?.output; }
  in(id) { return id === 'master' ? this.engine.master : this.boxes.get(id)?.input; }

  // Boîtes créées / retirées, câbles refaits d'après l'état.
  rebuild() {
    const st = this.st;
    const want = new Set(st.boxes.map(b => b.id));
    for (const [id, b] of this.boxes) if (!want.has(id)) { b.output.disconnect(); b.input.disconnect(); this.boxes.delete(id); }
    for (const b of st.boxes) {
      if (!this.boxes.has(b.id)) this.boxes.set(b.id, buildBox(this.ctx, this.engine, b));
      this.boxes.get(b.id).update(b.p);
    }
    for (const id of CHANNELS) this.out(id)?.disconnect();
    for (const b of this.boxes.values()) b.output.disconnect();
    for (const l of st.links) {
      const a = this.out(l.from), z = this.in(l.to);
      if (a && z) a.connect(z);
    }
  }

  update(id) {
    const b = this.st.boxes.find(x => x.id === id);
    if (b) this.boxes.get(id)?.update(b.p);
  }

  // Tempo changé : les delays et LFO calés sur le tempo suivent.
  tempoChanged() { for (const b of this.st.boxes) this.boxes.get(b.id)?.update(b.p); }

  tick() {
    const t = this.ctx.currentTime;
    for (const b of this.boxes.values()) b.schedule(t, t + 0.12);
  }

  // Export : programme les PCF sur tout le morceau.
  scheduleAll(t0, t1) { for (const b of this.boxes.values()) b.schedule(t0, t1); }
}
