// Platines : une ancienne sauvegarde avec des valeurs invalides est nettoyée au démarrage.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, decks: { A: { sampleId: 5, pitch: 3, vol: 'x' }, xfade: 9 },
        mix: { channels: { pads: {}, synth: {}, tr: {}, tl: {}, acid: {} } }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const d = A.state.decks;
  t.eq(d.A.sampleId, null, 'identifiant de son invalide ignoré');
  t.ok(Math.abs(d.A.pitch) <= 0.08, 'pitch ramené dans ±8 %', d.A.pitch);
  t.ok(d.A.vol >= 0 && d.A.vol <= 1, 'volume invalide remplacé', d.A.vol);
  t.ok(d.xfade >= 0 && d.xfade <= 1, 'crossfader ramené entre 0 et 1', d.xfade);
  t.ok('decks' in A.state.mix.channels, 'voie de mixage des platines ajoutée');
  A.wm.toggle('decks', true);
  await t.wait(200);
  t.eq(t.$$('.deck').length, 2, 'la fenêtre s\'ouvre normalement');
}
