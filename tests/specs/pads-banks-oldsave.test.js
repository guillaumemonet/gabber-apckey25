// Ancienne sauvegarde à 15 banques déjà remplies : les nouvelles banques de la bibliothèque (Anthems, Anthem…)
// s'installent dans les banques libres 16 à 21, les noms sont traduits, les sons stéréo se décodent,
// et Maj + SCENE LAUNCH fait défiler les groupes de banques 6-10, 11-15, 16-20, 21-25.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      const banks = Array.from({ length: 15 }, (_, b) => (b === 0 ? new Array(40).fill(null)
        : Array.from({ length: 40 }, (_, i) => ({ name: 'x', color: 5, sampleId: `lib:bank${b}/0${(i % 9) + 1}.flac`, bpm: 0, p: {} }))));
      tx.objectStore('state').put({ bank: 14, page: 'pad', bpm: 190, preset: 'init', globals: {}, banks, libBanks: ['Gabber'] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.eq(S.banks.length, A.BANKS, 'le nombre de banques passe à celui de l’application');
  const where = folder => S.banks.findIndex(bk => bk.some(p => p?.sampleId?.startsWith(`lib:${folder}/`))) + 1;
  t.eq(where('bank15'), 16, 'Anthems en banque 16');
  t.eq(where('anthem-drums'), 17, 'Anthem drums en banque 17');
  t.eq(where('anthem-guitars'), 21, 'Anthem guitars & choirs en banque 21');
  t.eq(S.banks[15].filter(Boolean).length, 40, '40 sons dans la banque 16');
  t.eq(S.banks[15][0]?.name, "Lead d'hymne", 'nom traduit en français');
  const gtr = await A.ensureBuffer('lib:bank15/09.flac');
  t.eq(gtr?.numberOfChannels, 2, 'les guitares se décodent en stéréo');
  t.near(gtr?.duration ?? 0, 5.053, 0.01, 'boucle de 4 mesures à 190 BPM');
  const press = (name, pressed = true) => A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed } }));
  const seq = [];
  press('scene1'); seq.push(S.bank + 1);
  press('shift');
  for (let k = 0; k < 5; k++) { press('scene1'); seq.push(S.bank + 1); }
  press('shift', false);
  t.eq(seq, [1, 6, 11, 16, 21, 6], 'Maj + SCENE LAUNCH 1 : 6 → 11 → 16 → 21 → 6');
  t.eq(t.$$('#banks button').length, A.BANKS, 'un bouton par banque');
  const guitars = t.$$('#lib-cats .lib-cat').find(b => /Guitares/.test(b.textContent));
  t.ok(guitars, 'catégorie Guitares dans la bibliothèque');
}
