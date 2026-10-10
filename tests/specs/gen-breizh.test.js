// Breizh generator : fenêtre, airs (danses, modes, forme A A B B, ornements), voix d'un couple de sonneurs
// (bombarde qui respire, biniou à l'octave), bourdon, écoute, Générer (un bloc par voix), sons de la famille Breizh.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  A.wm.toggle('breizh', true);
  const box = t.$('#breizh');
  t.eq(box.querySelectorAll('select[data-key]').length, 9, 'neuf réglages');
  t.eq(A.mergeBreizh({ instrument: 'x', bars: 3, tonic: 14 }), A.defaultBreizh(), 'sauvegarde invalide : réglages par défaut');

  // L'air : mode, registre, forme A A B B, même graine = même air.
  const o = { instrument: 'bombarde', dance: 'andro', tonic: 5, mode: 'dorian', bars: 4, form: 'AB', ornaments: 'none', seed: 3 };
  const seq = A.generateBreizh(o);
  const dorian = [0, 2, 3, 5, 7, 9, 10].map(s => (5 + s) % 12);
  t.ok(seq.length > 30 && seq.every(n => dorian.includes(n.note % 12)), 'toutes les notes dans le mode (fa dorien)', seq.map(n => n.note % 12));
  t.ok(seq.every(n => n.t >= 0 && n.t + n.len <= 64 + 1e-6 && n.note >= 60 && n.note <= 80), 'A A B B de 4 mesures = 64 temps, registre de la bombarde');
  const part = from => seq.filter(n => n.t >= from && n.t < from + 16).map(n => [n.t - from, n.note]);
  t.eq(part(16), part(0), 'la partie A est jouée deux fois');
  t.eq(seq.filter(n => n.t < 16).at(-1).note % 12, 5, 'la phrase finit sur la tonique');
  t.ok(Math.max(...part(32).map(n => n[1])) >= Math.max(...part(0).map(n => n[1])), 'la partie B monte au moins aussi haut');
  t.eq(JSON.stringify(A.generateBreizh(o)), JSON.stringify(seq), 'même graine : le même air');
  const orn = A.generateBreizh({ ...o, ornaments: 'rich' });
  t.ok(orn.length > seq.length && orn.some(n => n.len < 0.1), 'ornements : des notes d’agrément très courtes', orn.length - seq.length);
  for (const dance of A.BZ_DANCES) for (const instrument of Object.keys(A.BZ_INSTRUMENTS)) {
    const s = A.generateBreizh({ ...o, dance, instrument, form: 'A', ornaments: 'light' });
    t.ok(s.length >= 4 && s.every(n => n.t >= 0 && n.t < 16 && Number.isInteger(n.note)), `${instrument}, ${dance}`, s.length);
  }

  // Couple de sonneurs : la bombarde respire, le biniou joue tout à l'octave ; bourdon tonique + quinte.
  Object.assign(S.breizh, { instrument: 'couple', dance: 'gavotte', tonic: 5, mode: 'minor', bars: 4, form: 'AB', repeat: 2, ornaments: 'light', drone: 'fifth', seed: 5, draft: null });
  A.renderBreizh();
  const parts = A.breizhParts();
  t.eq(parts.map(p => p.preset), ['bombarde', 'biniou', 'bourdon'], 'trois voix : bombarde, biniou, bourdon');
  const [bomb, bin] = parts;
  t.ok(bomb.seq.every(n => n.t % 8 + n.len <= 7.5 + 1e-6) && bin.seq.some(n => n.t % 8 + n.len > 7.5), 'la bombarde respire à la fin des phrases de deux mesures, pas le biniou');
  t.eq(bin.seq.map(n => n.note), A.breizhDraft().seq.map(n => n.note + 12), 'le biniou joue tout l’air à l’octave');
  t.eq(parts[2].notes.map(n => n % 12), [5, 5, 0], 'bourdon : tonique sur deux octaves et quinte');

  // Écoute (un deuxième clic arrête).
  const level = t.meter(E.output);
  const peak = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  t.$('#breizh-listen').click();
  const playing = await peak(700);
  t.ok(A.breizhPreviewing() && playing > 0.02, 'Écouter joue l’air', playing);
  t.$('#breizh-listen').click();
  t.ok(!A.breizhPreviewing(), 'un deuxième clic l’arrête');

  // Générer : un bloc par voix, 32 mesures (A A B B de 4 mesures, ×2), sur trois pistes.
  t.$('#breizh-go').click();
  await t.wait(100);
  const clips = S.tl.tracks.flatMap(tr => tr.clips);
  t.eq(clips.map(c => c.preset), ['bombarde', 'biniou', 'bourdon'], 'trois blocs');
  t.ok(clips.every(c => c.start === 0 && c.len === 128), 'sur toute la durée', clips.map(c => c.len));
  t.ok(clips[0].pat === 64 && clips[2].notes.length === 3, 'motif de l’air, bourdon tenu');
  t.eq(new Set(S.tl.tracks.map((tr, i) => (tr.clips.length ? i : -1)).filter(i => i >= 0)).size, 3, 'chaque voix sur sa piste');

  // Retouche du brouillon : Nouvel air ne la remplace qu'à la demande ; la retouche suit dans les voix.
  const d = A.breizhDraft();
  d.seq[0].note += 2;
  d.edited = true;
  t.eq(A.breizhParts()[1].seq[0].note, d.seq[0].note + 12, 'la deuxième voix suit le brouillon retouché');

  // Lecture dans la timeline avec les sons bretons.
  t.$('#tl-play').click();
  t.ok(await t.until(() => [...E.voices.values()].some(v => v.patched), 4000), 'les blocs jouent avec leurs sons');
  const tl = await peak(600);
  t.ok(tl > 0.02, 'on les entend', tl);
  t.$('#tl-play').click();
  t.ok(await t.until(() => E.voices.size === 0, 4000), 'à l’arrêt, plus aucune voix');

  // Sons dans le synthé (famille Breizh).
  t.eq(A.PRESETS.filter(p => p.family === 'breizh').map(p => p.id), ['bombarde', 'biniou', 'cornemuse', 'bagad', 'bourdon'], 'famille Breizh du synthé');
  t.ok(A.engine.waves.reed && A.engine.waves.chanter, 'ondes d’anche');
  A.stopBreizhPreview();
}
