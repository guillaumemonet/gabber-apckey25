// Synthé à oscillateurs : fenêtre et modules, chaque preset sonne sans NaN, silence après relâchement, potard de l'APC,
// clavier qui suit la fenêtre active, bloc de notes joué par la timeline puis exporté, prise au clavier.
export default async function (t, A) {
  const S = A.state;
  t.eq(A.state.patch.links.filter(l => l.from === 'osc').length, 1, 'le synthé est câblé au master');
  A.wm.toggle('osc', true);
  await t.wait(100);
  t.eq(S.keys, 'osc', 'le clavier joue le synthé de la fenêtre active');
  t.eq(S.page, 'osc', 'page de potards du synthé');
  t.ok(t.$$('.osc-mod').length >= 7, 'modules (3 oscillateurs, mod, filtre, enveloppes, LFO…)', t.$$('.osc-mod').length);
  t.ok(t.$$('#osc-modules .knob').length >= 30, 'potards', t.$$('#osc-modules .knob').length);
  t.eq(t.$$('#osc-presets button').length >= 12, true, '12 presets ou plus');
  const meter = t.meter(A.oscSynth.out);
  const buf = new Float32Array(2048);
  const an = A.engine.ctx.createAnalyser(); an.fftSize = 2048; A.oscSynth.out.connect(an);
  const quiet = [];
  for (const p of ['hoover', 'fm_screech', 'reese', 'gabber_lead', 'acid_bass', 'sub', 'supersaw', 'pluck', 'brass_stab', 'pad', 'wobble', 'laser']) {
    A.loadOscPreset(p);
    A.playNote(60, 0.9, true); A.playNote(64, 0.9, true);
    await t.wait(250);
    an.getFloatTimeDomainData(buf);
    if (buf.some(Number.isNaN)) t.ok(false, `${p} : pas de NaN`);
    if (meter() < 0.01) quiet.push(p);
    A.playNote(60, 0, false); A.playNote(64, 0, false);
    await t.wait(80);
  }
  t.eq(quiet, [], 'chaque preset sonne');
  await t.wait(900);
  t.ok(meter() < 0.01, 'silence après relâchement des notes', meter());
  t.eq([...A.oscSynth.voices.values()].filter(v => !v.released).length, 0, 'aucune voix tenue');
  // Potard K1 de l'APC = coupure (le preset devient perso).
  A.loadOscPreset('supersaw');
  const c0 = S.osc.params.cutoff;
  A.apc.dispatchEvent(new CustomEvent('knob', { detail: { index: 0, value: 0.2 } }));
  t.ok(Math.abs(S.osc.params.cutoff - c0) > 0.01, 'K1 règle la coupure', [c0, S.osc.params.cutoff]);
  t.eq(S.osc.preset, null, 'le son devient perso');
  // Fenêtre Synthé : le clavier repart vers le synthé à couches, puis revient.
  A.wm.toggle('piano', true); await t.wait(50);
  t.eq(S.keys, 'synth', 'fenêtre Synthé : le clavier joue le synthé à couches');
  A.wm.toggle('osc', true); await t.wait(50);
  t.eq(S.keys, 'osc', 'retour au synthé à oscillateurs');
  // Bloc de notes de la timeline, joué puis exporté.
  A.loadOscPreset('acid_bass');
  S.tl.playhead = 0;
  for (const tr of S.tl.tracks) tr.clips = [];
  A.rollNew();
  const clip = S.tl.tracks.flatMap(x => x.clips)[0];
  t.eq(clip?.osc, 'acid_bass', 'le nouveau bloc retient le preset du synthé');
  clip.seq.push({ t: 0, len: 0.5, note: 41, vel: 0.9 }, { t: 0.5, len: 0.5, note: 44, vel: 0.9 }, { t: 1, len: 1, note: 48, vel: 0.9 });
  A.timeline.play(0);
  await t.wait(300);
  t.ok(meter() > 0.02, 'la timeline joue le bloc sur le synthé', meter());
  t.ok([...A.oscSynth.voices.keys()].some(k => String(k).startsWith('tl:')), 'voix de la timeline');
  A.timeline.stop();
  const chans = await A.renderSong();
  let peak = 0; for (const c of chans) for (let i = 0; i < c.length; i += 5) peak = Math.max(peak, Math.abs(c[i]));
  t.ok(peak > 0.05, 'l’export contient le synthé', peak);
  // Prise au clavier.
  for (const tr of S.tl.tracks) tr.arm = false;
  S.tl.tracks[1].arm = true; S.tl.tracks[1].src = 'osc';
  S.tl.playhead = 16;
  await A.tlStartRec();
  await t.wait(150);
  A.playNote(65, 0.9, true); await t.wait(150); A.playNote(65, 0, false);
  await A.tlStopRec();
  const take = S.tl.tracks.flatMap(x => x.clips).find(c => c.start === 16);
  t.ok(take?.osc, 'la prise au clavier devient un bloc du synthé à oscillateurs', take);
  t.eq(take?.seq?.length, 1, 'avec sa note');
}
