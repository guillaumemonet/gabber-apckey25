// Générateur d'accords : ancienne sauvegarde (réglages invalides, vieux bloc d'une note sur la piste 1).
export async function seed() {
  const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [] }));
  tracks[0].clips.push({ id: 'old1', type: 'note', note: 65, vel: 0.8, name: 'F4', cat: 'lead', start: 0, len: 2, loop: false });
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'acid', globals: {}, gen: { bars: 3, rhythm: 'zz' }, tl: { bars: 16, armed: 0, tracks }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  t.eq([S.gen.bars, S.gen.rhythm, S.gen.repeat, S.gen.bass], [2, 'hold', 2, 'none'], 'réglages invalides remplacés par ceux par défaut');
  t.eq(S.preset, 'acid', 'preset de la sauvegarde gardé');
  t.eq(S.tl.tracks[0].clips.map(c => c.id), ['old1'], 'vieux bloc gardé');
  S.tl.playhead = 0;
  t.eq(S.gen.lead.style, 'anthem', 'réglages de la mélodie ajoutés à une ancienne sauvegarde');
  A.wm.toggle('gen', true);
  t.$('#gen-go').click();
  await t.wait(100);
  const made = S.tl.tracks.map((tr, i) => [i, tr.clips.filter(c => c.id !== 'old1').length]).filter(x => x[1]);
  t.ok(made.length === 1 && made[0][0] !== 0, 'les accords vont sur une piste libre (pas sur le vieux bloc)', made);
  t.ok(S.tl.bars >= 16, 'le morceau garde au moins sa longueur', S.tl.bars);
}
