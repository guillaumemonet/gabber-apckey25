// Tempo du projet : une ancienne sauvegarde (sans liste des banques importées) garde son tempo au démarrage,
// même quand la bibliothèque s'importe pour la première fois.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'pad', bpm: 173, preset: 'init', globals: {}, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  t.eq(A.state.bpm, 173, 'le tempo de la sauvegarde est gardé');
  t.eq(+t.$('#bpm').value, 173, 'le champ tempo affiche 173');
  t.near(A.engine.bpm, 173, 0.01, 'le moteur joue à 173 BPM');
  t.ok(A.state.libBanks.length >= 20, 'la bibliothèque a bien été importée', A.state.libBanks.length);
}
