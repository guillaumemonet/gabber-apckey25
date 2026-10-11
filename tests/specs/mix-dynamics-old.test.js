// Écrêteur et multibande : une sauvegarde d'avant (master avec compresseur et limiteur seulement) se charge
// avec les deux coupés ; ses propres réglages sont gardés.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, banks: [],
        master: { comp: { on: false, threshold: -12, ratio: 4 }, limit: { on: true, gain: 6, ceiling: -1 } } }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const m = A.state.master;
  t.eq([m.comp.on, m.comp.threshold, m.limit.gain, m.limit.ceiling], [false, -12, 6, -1], 'réglages de l’ancienne sauvegarde gardés');
  t.eq([m.ott.on, m.clip.on], [false, false], 'multibande et écrêteur coupés');
  t.eq([A.engine.masterSettings.ott.on, A.engine.masterSettings.clip.on], [false, false], 'coupés dans le moteur');
  A.wm.toggle('mix', true);
  t.ok(t.$('#master-chain [data-group="ott"]').classList.contains('off') && t.$('#master-chain [data-group="clip"]').classList.contains('off'), 'affichés coupés');
}
