// Ancienne sauvegarde d'avant la 303 (mixeur à 4 voies, réglages et patterns invalides) : tout est remis d'aplomb.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'mix_vol', bpm: 190, preset: 'init', globals: {},
        mix: { channels: { pads: { vol: 0.5 }, synth: {}, tr: {}, tl: {} } }, windows: { pads: { open: true, x: 10, y: 10, w: 700, h: null } },
        acid: { params: { cutoff: 'x', reso: 0.1 }, patterns: [[1, 2]], pattern: 99, wave: 'square', link: false }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.ok(Object.keys(S.mix.channels).includes('acid'), 'la voie TB-303 est ajoutée au mixeur', Object.keys(S.mix.channels));
  t.near(S.mix.channels.pads.vol, 0.5, 1e-6, 'les réglages existants du mixeur sont gardés');
  t.eq(S.acid.pattern, 0, 'pattern invalide → pattern 1');
  t.eq(S.acid.patterns.length, 8, '8 patterns');
  t.ok(Number.isFinite(S.acid.params.cutoff), 'coupure invalide remplacée', S.acid.params.cutoff);
  t.near(S.acid.params.reso, 0.1, 1e-6, 'réglage valide gardé');
  t.eq(S.acid.wave, 'square', 'forme d’onde gardée');
  t.eq(S.acid.link, false, 'choix « Suivre la 909 » gardé');
  t.eq(S.acid.sound, null, 'son perso (réglages d’avant les presets)');
  A.wm.toggle('acid', true);
  await t.wait(50);
  t.eq(t.$('#acid-presets .pb-sel').value, '', 'le menu des presets n’affiche rien de choisi');
}
