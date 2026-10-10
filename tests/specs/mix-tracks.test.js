// Mixage des pistes : muet et solo instantanés en pleine lecture, effets d'insert par piste (ajout, réglage audible,
// limite de 4, annuler), export qui suit le solo.
export default async function (t, A) {
  const S = A.state, E = A.engine, TL = A.timeline;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat'), pad = find('Breakdown pad');
  const mk = (p, len) => ({ id: crypto.randomUUID(), start: 0, len, sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, color: 1, bpm: p.bpm || 0, loop: true });
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; });
  S.sc.on = false;
  S.tl.bars = 4;
  S.tl.tracks[0].clips.push(mk(beat, 16));
  S.tl.tracks[1].clips.push(mk(pad, 16));
  await A.loadTlBuffers();
  A.renderTl();
  t.ok(Array.isArray(S.tl.tracks[0].inserts) && S.tl.tracks[0].solo === false, 'chaque piste a ses inserts et son solo');

  const level = t.meter(E.output);
  const peak = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  const muteGain = ti => [...(TL.strips.get(ti)?.values() ?? [])].map(s => s.mute.gain.value);
  const heads = t.$$('#tl-grid .tl-head');
  t.ok(heads[0].querySelector('.tl-solo'), 'bouton S dans l’en-tête de piste');

  t.$('#tl-play').click();
  t.ok((await peak(800)) > 0.05, 'les deux pistes jouent');

  // Solo de la piste 2 : la piste 1 se tait tout de suite.
  heads[1].querySelector('.tl-solo').click();
  await t.wait(100);
  t.ok(S.tl.tracks[1].solo && heads[1].querySelector('.tl-solo').classList.contains('active'), 'solo enregistré et affiché');
  t.ok(muteGain(0).every(g => g < 0.05) && muteGain(1).every(g => g > 0.95), 'en pleine lecture, seule la piste en solo s’entend', [muteGain(0), muteGain(1)]);
  t.ok(t.$$('#tl-grid .tl-lane')[0].classList.contains('muted'), 'la piste coupée par le solo est grisée');
  heads[1].querySelector('.tl-solo').click();
  await t.wait(100);
  t.ok(muteGain(0).every(g => g > 0.95), 'sans solo, tout revient');

  // Muet : immédiat, et retour immédiat.
  heads[0].querySelector('.tl-mute').click();
  await t.wait(100);
  t.ok(muteGain(0).every(g => g < 0.05), 'muet immédiat en pleine lecture', muteGain(0));
  t.$$('#tl-grid .tl-head')[0].querySelector('.tl-mute').click();
  await t.wait(100);
  t.ok(muteGain(0).every(g => g > 0.95), 'et rallumée tout de suite (sans attendre le tour suivant)', muteGain(0));

  // Effets d'insert : panneau de la piste 2.
  t.$$('#tl-grid .tl-head')[1].querySelector('.tl-knobs').click();
  const panel = t.$('.track-knobs');
  const add = panel.querySelector('.track-inserts .fx-add');
  t.ok(add && [...add.options].some(o => o.value === 'eq'), 'menu des effets d’insert, égaliseur compris');
  const addFx = type => { add.value = type; add.dispatchEvent(new Event('change')); };
  addFx('filter');
  const strips = () => [...TL.strips.get(1).values()];
  t.eq(S.tl.tracks[1].inserts.map(f => f.type), ['filter'], 'insert ajouté à la piste');
  t.ok(strips().every(s => s.inserts.length === 1), 'et dans sa chaîne audio');
  t.ok(t.$$('#tl-grid .tl-head')[1].querySelector('.tl-knobs').classList.contains('active'), 'le bouton de la piste s’allume');
  // Mesure de l'effet : piste 2 seule, filtre ouvert puis fermé (passe-bas à 40 Hz).
  t.$$('#tl-grid .tl-head')[1].querySelector('.tl-solo').click();
  const cutoff = panel.querySelectorAll('.track-inserts .fx-param input')[1];
  const setCut = v => { cutoff.value = v; cutoff.dispatchEvent(new Event('input')); };
  setCut(1);
  await t.wait(300);
  const open = await peak(700);
  setCut(0);
  await t.wait(300);
  const closed = await peak(700);
  t.ok(open > 0.03 && closed < open * 0.5, 'le filtre en insert s’entend', [open, closed]);
  for (const type of ['eq', 'comp', 'dist']) addFx(type);
  t.eq(S.tl.tracks[1].inserts.length, 4, 'jusqu’à 4 inserts');
  t.ok(add.disabled, 'le menu se désactive à 4');
  t.$('#tl-play').click();

  // Annuler : le dernier insert disparaît, la chaîne suit.
  A.tlUndo();
  await t.wait(50);
  t.eq(S.tl.tracks[1].inserts.length, 3, 'Ctrl+Z retire le dernier insert');
  t.ok(strips().every(s => s.inserts.length === 3), 'et la chaîne audio suit');

  // Export : le solo d'une piste vide donne un silence ; sans solo, le morceau sonne.
  A.closeFxEditor();
  S.tl.tracks.forEach(tr => { tr.solo = false; tr.inserts = []; });
  S.tl.tracks[5].solo = true;
  let chans = await A.renderSong();
  let p = 0; for (const c of chans) for (let i = 0; i < c.length; i += 7) p = Math.max(p, Math.abs(c[i]));
  t.ok(p < 0.01, 'export : seule la piste en solo (vide) est rendue', p);
  S.tl.tracks[5].solo = false;
  chans = await A.renderSong();
  p = 0; for (const c of chans) for (let i = 0; i < c.length; i += 7) p = Math.max(p, Math.abs(c[i]));
  t.ok(p > 0.05, 'export sans solo : le morceau sonne', p);
}
