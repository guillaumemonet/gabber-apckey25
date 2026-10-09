// Câblage : une sauvegarde abîmée (boîte inconnue, réglage hors limites, boucle, câble vers une boîte absente)
// est réparée au chargement.
export async function seed() {
  const patch = { boxes: [{ id: 'box:1', type: 'dist', p: { drive: 9 } }, { id: 'x', type: 'nope' }],
    links: [{ from: 'acid', to: 'box:1' }, { from: 'box:1', to: 'master' }, { from: 'master', to: 'acid' }, { from: 'pads', to: 'ghost' }],
    known: ['pads', 'synth', 'tr', 'tl', 'acid'] };
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, patch, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const P = A.state.patch;
  t.eq(P.boxes.map(b => b.type), ['dist'], 'la boîte inconnue est retirée');
  t.ok(P.boxes[0].p.drive >= 0 && P.boxes[0].p.drive <= 1, 'le réglage hors limites est ramené', P.boxes[0].p.drive);
  t.ok(P.links.some(l => l.from === 'acid' && l.to === 'box:1') && P.links.some(l => l.from === 'box:1' && l.to === 'master'), 'le câblage valide est gardé');
  t.ok(!P.links.some(l => l.from === 'master'), 'le câble qui fait boucle est retiré');
  t.ok(!P.links.some(l => l.to === 'ghost'), 'le câble vers une boîte absente est retiré');
  for (const id of ['decks', 'osc']) t.ok(P.links.some(l => l.from === id && l.to === 'master'), `l'outil ${id} (nouveau depuis la sauvegarde) va au master`);
}
