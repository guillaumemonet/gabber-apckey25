// Sidechain : une ancienne sauvegarde aux réglages invalides est corrigée au chargement.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, sc: { on: 'yes', depth: 5, source: 'x' }, gen: { preset: 'nope' }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const sc = A.state.sc;
  t.eq(typeof sc.on, 'boolean', 'interrupteur remis en booléen');
  t.ok(sc.depth >= 0 && sc.depth <= 1, 'profondeur ramenée dans ses limites', sc.depth);
  t.ok(['kicks', 'beat'].includes(sc.source), 'source inconnue remplacée', sc.source);
  t.ok(A.state.gen.preset !== 'nope', 'preset inconnu du générateur remplacé', A.state.gen.preset);
}
