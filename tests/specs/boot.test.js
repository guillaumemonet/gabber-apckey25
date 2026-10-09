// Démarrage : l'application se lance, charge la bibliothèque, remplit les banques et affiche ses fenêtres.
export default async function (t, A) {
  const S = A.state;
  t.ok(A.engine?.ctx?.state === 'running', 'contexte audio lancé', A.engine?.ctx?.state);
  t.eq(S.banks.length, A.BANKS, 'toutes les banques de pads existent');
  t.ok(A.libManifest.banks.length >= 20, 'bibliothèque chargée', A.libManifest.banks.length);
  const anthem = S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith('lib:anthem-drums/')));
  t.ok(anthem >= 0, 'la banque Anthem drums est posée sur les pads');
  t.ok(S.banks[anthem]?.[0]?.buffer, 'ses sons sont décodés');
  t.ok(t.$$('#lib-list .lib-item').length > 0, 'la bibliothèque affiche des sons');
  t.ok(t.$$('#plugins button[data-plugin]').length >= 15, 'barre des plugins complète');
  t.ok(t.$('#tl-time b')?.textContent === '0:00.0', 'compteur de lecture à zéro', t.$('#tl-time b')?.textContent);
  t.eq(S.bpm, 190, 'un nouveau projet démarre à 190 BPM (tempo de la bibliothèque Anthem)');
  t.eq(document.documentElement.lang, 'fr', 'interface en français (préférence du profil de test)');
}
