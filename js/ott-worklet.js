// Compression multibande façon OTT, dans le fil audio : trois bandes (filtres de Linkwitz-Riley d'ordre 4 à 88 Hz
// et 2,5 kHz), chacune compressée vers le bas au-dessus de son seuil haut et vers le haut sous son seuil bas.
// Le mélange (Depth) se fait bande par bande avec le son sec de la même bande : sec et traité restent en phase,
// et la somme des bandes non traitées est plate (passe-tout). Depth à 0 : le son entre et ressort tel quel (aucun calcul).
// Réglages par message : { depth, time, up, down (en %), output (dB, appliqué aussi quand Depth est à 0) }.

// Seuils fixes (dB, niveau de crête de la bande), gain de rattrapage du côté traité, temps de base (attaque / relâche en ms).
const BANDS = [
  { down: -14, up: -30, makeup: 5, att: 48, rel: 280 },   // grave
  { down: -16, up: -32, makeup: 4, att: 22, rel: 280 },   // médium
  { down: -18, up: -34, makeup: 6, att: 13.5, rel: 130 },  // aigu
];
const DOWN_SLOPE = 1 - 1 / 66;   // presque un limiteur au-dessus du seuil haut
const UP_SLOPE = 1 - 1 / 4;      // 4:1 vers le haut sous le seuil bas
const MAX_UP = 18;               // remontée maximale (dB)
const FLOOR = -72;               // en dessous, rien n'est remonté (bruit de fond, silence) ; fondu sur 12 dB
const FADE = 0.01;               // passage sec <-> traité : 10 ms

// Coefficients RBJ d'un biquad (b0, b1, b2, a1, a2 normalisés).
function biquad(type, f, sr, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b = type === 'lp' ? [(1 - cs) / 2, 1 - cs, (1 - cs) / 2] : type === 'hp' ? [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2] : [1 - al, -2 * cs, 1 + al];
  return Float64Array.of(b[0] / a0, b[1] / a0, b[2] / a0, -2 * cs / a0, (1 - al) / a0);
}

class OttProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sr = sampleRate;
    // Par canal, dans l'ordre : LP1 ×2, HP1 ×2 (88 Hz), LP2 ×2, HP2 ×2 (2,5 kHz), passe-tout 2,5 kHz sur le grave.
    this.co = [...[0, 0].map(() => biquad('lp', 88, sr)), ...[0, 0].map(() => biquad('hp', 88, sr)),
      ...[0, 0].map(() => biquad('lp', 2500, sr)), ...[0, 0].map(() => biquad('hp', 2500, sr)), biquad('ap', 2500, sr)];
    this.st = [new Float64Array(9 * 4), new Float64Array(9 * 4)];   // x1, x2, y1, y2 par filtre
    this.env = new Float64Array(3);
    this.a = new Float64Array(3);
    this.g = new Float64Array(3);
    this.coef = new Float64Array(6);
    this.p = { depth: 0, time: 100, up: 100, down: 100, output: 0 };
    this.s = { depth: 0, up: 1, down: 1, out: 1 };   // réglages lissés (pas de saut de gain quand on tourne un bouton)
    this.smooth = 1 - Math.exp(-1 / (0.01 * sr));
    this.fade = 0;
    this.fadeStep = 1 / (FADE * sr);
    this.set(options?.processorOptions ?? {});
    this.port.onmessage = e => this.set(e.data);
  }

  set(p) {
    Object.assign(this.p, p);
    const k = Math.max(0.05, this.p.time / 100), sr = sampleRate;
    BANDS.forEach((b, i) => {
      this.coef[i * 2] = 1 - Math.exp(-1 / (b.att * k * 0.001 * sr));
      this.coef[i * 2 + 1] = 1 - Math.exp(-1 / (b.rel * k * 0.001 * sr));
    });
  }

  // Filtre n du canal c.
  f(c, n, x) {
    const k = this.co[n], s = this.st[c], o = n * 4;
    const y = k[0] * x + k[1] * s[o] + k[2] * s[o + 1] - k[3] * s[o + 2] - k[4] * s[o + 3];
    s[o + 1] = s[o]; s[o] = x; s[o + 3] = s[o + 2]; s[o + 2] = y;
    return y;
  }

  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    const oL = out[0], oR = out[1] ?? out[0];
    if (!oL) return true;
    const L = inp[0], R = inp[1] ?? inp[0];
    const len = oL.length;
    if (!L) { oL.fill(0); if (oR !== oL) oR.fill(0); return true; }
    const target = this.p.depth > 0 ? 1 : 0;
    const tOut = Math.pow(10, this.p.output / 20);
    if (!target && this.fade <= 0) {
      // Transparent : copie exacte (au gain de sortie près), et les filtres repartiront de zéro.
      if (tOut === 1) { oL.set(L); if (oR !== oL) oR.set(R); } else for (let i = 0; i < len; i++) { oL[i] = L[i] * tOut; if (oR !== oL) oR[i] = R[i] * tOut; }
      this.s.out = tOut;
      if (this.env[0] || this.env[1] || this.env[2]) { this.st[0].fill(0); this.st[1].fill(0); this.env.fill(0); this.s.depth = 0; }
      return true;
    }
    const s = this.s, p = this.p, sm = this.smooth, env = this.env, cf = this.coef, a = this.a, g = this.g;
    const tDepth = p.depth / 100, tUp = p.up / 100, tDown = p.down / 100;
    for (let i = 0; i < len; i++) {
      s.depth += (tDepth - s.depth) * sm; s.up += (tUp - s.up) * sm; s.down += (tDown - s.down) * sm; s.out += (tOut - s.out) * sm;
      this.fade = target ? Math.min(1, this.fade + this.fadeStep) : Math.max(0, this.fade - this.fadeStep);
      const xl = L[i], xr = R[i];
      // Bandes des deux canaux.
      const lo0 = this.f(0, 8, this.f(0, 1, this.f(0, 0, xl))), lo1 = this.f(1, 8, this.f(1, 1, this.f(1, 0, xr)));
      const h0 = this.f(0, 3, this.f(0, 2, xl)), h1 = this.f(1, 3, this.f(1, 2, xr));
      const mi0 = this.f(0, 5, this.f(0, 4, h0)), mi1 = this.f(1, 5, this.f(1, 4, h1));
      const hi0 = this.f(0, 7, this.f(0, 6, h0)), hi1 = this.f(1, 7, this.f(1, 6, h1));
      a[0] = Math.max(Math.abs(lo0), Math.abs(lo1)); a[1] = Math.max(Math.abs(mi0), Math.abs(mi1)); a[2] = Math.max(Math.abs(hi0), Math.abs(hi1));
      for (let b = 0; b < 3; b++) {
        // Détection de crête liée en stéréo (attaque / relâche), puis gain du côté traité.
        env[b] += (a[b] - env[b]) * (a[b] > env[b] ? cf[b * 2] : cf[b * 2 + 1]);
        const e = 20 * Math.log10(env[b] + 1e-12), B = BANDS[b];
        let db = B.makeup;
        if (e > B.down) db -= (e - B.down) * DOWN_SLOPE * s.down;
        else if (e < B.up) db += Math.min(MAX_UP, (B.up - e) * UP_SLOPE) * Math.min(1, Math.max(0, (e - FLOOR) / 12)) * s.up;
        // Mélange avec le sec de la même bande : gain = 1 + depth × (gain traité − 1).
        g[b] = 1 + s.depth * (Math.pow(10, db / 20) - 1);
      }
      const w = this.fade, o = s.out;
      const yl = (lo0 * g[0] + mi0 * g[1] + hi0 * g[2]) * o, yr = (lo1 * g[0] + mi1 * g[1] + hi1 * g[2]) * o;
      oL[i] = w * yl + (1 - w) * xl * o;
      if (oR !== oL) oR[i] = w * yr + (1 - w) * xr * o;
    }
    return true;
  }
}

registerProcessor('gk-ott', OttProcessor);
