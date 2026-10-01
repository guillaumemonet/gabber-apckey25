// Compteur de charge (en-tête) : moteur audio et interface.
// - Audio : la charge que donne le navigateur quand il sait la mesurer (AudioContext.renderCapacity, Chrome / Edge) ;
//   sinon on surveille l'horloge audio : si elle avance moins vite que le temps réel, le moteur n'arrive plus à suivre
//   (son haché). Dans ce cas la barre montre ce retard.
// - Interface : part du temps où la page n'arrive plus à afficher ses images (calculs, dessin de la timeline…).

const WINDOW = 500;   // ms entre deux mesures

export class CpuMeter {
  // ctx : contexte audio ; voices() : nombre de voix et de sons qui jouent ; onUpdate(mesure) à chaque mesure.
  constructor(ctx, voices, onUpdate) {
    this.ctx = ctx;
    this.voices = voices;
    this.onUpdate = onUpdate;
    this.audio = 0;          // 0..1 : charge du moteur audio (renderCapacity) ou retard de l'horloge
    this.precise = false;    // true : charge donnée par le navigateur
    this.underrun = 0;       // part des blocs audio rendus en retard (renderCapacity)
    this.ui = 0;
    this.frames = 0;
    this.minFrame = Infinity;
    this.minSeen = [];
    this.clock = [];         // [heure audio, heure réelle] des dernières mesures (2 s)
    this.lastW = performance.now();
    this.lastFrame = this.lastW;
    try {
      const rc = ctx.renderCapacity;
      if (rc?.start) {
        rc.addEventListener('update', e => { this.precise = true; this.audio = e.averageLoad; this.peak = e.peakLoad; this.underrun = e.underrunRatio; });
        rc.start({ updateInterval: WINDOW / 1000 });
      }
    } catch { /* pas de mesure du navigateur */ }
    const frame = now => {
      const d = now - this.lastFrame;
      this.lastFrame = now;
      if (d > 0) { this.frames++; this.minFrame = Math.min(this.minFrame, d); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    this.timer = setInterval(() => this.measure(), WINDOW);
  }

  measure() {
    const now = performance.now();
    const elapsed = now - this.lastW;
    // Horloge audio : retard sur le temps réel, sur 2 s (elle avance par paquets : une mesure courte serait trompeuse),
    // seulement quand le son tourne et que la page est visible.
    if (!this.precise) {
      if (this.ctx.state !== 'running' || document.hidden) this.clock = [];
      this.clock.push([this.ctx.currentTime, now]);
      if (this.clock.length > 5) this.clock.shift();
      const [a0, w0] = this.clock[0];
      const span = (now - w0) / 1000;
      const lag = span > 1.5 ? Math.min(1, Math.max(0, 1 - (this.ctx.currentTime - a0) / span)) : 0;
      this.audio = lag > 0.05 ? lag : 0;
    }
    // Interface : images affichées comparées à ce que l'écran permet (intervalle mini vu ces dernières secondes).
    if (!document.hidden && this.frames) {
      this.minSeen.push(this.minFrame);
      if (this.minSeen.length > 10) this.minSeen.shift();
      const interval = Math.max(4, Math.min(...this.minSeen));
      const busy = Math.min(1, Math.max(0, 1 - (this.frames * interval) / elapsed));
      this.ui = this.ui * 0.4 + busy * 0.6;
    }
    this.frames = 0;
    this.minFrame = Infinity;
    this.lastW = now;
    this.onUpdate({ audio: this.audio, precise: this.precise, underrun: this.underrun, ui: this.ui, voices: this.voices() });
  }
}
