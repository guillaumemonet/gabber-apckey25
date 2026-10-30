// Bibliothèque (profil neuf) : les banques Anthem remplissent les pads 17 à 21, la banque Early hardcore le 22 ; arbre famille › type › sons
// (familles en anglais, nouvelles banques en tête, tous les sons des banques présents), filtre coups / boucles, recherche ; Maj + SCENE LAUNCH
// fait le tour des groupes.
export default async function (t, A) {
  const S = A.state;
  const folders = ['anthem-drums', 'anthem-leads', 'anthem-chords', 'anthem-drops', 'anthem-guitars'];
  const where = folders.map(f => S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith(`lib:${f}/`))) + 1);
  t.eq(where, [17, 18, 19, 20, 21], 'les cinq banques Anthem sur les pads 17 à 21');
  t.ok(S.banks[16].filter(Boolean).length === 40, 'banque 17 complète');
  const early = A.libManifest.banks.find(b => b.name === 'Early hardcore');
  t.eq(S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith('lib:early-hardcore/'))) + 1, 22, 'banque Early hardcore sur les pads 22');
  t.eq(S.banks[21].filter(Boolean).length, 40, 'banque 22 complète');
  t.eq(['anthem-hooks', 'lead-riffs'].map(f => S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith(`lib:${f}/`))) + 1), [23, 24], 'Anthem hooks et Lead riffs sur les pads 23 et 24');
  const bass = A.libraryItems({ manifest: A.libManifest, kit: A.kit, banks: S.banks, tl: S.tl, userSounds: [] }).filter(i => i.sampleId.startsWith('lib:basslines/'));
  t.ok(bass.length === 26 && bass.every(i => i.loop && i.bpm && i.bars && i.family === 'Bass'), 'Basslines : dans la bibliothèque seulement (26 boucles)', bass.length);
  t.ok(S.banks.some((b, i) => i > 0 && !b.some(Boolean)), 'il reste une banque vide');
  t.ok(early.pads.slice(0, 8).every(p => p.cat === 'kick') && early.pads.filter(p => p.mode === 2).every(p => p.bpm >= 160 && p.bpm <= 200 && p.kicks?.length),
    'kicks sur la première rangée, boucles de 160 à 200 BPM avec la position de leurs kicks (sidechain)');
  const onPads = S.banks.flat().filter(p => p?.sampleId?.startsWith('lib:')).length;
  t.ok(onPads >= 700, 'les sons de la bibliothèque sont sur les pads', onPads);
  t.ok(!S.banks[16].some(p => p?.buffer), 'ils ne sont décodés qu’à l’affichage de leur banque (banque 17 pas encore affichée)');

  // Arbre famille › type › sons ; tous les sons des banques y sont.
  const rows = () => t.$$('#lib-list .lib-item span').map(s => s.textContent);
  const chipOf = (sel, re) => t.$$(sel).find(b => re.test(b.firstChild?.nextSibling?.textContent ?? b.textContent));
  const fam = re => chipOf('#lib-cats .lib-cat', re);
  const type = re => chipOf('#lib-types .lib-type', re);
  const count = b => +(b?.querySelector('small')?.textContent ?? 0);
  t.eq(t.$$('#lib-cats .lib-cat').slice(0, 8).map(b => b.firstChild.nextSibling.textContent),
    ['Drums', 'Bass', 'Leads', 'Keys', 'Pads & Strings', 'Vocals', 'FX', 'Guitars'], 'familles en anglais, dans l’ordre du catalogue');
  fam(/^Drums$/).click();
  await t.wait(100);
  t.ok(t.$$('#lib-types .lib-type').length >= 8, 'types de la famille Drums', t.$$('#lib-types .lib-type').length);
  type(/^Kicks$/).click();
  await t.wait(100);
  t.eq(rows()[0], 'Mainstream', 'Drums › Kicks commence par les kicks des nouvelles banques');
  t.ok(count(type(/^Kicks$/)) >= 110, 'tous les kicks des banques (les anciennes comprises)', count(type(/^Kicks$/)));
  const inBanks = new Set(S.banks.flat().map(p => p?.sampleId).filter(id => id?.startsWith('lib:')));
  const listed = new Set(A.libraryItems({ manifest: A.libManifest, kit: A.kit, banks: S.banks, tl: S.tl, userSounds: S.userSounds }).map(i => i.sampleId));
  t.ok([...inBanks].every(id => listed.has(id)), 'chaque son des banques est dans la bibliothèque', [...inBanks].filter(id => !listed.has(id)).slice(0, 3));
  t.eq(count(fam(/^Guitars$/)), 34, 'Guitars : 34 sons');
  // Filtre coups / boucles.
  t.$('#lib-kind [data-kind="loop"]').click();
  await t.wait(100);
  t.ok(t.$$('#lib-list .lib-item small').every(s => !/coup|1-shot/.test(s.textContent)), 'Boucles : seulement des boucles');
  t.$('#lib-kind [data-kind="all"]').click();
  // Recherche dans tout l'arbre : nom, type, étiquettes.
  const search = t.$('#lib-search');
  search.value = 'reese';
  search.dispatchEvent(new Event('input'));
  await t.wait(100);
  t.ok(rows().length >= 2 && rows().every(r => /reese/i.test(r)), 'recherche par nom', rows());
  t.ok(t.$('#lib-types').hidden, 'pas de types pendant une recherche');
  search.value = 'andalusian';
  search.dispatchEvent(new Event('input'));
  await t.wait(100);
  t.ok(rows().length >= 20, 'recherche par étiquette (ambiance)', rows().length);
  t.ok(/Drums › |Leads › |Bass › /.test(t.$('#lib-list .lib-item').title), 'la place dans l’arbre au survol', t.$('#lib-list .lib-item').title);
  search.value = '';
  search.dispatchEvent(new Event('input'));

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
