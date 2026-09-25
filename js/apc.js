// Couche matérielle APC Key 25 (mk1 et mk2) : détection, lecture des messages, LEDs.
// Référence mk2 : "APC Key 25 mk2 - Communication Protocol v1.1" (Akai).
import { t } from './i18n.js';

// Palette officielle mk2 : vélocité -> couleur RGB.
export const PALETTE = [
  '#000000', '#1E1E1E', '#7F7F7F', '#FFFFFF', '#FF4C4C', '#FF0000', '#590000', '#190000',
  '#FFBD6C', '#FF5400', '#591D00', '#271B00', '#FFFF4C', '#FFFF00', '#595900', '#191900',
  '#88FF4C', '#54FF00', '#1D5900', '#142B00', '#4CFF4C', '#00FF00', '#005900', '#001900',
  '#4CFF5E', '#00FF19', '#00590D', '#001902', '#4CFF88', '#00FF55', '#00591D', '#001F12',
  '#4CFFB7', '#00FF99', '#005935', '#001912', '#4CC3FF', '#00A9FF', '#004152', '#001019',
  '#4C88FF', '#0055FF', '#001D59', '#000819', '#4C4CFF', '#0000FF', '#000059', '#000019',
  '#874CFF', '#5400FF', '#190064', '#0F0030', '#FF4CFF', '#FF00FF', '#590059', '#190019',
  '#FF4C87', '#FF0054', '#59001D', '#220013', '#FF1500', '#993500', '#795100', '#436400',
  '#033900', '#005735', '#00547F', '#0000FF', '#00454F', '#2500CC', '#7F7F7F', '#202020',
  '#FF0000', '#BDFF2D', '#AFED06', '#64FF09', '#108B00', '#00FF87', '#00A9FF', '#002AFF',
  '#3F00FF', '#7A00FF', '#B21A7D', '#402100', '#FF4A00', '#88E106', '#72FF15', '#00FF00',
  '#3BFF26', '#59FF71', '#38FFCC', '#5B8AFF', '#3151C6', '#877FE9', '#D31DFF', '#FF005D',
  '#FF7F00', '#B9B000', '#90FF00', '#835D07', '#392B00', '#144C10', '#0D5038', '#15152A',
  '#16205A', '#693C1C', '#A8000A', '#DE513D', '#D86A1C', '#FFE126', '#9EE12F', '#67B50F',
  '#1E1E30', '#DCFF6B', '#80FFBD', '#9A99FF', '#8E66FF', '#404040', '#757575', '#E0FFFF',
  '#A00000', '#350000', '#1AD000', '#074200', '#B9B000', '#3F3100', '#B35F00', '#4B1502',
];

// Couleurs proposées dans l'interface (indices de la palette).
export const PICKER_COLORS = [5, 60, 9, 96, 13, 109, 17, 21, 29, 33, 37, 41, 45, 49, 81, 53, 57, 3];
// mk1 : seules couleurs possibles (rouge, vert, jaune), exprimées en indices de palette.
export const MK1_PICKER_COLORS = [5, 21, 13];

// mk1 : pads tricolores (vérifié sur l'appareil). +1 = clignotant.
const MK1 = { off: 0, green: 1, red: 3, yellow: 5 };

// mk2 : le canal MIDI de la note-on fixe le comportement de la LED.
const MK2_CH = { dim: 1, on: 6, pulse: 9, blink: 14 };

export const BTN = {
  track: [0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47],
  scene: [0x52, 0x53, 0x54, 0x55, 0x56],
  stopAll: 0x51,
  play: 0x5b,
  record: 0x5d,
  shift: 0x62,
};
const BUTTON_NAMES = new Map([
  ...BTN.track.map((n, i) => [n, `track${i + 1}`]),
  ...BTN.scene.map((n, i) => [n, `scene${i + 1}`]),
  [BTN.stopAll, 'stopAll'], [BTN.play, 'play'], [BTN.record, 'record'], [BTN.shift, 'shift'],
]);

const KNOB_CC0 = 0x30;
const SUSTAIN_CC = 0x40;
const APC_RE = /apc\s*key|apc\s*25|apckey/i;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mk1Color(paletteIndex) {
  const [r, g, b] = hexToRgb(PALETTE[paletteIndex] || '#000000');
  if (r + g + b < 40) return MK1.off;
  if (r > 150 && g > 150) return MK1.yellow;
  if (r >= g && r >= b) return g > r * 0.45 ? MK1.yellow : MK1.red;
  return MK1.green;
}

// Couleur réellement affichée par un mk1, en indice de palette (pour l'interface).
export function mk1Equivalent(paletteIndex) {
  return { [MK1.red]: 5, [MK1.green]: 21, [MK1.yellow]: 13 }[mk1Color(paletteIndex)] ?? 0;
}

export class APC extends EventTarget {
  constructor() {
    super();
    this.access = null;
    this.model = null;          // 'mk1' | 'mk2' | null
    this.inputs = [];
    this.outputs = [];
    this.roles = new Map();     // id du port d'entrée -> 'keys' | 'control'
    this.padLeds = new Array(40).fill('');
    this.btnLeds = new Map();
  }

  get connected() { return this.inputs.length > 0; }

  async init() {
    if (!navigator.requestMIDIAccess) throw new Error(t('status.noWebMidi'));
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.scan();
    this.scan(true);
  }

