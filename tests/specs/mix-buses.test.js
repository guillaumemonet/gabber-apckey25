// Bus : une piste envoyée vers un bus (panneau de piste) passe par sa chaîne ; lettre dans l'en-tête, liste des
// pistes du bus, volume, solo et muet du bus, effets d'insert, annuler, anciennes sauvegardes, export.
export default async function (t, A) {
  const S = A.state, E = A.engine, TL = A.timeline;
  t.eq(S.tl.buses.length, 4, 'quatre bus');
  t.eq(A.mergeTlState({ tracks: [{ clips: [] }] }).buses.length, 4, 'une ancienne sauvegarde reçoit ses quatre bus');
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat'), pad = find('Breakdown pad');
  const mk = (p, len) => ({ id: crypto.randomUUID(), start: 0, len, sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, color: 1, bpm: p.bpm || 0, loop: true });
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; });
  S.sc.on = false;
  S.tl.bars = 2;
  S.tl.tracks[0].clips.push(mk(beat, 8));
  S.tl.tracks[1].clips.push(mk(pad, 8));
  await A.loadTlBuffers();
  A.renderTl();

  // Fenêtre Bus.
  t.$('#plugins button[data-plugin="buses"]').click();
  t.ok(A.wm.isOpen('buses'), 'la barre des plugins ouvre la fenêtre Bus');
  t.eq(t.$$('#buses .bus-strip').length, 4, 'quatre voies de bus');

  // Piste 1 -> bus A (panneau de la piste).
  t.$$('#tl-grid .tl-head')[0].querySelector('.tl-knobs').click();
  const sel = t.$('.track-knobs .tk-bus');
  t.ok(sel && sel.options.length === 5, 'choix du bus dans le panneau de piste');
  sel.value = '0'; sel.dispatchEvent(new Event('change'));
  A.closeFxEditor();
  t.eq(S.tl.tracks[0].bus, 0, 'piste envoyée vers le bus A');
  const badge = t.$$('#tl-grid .tl-head')[0].querySelector('.tl-bus');
  t.ok(!badge.hidden && badge.textContent === 'A', 'lettre du bus dans l’en-tête de la piste');
  t.ok(/1/.test(t.$$('#buses .bus-tracks')[0].textContent), 'le bus liste sa piste', t.$$('#buses .bus-tracks')[0].textContent);

  const level = t.meter(E.output);
  const peak = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  const muteGain = ti => [...(TL.strips.get(ti)?.values() ?? [])].map(s => s.mute.gain.value);
  t.$('#tl-play').click();
  await t.wait(600);
  t.ok(TL.busChains.get(0)?.size > 0, 'le son de la piste passe par la chaîne du bus');
  t.ok(TL.busLevel(0) > 0.01, 'vumètre du bus', TL.busLevel(0));

  // Solo du bus : seule la piste du bus s'entend.
  const strip = t.$$('#buses .bus-strip')[0];
  strip.querySelector('.solo').click();
  await t.wait(100);
  t.ok(muteGain(0).every(g => g > 0.95) && muteGain(1).every(g => g < 0.05), 'solo du bus : seules ses pistes s’entendent', [muteGain(0), muteGain(1)]);
  const before = await peak(600);
  // Volume du bus à zéro : silence.
  const vol = strip.querySelector('input[data-field="vol"]');
  vol.value = 0; vol.dispatchEvent(new Event('input'));
  await t.wait(300);
  const after = await peak(600);
  t.ok(before > 0.03 && after < before * 0.1, 'le volume du bus agit sur ses pistes', [before, after]);
  vol.dispatchEvent(new Event('dblclick'));
  t.eq(S.tl.buses[0].vol, 1, 'double-clic : volume par défaut');
  strip.querySelector('.solo').click();
  // Muet du bus.
  strip.querySelector('.mute').click();
  await t.wait(100);
  t.ok(muteGain(0).every(g => g < 0.05) && muteGain(1).every(g => g > 0.95), 'muet du bus : ses pistes se taisent', [muteGain(0), muteGain(1)]);
  t.ok(t.$$('#tl-grid .tl-lane')[0].classList.contains('muted'), 'la piste coupée par son bus est grisée');
  strip.querySelector('.mute').click();

  // Effets d'insert du bus.
  const add = strip.querySelector('.fx-add');
  add.value = 'comp'; add.dispatchEvent(new Event('change'));
  t.eq(S.tl.buses[0].inserts.map(f => f.type), ['comp'], 'insert ajouté au bus');
  t.ok([...TL.busChains.get(0).values()].every(c => c.inserts.length === 1), 'dans sa chaîne audio');
  t.$('#tl-play').click();

  // Annuler : l'insert ajouté au bus disparaît (les bus font partie de l'historique), la piste reste dans le bus.
  A.tlUndo();
  await t.wait(50);
  t.eq(S.tl.buses[0].inserts.length, 0, 'Ctrl+Z : l’insert du bus disparaît');
  t.eq(S.tl.tracks[0].bus, 0, 'la piste reste dans le bus');
  // Sortir la piste du bus, puis Annuler : elle y revient.
  t.$$('#tl-grid .tl-head')[0].querySelector('.tl-knobs').click();
  const sel2 = t.$('.track-knobs .tk-bus');
  sel2.value = ''; sel2.dispatchEvent(new Event('change'));
  A.closeFxEditor();
  t.ok(S.tl.tracks[0].bus === null && t.$$('#tl-grid .tl-head')[0].querySelector('.tl-bus').hidden, 'piste sortie du bus, lettre retirée');
  A.tlUndo();
  await t.wait(50);
  t.eq(S.tl.tracks[0].bus, 0, 'Ctrl+Z : la piste revient dans le bus');

  // Export : seule la piste du bus, bus à zéro = silence ; bus normal = son.
  S.tl.buses[0].inserts = [];
  S.tl.tracks[1].mute = true;
  S.tl.buses[0].vol = 0;
  let chans = await A.renderSong();
  let p = 0; for (const c of chans) for (let i = 0; i < c.length; i += 7) p = Math.max(p, Math.abs(c[i]));
  t.ok(p < 0.01, 'export : le volume du bus s’applique', p);
  S.tl.buses[0].vol = 1;
  chans = await A.renderSong();
  p = 0; for (const c of chans) for (let i = 0; i < c.length; i += 7) p = Math.max(p, Math.abs(c[i]));
  t.ok(p > 0.05, 'export : la piste passe par le bus', p);
  t.ok(A.stateSnapshot().tl.buses.length === 4, 'bus enregistrés avec le projet');
}
