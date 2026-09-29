// Visualiseur façon Winamp, en clin d'œil : spectre à LED avec crêtes qui retombent, oscilloscope à traînées,
// mode « MilkDrop » (l'image précédente est réinjectée, zoomée et tournée : formes qui tourbillonnent et laissent
// des traînées), vumètres à aiguille façon hi-fi et barres LED par voie de mixage.
// Les couleurs avancent avec le tempo (une teinte par temps) ; chaque kick fait un flash.
// Rien n'est dessiné quand la fenêtre est fermée.

import { Viz3D, GL_MODES } from './viz3d.js';

// Modes 2D (canvas) puis 3D (WebGL, s'il est disponible).
export const VIZ_MODES = ['spectrum', 'scope', 'milk', 'vu', ...(Viz3D.supported() ? GL_MODES : [])];

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;

export class Visualizer {
  // opts : { beats() -> temps écoulés (tempo), channels: [{ id, label }], level(id) -> crête 0..1 }
  constructor(ctx, input, opts) {
    this.ctx = ctx;
    this.opts = opts;
    this.an = ctx.createAnalyser();
    this.an.fftSize = 4096;
    this.an.smoothingTimeConstant = 0.72;
    this.an.minDecibels = -80;   // plage large : un son très compressé (gabber) ne sature pas les barres
    this.an.maxDecibels = -8;
    const split = ctx.createChannelSplitter(2);
    this.aL = ctx.createAnalyser();
    this.aR = ctx.createAnalyser();
    for (const a of [this.aL, this.aR]) { a.fftSize = 2048; a.smoothingTimeConstant = 0; }
    input.connect(this.an);
    input.connect(split);
    split.connect(this.aL, 0);
    split.connect(this.aR, 1);
    // Firefox ne fait tourner un analyseur que s'il mène à la sortie : on les y relie par un gain nul (inaudible).
    const sink = ctx.createGain();
    sink.gain.value = 0;
    for (const a of [this.an, this.aL, this.aR]) a.connect(sink);
    sink.connect(ctx.destination);
    this.freq = new Uint8Array(this.an.frequencyBinCount);
    this.wave = new Float32Array(this.an.fftSize);
    this.wl = new Float32Array(this.aL.fftSize);
    this.wr = new Float32Array(this.aR.fftSize);
    this.mode = 'spectrum';
    this.kicks = [];
    this.flash = 0;
    this.punch = 0;
    this.bars = [];
    this.peaks = [];
    this.needles = [0, 0];
    this.clips = [0, 0];
    this.chan = {};
    this.running = false;
    this.fb = document.createElement('canvas');   // image précédente (MilkDrop)
    this.spin = 0;
  }

  kick(time) { this.kicks.push(time); }

  start(canvas, glCanvas) {
    this.cv = canvas;
    this.glCv = glCanvas;
    if (this.running) return;
    this.running = true;
    const loop = () => { if (!this.running) return; this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  // Taille du canvas = taille affichée (le mode MilkDrop calcule en demi-résolution).
  size() {
    const cv = this.cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1) * (this.mode === 'milk' ? 0.5 : 1);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.fb.width = w; this.fb.height = h; }
    return { w, h, s: dpr };
  }

  frame() {
    if (!this.cv?.parentElement?.clientWidth) return;   // fenêtre repliée (le canvas 2D, lui, est masqué en mode 3D)
    const now = this.ctx.currentTime;
    while (this.kicks.length && this.kicks[0] <= now + 0.01) {
      const t = this.kicks.shift();
      if (now - t < 0.2) { this.flash = 1; this.punch = 1; }
    }
    this.kicks = this.kicks.filter(t => t > now - 0.2);
    this.an.getByteFrequencyData(this.freq);
    this.an.getFloatTimeDomainData(this.wave);
    const beats = this.opts.beats();
    this.hue = 200 + beats * 24;   // la teinte avance d'un cran par temps
    this.tint = 40 * Math.sin(beats * Math.PI / 8);   // le spectre, lui, reste vert-jaune-rouge et oscille sur 16 temps
    this.bass = this.band(30, 150);
    this.mid = this.band(400, 2500);
    this.high = this.band(5000, 14000);
    const gl = GL_MODES.includes(this.mode);
    this.cv.hidden = gl;
    if (this.glCv) this.glCv.hidden = !gl;
    if (gl) {
      try {
        this.gl3d ??= new Viz3D(this.glCv);
        // Résolution plafonnée (le plein écran reste fluide).
        const scale = Math.min(1, 1100 / Math.max(1, this.glCv.clientWidth)) * Math.min(1.5, window.devicePixelRatio || 1);
        this.gl3d.render(this.mode, this.freq, this.ctx.sampleRate / this.an.fftSize, { beats, bass: this.bass, mid: this.mid, high: this.high, flash: this.flash, hue: this.hue }, scale);
      } catch (err) { console.warn('Visualizer 3D', err); this.mode = 'milk'; }
    } else {
      const g = this.cv.getContext('2d');
      this[this.mode](g, this.size());
    }
    this.flash *= 0.86;
    this.punch *= 0.8;
  }

