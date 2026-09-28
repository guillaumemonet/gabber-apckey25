// Lecteur d'un deck des platines : lit un son à vitesse variable, y compris à l'envers (scratch).
// Messages reçus : { buffer: [Float32Array, Float32Array] } ; { rate } vitesse visée (1 = normale, négative = à l'envers) ;
// { pos } position en secondes ; { loop } ; { startAt } instant (horloge audio) où la vitesse visée s'applique ;
// { scratch } true = la vitesse suit la main sans lissage long.
// Messages envoyés : { pos } (secondes) une trentaine de fois par seconde, { ended: true } en fin de son sans boucle.
class DeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null;
    this.len = 0;
    this.pos = 0;          // en échantillons du son
    this.rate = 0;         // vitesse actuelle (lissée)
    this.target = 0;       // vitesse visée
    this.pending = null;   // { rate, at } : vitesse à appliquer à un instant précis
    this.loop = true;
    this.scratch = false;
    this.ratio = 1;        // fréquence d'échantillonnage du son / celle du contexte
    this.sinceReport = 0;
    this.port.onmessage = e => this.onMessage(e.data);
  }

  onMessage(m) {
    if (m.buffer) {
      this.ch = m.buffer;
      this.len = m.buffer[0].length;
      this.ratio = (m.sampleRate || sampleRate) / sampleRate;
      this.pos = 0;
    }
    if (m.pos !== undefined) this.pos = Math.max(0, Math.min(this.len - 1, m.pos * (m.sampleRate || sampleRate)));
    if (m.loop !== undefined) this.loop = m.loop;
    if (m.scratch !== undefined) this.scratch = m.scratch;
    if (m.rate !== undefined) {
      if (m.startAt !== undefined && m.startAt > currentTime) this.pending = { rate: m.rate, at: m.startAt };
      else { this.pending = null; this.target = m.rate; }
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length;
    if (!this.ch || !this.len) { for (const c of out) c.fill(0); return true; }
    const l = this.ch[0];
    const r = this.ch[1] ?? l;
    // Lissage de la vitesse : rapide en scratch (la main), plus doux au démarrage / à l'arrêt (moteur de la platine).
    const k = this.scratch ? 0.02 : 0.0025;
    for (let i = 0; i < n; i++) {
      if (this.pending && currentTime + i / sampleRate >= this.pending.at) { this.target = this.pending.rate; this.pending = null; this.rate = this.target; }
      this.rate += (this.target - this.rate) * k;
      const p = this.pos;
      const i0 = Math.floor(p);
      const f = p - i0;
      const i1 = i0 + 1 < this.len ? i0 + 1 : (this.loop ? 0 : i0);
      out[0][i] = l[i0] + (l[i1] - l[i0]) * f;
      if (out[1]) out[1][i] = r[i0] + (r[i1] - r[i0]) * f;
      this.pos += this.rate * this.ratio;
      if (this.pos >= this.len) {
        if (this.loop) this.pos -= this.len;
        else { this.pos = this.len - 1; this.target = this.rate = 0; this.port.postMessage({ ended: true }); }
      } else if (this.pos < 0) {
        this.pos = this.loop ? this.pos + this.len : 0;
      }
    }
    this.sinceReport += n;
    if (this.sinceReport >= 1536) {
      this.sinceReport = 0;
      this.port.postMessage({ pos: this.pos / (sampleRate * this.ratio) });
    }
    return true;
  }
}

registerProcessor('deck', DeckProcessor);
