// Lecteur d'un deck des platines : lit un son à vitesse variable, y compris à l'envers (scratch).
// Messages reçus : { buffer: [Float32Array, Float32Array] } ; { rate } vitesse du moteur (1 = normale) ;
// { pos } position en secondes ; { loop } ; { startAt } instant (horloge audio) où la vitesse visée s'applique ;
// { hold: true | false } la main pose / relâche le disque ; { scrub } la main a fait tourner le disque de `scrub` secondes de son.
// Messages envoyés : { pos, at } (secondes du son, horloge audio) une trentaine de fois par seconde, { ended: true } en fin de son.
//
// Scratch : comme sur une vraie platine, le disque suit la POSITION de la main (pas sa vitesse) : chaque geste déplace
// une cible, que le disque rejoint avec un peu d'inertie (ressort amorti), ce qui lisse les à-coups de la souris
// sans retard audible. La lecture interpole sur 4 points (Hermite) et un filtre évite le crénelage quand ça va vite.
class DeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null;
    this.len = 0;
    this.pos = 0;          // en échantillons du son (continu pendant le scratch, ramené dans le son ensuite)
    this.rate = 0;         // vitesse actuelle (échantillons du son par échantillon de sortie, à ratio près)
    this.target = 0;       // vitesse du moteur visée
    this.pending = null;   // { rate, at } : vitesse à appliquer à un instant précis
    this.loop = true;
    this.hold = false;     // la main tient le disque
    this.goal = 0;         // position visée par la main (échantillons du son)
    this.vel = 0;          // vitesse du disque tenu (échantillons du son par seconde)
    this.ratio = 1;        // fréquence d'échantillonnage du son / celle du contexte
    this.lpL = 0; this.lpR = 0;   // filtre anti-crénelage
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
    const sr = sampleRate * this.ratio;
    if (m.pos !== undefined) { this.pos = Math.max(0, Math.min(this.len - 1, m.pos * (m.sampleRate || sr))); this.goal = this.pos; }
    if (m.loop !== undefined) this.loop = m.loop;
    if (m.hold === true && !this.hold) {
      this.hold = true;
      this.goal = this.pos;
      this.vel = this.rate * sr;   // la main attrape le disque qui tourne
    }
    if (m.hold === false && this.hold) {
      this.hold = false;
      this.rate = this.vel / sr;   // relâché : il garde l'élan de la main, puis le moteur le ramène à sa vitesse
      this.pos = this.wrap(this.pos);
    }
    if (m.scrub !== undefined) this.goal += m.scrub * sr;
    if (m.rate !== undefined) {
      if (m.startAt !== undefined && m.startAt > currentTime) this.pending = { rate: m.rate, at: m.startAt };
      else { this.pending = null; this.target = m.rate; }
    }
  }

  wrap(p) {
    if (!this.len) return 0;
    if (this.loop) return ((p % this.len) + this.len) % this.len;
    return Math.max(0, Math.min(this.len - 1, p));
  }

  sample(c, p) {
    const n = this.len;
    const i = Math.floor(p);
    const f = p - i;
    const at = k => { let j = i + k; if (this.loop) j = ((j % n) + n) % n; else j = j < 0 ? 0 : j >= n ? n - 1 : j; return c[j]; };
    const y0 = at(-1), y1 = at(0), y2 = at(1), y3 = at(2);
    // Hermite 4 points : plus doux que l'interpolation linéaire, surtout au ralenti.
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length;
    if (!this.ch || !this.len) { for (const c of out) c.fill(0); return true; }
    const l = this.ch[0];
    const r = this.ch[1] ?? l;
    const sr = sampleRate * this.ratio;
    const dt = 1 / sampleRate;
    // Disque tenu : ressort critique (~28 Hz) vers la position de la main.
    const w = 2 * Math.PI * 28;
    // Moteur : départ et arrêt en ~0,1 s (platine à fort couple).
    const motor = 1 - Math.exp(-dt / 0.06);
    for (let i = 0; i < n; i++) {
      if (this.pending && currentTime + i * dt >= this.pending.at) { this.target = this.pending.rate; this.pending = null; this.rate = this.target; }
      let step;
      if (this.hold) {
        this.vel += (w * w * (this.goal - this.pos) - 2 * w * this.vel) * dt;
        step = this.vel * dt;
      } else {
        this.rate += (this.target - this.rate) * motor;
        step = this.rate * this.ratio;
      }
      const p = this.pos;
      let a = this.sample(l, p), b = r === l ? a : this.sample(r, p);
      // Anti-crénelage : passe-bas d'autant plus fort que le disque va vite (au-delà de la vitesse normale).
      const sp = Math.abs(step);
      const k = sp > 1.05 ? Math.min(1, 1.15 / sp) : 1;
      this.lpL += (a - this.lpL) * k; this.lpR += (b - this.lpR) * k;
      out[0][i] = this.lpL;
      if (out[1]) out[1][i] = this.lpR;
      this.pos += step;
      if (!this.hold) {
        if (this.pos >= this.len) {
          if (this.loop) this.pos -= this.len;
          else { this.pos = this.len - 1; this.target = this.rate = 0; this.port.postMessage({ ended: true }); }
        } else if (this.pos < 0) this.pos = this.loop ? this.pos + this.len : 0;
      } else if (!this.loop) {
        // Sans boucle, le disque ne va pas au-delà du son.
        if (this.pos < 0) { this.pos = 0; this.vel = Math.max(0, this.vel); this.goal = Math.max(this.goal, 0); }
        if (this.pos > this.len - 1) { this.pos = this.len - 1; this.vel = Math.min(0, this.vel); this.goal = Math.min(this.goal, this.len - 1); }
      }
    }
    this.sinceReport += n;
    if (this.sinceReport >= 1024) {
      this.sinceReport = 0;
      this.port.postMessage({ pos: this.wrap(this.pos) / sr, at: currentTime + n / sampleRate, speed: this.hold ? this.vel / sr : this.rate });
    }
    return true;
  }
}

registerProcessor('deck', DeckProcessor);
