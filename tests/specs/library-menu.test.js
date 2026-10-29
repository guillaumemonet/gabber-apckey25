// Bibliothèque, clic droit sur un son : « Charger dans… » un pad d'une autre banque, une platine, la timeline, le lanceur,
// l'instrument échantillon (pad accordé sur la note du son + bloc de notes ouvert dans le piano roll).
export default async function (t, A) {
  const S = A.state;
  const items = A.libraryItems({ manifest: A.libManifest, kit: A.kit, banks: S.banks, tl: S.tl, userSounds: S.userSounds });
  const loop = items.find(i => i.loop && i.bars && i.family === 'Guitars');
  const tonal = items.find(i => !i.loop && i.note && /^[A-G]#?$/.test(i.note) && i.family === 'Keys');
  t.ok(loop && tonal, 'une boucle et un son accordé dans le catalogue', [loop?.name, tonal?.name]);

  const open = async item => {
    const search = t.$('#lib-search');
    search.value = item.name; search.dispatchEvent(new Event('input'));
    await t.wait(80);
    const row = t.$$('#lib-list .lib-item').find(r => r.dataset.id === item.sampleId);
    const r = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 5 }));
    await t.wait(50);
    return t.$('.lib-menu');
  };
  const pick = async (item, icon, done, nth = 0) => { const m = await open(item); m.querySelectorAll(`.cm-item[data-icon="${icon}"]`)[nth].click(); await t.until(done, 5000); };

  // Un pad d'une autre banque que celle affichée.
  const menu = await open(loop);
  t.ok(menu && menu.querySelectorAll('.cm-item').length >= 7, 'menu Charger dans…', menu?.textContent);
  menu.querySelector('.cm-item[data-icon="pads"]').click();
  await t.wait(50);
  const sel = menu.querySelector('select');
  const bank = S.bank === 2 ? 3 : 2;
  sel.value = bank; sel.dispatchEvent(new Event('change'));
  t.eq(menu.querySelectorAll('.lm-pads button').length, 40, 'grille de 40 pads');
  menu.querySelectorAll('.lm-pads button')[32].click();   // en bas à gauche : le pad 1
  await t.until(() => S.banks[bank][0]?.sampleId === loop.sampleId, 5000);
  t.eq(S.banks[bank][0]?.sampleId, loop.sampleId, `pad 1 de la banque ${bank + 1}`, S.banks.map((b, k) => [k, b.findIndex(p => p?.sampleId === loop.sampleId)]).filter(x => x[1] >= 0));
  t.ok(!t.$('.lib-menu'), 'le menu se ferme');

  await pick(loop, 'decks', () => S.decks.B.sampleId === loop.sampleId, 1);
  t.eq(S.decks.B.sampleId, loop.sampleId, 'platine B');

  await pick(loop, 'tr', () => S.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === loop.sampleId)));
  const clip = S.tl.tracks.flatMap(tr => tr.clips).find(c => c.sampleId === loop.sampleId);
  t.ok(clip && clip.len === loop.bars * 4, 'posé sur la timeline, sur ses mesures', clip?.len);

  await pick(loop, 'scenes', () => S.launcher.slots.flat().some(c => c?.sampleId === loop.sampleId));
  t.ok(S.launcher.slots.flat().some(c => c?.sampleId === loop.sampleId), 'envoyé au lanceur');

  // Instrument échantillon.
  S.banks[S.bank][39] = null;
  await pick(tonal, 'keys', () => S.roll.clip && S.tl.tracks.some(tr => tr.clips.some(c => c.id === S.roll.clip && c.smps)));
  const block = S.tl.tracks.flatMap(tr => tr.clips).find(c => c.smps && S.banks[c.smps[0].bank][c.smps[0].pad]?.sampleId === tonal.sampleId);
  t.ok(block?.type === 'note' && block.seq.length === 1, 'bloc de notes qui joue le son', block);
  const pad = block && S.banks[block.smps[0].bank][block.smps[0].pad];
  const { noteClass } = await import('/js/library.js');
  t.eq(((pad?.smp?.root ?? -1) % 12 + 12) % 12, noteClass(tonal.note), `pad accordé sur sa note (${tonal.note})`, pad?.smp);
  t.eq(S.roll.clip, block?.id, 'ouvert dans le piano roll');

  // Hauteur d'un son synthétique (la2, 110 Hz, avec harmoniques) : bonne octave, avec ou sans note connue.
  const { guessRoot } = await import('/js/sampler.js');
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const buf = ctx.createBuffer(1, 44100, 44100), x = buf.getChannelData(0);
  for (let k = 0; k < x.length; k++) x[k] = [1, 0.6, 0.4, 0.3].reduce((s, a, h) => s + a * Math.sin(2 * Math.PI * 110 * (h + 1) * k / 44100), 0) / 3;
  t.eq([guessRoot(buf, 9), guessRoot(buf, null)], [45, 45], 'la2 reconnu (avec la note, et sans)');
}
