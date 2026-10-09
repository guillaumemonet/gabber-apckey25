// Bibliothèque (ancienne sauvegarde : 11 banques déjà posées, un pad et un bloc renommés à la main) :
// les noms officiels reviennent, les banques manquantes sont ajoutées sans doublon, l'onglet Effets pose un effet,
// la recherche trouve les sons.
let g2 = -1;
export async function seed() {
  const man = await fetch('sounds/banks.json').then(r => r.json());
  const banks = Array.from({ length: 15 }, () => new Array(40).fill(null));
  man.banks.slice(0, 11).forEach((b, k) => b.pads.forEach((p, i) => { if (p) banks[k + 1][i] = { name: p.name, color: p.color, sampleId: `lib:${p.file}`, bpm: p.bpm || 0, p: {} }; }));
  g2 = man.banks.findIndex(b => b.name === 'Gabber 2');
  banks[g2 + 1][29].name = 'Hoover only';
  const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [], fx: [] }));
  tracks[0].clips.push({ id: 'c1', start: 0, len: 4, sampleId: `lib:${man.banks[g2].pads[28].file}`, name: 'Acid only', cat: 'lead', bpm: 190, loop: true });
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, libBanks: man.banks.slice(0, 11).map(b => b.name), tl: { bars: 16, tracks }, banks }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.ok(S.banks[g2 + 1][29]?.name && S.banks[g2 + 1][29].name !== 'Hoover only', 'pad renommé : le nom officiel revient', S.banks[g2 + 1][29]?.name);
  t.ok(S.tl.tracks[0].clips[0]?.name && S.tl.tracks[0].clips[0].name !== 'Acid only', 'bloc renommé : le nom officiel revient', S.tl.tracks[0].clips[0]?.name);
  const folders = new Map();
  S.banks.forEach((b, i) => { const f = b.find(p => p?.sampleId?.startsWith('lib:'))?.sampleId.split('/')[0]; if (f) folders.set(f, [...(folders.get(f) ?? []), i]); });
  t.ok([...folders.values()].every(v => v.length === 1), 'aucune banque de la bibliothèque en double', [...folders].filter(([, v]) => v.length > 1));
  t.ok(folders.has('lib:anthem-drums'), 'les banques manquantes sont ajoutées (Anthem drums)');
  t.ok(S.libBanks.length >= A.libManifest.banks.length - 1, 'banques connues enregistrées', S.libBanks.length);

  // Onglet Effets : familles, puis glisser le premier effet sur la piste 2.
  t.$('#lib-tabs [data-tab="fx"]').click();
  await t.wait(100);
  t.ok(t.$$('#lib-cats .lib-cat').length >= 6, 'familles d\'effets', t.$$('#lib-cats .lib-cat').length);
  const row = t.$('#lib-list .lib-item');
  const lane = t.$$('.tl-lane')[1];
  const r = row.getBoundingClientRect(), rl = lane.getBoundingClientRect();
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 40, clientY: r.top + 20 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: rl.left + 30, clientY: rl.top + 10 }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: rl.left + 30, clientY: rl.top + 10 }));
  await t.wait(200);
  t.eq(S.tl.tracks[1].fx.length, 1, 'effet posé sur la piste 2');

  // Recherche.
  t.$('#lib-tabs [data-tab="sounds"]').click();
  const search = t.$('#lib-search');
  search.value = 'kick'; search.dispatchEvent(new Event('input'));
  await t.wait(100);
  const found = t.$$('#lib-list .lib-item span').map(s => s.textContent);
  t.ok(found.length > 5 && found.every(n => /kick/i.test(n)), 'la recherche filtre par nom', found.slice(0, 5));
}
