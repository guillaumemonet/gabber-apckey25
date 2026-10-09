// Timeline : ancienne sauvegarde avec une seule piste armée (armed: 5) et la source « synthé » -> la piste 6 est armée.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [], fx: [] }));
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, tl: { bars: 32, source: 'synth', armed: 5, tracks }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.eq(S.tl.tracks.map((tr, i) => (tr.arm ? i : -1)).filter(i => i >= 0), [5], 'la piste armée de l\'ancienne sauvegarde est la 6');
  t.eq(S.tl.source, 'synth', 'source d\'enregistrement gardée');
  t.ok(t.$('#tl-source').options.length >= 6, 'menu des sources complet', t.$('#tl-source').options.length);
}
