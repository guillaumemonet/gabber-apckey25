// Bibliothèque (profil neuf) : les banques Anthem remplissent les pads 17 à 21, la bibliothèque les met en tête,
// les anciennes banques sont archivées (case pour les afficher), les voix restent visibles, Maj + SCENE LAUNCH fait le tour des groupes.
export default async function (t, A) {
  const S = A.state;
  const folders = ['anthem-drums', 'anthem-leads', 'anthem-chords', 'anthem-drops', 'anthem-guitars'];
  const where = folders.map(f => S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith(`lib:${f}/`))) + 1);
  t.eq(where, [17, 18, 19, 20, 21], 'les cinq banques Anthem sur les pads 17 à 21');
  t.ok(S.banks[16].filter(Boolean).length === 40, 'banque 17 complète');
  const total = A.libManifest.banks.reduce((n, b) => n + b.pads.filter(Boolean).length, 0);
  t.ok(t.$('#start-msg').textContent.includes(`${total}/${total}`), 'tous les sons de la bibliothèque chargés au démarrage', t.$('#start-msg').textContent);

  const rows = () => t.$$('#lib-list .lib-item span').map(s => s.textContent);
  const cat = re => t.$$('#lib-cats .lib-cat').find(b => re.test(b.textContent));
  const count = re => +(cat(re)?.querySelector('small')?.textContent ?? 0);
  cat(/Kicks/).click();
  await t.wait(100);
  t.eq(rows()[0], 'Mainstream', 'la catégorie Kicks commence par les nouveaux kicks');
  const kicksNew = count(/Kicks/);
  t.eq(kicksNew, 20, 'sans les archives : les 20 kicks Anthem');
  t.ok(count(/Guit/) === 24, 'les 24 nouvelles guitares (les anciennes archivées)', count(/Guit/));
  const voices = count(/Voix|Voices/);
  t.ok(voices >= 30, 'les voix restent visibles (cris compris)', voices);

  t.$('#lib-archives').click();
  await t.wait(150);
  t.ok(S.libArchives, 'case Archives cochée et enregistrée');
  t.ok(count(/Kicks/) > kicksNew, 'avec les archives : les anciens kicks reviennent', count(/Kicks/));
  t.eq(count(/Voix|Voices/), voices, 'les voix ne changent pas');
  t.$('#lib-archives').click();
  await t.wait(100);
  t.eq(count(/Kicks/), kicksNew, 'archives masquées de nouveau');

  // Maj + SCENE LAUNCH 1 : 6, 11, 16, 21, puis retour à 6.
  const btn = (name, pressed = true) => A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed } }));
  const seq = [];
  btn('scene1'); seq.push(S.bank + 1);
  btn('shift');
  for (let k = 0; k < 5; k++) { btn('scene1'); seq.push(S.bank + 1); }
  btn('shift', false);
  t.eq(seq, [1, 6, 11, 16, 21, 6], 'Maj + SCENE LAUNCH parcourt les groupes de banques');
  t.eq(t.$$('#banks button').length, A.BANKS, 'un bouton par banque');
}
