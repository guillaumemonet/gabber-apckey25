// Calcul de l'étirement / transposition hors du fil de l'interface (js/stretch.js).
// Message : { id, chans: Float32Array[], factor, semis, loop } -> réponse { id, chans }.
import { warp } from './stretch.js';

self.onmessage = e => {
  const { id, chans, factor, semis, loop } = e.data;
  const out = warp(chans, factor, semis, loop);
  self.postMessage({ id, chans: out }, out.map(c => c.buffer));
};
