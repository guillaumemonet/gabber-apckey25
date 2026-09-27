// Enregistrement de la sortie générale en WAV 16 bits stéréo.

export function encodeWav(channels, sampleRate) {
  const n = channels[0].length;
  const nch = channels.length;
  const buf = new ArrayBuffer(44 + n * nch * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * nch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nch * 2, true);
  v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * nch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return buf;
}

const loadedModules = new WeakMap();   // un seul chargement du module par contexte audio

export class Recorder {
  constructor(ctx, source) {
    this.ctx = ctx;
    this.source = source;
    this.node = null;
    this.chunks = null;
    this.startedAt = 0;
  }

  get recording() { return !!this.chunks; }
  get elapsed() { return this.recording ? this.ctx.currentTime - this.startedAt : 0; }

  async start() {
    if (!this.node) {
      if (!loadedModules.has(this.ctx)) loadedModules.set(this.ctx, this.ctx.audioWorklet.addModule('js/recorder-worklet.js'));
      await loadedModules.get(this.ctx);
      this.node = new AudioWorkletNode(this.ctx, 'recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      this.node.connect(mute).connect(this.ctx.destination);
      this.node.port.onmessage = e => {
        if (!this.chunks) return;
        this.chunks[0].push(...e.data[0]);
        this.chunks[1].push(...e.data[1]);
      };
    }
    this.chunks = [[], []];
    this.startedAt = this.ctx.currentTime;
    this.source.connect(this.node);
  }

  // Renvoie l'audio brut : { channels: [gauche, droite], sampleRate, startedAt (horloge audio) }.
  async stopRaw() {
    this.source.disconnect(this.node);
    await new Promise(r => setTimeout(r, 250));   // derniers blocs en transit
    const chunks = this.chunks;
    this.chunks = null;
    const join = list => {
      const out = new Float32Array(list.reduce((s, a) => s + a.length, 0));
      let o = 0;
      for (const a of list) { out.set(a, o); o += a.length; }
      return out;
    };
    return { channels: [join(chunks[0]), join(chunks[1])], sampleRate: this.ctx.sampleRate, startedAt: this.startedAt };
  }

  // Renvoie un Blob WAV.
  async stop() {
    const raw = await this.stopRaw();
    return new Blob([encodeWav(raw.channels, raw.sampleRate)], { type: 'audio/wav' });
  }
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
