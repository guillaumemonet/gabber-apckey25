// Sidechain : interface, quels sons sont baissés, déclenchement sur les kicks des boucles de la timeline,
// de la 909 et des boucles des pads, mode « chaque temps », sauvegarde des réglages.
export default async function (t, A) {
  const S = A.state, E = A.engine, SC = A.sidechain;
  const box = t.$('#sidechain');
  t.ok(box.querySelectorAll('button').length >= 2, 'interface du sidechain');
  t.ok(t.$('[data-win="gen"] #gen') && !t.$('.piano-area #gen'), 'le générateur a sa propre fenêtre (plus dans la fenêtre Synthé)');
  box.querySelector('button[data-sc=on]').click();
  t.ok(S.sc.on, 'sidechain activé');
  const ducks = [];
  const d0 = SC.duck.bind(SC);
  SC.duck = time => { ducks.push(time); return d0(time); };

  // Timeline : une boucle aux kicks connus, une nappe (baissée), un kick seul.
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat'), pad = find('Breakdown pad'), kick = find('Mainstream F');
  const mk = (p, start, len, loop) => ({ id: crypto.randomUUID(), start, len, sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, color: 1, bpm: p.bpm || 0, loop });
  const cBeat = mk(beat, 0, 8, true), cPad = mk(pad, 0, 16, true), cKick = mk(kick, 10, 1, false);
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; });
  S.tl.tracks[0].clips.push(cBeat); S.tl.tracks[1].clips.push(cPad); S.tl.tracks[2].clips.push(cKick);
  S.tl.bars = 16; S.tl.playhead = 0;
  await A.loadTlBuffers();
  t.ok(!A.timeline.isDucked(cBeat), 'la batterie n\'est pas baissée');
  t.ok(A.timeline.isDucked(cPad), 'la nappe est baissée');
  t.ok(A.timeline.kicksOf(cBeat)?.length >= 4, 'les kicks de la boucle sont connus', A.timeline.kicksOf(cBeat));
  t.eq(A.timeline.kicksOf(cKick), [0], 'un kick seul compte pour un kick');
  t.ok(!A.timeline.kicksOf(cPad), 'la nappe n\'a pas de kick');

  A.timeline.play(0);
  const t0 = A.timeline.cycles[0].time;
  await t.wait(1200);
  const bd = 60 / E.bpm;
  const rel = ducks.map(x => (x - t0) / bd);
  t.ok(ducks.length >= 2, 'la timeline déclenche le sidechain', ducks.length);
  t.ok(rel.every(b => Math.abs(b - Math.round(b)) < 0.01), 'sur les temps (kicks de la boucle)', rel.slice(0, 8));
  const offset = t.meter(SC.sampleAmt);
  let min = 0;
  const an = E.ctx.createAnalyser(); an.fftSize = 2048; SC.sampleAmt.connect(an);
  const buf = new Float32Array(2048);
  for (let i = 0; i < 20; i++) { an.getFloatTimeDomainData(buf); for (const v of buf) min = Math.min(min, v); await t.wait(30); }
  t.ok(min < -0.1 || offset() > 0.1, 'le bus des nappes baisse vraiment', min);
  A.timeline.stop();
  await t.wait(100);
  t.eq(SC.pending.size, 0, 'rien ne reste programmé à l\'arrêt');

  // 909.
  ducks.length = 0;
  A.drum.start();
  await t.wait(1000);
  A.drum.stop();
  t.ok(ducks.length >= 2, 'chaque grosse caisse de la 909 déclenche le sidechain', ducks.length);

  // Boucle sur un pad.
  ducks.length = 0;
  const padObj = S.banks.flat().find(p => p?.name === 'Mainstream beat' && p.buffer) ?? { ...find('Mainstream beat') };
  if (!padObj.buffer) { padObj.buffer = await A.ensureBuffer('lib:' + padObj.file); padObj.sampleId = 'lib:' + padObj.file; padObj.p = A.defaultPositions('pad'); padObj.p.mode = 1; }
  E.playPad(9999, padObj);
  await t.wait(1500);
  t.eq(E.padVoices.get(9999)?.mode, 'loop', 'le pad joue en boucle');
  t.ok(SC.loopKicks().length >= 1, 'ses kicks sont suivis');
  const gaps = ducks.slice(1).map((x, i) => x - ducks[i]);
  t.ok(ducks.length >= 2 && gaps.every(g => Math.abs(g - bd) < 0.01), 'un déclenchement par kick de la boucle', gaps);
  E.stopPad(9999);

  // Mode « chaque temps » sans aucun kick.
  const sel = box.querySelector('select');
  sel.value = 'beat';
  sel.dispatchEvent(new Event('change'));
  S.tl.tracks.forEach(tr => { tr.clips = []; });
  S.tl.tracks[1].clips.push(cPad);
  ducks.length = 0;
  await t.wait(300);
  A.timeline.play(0);
  await t.wait(1300);
  A.timeline.stop();
  const g2 = ducks.slice(1).map((x, i) => x - ducks[i]);
  t.ok(ducks.length >= 2 && g2.every(g => Math.abs(g - bd) < 0.01), 'mode chaque temps : un déclenchement par temps', g2);

  // Fenêtre Générateur, onglet Accords.
  A.wm.toggle('gen', true);
  t.$$('.gen-tabs button')[0].click();
  const gsel = t.$('#gen [data-panel="chords"] select[data-key="preset"]');
  t.ok(A.wm.isOpen('gen'), 'le générateur s\'ouvre');
  t.eq(gsel.value, 'epic_strings', 'preset de départ du générateur');
  await t.wait(600);
  t.eq(S.sc.source, 'beat', 'la source du sidechain est gardée');
  t.ok(S.sc.on, 'l\'état du sidechain est gardé');
}
