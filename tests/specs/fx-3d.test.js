// Chaîne d'effets d'une piste (rendu hors ligne) : transparente avant et après le bloc, active pendant.
import { TrackChain } from '../../js/trackfx.js';

export const start = false;

const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const P = { distance: 12, bars: 1, radius: 1.5, dir: 'cw', height: 4 };

async function run(fx) {
  const ctx = new OfflineAudioContext(2, 44100, 44100);
  const osc = ctx.createOscillator();
  osc.frequency.value = 220;
  const pan = ctx.createStereoPanner();
  pan.pan.value = 0.3;
  osc.connect(pan);
  if (fx) {
    const c = new TrackChain(ctx, { reverbIn: ctx.createGain(), delayIn: ctx.createGain() }, ctx.destination);
    c.sync([{ id: 'x', fx, start: 0, len: 4, p: P }]);
    pan.connect(c.input);
    c.play({ id: 'x', fx, p: P }, 0.4, 0.6, 0.3);
  } else pan.connect(ctx.destination);
  osc.start();
  const L = (await ctx.startRendering()).getChannelData(0);
  return [rms(L.slice(4410, 17640)), rms(L.slice(18000, 26000)), rms(L.slice(28000, 44100))];
}

export default async function (t) {
  const dry = await run(null);
  for (const fx of ['zoomin3d', 'orbit3d', 'spiral3d', 'flyby3d', 'fadein', 'hprise']) {
    const w = await run(fx);
    const r = w.map((v, i) => v / dry[i]);
    t.near(r[0], 1, 0.02, `${fx} : transparent avant le bloc`);
    t.near(r[2], 1, 0.02, `${fx} : transparent après le bloc`);
    // Le passe-haut monte trop lentement pour un bloc de 0,2 s sur un la grave : seulement la transparence.
    if (fx !== 'hprise') t.ok(Math.abs(r[1] - 1) > 0.02, `${fx} : agit pendant le bloc`, r[1]);
  }
}
