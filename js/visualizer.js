// Visualiseur façon Winamp, en clin d'œil.
// Modes 2D (dessinés dans un canvas) : spectre à LED avec crêtes qui retombent, oscilloscope à traînées,
// « Milk » façon MilkDrop (l'image précédente est réinjectée, zoomée et tournée), vumètres à aiguille façon hi-fi,
// texte qui cogne sur les kicks, nuage de particules, barres Amiga et défileur, spectrogramme.
// Modes 3D / GPU (WebGL, voir js/viz3d.js). Un drop (retour des graves après un break) fait exploser l'image.
// Chaîne d'image (WebGL) : le mode -> filtres empilables (CRT…) et transition entre modes -> chaque sortie
// (l'aperçu de la fenêtre, la fenêtre projecteur sur un deuxième écran).
// Les couleurs avancent avec le tempo (une teinte par temps) ; chaque kick fait un flash.
// Rien n'est calculé quand aucune sortie n'est affichée.

import { VizGL, GL_MODES } from './viz3d.js';

const GL_OK = VizGL.supported();
// Modes 2D, puis 3D / GPU (si le WebGL est disponible) ; filtres (ils passent par le WebGL).
export const VIZ_2D = ['spectrum', 'scope', 'milk', 'vu', 'bang', 'particles', 'copper', 'spectrogram'];
export const VIZ_3D = GL_OK ? GL_MODES : [];
export const VIZ_MODES = [...VIZ_2D, ...VIZ_3D];
export const VIZ_FILTERS = GL_OK ? ['crt', 'kaleido', 'glitch', 'strobe'] : [];
const SCENE_SCALE = { fractal: 0.5, blob: 0.55, terrain: 0.6, city: 0.6, metaballs: 0.6, plasma: 0.5, lasers: 0.7, starfield: 0.8, tunnel: 0.75, rotozoom: 0.75, ledwall: 1 };
const MAX_PIXELS = 1920 * 1080;
const STROBE_GAP = 0.34;   // au plus 3 flashs par seconde (recommandation pour l'épilepsie photosensible)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;

