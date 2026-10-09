// Timeline : à l'arrêt, le synthé à oscillateurs se tait tout de suite (y compris les notes préparées d'avance
// ou dont la voix a été reprise par une note suivante) ; il ne reste que la queue de la réverbe / du delay.
export default async function (t, A) {
  const S = A.state;
  await A.loadDemoFile(2);
  await t.until(() => S.tl.tracks.length === 15, 10000);
  await t.wait(1000);
  const E = A.engine;
  // Analyseur tiré par la sortie (via un gain nul) : sinon Firefox peut garder la dernière mesure quand l'entrée se tait.
  const meter = node => {
    const an = E.ctx.createAnalyser(); an.fftSize = 2048;
    const mute = E.ctx.createGain(); mute.gain.value = 0;
    node.connect(an); an.connect(mute).connect(E.ctx.destination);
    // Une source muette toujours active : l'analyseur reste calculé même quand le nœud mesuré n'a plus d'entrée.
    const keep = E.ctx.createConstantSource(); keep.offset.value = 0; keep.connect(an); keep.start();
    const buf = new Float32Array(2048);
    return () => { an.getFloatTimeDomainData(buf); let p = 0; for (const x of buf) p = Math.max(p, Math.abs(x)); return p; };
  };
  const osc = meter(A.oscSynth.out), master = meter(E.master);
  for (const bar of [32, 17, 44]) {
    A.timeline.play(bar * 4);
    await t.wait(2300);
    const before = osc();
    // Chaque voix de la timeline encore connue (y compris celles préparées d'avance ou reprises par une note suivante)
    // doit être coupée net par Stop.
    const voices = [...A.oscSynth.all].filter(v => String(v.key).startsWith('tl:'));
    let cut = 0;
    for (const v of voices) { const c = v.cut; v.cut = tt => { cut++; return c(tt); }; }
    A.timeline.stop();
    t.ok(before > 0.01, `mesure ${bar} : le synthé à oscillateurs joue`, before);
    t.ok(voices.length > 0, `mesure ${bar} : des voix sont en cours ou préparées`, voices.length);
    t.eq(cut, voices.length, `mesure ${bar} : Stop coupe toutes ces voix`);
    // Le son retombe (délai large : l'horloge audio peut prendre du retard quand la machine est chargée).
    const quiet = await t.until(() => osc() < 0.005, 3000, 20);
    t.ok(quiet, `mesure ${bar} : le synthé se tait`, osc());
    await t.wait(1500);
    t.ok(master() < 0.01, `mesure ${bar} : silence ensuite (queues de réverbe / delay comprises)`, master());
    await t.wait(500);
  }
}
