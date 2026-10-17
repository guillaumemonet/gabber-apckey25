// Autotune hors du fil de l'interface (js/autotune.js).
// Message : { id, chans: Float32Array[], sr, opts } -> réponse { id, chans, curve, track, stats } (ou { id, error }).
import { autotune } from './autotune.js';

self.onmessage = e => {
  const { id, chans, sr, opts } = e.data;
  try {
    const r = autotune(chans, sr, opts);
    const curve = { ...r.curve, hop: r.track.hop, start: r.track.start, sr };
    self.postMessage({ id, chans: r.chans, curve, stats: r.stats }, r.chans.map(c => c.buffer));
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) });
  }
};