export class Visualizer {
  // opts : { beats() -> temps écoulés, bpm(), channels: [{ id, label }], level(id) -> crête 0..1 }
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
    this.fx = {};                 // filtres actifs : { crt: 0..1, kaleido: branches, glitch: 0..1, strobe: bool }
    this.words = ['HARDCORE'];    // textes du mode « texte qui cogne »
    this.speed = 1;       // réglages (potentiomètres) : vitesse, décalage de teinte, force des flashs, sensibilité
    this.hueShift = 0;
    this.flashGain = 1;
    this.sens = 1;
    this.bins = new Float32Array(64);
    this.bassSlow = 0;    // détection des breaks et des drops
    this.breakSince = null;
    this.onDrop = () => {};
    this.kicks = [];
    this.flash = 0;
    this.punch = 0;
    this.strobe = 0;
    this.strobeAt = -1;
    this.travel = 0;
    this.last = performance.now();
    this.bars = [];
    this.peaks = [];
    this.needles = [0, 0];
    this.clips = [0, 0];
    this.chan = {};
    this.outputs = new Set();
    this.running = false;
    this.src = document.createElement('canvas');   // image des modes 2D
    this.fb = document.createElement('canvas');    // image précédente (Milk)
    this.spin = 0;
    this.glp = null;
    if (GL_OK) { try { this.glp = new VizGL(); } catch (err) { console.warn('Visualizer WebGL', err); } }
  }

  kick(time) { this.kicks.push(time); }

  // Une sortie = un canvas affiché (aperçu de la fenêtre, projecteur). Le calcul tourne tant qu'il y en a une.
  addOutput(cv) {
    this.outputs.add(cv);
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.outputs.size) { this.running = false; return; }
      try { this.frame(); } catch (err) { console.warn('Visualizer', err); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  removeOutput(cv) { this.outputs.delete(cv); }

  setMode(mode) {
    if (mode === this.mode) return;
    this.glp?.beginTransition();
    this.mode = mode;
  }

  frame() {
    // Taille de travail : la plus grande des sorties visibles (plafonnée à la Full HD).
    const outs = [...this.outputs].filter(c => c.isConnected && c.clientWidth > 0 && c.clientHeight > 0);
    if (!outs.length) return;
    const px = c => Math.min(2, c.ownerDocument.defaultView?.devicePixelRatio || 1);
    let W = Math.max(...outs.map(c => c.clientWidth * px(c))), H = Math.max(...outs.map(c => c.clientHeight * px(c)));
    const k = Math.min(1, Math.sqrt(MAX_PIXELS / (W * H)));
    W = Math.max(2, Math.round(W * k));
    H = Math.max(2, Math.round(H * k));
    const cssW = Math.max(...outs.map(c => c.clientWidth));

    const now = this.ctx.currentTime;
    let kicked = false;
    while (this.kicks.length && this.kicks[0] <= now + 0.01) {
      const t = this.kicks.shift();
      if (now - t < 0.2) { this.flash = Math.max(this.flash, this.flashGain); this.punch = 1; kicked = true; }
    }
    this.kicks = this.kicks.filter(t => t > now - 0.2);
    this.an.getByteFrequencyData(this.freq);
    this.an.getFloatTimeDomainData(this.wave);
    const beats = this.opts.beats() * this.speed;
    this.beats = beats;
    this.hue = 200 + beats * 24 + this.hueShift;   // la teinte avance d'un cran par temps
    this.tint = 40 * Math.sin(beats * Math.PI / 8);   // le spectre, lui, reste vert-jaune-rouge et oscille sur 16 temps
    this.bass = Math.min(1, this.band(30, 150) * this.sens);
    this.mid = Math.min(1, this.band(400, 2500) * this.sens);
    this.high = Math.min(1, this.band(5000, 14000) * this.sens);
    const hzb = this.ctx.sampleRate / this.an.fftSize;
    for (let i = 0; i < 64; i++) {
      const k = Math.min(this.freq.length - 1, Math.round(30 * Math.pow(16000 / 30, i / 64) / hzb));
      this.bins[i] = Math.min(1, this.freq[k] / 255 * this.sens);
    }
    this.detectDrop(now);
    const t = performance.now();
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.travel += dt * (this.opts.bpm() / 60) * this.speed * (0.5 + this.bass * 1.5 + this.punch * 3);
    // Stroboscope : un flash blanc sur les kicks, jamais plus de 3 par seconde.
    if (this.fx.strobe && kicked && now - this.strobeAt >= STROBE_GAP) this.strobeAt = now;
    this.strobe = this.fx.strobe ? Math.max(0, 1 - (now - this.strobeAt) / 0.07) : 0;

    let source;
    const v = { beats, bass: this.bass, mid: this.mid, high: this.high, flash: this.flash, hue: this.hue, travel: this.travel, time: t / 1000 };
    const gl3d = GL_MODES.includes(this.mode) && this.glp;
    if (!gl3d) {
      const s2 = this.mode === 'milk' ? 0.5 : 1;
      const w = Math.round(W * s2), h = Math.round(H * s2);
      if (this.src.width !== w || this.src.height !== h) { this.src.width = w; this.src.height = h; this.fb.width = w; this.fb.height = h; }
      const mode = GL_MODES.includes(this.mode) ? 'milk' : this.mode;
      this[mode](this.src.getContext('2d'), { w, h, s: (W / cssW) * s2 });
    }
    if (this.glp) {
      this.glp.resize(W, H);
      if (gl3d) {
        this.glp.analyse(this.freq, this.ctx.sampleRate / this.an.fftSize, beats);
        if (this.glp.isSim(this.mode)) this.glp.simulate(this.mode, v, this.splat(kicked));
        else this.glp.scene(this.mode, v, SCENE_SCALE[this.mode] ?? 0.75);
      } else this.glp.upload(this.src);
      this.glp.post(v, { crt: this.fx.crt || 0, kaleido: this.fx.kaleido || 0, glitch: this.fx.glitch || 0, strobe: this.strobe });
      source = this.glp.cv;
    } else source = this.src;
    for (const c of outs) {
      const w = Math.round(Math.min(W, c.clientWidth * px(c))), h = Math.round(Math.min(H, c.clientHeight * px(c)));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      c.getContext('2d').drawImage(source, 0, 0, w, h);
    }
    this.flash *= 0.86;
    this.punch *= 0.8;
  }

  // Encre du fluide (une giclée à chaque kick, un filet qui tourne avec les médiums) ; germes de la réaction-diffusion.
  splat(kicked) {
    const col = h => { const c = [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }); return c; };
    if (this.mode === 'reaction') return kicked ? { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7, r: 0.03, w: 1, col: [0, 0, 0] } : null;
    if (kicked) return { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6, r: 0.07, w: 0.9, col: col(this.hue + Math.random() * 120) };
    const a = this.beats * 0.8;
    return { x: 0.5 + Math.cos(a) * 0.28, y: 0.5 + Math.sin(a * 1.3) * 0.28, r: 0.035, w: 0.15 + this.mid * 0.5, col: col(this.hue + 180) };
  }

  // Break (les graves disparaissent pendant plus de 2 mesures) puis drop (ils reviennent) : grosse explosion.
  detectDrop(now) {
    const bpm = this.opts.bpm();
    this.bassSlow += (this.bass - this.bassSlow) * 0.01;
    if (this.bass < this.bassSlow * 0.35 && this.bassSlow > 0.08) this.breakSince ??= now;
    else if (this.breakSince !== null && this.bass > this.bassSlow * 0.8) {
      if (now - this.breakSince > 8 * 60 / bpm) { this.flash = 1.5; this.punch = 1.6; this.onDrop(); }
      this.breakSince = null;
    }
  }

  // ---- Texte qui cogne : un mot par mesure, écrasé sur chaque kick, étiré par les graves, en glitch ----
  bang(g, { w, h, s }) {
    g.fillStyle = '#050507';
    g.fillRect(0, 0, w, h);
    // Bandes diagonales qui défilent au tempo.
    g.save();
    g.globalAlpha = 0.07 + this.flash * 0.12;
    g.fillStyle = hsl(this.hue, 100, 55);
    const off = (this.beats * 40 * s) % (80 * s);
    for (let x = -h - 80 * s + off; x < w + h; x += 80 * s) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40 * s, 0); g.lineTo(x + 40 * s + h, h); g.lineTo(x + h, h); g.fill();
    }
    g.restore();
    const words = this.words.length ? this.words : ['HARDCORE'];
    const word = words[Math.floor(this.beats / 4) % words.length].toUpperCase();
    let size = h * 0.34;
    g.font = `900 ${size}px Impact, "Arial Black", "Segoe UI Black", system-ui, sans-serif`;
    const mw = g.measureText(word).width;
    if (mw > w * 0.86) { size *= w * 0.86 / mw; g.font = `900 ${size}px Impact, "Arial Black", "Segoe UI Black", system-ui, sans-serif`; }
    const slam = this.punch;
    const sx = 1 + slam * 0.12, sy = 1 + slam * 0.18 + this.bass * 0.1;
    const shake = slam * h * 0.02;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const draw = (color, dx) => {
      g.save();
      g.translate(w / 2 + dx + (Math.random() - 0.5) * shake, h / 2 + (Math.random() - 0.5) * shake);
      g.scale(sx, sy);
      g.fillStyle = color;
      g.fillText(word, 0, 0);
      g.restore();
    };
    g.globalCompositeOperation = 'lighter';
    const split = (3 + slam * 10) * s;
    draw(hsl(this.hue, 100, 50, 0.9), -split);
    draw(hsl(this.hue + 180, 100, 50, 0.9), split);
    g.globalCompositeOperation = 'source-over';
    draw('#fff', 0);
    // Bandes décalées (glitch) juste après le kick.
    if (this.flash > 0.6) {
      for (let k = 0; k < 3; k++) {
        const y = h * (0.3 + Math.random() * 0.4), bh = (3 + Math.random() * 14) * s;
        g.drawImage(this.src, 0, y, w, bh, (Math.random() - 0.5) * 30 * s * this.flash, y, w, bh);
      }
    }
    g.font = `700 ${Math.round(14 * s)}px system-ui, sans-serif`;
    g.fillStyle = hsl(this.hue + 180, 80, 70, 0.8);
    g.fillText(`${Math.round(this.opts.bpm())} BPM`, w / 2, h * 0.88);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  // ---- Nuage de particules : une sphère de points qui explose à chaque kick puis se reforme ----
  particles(g, { w, h, s }) {
    g.fillStyle = 'rgba(3,3,6,0.35)';
    g.fillRect(0, 0, w, h);
    const N = 1400;
    if (!this.pts) {
      this.pts = [];
      for (let i = 0; i < N; i++) {   // points répartis sur la sphère (spirale de Fibonacci)
        const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
        this.pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, d: 0, v: 0, band: i % 64 });
      }
    }
    const ay = this.beats * 0.12, ax = Math.sin(this.beats * 0.05) * 0.6;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const R = Math.min(w, h) * 0.3 * (1 + this.bass * 0.25);
    const kick = this.punch > 0.95;
    g.globalCompositeOperation = 'lighter';
    for (const p of this.pts) {
      if (kick) p.v += 0.06 + Math.random() * 0.1;
      p.v += -p.d * 0.08;                 // ressort : retour sur la sphère
      p.v *= 0.9;
      p.d += p.v;
      const bump = 1 + p.d + (this.bins?.[p.band] ?? 0) * 0.35;
      let x = p.x * bump, y = p.y * bump, z = p.z * bump;
      [x, z] = [x * cy - z * sy, x * sy + z * cy];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const persp = 2.2 / (2.2 + z);
      const px = w / 2 + x * R * persp, py = h / 2 + y * R * persp;
      const size = Math.max(1, 2.2 * s * persp);
      g.fillStyle = hsl(this.hue + p.band * 2 + z * 40, 90, 55 + 10 * persp, 0.55 * persp);
      g.fillRect(px - size / 2, py - size / 2, size, size);
    }
    g.globalCompositeOperation = 'source-over';
  }

  // ---- Barres Amiga (copper bars) et défileur sinusoïdal ----
  copper(g, { w, h, s }) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    // Petites étoiles qui défilent à l'horizontale.
    this.stars ??= Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));
    g.fillStyle = '#fff';
    for (const st of this.stars) {
      st.x -= 0.002 * st.z * (1 + this.bass * 2);
      if (st.x < 0) { st.x += 1; st.y = Math.random(); }
      g.globalAlpha = st.z;
      g.fillRect(st.x * w, st.y * h, 2 * s * st.z, 2 * s * st.z);
    }
    g.globalAlpha = 1;
    const bh = h * 0.07;
    for (let i = 0; i < 8; i++) {
      const y = h * 0.42 + Math.sin(this.beats * 0.9 + i * 0.45) * h * 0.3 * (0.8 + this.mid * 0.4);
      const grd = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
      const hue = this.hue + i * 40;
      grd.addColorStop(0, hsl(hue, 90, 10));
      grd.addColorStop(0.5, hsl(hue, 90, 70 + this.flash * 20));
      grd.addColorStop(1, hsl(hue, 90, 10));
      g.fillStyle = grd;
      g.fillRect(0, y - bh / 2, w, bh);
    }
    // Défileur : les mots du mode Texte qui cogne, sur une vague.
    const text = `${(this.words.length ? this.words : ['GABBERKEY']).join('  ***  ')}  ***  ${Math.round(this.opts.bpm())} BPM  ***  `;
    const size = Math.round(h * 0.11);
    g.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`;
    g.textBaseline = 'middle';
    const cw = size * 0.62;
    const total = text.length * cw;
    this.scrollX = ((this.scrollX ?? 0) + (2 + this.bass * 4) * s) % total;
    for (let i = 0; i * cw - this.scrollX < w + total; i++) {
      const x = i * cw - this.scrollX;
      if (x < -cw || x > w + cw) continue;
      const ch = text[i % text.length];
      const y = h * 0.8 + Math.sin(x * 0.012 / s + this.beats * 2.5) * h * 0.06 * (1 + this.punch);
      g.fillStyle = hsl(this.hue + x * 0.2, 100, 60);
      g.fillText(ch, x, y);
    }
    g.textBaseline = 'alphabetic';
  }

  // ---- Spectrogramme : le son défile en cascade de couleurs (graves en bas) ----
  spectrogram(g, { w, h }) {
    const sc = (this.sgram ??= document.createElement('canvas'));
    if (sc.width !== w || sc.height !== h) { sc.width = w; sc.height = h; sc.getContext('2d').fillStyle = '#000'; sc.getContext('2d').fillRect(0, 0, w, h); }
    const c = sc.getContext('2d');
    const step = Math.max(1, Math.round(w / 500));
    c.drawImage(sc, -step, 0);
    const hz = this.ctx.sampleRate / this.an.fftSize;
    const img = c.createImageData(step, h);
    for (let y = 0; y < h; y++) {
      const f = 30 * Math.pow(16000 / 30, 1 - y / h);
      const v = this.freq[Math.min(this.freq.length - 1, Math.round(f / hz))] / 255;
      // Noir -> violet -> rouge -> jaune -> blanc.
      const r = Math.min(255, v * 3 * 255), gg = Math.min(255, Math.max(0, v * 3 - 1) * 255), b = Math.min(255, Math.max(0, v < 0.33 ? v * 2.2 : (1 - v) * 1.2 + Math.max(0, v * 3 - 2)) * 255);
      for (let x = 0; x < step; x++) { const o = (y * step + x) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255; }
    }
    c.putImageData(img, w - step, 0);
    g.drawImage(sc, 0, 0);
    if (this.flash > 0.5) { g.fillStyle = `rgba(255,255,255,${(this.flash - 0.5) * 0.3})`; g.fillRect(w - 3, 0, 3, h); }
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
    b.drawImage(this.src, 0, 0);
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
