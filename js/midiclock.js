// Horloge MIDI.
// - Envoi : 24 impulsions par temps (0xF8) vers une sortie MIDI, calées sur l'horloge audio (programmées un peu en avance
//   avec l'horodatage du Web MIDI) ; au départ, la position (Song Position Pointer, en doubles croches) puis Start (au
//   début du morceau) ou Continue ; Stop à l'arrêt.
// - Réception : tempo calculé sur les impulsions reçues (moyenne glissante), Start / Continue / Stop.
const PPQ = 24;
const AHEAD = 0.12;   // avance de programmation (s)

export class ClockSender {
  // ctx : contexte audio ; getBpm() : tempo actuel.
  constructor(ctx, getBpm) {
    this.ctx = ctx;
    this.getBpm = getBpm;
    this.port = null;
    this.timer = 0;
    this.next = 0;        // instant audio de la prochaine impulsion
    this.sent = 0;        // impulsions envoyées depuis le départ
  }

  // Instant audio -> horodatage du Web MIDI (performance.now, en ms).
  stamp(t) {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts?.performanceTime && Number.isFinite(ts.contextTime)) return ts.performanceTime + (t - ts.contextTime) * 1000;
    return performance.now() + (t - this.ctx.currentTime) * 1000;
  }
  send(data, t) {
    try { this.port?.send(data, t === undefined ? undefined : Math.max(0, this.stamp(t))); } catch { /* port fermé */ }
  }

  // Départ au temps `beat` (joué à l'instant audio `at`).
  start(beat, at) {
    this.stop(false);
    if (!this.port) return;
    const sixteenths = Math.max(0, Math.round(beat * 4));
    this.send([0xf2, sixteenths & 0x7f, (sixteenths >> 7) & 0x7f], at - 0.002);
    this.send([sixteenths ? 0xfb : 0xfa], at - 0.001);
    this.next = at;
    this.sent = 0;
    this.pump();
    this.timer = setInterval(() => this.pump(), 25);
  }

  pump() {
    const until = this.ctx.currentTime + AHEAD;
    while (this.next < until) {
      this.send([0xf8], this.next);
      this.sent++;
      this.next += 60 / this.getBpm() / PPQ;
    }
  }

  stop(sendStop = true) {
    if (this.timer && sendStop) this.send([0xfc]);
    clearInterval(this.timer);
    this.timer = 0;
  }

  get running() { return !!this.timer; }
}

// Suit l'horloge d'un appareil : tempo (moyenne des 48 dernières impulsions), Start / Continue / Stop.
export class ClockFollower {
  constructor({ onTempo, onStart, onContinue, onStop }) {
    Object.assign(this, { onTempo, onStart, onContinue, onStop });
    this.times = [];
    this.last = 0;
  }

  // Message temps réel reçu ; `ms` : instant de réception (ms).
  message(byte, ms) {
    if (byte === 0xf8) {
      this.times.push(ms);
      if (this.times.length > 49) this.times.shift();
      if (this.times.length >= 25) {
        const span = (this.times[this.times.length - 1] - this.times[0]) / (this.times.length - 1);
        const bpm = 60000 / (span * PPQ);
        // Seuil : l'horloge reçue tremble un peu ; on ne suit que les vrais changements.
        if (bpm >= 40 && bpm <= 300 && Math.abs(bpm - this.last) > 0.3) { this.last = Math.round(bpm * 10) / 10; this.onTempo(this.last); }
      }
    } else if (byte === 0xfa) { this.times = []; this.onStart(); }
    else if (byte === 0xfb) this.onContinue();
    else if (byte === 0xfc) this.onStop();
  }
}
