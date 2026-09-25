// Capture la sortie audio par blocs et les envoie au fil principal.
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [[], []];
    this.frames = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input.length) {
      for (let c = 0; c < 2; c++) this.chunks[c].push(new Float32Array(input[Math.min(c, input.length - 1)]));
      this.frames += input[0].length;
      if (this.frames >= 8192) this.flush();
    }
    // Sortie silencieuse : le nœud doit rester relié au graphe pour être traité.
    for (const ch of outputs[0]) ch.fill(0);
    return true;
  }

  flush() {
    this.port.postMessage(this.chunks);
    this.chunks = [[], []];
    this.frames = 0;
  }
}

registerProcessor('recorder', RecorderProcessor);
