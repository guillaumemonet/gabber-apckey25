// Sons à la demande : au démarrage, seule la banque affichée (et ce que jouent la timeline et les scènes) est décodée ;
// une banque se charge quand on l'affiche ; un pad pas encore chargé part dès qu'il est décodé ;
// les pads joués par la timeline se chargent avec elle ; l'export d'une banque attend ses sons.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  const libBanks = S.banks.map((b, i) => i).filter(i => i !== S.bank && S.banks[i].some(p => p?.sampleId?.startsWith('lib:')));
  t.ok(libBanks.length >= 10, 'des banques de la bibliothèque sont posées', libBanks.length);
  const decoded = S.banks.flat().filter(p => p?.buffer).length, total = S.banks.flat().filter(Boolean).length;
  t.ok(decoded <= 45, 'au démarrage, seule la banque affichée est décodée', `${decoded}/${total}`);

  // Afficher une banque la charge.
  const b1 = libBanks[0];
  A.setBank(b1);
  t.ok(await t.until(() => A.bankLoaded(b1), 15000), 'la banque affichée se charge');
  t.ok(S.banks[b1].filter(Boolean).every(p => p.buffer), 'tous ses pads ont leur son');

  // Un pad pressé avant la fin du chargement part dès que son son est décodé.
  const b2 = libBanks.find(b => b !== b1 && !A.bankLoaded(b) && S.banks[b][0]);
  A.setBank(b2);
  t.ok(!S.banks[b2][0].buffer, 'le pad n’est pas encore décodé');
  A.triggerPad(0);
  const key = A.padKey(b2, 0);
  t.ok(await t.until(() => E.padVoices.has(key), 10000), 'le pad joue dès que son son est décodé');
  A.panic();

  // Un coup de pad posé sur la timeline, dans une banque jamais affichée : chargé avec la timeline.
  const b3 = libBanks.find(b => b !== b1 && b !== b2 && !S.banks[b].some(p => p?.buffer) && S.banks[b][0]);
  S.tl.tracks[0].clips.push({ id: 'c-pad-ondemand', type: 'pad', bank: b3, pad: 0, start: 0, len: 1, vel: 1 });
  await A.loadTlBuffers();
  t.ok(S.banks[b3][0].buffer, 'le pad joué par la timeline est décodé');
  t.ok(!S.banks[b3].slice(1).some(p => p?.buffer), 'les autres pads de sa banque restent à charger');

  // Le même son demandé deux fois en même temps n'est décodé qu'une fois.
  const id = S.banks[b3][1]?.sampleId;
  if (id) {
    const [x, y] = await Promise.all([A.loadSound(id), A.loadSound(id)]);
    t.ok(x && x === y, 'un seul décodage pour deux demandes simultanées');
  }
}