  // Niveau moyen 0..1 d'une bande de fréquences.
  band(f0, f1) {
    const hz = this.ctx.sampleRate / this.an.fftSize;
    const a = Math.max(1, Math.floor(f0 / hz)), b = Math.min(this.freq.length - 1, Math.ceil(f1 / hz));
    let s = 0;
    for (let i = a; i <= b; i++) s += this.freq[i];
    return s / (b - a + 1) / 255;
  }

  // Flash du kick : un voile de couleur sur tout l'écran.
  drawFlash(g, w, h, strength = 0.22) {
    if (this.flash < 0.02) return;
    g.fillStyle = hsl(this.hue + 180, 100, 60, this.flash * strength);
    g.fillRect(0, 0, w, h);
  }

  // ---- Spectre : barres de LED, crêtes qui retombent, reflet ----
  spectrum(g, { w, h, s }) {
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, w, h);
    this.drawFlash(g, w, h, 0.1);   // en fond, sous les barres
    const n = clamp(Math.round(w / (14 * s)), 24, 96);
    const hz = this.ctx.sampleRate / this.an.fftSize;
    const base = h * 0.8;
    const gap = Math.max(1, 3 * s);
    const bw = w / n;
    const seg = Math.max(3, 6 * s), segGap = Math.max(1, 2 * s);
    for (let i = 0; i < n; i++) {
      const f0 = 30 * Math.pow(16000 / 30, i / n), f1 = 30 * Math.pow(16000 / 30, (i + 1) / n);
      let v = 0;
      for (let k = Math.floor(f0 / hz); k <= Math.ceil(f1 / hz) && k < this.freq.length; k++) v = Math.max(v, this.freq[k]);
      v = Math.pow(v / 255, 1.6) * (0.85 + i / n * 0.35);
      this.bars[i] = Math.max(v, (this.bars[i] ?? 0) * 0.86);
      const pk = this.peaks[i] ?? { v: 0, vel: 0 };
      if (this.bars[i] >= pk.v) { pk.v = this.bars[i]; pk.vel = 0; } else { pk.vel += 0.0009; pk.v = Math.max(0, pk.v - pk.vel); }
      this.peaks[i] = pk;
      const x = i * bw + gap / 2, bwi = bw - gap;
      const top = base * clamp(this.bars[i], 0, 1);
      for (let y = 0; y < top; y += seg + segGap) {
        const r = y / base;   // du bas (vert) vers le haut (rouge), comme Winamp ; le vert glisse avec le tempo
        const hue = 120 - r * 120 + this.tint * (1 - r);
        g.fillStyle = hsl(hue, 95, 50 + r * 8);
        g.fillRect(x, base - y - seg, bwi, seg);
        g.fillStyle = hsl(hue, 95, 50, 0.16);   // reflet
        g.fillRect(x, base + y + segGap, bwi, seg);
      }
      g.fillStyle = hsl(this.hue, 20, 85);
      g.fillRect(x, base - base * clamp(pk.v, 0, 1) - seg - 2 * s, bwi, Math.max(2, 2.5 * s));
    }
    g.fillStyle = 'rgba(7,8,10,.55)';
    g.fillRect(0, base, w, h - base);
  }

  // ---- Oscilloscope : trace lumineuse calée sur le signal, qui laisse une traînée ----
  scope(g, { w, h, s }) {
    g.fillStyle = 'rgba(4,6,8,0.3)';
    g.fillRect(0, 0, w, h);
    if (this.flash > 0.6) this.drawFlash(g, w, h, 0.05);   // léger : les traînées l'accumulent
    g.strokeStyle = 'rgba(80,255,160,0.07)';
    g.lineWidth = 1;
    for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(0, h * k / 8); g.lineTo(w, h * k / 8); g.stroke(); }
    for (let k = 1; k < 12; k++) { g.beginPath(); g.moveTo(w * k / 12, 0); g.lineTo(w * k / 12, h); g.stroke(); }
    const d = this.wave;
    let start = 0;   // déclenchement sur un passage par zéro montant : la trace ne défile pas
    for (let i = 1; i < d.length / 2; i++) if (d[i - 1] < 0 && d[i] >= 0) { start = i; break; }
    const len = Math.floor(d.length / 4);   // environ 20 ms : quelques cycles du kick, lisibles
    g.lineWidth = 2.2 * s;
    g.shadowBlur = 14 * s;
    g.shadowColor = hsl(this.hue, 100, 60);
    g.strokeStyle = hsl(this.hue, 100, 70);
    g.beginPath();
    for (let i = 0; i < len; i++) {
      const x = i / (len - 1) * w, y = h / 2 - d[start + i] * h * 0.42 * (1 + this.punch * 0.3);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    // Figure de Lissajous (stéréo) dans le coin.
    this.aL.getFloatTimeDomainData(this.wl);
    this.aR.getFloatTimeDomainData(this.wr);
    const r = Math.min(w, h) * 0.16, cx = w - r - 16 * s, cy = r + 16 * s;
    g.lineWidth = 1.2 * s;
    g.strokeStyle = hsl(this.hue + 120, 100, 70, 0.8);
    g.shadowColor = hsl(this.hue + 120, 100, 60);
    g.beginPath();
    for (let i = 0; i < this.wl.length; i += 2) {
      const l = this.wl[i], rr = this.wr[i];
      const x = cx + (l - rr) * r * 0.7, y = cy - (l + rr) * r * 0.7;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  // ---- MilkDrop : l'image précédente est réinjectée (zoom, rotation, teinte) sous de nouvelles formes ----
  milk(g, { w, h }) {
    const b = this.fb.getContext('2d');
    b.clearRect(0, 0, w, h);
    b.drawImage(this.cv, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, w, h);
    this.spin += 0.004 + this.mid * 0.02;
    g.save();
    g.globalAlpha = 0.93;
    g.translate(w / 2, h / 2);
    g.rotate(0.006 + this.bass * 0.02 * Math.sin(this.spin));
    const z = 1.018 + this.bass * 0.03 + this.punch * 0.07;
    g.scale(z, z);
    g.filter = 'hue-rotate(4deg)';
    g.drawImage(this.fb, -w / 2, -h / 2);
    g.restore();
    g.filter = 'none';
    // Onde refermée en cercle, qui gonfle avec les graves et au kick.
    const d = this.wave;
    const R = Math.min(w, h) * (0.18 + this.bass * 0.12 + this.punch * 0.1);
    const pts = 180;
    g.lineWidth = Math.max(1.5, Math.min(w, h) / 220);
    g.strokeStyle = hsl(this.hue, 100, 65);
    g.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = i / pts * TAU + this.spin;
      const v = d[Math.floor(i / pts * (d.length / 2 - 1))] || 0;
      const r = R * (1 + v * 0.9);
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    // Polygones qui tournent en sens contraire, taille suivant les médiums.
    for (let k = 0; k < 3; k++) {
      const sides = 3 + k;
      const rr = Math.min(w, h) * (0.08 + k * 0.07) * (1 + this.mid * 0.8);
      g.strokeStyle = hsl(this.hue + 90 + k * 60, 100, 60, 0.8);
      g.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU - this.spin * (k + 1) * 1.3;
        const x = w / 2 + Math.cos(a) * rr, y = h / 2 + Math.sin(a) * rr;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    // Étincelles sur les aigus.
    const sparks = Math.round(this.high * 30);
    for (let i = 0; i < sparks; i++) {
      const a = Math.random() * TAU, r = R * (1.2 + Math.random() * 1.2);
      g.fillStyle = hsl(this.hue + 200, 100, 80, 0.9);
      g.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2, 2);
    }
    if (this.flash > 0.5) {   // éclat du kick : un anneau qui part du centre
      g.strokeStyle = hsl(this.hue + 180, 100, 75, this.flash);
      g.lineWidth = Math.max(2, Math.min(w, h) / 90);
      g.beginPath();
      g.arc(w / 2, h / 2, R * (1.6 - this.flash * 0.5), 0, TAU);
      g.stroke();
    }
  }

  // ---- Vumètres à aiguille (hi-fi) et barres LED par voie ----
  vu(g, { w, h, s }) {
    g.fillStyle = '#0b0b0d';
    g.fillRect(0, 0, w, h);
    this.aL.getFloatTimeDomainData(this.wl);
    this.aR.getFloatTimeDomainData(this.wr);
    const meterH = h * 0.62;
    const mw = Math.min((w - 36 * s) / 2, meterH * 1.6);
    const y0 = 12 * s;
    [this.wl, this.wr].forEach((d, k) => {
      let sum = 0, peak = 0;
      for (const v of d) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      const rms = Math.sqrt(sum / d.length);
      const db = 20 * Math.log10(Math.max(1e-5, rms)) + 14;          // 0 VU ≈ -14 dBFS efficaces
      const target = clamp((db + 20) / 23, 0, 1);                      // de -20 à +3 VU
      this.needles[k] += (target - this.needles[k]) * 0.16;           // inertie d'aiguille
      this.clips[k] = peak > 0.98 ? 1 : this.clips[k] * 0.93;
      const x = w / 2 + (k ? 6 * s : -6 * s - mw);
      this.needle(g, x, y0, mw, meterH, this.needles[k], this.clips[k], k ? 'R' : 'L', s);
    });
    // Barres LED des voies de mixage (+ master).
    const chans = this.opts.channels;
    const top = y0 + meterH + 16 * s, bh = h - top - 22 * s;
    const cw = Math.min(64 * s, (w - 24 * s) / chans.length);
    const x0 = (w - cw * chans.length) / 2;
    const segs = 18;
    chans.forEach((c, i) => {
      const lvl = clamp(this.opts.level(c.id), 0, 1.2);
      const st = this.chan[c.id] ?? { v: 0, hold: 0, t: 0 };
      st.v = Math.max(lvl, st.v * 0.9);
      if (st.v >= st.hold) { st.hold = st.v; st.t = 40; } else if (--st.t < 0) st.hold *= 0.96;
      this.chan[c.id] = st;
      const x = x0 + i * cw + cw * 0.2, bw = cw * 0.6;
      for (let sgi = 0; sgi < segs; sgi++) {
        const r = sgi / (segs - 1);
        const on = st.v >= r * 0.95 + 0.02;
        const hold = Math.abs(st.hold - r) < 0.5 / segs;
        const col = r > 0.85 ? [0, 95] : r > 0.65 ? [48, 100] : [135 + (this.hue % 60) * 0.3, 80];
        g.fillStyle = hsl(col[0], col[1], on || hold ? 52 : 12, on || hold ? 1 : 0.9);
        const sh = bh / segs;
        g.fillRect(x, top + bh - (sgi + 1) * sh + 1, bw, sh - 2);
      }
      g.fillStyle = '#8b8d94';
      g.font = `${Math.round(10 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(c.label, x + bw / 2, top + bh + 14 * s);
    });
    g.textAlign = 'left';
    this.drawFlash(g, w, h, 0.08);
  }

  needle(g, x, y, w, h, p, clip, name, s) {
    // Cadran rétroéclairé, graduations, zone rouge, aiguille, reflet du verre.
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, '#f6e7bf');
    grd.addColorStop(1, '#d9b870');
    g.fillStyle = '#1b1712';
    g.fillRect(x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s);
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h * 1.18, R = h * 0.98;
    const a0 = -Math.PI / 2 - 0.78, a1 = -Math.PI / 2 + 0.78;
    const ang = v => a0 + (a1 - a0) * v;
    g.lineWidth = 1.4 * s;
    g.strokeStyle = '#2a2116';
    g.beginPath(); g.arc(cx, cy, R * 0.8, a0, a1); g.stroke();
    g.strokeStyle = '#c0281c';
    g.lineWidth = 4 * s;
    g.beginPath(); g.arc(cx, cy, R * 0.8, ang(20 / 23), a1); g.stroke();
    g.font = `${Math.round(11 * s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    for (const db of [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]) {
      const a = ang((db + 20) / 23);
      const r1 = R * 0.8, r2 = R * (db % 5 === 0 || db > -3 ? 0.87 : 0.84);
      g.strokeStyle = db > 0 ? '#c0281c' : '#2a2116';
      g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      if ([-20, -10, -5, -3, 0, 3].includes(db)) {
        g.fillStyle = db > 0 ? '#c0281c' : '#2a2116';
        g.fillText(`${db > 0 ? '+' : ''}${db}`, cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94 + 4 * s);
      }
    }
    g.fillStyle = '#2a2116';
    g.font = `bold ${Math.round(15 * s)}px Georgia, serif`;
    g.fillText('VU', cx, y + h * 0.72);
    g.font = `${Math.round(10 * s)}px system-ui, sans-serif`;
    g.fillText(name, x + 14 * s, y + h - 10 * s);
    g.textAlign = 'left';
    // Aiguille
    const a = ang(p);
    g.strokeStyle = '#111';
    g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); g.stroke();
    // Voyant de crête
    g.fillStyle = clip > 0.1 ? `rgba(255,40,20,${0.4 + clip * 0.6})` : '#5a1d15';
    g.beginPath(); g.arc(x + w - 16 * s, y + h - 14 * s, 5 * s, 0, TAU); g.fill();
    // Reflet du verre
    const glass = g.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, 'rgba(255,255,255,.22)');
    glass.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = glass;
    g.fillRect(x, y, w, h);
    // Rétroéclairage qui pulse au kick
    if (this.flash > 0.05) { g.fillStyle = `rgba(255,190,90,${this.flash * 0.18})`; g.fillRect(x, y, w, h); }
  }
}
