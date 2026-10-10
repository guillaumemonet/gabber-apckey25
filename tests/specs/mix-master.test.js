// Chaîne master : limiteur chargé, réglages par défaut (= ancien limiteur), compteur de sonie en direct, plafond tenu
// avec beaucoup de gain d'entrée, réduction de gain affichée, sauvegarde, fichier du mixeur, export (plafond, sonie).
export default async function (t, A) {
  const S = A.state, E = A.engine;
  t.ok(E.limiterNode, 'limiteur du fil audio chargé');
  t.eq([S.master.comp.threshold, S.master.comp.ratio, S.master.comp.on, S.master.limit.on], [-3, 20, true, true], 'réglages par défaut : le compresseur reprend l’ancien limiteur');
  A.wm.toggle('mix', true);
  const box = t.$('#master-chain');
  t.eq(box.querySelectorAll('.mc-on').length, 2, 'compresseur et limiteur, chacun avec son bouton');
  t.ok(box.querySelectorAll('input[type=range]').length >= 9, 'réglages de la chaîne master');

  // Un son fort en boucle sur la timeline.
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat');
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; });
  S.tl.bars = 2;
  S.tl.tracks[0].clips.push({ id: 'c-m', start: 0, len: 8, sampleId: 'lib:' + beat.file, name: beat.name, cat: beat.cat, color: 1, bpm: beat.bpm || 0, loop: true });
  await A.loadTlBuffers();
  A.masterMeter.reset();
  t.$('#tl-play').click();
  await t.wait(1500);
  t.ok(A.masterMeter.slices.length >= 8, 'le compteur reçoit une mesure toutes les 100 ms', A.masterMeter.slices.length);
  t.ok(A.masterMeter.momentary > -40, 'sonie momentanée mesurée', A.masterMeter.momentary);
  await t.wait(300);
  t.ok(/LUFS/.test(box.querySelector('[data-m="momentary"]').textContent) && !/∞/.test(box.querySelector('[data-m="momentary"]').textContent), 'affichée dans la fenêtre', box.querySelector('[data-m="momentary"]').textContent);

  // Beaucoup de gain d'entrée : la crête reste au plafond, la réduction de gain s'affiche.
  const set = (g, k, v) => { const inp = box.querySelector(`input[data-g="${g}"][data-k="${k}"]`); inp.value = v; inp.dispatchEvent(new Event('input')); };
  set('limit', 'gain', 18);
  set('limit', 'ceiling', -1);
  await t.wait(300);
  A.masterMeter.reset();
  await t.wait(1500);
  const ceil = Math.pow(10, -1 / 20);
  t.ok(A.masterMeter.peak <= ceil + 1e-3 && A.masterMeter.peak > ceil * 0.9, 'avec +18 dB, la crête reste au plafond de −1 dB', A.masterMeter.peak);
  await t.wait(250);
  t.ok(/−|-/.test(box.querySelector('[data-m="gr"]').textContent), 'réduction de gain affichée', box.querySelector('[data-m="gr"]').textContent);
  t.$('#tl-play').click();

  // Sauvegarde et fichier de réglages du mixeur.
  t.eq(A.stateSnapshot().master.limit.gain, 18, 'enregistré avec le projet');
  t.eq(A.TOOL_IO.mix.get().master.limit.ceiling, -1, 'dans le fichier de réglages du mixeur');
  box.querySelector('input[data-g="limit"][data-k="gain"]').dispatchEvent(new Event('dblclick'));
  t.eq(S.master.limit.gain, 0, 'double-clic : valeur par défaut');

  // Export : plafond tenu, et plus fort avec du gain d'entrée.
  const loud = async gain => { S.master.limit.gain = gain; return A.measureLoudness(await A.renderSong(), E.ctx.sampleRate); };
  const quiet = await loud(0);
  const hot = await loud(12);
  t.ok(hot.peakDb <= -1 + 0.05, 'export : crête au plafond', hot.peakDb);
  t.ok(hot.integrated > quiet.integrated + 3, 'export : +12 dB d’entrée = nettement plus fort', [quiet.integrated, hot.integrated]);
  S.master.limit.gain = 0;
  // Un stem sort sans chaîne master (le gain d'entrée ne s'applique pas).
  S.master.limit.gain = 12;
  const stem = A.measureLoudness(await A.renderSong(0), E.ctx.sampleRate);
  t.ok(stem.integrated < hot.integrated - 3, 'un stem sort sans la chaîne master', [stem.integrated, hot.integrated]);
  S.master.limit.gain = 0;
  A.applyMaster();
}
