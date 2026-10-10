// Saturation d'une piste (potentiomètre « Saturation ») : présente dans le panneau, transparente à 0, le rendu se
// déforme à 100 % ; les curseurs des effets d'insert restent utilisables dans les voies étroites (mixeur, bus).
export default async function (t, A) {
  const S = A.state, E = A.engine, sr = E.ctx.sampleRate;
  const n = sr * 2, sine = new Float32Array(n);
  for (let i = 0; i < n; i++) sine[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / sr);
  await A.store.saveSample('user:drive-test', { name: 'Sinus', data: await new Blob([A.encodeWav([sine, sine], sr)]).arrayBuffer() });
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; tr.auto = {}; tr.drive = 0; });
  S.sc.on = false;
  S.tl.bars = 1;
  S.tl.tracks[0].clips.push({ id: 'c-d', start: 0, len: 4, sampleId: 'user:drive-test', name: 'Sinus', cat: 'mine', color: 1, bpm: 0, loop: true });
  await A.loadTlBuffers();
  A.renderTl();

  t.$$('#tl-grid .tl-head')[0].querySelector('.tl-knobs').click();
  const labels = t.$$('.track-knobs .track-knob-row .knob .label').map(e => e.textContent);
  t.eq(labels.length, 7, 'sept potentiomètres de piste');
  t.ok(labels.some(l => /saturation|drive/i.test(l)), 'dont la saturation', labels);
  A.closeFxEditor();

  // Taux de distorsion : énergie hors du fondamental (après soustraction du meilleur sinus de 220 Hz).
  const thd = ch => {
    const c = ch[0], a = Math.floor(0.3 * sr), b = Math.floor(1.0 * sr);
    let ss = 0, sc = 0, tot = 0;
    for (let i = a; i < b; i++) { ss += c[i] * Math.sin(2 * Math.PI * 220 * i / sr); sc += c[i] * Math.cos(2 * Math.PI * 220 * i / sr); }
    const k = 2 / (b - a), as = ss * k, ac = sc * k;
    let res = 0;
    for (let i = a; i < b; i++) { const f = as * Math.sin(2 * Math.PI * 220 * i / sr) + ac * Math.cos(2 * Math.PI * 220 * i / sr); res += (c[i] - f) ** 2; tot += c[i] ** 2; }
    return Math.sqrt(res / tot);
  };
  const clean = thd(await A.renderSong());
  t.ok(clean < 0.05, 'à 0 : le son passe sans déformation', clean);
  S.tl.tracks[0].drive = 1;
  const hot = thd(await A.renderSong());
  t.ok(hot > clean * 4 && hot > 0.15, 'à 100 % : le son sature', [clean, hot]);

  // Curseurs d'insert dans une voie de bus : assez larges pour être saisis.
  A.wm.toggle('buses', true);
  const add = t.$$('#buses .fx-add')[0];
  add.value = 'dist'; add.dispatchEvent(new Event('change'));
  const w = t.$('#buses .fx-list input[type=range]').getBoundingClientRect().width;
  t.ok(w >= 40, 'curseur de la distorsion du bus utilisable', w);
  A.wm.toggle('mix', true);
  const addm = t.$$('#mixer .fx-add')[0];
  addm.value = 'filter'; addm.dispatchEvent(new Event('change'));
  const wm = t.$('#mixer .fx-list input[type=range]').getBoundingClientRect().width;
  t.ok(wm >= 40, 'curseur du filtre du mixeur utilisable', wm);
}
