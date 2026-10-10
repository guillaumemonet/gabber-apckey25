// Autres appareils MIDI que l'APC Key 25 (claviers maîtres, contrôleurs) : notes, pédale de sustain, contrôleurs
// (potentiomètres, faders, boutons). Événements :
//   key { note, velocity (0..1), on }   pedal { on }   cc { port, ch, cc, value (0..127) }
//   button { port, ch, note, on }  (note assignée à une commande par le MIDI learn, ou note reçue pendant l'apprentissage)
//   realtime { port, byte, ms }  (horloge 0xF8, Start 0xFA, Continue 0xFB, Stop 0xFC)
//   raw { port, data }   connection { inputs: [noms], outputs: [noms] }
const APC_RE = /apc\s*key|apc\s*25|apckey/i;

export class MidiHub extends EventTarget {
  constructor() {
    super();
    this.access = null;
    this.inputs = [];
    this.outputs = [];   // sorties MIDI (autres que l'APC) : envoi de l'horloge
    this.learning = false;   // MIDI learn en cours : les notes servent à l'assignation, elles ne jouent pas
    this.isCommand = () => false;   // (port, canal, note) -> note assignée à une commande (elle ne joue pas) ; branché par l'application
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  async init() {
    if (!navigator.requestMIDIAccess) return;
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.addEventListener('statechange', () => this.scan());
    this.scan();
  }

  scan() {
    const ins = [...this.access.inputs.values()].filter(p => !APC_RE.test(p.name) && p.state === 'connected');
    const outs = [...this.access.outputs.values()].filter(p => !APC_RE.test(p.name) && p.state === 'connected');
    if (ins.map(p => p.id).join() === this.inputs.map(p => p.id).join() && outs.map(p => p.id).join() === this.outputs.map(p => p.id).join()) return;
    this.outputs = outs;
    for (const p of this.inputs) p.onmidimessage = null;
    this.inputs = ins;
    for (const p of ins) {
      p.open().catch(() => {});
      p.onmidimessage = e => this.onMessage(p.name, e.data, e.timeStamp);
    }
    this.emit('connection', { inputs: ins.map(p => p.name), outputs: outs.map(p => p.name) });
  }

  onMessage(port, data, ms = performance.now()) {
    if (data[0] >= 0xf8) { this.emit('realtime', { port, byte: data[0], ms }); return; }   // horloge : pas dans le moniteur (24 par temps)
    this.emit('raw', { port, data: [...data] });
    const [st, d1, d2] = data;
    const type = st & 0xf0, ch = st & 0x0f;
    if (type === 0x90 || type === 0x80) {
      const on = type === 0x90 && d2 > 0;
      if (this.learning || this.isCommand(port, ch, d1)) { this.emit('button', { port, ch, note: d1, on }); return; }
      this.emit('key', { note: d1, velocity: on ? d2 / 127 : 0, on });
    } else if (type === 0xb0) {
      if (d1 === 64 && !this.learning) { this.emit('pedal', { on: d2 >= 64 }); return; }
      this.emit('cc', { port, ch, cc: d1, value: d2 });
    }
  }
}
