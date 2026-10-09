// TB-303 : horloge propre puis calée sur la 909, grille, saisie au clavier, page de potards (Maj + REC),
// enregistrement audio dans la timeline, aide.
export default async function (t, A) {
  const S = A.state, AC = A.acid, E = A.engine;
  A.wm.toggle('acid', true);
  const grid = t.$('#acid-grid');
  t.eq(grid.querySelectorAll('.acid-cell').length, 17 * 16, 'grille de 16 pas × 17 rangées (13 notes, accent, slide, octave + et −)');
  t.ok(t.$$('#acid-knobs .knob').length >= 9, 'potards de la 303');
  t.ok(t.$$('.strip-name').some(e => /303/.test(e.textContent)), 'voie TB-303 dans le mixeur');
  const level = t.meter(AC.out);
  const peakOver = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  // 1. Horloge propre.
  S.acid.link = false;
  const steps = [];
  const os = AC.onStep; AC.onStep = s => { steps.push(s); os(s); };
  t.$('#acid-play').click();
  const p1 = await peakOver(1200);
  t.ok(AC.running, 'la 303 joue sur sa propre horloge');
  t.ok(steps.length >= 8, 'les pas défilent', steps.length);
  t.ok(p1 > 0.05, 'elle sonne', p1);
  t.$('#acid-play').click();
  await t.wait(300);
  t.ok(!AC.running, 'arrêt');
  t.ok((await peakOver(300)) < 0.05, 'silence après l’arrêt');
  // 2. Suivre la 909.
  t.$('#acid-link').click();
  steps.length = 0;
  t.$('#acid-play').click();
  await t.wait(800);
  t.ok(A.drum.running && AC.linked, '▶ lance la 909 et la 303 calée dessus');
  t.ok(steps.length >= 4, 'la 303 avance sur l’horloge de la 909', steps.length);
  A.drum.stop();
  await t.wait(200);
  t.ok(!AC.playing, 'arrêter la 909 arrête la 303');
  // 3. Grille : une note et un accent au pas 4 du pattern 6 (vide).
  t.$$('#acid-patterns button')[5].click();
  const pat = () => S.acid.patterns[S.acid.pattern];
  const cells = grid.querySelectorAll('.acid-cell');
  cells[(13 - 1 - 7) * 16 + 3].click();
  cells[13 * 16 + 16 * 2 + 3].click();
  t.eq(S.acid.pattern, 5, 'pattern 6 choisi');
  t.ok(pat()[3].gate && pat()[3].note === 7 && pat()[3].acc, 'la case et l’accent sont posés', pat()[3]);
  // 4. Saisie au clavier de l'APC (le synthé ne joue pas).
  t.$('#acid-rec').click();
  const key = (note, velocity) => A.apc.dispatchEvent(new CustomEvent('key', { detail: { note, velocity, on: true } }));
  key(41, 0.7); key(53, 0.95); key(44, 0.7);
  t.$('#acid-rest').click();
  const s4 = pat().slice(0, 4);
  t.ok(s4[0].gate && s4[0].note === 0, '1er pas : fa', s4[0]);
  t.ok(s4[1].gate && s4[1].oct === 1 && s4[1].acc, '2e pas : fa à l’octave, accentué (frappe forte)', s4[1]);
  t.ok(s4[2].gate && s4[2].note === 3, '3e pas : la bémol', s4[2]);
  t.ok(!s4[3].gate, '4e pas : silence');
  t.eq(E.voices.size, 0, 'le synthé ne joue pas pendant la saisie');
  t.$('#acid-rec').click();
  // 6. Enregistrement audio dans la timeline (source TB-303).
  for (const tr of S.tl.tracks) tr.arm = false;
  S.tl.tracks[0].arm = true;
  S.tl.tracks[0].src = 'acid';
  S.acid.pattern = 0;
  t.$('#tl-rec').click();
  await t.until(() => A.tlRec, 2000);
  t.ok(A.tlRec, 'l’enregistrement démarre');
  await t.wait(2200);
  t.$('#tl-rec').click();
  const rec = await t.until(() => S.tl.tracks.flatMap(x => x.clips).find(c => c.sampleId?.startsWith('rec:')), 5000);
  t.ok(rec, 'la prise de la 303 devient un bloc audio');
  t.ok(rec?.len >= 4, 'longueur de la prise en temps', rec?.len);
  t.ok(!AC.playing, 'la 303 s’arrête avec l’enregistrement');
  // 5. Maj + REC = page TB-303, K1 = coupure.
  const btn = (name, pressed) => A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed } }));
  A.setPage('synth');
  btn('shift', true); btn('record', true); btn('record', false); btn('shift', false);
  t.eq(S.page, 'acid', 'Maj + REC : page de potards TB-303');
  const c0 = S.acid.params.cutoff;
  A.turnKnob(0, { value: 0.8 });
  t.ok(Math.abs(S.acid.params.cutoff - 0.8) < 0.01 && c0 !== 0.8, 'K1 règle la coupure', [c0, S.acid.params.cutoff]);
  // 7. Aide.
  t.$('[data-win="acid"] .win-help').click();
  t.ok(t.$$('.win-help-pop li').length >= 5, 'aide de la fenêtre');
}