  scan(force = false) {
    const ins = [...this.access.inputs.values()].filter(p => APC_RE.test(p.name) && p.state === 'connected');
    const outs = [...this.access.outputs.values()].filter(p => APC_RE.test(p.name) && p.state === 'connected');
    const changed = ins.map(p => p.id).join() !== this.inputs.map(p => p.id).join()
      || outs.map(p => p.id).join() !== this.outputs.map(p => p.id).join();
    if (!changed && !force) return;

    for (const p of this.inputs) p.onmidimessage = null;
    this.inputs = ins;
    this.outputs = outs;
    this.model = ins.length ? ([...ins, ...outs].some(p => /mk\s*2|mkii/i.test(p.name)) ? 'mk2' : 'mk1') : null;
    this.guessRoles();
    this.errors = [];
    for (const p of [...ins, ...outs]) {
      // Ouverture explicite : sous Windows, un port déjà utilisé par un autre logiciel est refusé.
      p.open().catch(err => {
        this.errors.push(`${p.name} : ${err.message}`);
        this.emit('portError', { port: p.name, message: err.message });
      });
    }
    for (const p of ins) p.onmidimessage = e => this.onMessage(p, e.data);

    // Le cache LED ne correspond plus à rien après (re)connexion.
    this.padLeds.fill('');
    this.btnLeds.clear();
    this.emit('connection', {
      model: this.model,
      inputs: ins.map(p => p.name),
      outputs: outs.map(p => p.name),
      allInputs: [...this.access.inputs.values()].map(p => p.name),
    });
  }

  // mk2 : port 0 = clavier, port 1 = pads/potards/boutons (noms variables selon l'OS).
  guessRoles() {
    this.roles.clear();
    if (this.model !== 'mk2' || this.inputs.length < 2) return;
    this.inputs.forEach((p, i) => {
      let role = i === 0 ? 'keys' : 'control';
      if (/midiin2|control|ctrl/i.test(p.name)) role = 'control';
      else if (/keys|clavier/i.test(p.name)) role = 'keys';
      this.roles.set(p.id, role);
    });
  }

  // Corrige les rôles des ports dès qu'un message sans ambiguïté arrive.
  learnRole(port, role) {
    if (this.model !== 'mk2' || this.inputs.length < 2 || this.roles.get(port.id) === role) return;
    const other = role === 'keys' ? 'control' : 'keys';
    for (const p of this.inputs) this.roles.set(p.id, p.id === port.id ? role : other);
    this.emit('roles', {});
  }

  swapRoles() {
    for (const [id, r] of this.roles) this.roles.set(id, r === 'keys' ? 'control' : 'keys');
    this.emit('roles', {});
  }

  portsInfo() {
    return this.inputs.map(p => ({ name: p.name, role: this.roles.get(p.id) || 'tout' }));
  }

  onMessage(port, data) {
    this.emit('raw', { port: port.name, data: [...data] });
    const status = data[0] & 0xf0;
    const ch = data[0] & 0x0f;
    const d1 = data[1];
    const d2 = data[2];

    if (status === 0xb0) {
      if (d1 === SUSTAIN_CC) {
        this.learnRole(port, 'keys');
        this.emit('sustain', { on: d2 >= 64 });
      } else if (d1 >= KNOB_CC0 && d1 < KNOB_CC0 + 8) {
        this.learnRole(port, 'control');
        const index = d1 - KNOB_CC0;
        if (this.model === 'mk2') this.emit('knob', { index, delta: d2 < 64 ? d2 : d2 - 128 });
        else this.emit('knob', { index, value: d2 / 127 });
      }
      return;
    }

    if (status !== 0x90 && status !== 0x80) return;
    const on = status === 0x90 && d2 > 0;

    // Clavier : canal ≠ 1 (mk1, ou mk2 reconfiguré), ou port "keys" sur mk2.
    let isKey = ch !== 0 || this.roles.get(port.id) === 'keys';
    // Les pads/boutons envoient toujours 127 : une autre vélocité vient forcément du clavier.
    if (!isKey && on && d2 !== 127 && this.model === 'mk2') {
      this.learnRole(port, 'keys');
      isKey = true;
    }
    if (isKey) {
      this.emit('key', { note: d1, velocity: on ? d2 / 127 : 0, on });
      return;
    }
    if (d1 < 40) this.emit('pad', { index: d1, pressed: on });
    else if (BUTTON_NAMES.has(d1)) this.emit('button', { name: BUTTON_NAMES.get(d1), note: d1, pressed: on });
  }

  send(bytes) {
    for (const o of this.outputs) {
      try { o.send(bytes); } catch { /* port fermé entre-temps */ }
    }
  }

  // mode : 'off' | 'dim' | 'on' | 'pulse' | 'blink'
  setPad(index, colorIndex, mode) {
    if (!this.outputs.length) return;
    const key = `${colorIndex}:${mode}`;
    if (this.padLeds[index] === key) return;
    this.padLeds[index] = key;

    if (mode === 'off' || !colorIndex) {
      this.send([0x90, index, 0]);
    } else if (this.model === 'mk2') {
      this.send([0x90 | MK2_CH[mode], index, colorIndex]);
    } else {
      const c = mk1Color(colorIndex);
      const blink = mode === 'pulse' || mode === 'blink' || mode === 'on';
      this.send([0x90, index, c && blink ? c + 1 : c]);
    }
  }

  // state : 0 éteint, 1 allumé, 2 clignotant
  setButton(note, state) {
    if (!this.outputs.length || this.btnLeds.get(note) === state) return;
    this.btnLeds.set(note, state);
    this.send([0x90, note, state]);
  }

  clearAll() {
    for (let i = 0; i < 40; i++) this.send([0x90, i, 0]);
    for (const n of BUTTON_NAMES.keys()) this.send([0x90, n, 0]);
    this.padLeds.fill('');
    this.btnLeds.clear();
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}
