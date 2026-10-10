// Fin de la chaîne master, dans le fil audio : limiteur à anticipation (lookahead) puis mesures.
// Limiteur : gain d'entrée, plafond (ceiling), relâchement. Le son est retardé de 5 ms ; le gain nécessaire pour qu'aucun
// échantillon ne dépasse le plafond est préparé pendant ce temps (minimum glissant puis moyenne sur 5 ms : pas de clic),
// puis remonte doucement (relâchement). Mesures envoyées toutes les 100 ms : énergie pondérée K (pour les LUFS,
// voir js/lufs.js), crête de sortie, réduction de gain maximale.
// Réglages par message : { on, gain (dB), ceiling (dB), release (ms) } ; options : { k: coefficients de pondération K }.

class MasterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sr = sampleRate;
    this.la = Math.max(1, Math.round(0.005 * sr));   // anticipation : 5 ms
    this.buf = [new Float32Array(this.la), new Float32Array(this.la)];   // son retardé de `la` échantillons
    this.pos = 0;
    // Minimum glissant (file monotone) des gains nécessaires, puis moyenne glissante.
    this.dqIdx = new Int32Array(this.la + 2);
    this.dqVal = new Float32Array(this.la + 2);
    this.dqHead = 0; this.dqLen = 0; this.n = 0;
    this.box = new Float32Array(this.la); this.boxSum = this.la; this.boxPos = 0; this.box.fill(1);
    this.g = 1;
    this.set({ on: true, gain: 0, ceiling: -0.3, release: 80 });
    // Mesures.
    this.k = options.processorOptions?.k;
    this.kState = [new Float64Array(8), new Float64Array(8)];
    this.slice = Math.round(0.1 * sr);
    this.count = 0; this.energy = [0, 0]; this.peak = 0; this.minGain = 1;
    this.port.onmessage = e => this.set(e.data);
  }

  set(p) {
    if (p.on !== undefined) this.on = !!p.on;
    if (p.gain !== undefined) this.pre = Math.pow(10, p.gain / 20);
    if (p.ceiling !== undefined) this.ceil = Math.pow(10, p.ceiling / 20);
    if (p.release !== undefined) this.rel = 1 - Math.exp(-1 / (Math.max(5, p.release) * 0.001 * sampleRate));
  }

  // Pondération K d'un échantillon du canal c (deux biquads en série).
  kw(c, x) {
    const s = this.kState[c], [f1, f2] = this.k;
    const y1 = f1.b[0] * x + f1.b[1] * s[0] + f1.b[2] * s[1] - f1.a[0] * s[2] - f1.a[1] * s[3];
    s[1] = s[0]; s[0] = x; s[3] = s[2]; s[2] = y1;
    const y2 = f2.b[0] * y1 + f2.b[1] * s[4] + f2.b[2] * s[5] - f2.a[0] * s[6] - f2.a[1] * s[7];
    s[5] = s[4]; s[4] = y1; s[7] = s[6]; s[6] = y2;
    return y2;
  }

  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    const L = inp[0], R = inp[1] ?? inp[0];
    const oL = out[0], oR = out[1] ?? out[0];
    if (!oL) return true;
    const len = oL.length, la = this.la;
    for (let i = 0; i < len; i++) {
      const pre = this.on ? this.pre : 1;   // le gain d'entrée fait partie du limiteur : coupé avec lui
      const l = L ? L[i] * pre : 0, r = R ? R[i] * pre : 0;
      let yl, yr;
      if (this.on) {
        // Gain nécessaire pour cet échantillon, ajouté à la file du minimum glissant (fenêtre de la + 1 échantillons :
        // elle couvre l'échantillon qui sort, retardé de la).
        const a = Math.max(Math.abs(l), Math.abs(r));
        const need = a > this.ceil ? this.ceil / a : 1;
        const n = this.n++;
        while (this.dqLen && this.dqVal[(this.dqHead + this.dqLen - 1) % (la + 2)] >= need) this.dqLen--;
        const slot = (this.dqHead + this.dqLen) % (la + 2);
        this.dqIdx[slot] = n; this.dqVal[slot] = need; this.dqLen++;
        while (this.dqIdx[this.dqHead] <= n - la - 1) { this.dqHead = (this.dqHead + 1) % (la + 2); this.dqLen--; }
        const min = this.dqVal[this.dqHead];
        // Moyenne sur la fenêtre : la descente du gain est étalée sur 5 ms et atteint le minimum à temps.
        this.boxSum += min - this.box[this.boxPos];
        this.box[this.boxPos] = min;
        this.boxPos = (this.boxPos + 1) % la;
        const target = Math.min(min, this.boxSum / la);
        this.g = target < this.g ? target : this.g + (target - this.g) * this.rel;
        // Sortie : l'échantillon d'il y a 5 ms, avec le gain préparé pour lui.
        const p = this.pos;
        yl = this.buf[0][p] * this.g; yr = this.buf[1][p] * this.g;
        this.buf[0][p] = l; this.buf[1][p] = r;
        this.pos = (p + 1) % la;
        // Garde-fou : jamais au-dessus du plafond.
        if (yl > this.ceil) yl = this.ceil; else if (yl < -this.ceil) yl = -this.ceil;
        if (yr > this.ceil) yr = this.ceil; else if (yr < -this.ceil) yr = -this.ceil;
        if (this.g < this.minGain) this.minGain = this.g;
      } else {
        yl = l; yr = r;
      }
      oL[i] = yl;
      if (oR !== oL) oR[i] = yr;
      // Mesures.
      if (this.k) {
        const wl = this.kw(0, yl), wr = this.kw(1, yr);
        this.energy[0] += wl * wl; this.energy[1] += wr * wr;
      }
      const pk = Math.max(Math.abs(yl), Math.abs(yr));
      if (pk > this.peak) this.peak = pk;
      if (++this.count >= this.slice) {
        this.port.postMessage({ e: (this.energy[0] + this.energy[1]) / this.count, peak: this.peak, gr: this.minGain });
        this.count = 0; this.energy[0] = this.energy[1] = 0; this.peak = 0; this.minGain = 1;
      }
    }
    return true;
  }
}

registerProcessor('gk-master', MasterProcessor);
