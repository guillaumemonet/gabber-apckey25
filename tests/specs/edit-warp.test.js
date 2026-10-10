// Étirement temporel et transposition des sons : un la 440 Hz « à 120 BPM » posé dans un morceau à 150 BPM.
// Sans « Garder la hauteur » il monte (550 Hz) ; avec, il reste à 440 Hz et suit le tempo ; transposé de +12, 880 Hz ;
// l'export attend les sons recalculés ; menu ; annuler.
export default async function (t, A) {
  const S = A.state, E = A.engine, sr = E.ctx.sampleRate;
  // Son de test : 2 s de la 440 Hz, rangé comme un son importé.
  const n = sr * 2, sine = new Float32Array(n);
  for (let i = 0; i < n; i++) sine[i] = 0.4 * Math.sin(2 * Math.PI * 440 * i / sr);
  const wav = await new Blob([A.encodeWav([sine, sine], sr)]).arrayBuffer();
  await A.store.saveSample('user:warp-test', { name: 'La 440', data: wav });
  S.userSounds.push({ sampleId: 'user:warp-test', name: 'La 440', cat: 'mine' });
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; tr.auto = {}; });
  S.sc.on = false;
  S.tl.bars = 2;
  A.setBpm(150);
  const clip = { id: 'c-w', start: 0, len: 8, sampleId: 'user:warp-test', name: 'La 440', cat: 'mine', color: 1, bpm: 120, loop: true };
  S.tl.tracks[0].clips.push(clip);
  await A.loadTlBuffers();
  A.renderTl();
  A.save();
  // Fréquence (passages par zéro) entre 0,5 s et 2 s du rendu.
  const freq = ch => { const c = ch[0], a = Math.floor(0.5 * sr), b = Math.floor(2 * sr); let z = 0; for (let i = a + 1; i < b; i++) if (c[i - 1] < 0 && c[i] >= 0) z++; return z / 1.5; };

  t.near(freq(await A.renderSong()), 550, 8, 'sans « Garder la hauteur » : le son monte avec le tempo (550 Hz)');
  // Menu : Garder la hauteur.
  const open = () => t.$$('#tl-grid .tl-clip').find(e => e._obj?.id === 'c-w').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 400 }));
  open();
  const keep = [...t.$$('.clip-menu .cm-check')].find(r => /hauteur|pitch/i.test(r.textContent))?.querySelector('input');
  t.ok(keep && !keep.checked, 'menu : « Garder la hauteur » (désactivé sur un ancien bloc)');
  keep.checked = true; keep.dispatchEvent(new Event('change'));
  t.ok(S.tl.tracks[0].clips[0].warp, 'activé');
  A.closeClipMenu();
  t.near(freq(await A.renderSong()), 440, 8, 'avec : il garde sa hauteur (440 Hz) en suivant le tempo');
  // Le son recalculé est prêt pour la lecture aussi.
  const c0 = S.tl.tracks[0].clips[0];
  t.ok(await t.until(() => A.timeline.warpOf(c0, A.clipBuffer(c0.sampleId), 150 / 120), 3000), 'son recalculé prêt pour la lecture');

  // Transposer de +12 : 880 Hz, même vitesse.
  open();
  [...t.$$('.clip-menu .cm-transpose button')].find(b => b.textContent === '+12').click();
  t.eq(S.tl.tracks[0].clips[0].semi, 12, '+12 demi-tons');
  A.closeClipMenu();
  const up = await A.renderSong();
  t.near(freq(up), 880, 12, 'transposé d’une octave (880 Hz)');
  let r = 0; for (let i = Math.floor(0.5 * sr); i < 2 * sr; i += 7) r = Math.max(r, Math.abs(up[0][i]));
  t.ok(r > 0.2, 'au même niveau', r);
  // Annuler : la transposition disparaît.
  A.tlUndo();
  await t.wait(50);
  t.ok(!S.tl.tracks[0].clips[0].semi, 'Ctrl+Z annule la transposition');

  // Nouveau bloc posé depuis la bibliothèque : « Garder la hauteur » d'office.
  await A.tlPlaceItem({ sampleId: 'user:warp-test', name: 'La 440', cat: 'mine', bpm: 120, loop: true }, 1, 0);
  t.ok(S.tl.tracks[1].clips[0]?.warp, 'un nouveau bloc garde sa hauteur par défaut');
  A.setBpm(190);
}
