// Générateur d'accords : progression tapée (accord inconnu signalé), son, répétitions, basse ; blocs créés sur des
// pistes libres ; les voix des nappes gardent leur son quand on change de preset ; pas de piste libre = message.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  t.$('#plugins button[data-plugin="gen"]').click();
  const box = t.$('#gen');
  t.ok(A.wm.isOpen('gen'), 'la barre des plugins ouvre la fenêtre Générateur');
  t.$$('.gen-tabs button')[0].click();
  t.eq(S.gen.tab, 'chords', 'onglet Accords');
  t.eq(box.querySelectorAll('.gen-panel:not([hidden]) select').length, 4, 'quatre réglages propres aux accords');
  t.ok(box.querySelectorAll('.gen-chips button').length >= 3, 'progressions toutes prêtes');
  const input = box.querySelector('input[type=text]');
  input.value = 'Fm - Db - Eb - Cm7 xx'; input.dispatchEvent(new Event('input'));
  const set = (key, v) => { const el = box.querySelector(`[data-panel="chords"] select[data-key="${key}"], .gen-row:not(.gen-panel) select[data-key="${key}"]`); el.value = v; el.dispatchEvent(new Event('change')); };
  set('preset', 'thunder_pad'); set('repeat', '1'); set('bass', 'offbeat');
  const info = box.querySelector('.gen-info').textContent;
  t.ok(/Fm/.test(info) && /Cm7/.test(info) && /xx/.test(info), 'accords reconnus et accord inconnu affichés', info);
  box.querySelector('button.primary').click();
  await t.wait(100);
  const all = () => S.tl.tracks.flatMap(tr => tr.clips);
  const pads = all().filter(c => c.preset === 'thunder_pad');
  const bass = all().filter(c => c.preset === 'bass');
  t.eq(pads.map(c => [c.name, c.start, c.len]), [['Fm', 0, 8], ['Db', 8, 8], ['Eb', 16, 8], ['Cm7', 24, 8]], 'un bloc par accord, 2 mesures chacun');
  t.ok(pads.every(c => c.notes?.length >= 3), 'chaque bloc joue l\'accord', pads.map(c => c.notes));
  t.ok(bass.length >= 4 && bass.every(c => c.notes.length === 1 && c.start < 32), 'basse en contretemps sur la même durée', bass.length);
  const padTrack = S.tl.tracks.findIndex(tr => tr.clips.includes(pads[0]));
  const bassTrack = S.tl.tracks.findIndex(tr => tr.clips.includes(bass[0]));
  t.ok(padTrack >= 0 && bassTrack >= 0 && padTrack !== bassTrack, 'nappes et basse sur deux pistes', [padTrack, bassTrack]);
  t.ok(/xx/.test(t.$('#toast').textContent), 'le message signale l\'accord ignoré', t.$('#toast').textContent);
  // Lecture : voix « patchées » (son du bloc), qui survivent à un changement de preset.
  t.$('#tl-play').click();
  const got = await t.until(() => [...E.voices.values()].some(v => v.patched), 4000);
  t.ok(got, 'les nappes jouent avec leur propre son');
  const before = [...E.voices.values()].filter(v => v.patched).length;
  A.applyPreset('hoover');
  await t.wait(50);
  t.ok([...E.voices.values()].filter(v => v.patched).length >= before, 'changer de preset ne coupe pas les nappes', before);
  t.$('#tl-play').click();
  t.ok(await t.until(() => E.voices.size === 0, 4000), 'à l\'arrêt, plus aucune voix', E.voices.size);
  // Clic droit sur un bloc : supprimé.
  const n0 = all().length;
  t.$('.tl-clip.note').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  t.eq(n0 - all().length, 1, 'clic droit : le bloc est supprimé');
  // Plus aucune piste libre : message, rien n'est ajouté.
  S.tl.tracks.forEach(tr => tr.clips.push({ id: crypto.randomUUID(), type: 'note', note: 60, name: 'x', cat: 'lead', start: 0, len: 4 }));
  const n1 = all().length;
  box.querySelector('button.primary').click();
  await t.wait(50);
  t.eq(all().length, n1, 'aucune piste libre : rien n\'est ajouté');
  t.ok(t.$('#toast').textContent.length > 0 && !/xx/.test(t.$('#toast').textContent), 'un message l\'explique', t.$('#toast').textContent);
  t.eq([S.gen.prog, S.gen.preset, S.gen.repeat, S.gen.bass], ['Fm - Db - Eb - Cm7 xx', 'thunder_pad', 1, 'offbeat'], 'réglages du générateur gardés');
}
