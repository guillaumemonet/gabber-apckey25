// Piano roll : nouveau bloc, dessin, déplacement, copie, transposition, vélocité, gomme, annuler, longueur du motif,
// lecture (timeline et écoute seule), saisie pas à pas, quantification, prise du synthé en un bloc, export.
export default async function (t, A) {
  const S = A.state;
  const R = A.pianoRoll;
  S.tl.playhead = 8;
  A.rollNew();
  await t.wait(300);
  const f = () => S.tl.tracks.flatMap(tr => tr.clips).find(c => c.id === S.roll.clip);
  t.ok(A.wm.isOpen('roll') && A.wm.active === 'roll', 'nouveau bloc : le piano roll s\'ouvre');
  t.eq([f()?.start, f()?.len, f()?.pat], [8, 4, 4], 'bloc d\'une mesure à la tête de lecture (mesure 3)');
  t.ok(t.$('#roll-empty').hidden, 'le message « aucun bloc » est caché');
  const cv = t.$('#roll-canvas');
  const X = b => 46 + (b - R.x0) * R.px, Y = n => 20 + (R.top - n) * R.rowH + 6;
  const ptr = (type, x, y, o = {}) => {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, pointerId: 1, button: o.button ?? 0, buttons: 1 }));
  };
  const click = (x, y, o) => { ptr('pointerdown', x, y, o); ptr('pointerup', x, y, o); };
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  // Clic + glisser : fa4 sur un temps ; clic simple : une note de même durée.
  ptr('pointerdown', X(0.1), Y(65)); ptr('pointermove', X(0.9), Y(65)); ptr('pointerup', X(0.9), Y(65));
  click(X(1.05), Y(68));
  t.eq(f().seq.map(n => [n.t, n.note, n.len]), [[0, 65, 1], [1, 68, 1]], 'deux notes dessinées');
  // Glisser la 2e note d'un temps et d'un demi-ton.
  ptr('pointerdown', X(1.1), Y(68)); ptr('pointermove', X(2.1), Y(69)); ptr('pointerup', X(2.1), Y(69));
  t.eq([f().seq[1].t, f().seq[1].note], [2, 69], 'note déplacée');
  // Tout sélectionner, dupliquer (le motif s'allonge), transposer d'une octave les copies sélectionnées.
  key('a', { ctrlKey: true }); key('d', { ctrlKey: true });
  t.eq(f().seq.map(n => [n.t, n.note]), [[0, 65], [2, 69], [4, 65], [6, 69]], 'Ctrl+D : les notes copiées après');
  t.eq([f().pat, f().len], [8, 8], 'le motif passe à 2 mesures');
  key('ArrowUp', { shiftKey: true });
  t.eq(f().seq.map(n => n.note), [65, 69, 77, 81], 'Maj+↑ : la sélection monte d\'une octave');
  // Vélocité (bande du bas) sur une note sélectionnée.
  click(X(4), cv.clientHeight - 50);
  t.ok(f().seq[2].vel > 0.85 && f().seq[0].vel === 0.85, 'vélocité changée sur la note visée seulement', f().seq.map(n => n.vel));
  // Gomme (clic droit), puis Ctrl+Z.
  key('Escape');
  click(X(0.2), Y(65), { button: 2 });
  t.eq(f().seq.length, 3, 'clic droit : la note est effacée');
  key('z', { ctrlKey: true });
  await t.wait(50);
  t.eq(f()?.seq.length, 4, 'Ctrl+Z : la note revient');
  t.eq(R.clip?.id, S.roll.clip, 'le piano roll garde le bloc après l\'annulation');
  // Longueur du motif.
  t.$('#roll-shorter').click();
  t.eq([f().pat, f().len, t.$('#roll-len').textContent], [4, 4, '1 mesure'], '− : une mesure');
  t.$('#roll-longer').click();
  t.eq([f().pat, f().len, t.$('#roll-len').textContent], [8, 8, '2 mesures'], '+ : deux mesures');
  // Lecture : timeline puis écoute seule.
  const calls = [];
  const orig = A.engine.noteOn;
  A.engine.noteOn = function (...a) { calls.push(String(a[3])); return orig.apply(this, a); };
  try {
    A.timeline.play(8);
    await t.wait(400);
    A.timeline.stop();
    t.ok(calls.filter(k => k.startsWith('tl:')).length >= 1, 'la timeline joue les notes du bloc', calls);
    calls.length = 0;
    A.rollStart();
    await t.wait(1400);
    const ph = R.host.playhead();
    A.rollStop();
    t.ok(calls.filter(k => k.startsWith('rollp:')).length >= 1, 'l\'écoute joue le motif', calls);
    t.ok(ph > 0 && !A.rollPlay, 'la tête du piano roll avance, puis l\'écoute s\'arrête', ph);
  } finally { A.engine.noteOn = orig; }
  // Saisie pas à pas : un accord puis une note, au curseur.
  S.roll.step = true;
  R.cursor = 4;
  A.wm.toggle('roll', true);
  A.playNote(60, 0.7, true); A.playNote(63, 0.7, true); A.playNote(60, 0, false); A.playNote(63, 0, false);
  A.playNote(62, 0.7, true); A.playNote(62, 0, false);
  S.roll.step = false;
  const added = f().seq.filter(n => [60, 62, 63].includes(n.note)).map(n => [n.t, n.note]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  t.eq(added.length, 3, 'saisie pas à pas : trois notes ajoutées', added);
  t.ok(added[0]?.[0] === 4 && added[1]?.[0] === 4 && added[2]?.[0] > 4 && R.cursor > added[2][0], 'l\'accord au curseur, la note suivante après', { added, cursor: R.cursor });
  // Quantifier la sélection.
  f().seq.push({ t: 0.61, len: 0.3, note: 70, vel: 0.8 });
  R.sel = new Set([f().seq.at(-1)]);
  t.$('#roll-quant').click();
  const q = f().seq.find(n => n.note === 70);
  t.ok(Math.abs(q.t - 0.5) < 1e-6 || Math.abs(q.t - 0.75) < 1e-6, 'quantifier : la note se cale sur la grille', q);
  // Enregistrement du synthé : un seul bloc de notes.
  for (const tr of S.tl.tracks) tr.arm = false;
  S.tl.tracks[5].src = 'synth'; S.tl.tracks[5].arm = true;
  S.tl.playhead = 32;
  await A.tlStartRec();
  await t.wait(200);
  A.playNote(65, 0.9, true); await t.wait(120); A.playNote(65, 0, false);
  A.playNote(68, 0.9, true); A.playNote(72, 0.9, true); await t.wait(200); A.playNote(68, 0, false); A.playNote(72, 0, false);
  await A.tlStopRec();
  const takes = S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.type === 'note' && c.start >= 32);
  t.eq(takes.length, 1, 'la prise du synthé est un seul bloc');
  t.eq(takes[0]?.seq.map(n => n.note).sort(), [65, 68, 72], 'avec ses trois notes');
  t.eq(S.roll.clip, takes[0]?.id, 'le piano roll montre la prise');
  t.eq(S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.type === 'note' && !c.seq).length, 0, 'aucun ancien bloc d\'une note');
  // Export : les blocs de notes sonnent.
  const chans = await A.renderSong();
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i += 7) peak = Math.max(peak, Math.abs(c[i]));
  t.ok(peak > 0.01, 'l\'export fait entendre les notes', peak);
}
