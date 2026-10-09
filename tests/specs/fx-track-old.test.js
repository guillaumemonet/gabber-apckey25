// Effets de piste : une ancienne sauvegarde avec des blocs invalides est nettoyée au chargement.
export async function seed() {
  const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [] }));
  tracks[2].fx = [{ fx: 'nope', start: 0, len: 4 }, { fx: 'pcf', start: 0, len: 8, p: { mode: 'xx', q: 99 } }];
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, tl: { bars: 16, tracks }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const fx = A.state.tl.tracks[2].fx;
  t.eq(fx.length, 1, 'le bloc d\'un effet inconnu est retiré');
  t.eq(fx[0]?.fx, 'pcf', 'le bloc PCF est gardé');
  t.eq(fx[0]?.p.mode, 'lp', 'un réglage invalide reprend sa valeur par défaut');
  t.ok(fx[0]?.p.q >= 0.7 && fx[0]?.p.q <= 20, 'un réglage hors limites reprend sa valeur par défaut', fx[0]?.p.q);
  t.ok(typeof fx[0]?.id === 'string', 'le bloc reçoit un identifiant');
  t.ok(A.state.tl.tracks.length >= 16, 'les pistes de la sauvegarde sont gardées', A.state.tl.tracks.length);
}
