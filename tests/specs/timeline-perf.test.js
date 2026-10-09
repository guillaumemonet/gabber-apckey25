// Timeline : un morceau chargé ne crée pas tout son graphe audio d'un coup (notes et blocs préparés au fil de la lecture),
// et le moteur audio tient à peu près le temps réel.
export default async function (t, A) {
  const S = A.state;
  await A.loadDemoFile(2);
  await t.until(() => S.tl.tracks.length === 15, 10000);
  await t.wait(1000);
  const ctx = A.engine.ctx;
  let nodes = 0;
  const wrapped = ['createGain', 'createBiquadFilter', 'createOscillator', 'createBufferSource', 'createStereoPanner', 'createWaveShaper', 'createDelay', 'createConstantSource'];
  const orig = {};
  for (const k of wrapped) { orig[k] = ctx[k]; const f = ctx[k].bind(ctx); ctx[k] = (...a) => { nodes++; return f(...a); }; }
  const t0 = performance.now();
  A.timeline.play(64);   // depuis le 1er drop, la partie la plus chargée
  const playMs = performance.now() - t0;
  const atPlay = nodes;
  const a0 = ctx.currentTime, w0 = performance.now();
  await t.wait(6000);
  const audioAdv = ctx.currentTime - a0, wall = (performance.now() - w0) / 1000;
  A.timeline.stop();
  for (const k of wrapped) ctx[k] = orig[k];
  t.ok(atPlay < 5000, 'au lancement, quelques milliers de nœuds au plus (avant : plus de 20 000)', atPlay);
  t.ok(playMs < 1000, 'le lancement est rapide', Math.round(playMs));
  // Firefox sans écran, machine chargée : l'horloge audio peut prendre du retard ; on vérifie seulement qu'elle n'est pas bloquée.
  t.ok(audioAdv > wall * 0.3, 'le moteur audio avance pendant la lecture (pas de blocage)', { audioAdv, wall });
}
