// Timeline : une ancienne sauvegarde (pistes sans potards, source d'enregistrement TB-303) se recharge correctement.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [] }));
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, tl: { bars: 32, source: 'acid', tracks }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.eq(S.tl.tracks.length, 16, 'les 16 pistes reviennent');
  t.eq(t.$$('#tl-grid .tl-lane').length, 16, 'une ligne par piste');
  t.eq(S.tl.source, 'acid', 'la source d\'enregistrement TB-303 est gardée');
  t.ok(S.tl.tracks.every(tr => tr.vol === 1 && tr.pan === 0 && tr.lp === 20000 && tr.hp === 20 && Array.isArray(tr.fx)), 'potards et effets par défaut ajoutés');
  t.eq(t.$$('.tl-knobs').length, 16, 'un bouton de potards par piste');
}
