// Fichiers .gabber : morceau (sons « rec: » embarqués), réglages de chaque outil, projet entier.
// Ouvrir un projet redémarre l'application : le test se fait en deux temps (sessionStorage garde le 1er).
const KEY = 'gk-test-files';

export default async function (t, A) {
  const S = A.state;
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  if (saved) {
    // 2e temps : l'application a redémarré sur le projet ouvert.
    sessionStorage.removeItem(KEY);
    for (const c of saved.checks) t.ok(c.ok, `(avant le redémarrage) ${c.msg}`, c.detail);
    const count = S.tl.tracks.reduce((n, tr) => n + tr.clips.length + tr.fx.length, 0);
    t.eq(S.bpm, 173, 'projet rouvert : le tempo est restauré');
    t.eq(count, saved.count, 'projet rouvert : tous les blocs sont là');
    t.eq(S.tr.pattern, 3, 'projet rouvert : réglages de la 909 restaurés');
    t.ok(S.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === 'rec:filetest')), 'projet rouvert : le bloc enregistré est là');
    const sample = await A.store.loadSample('rec:filetest');
    t.ok(sample?.data?.byteLength > 40000, 'projet rouvert : le son embarqué est recréé', sample?.data?.byteLength);
    t.ok(await t.until(() => A.clipBuffer('rec:filetest'), 5000), 'projet rouvert : il est décodé');
    return;
  }
  const first = [];
  const check = (ok, msg, detail) => { first.push({ ok: !!ok, msg, detail: ok ? undefined : JSON.stringify(detail) }); };
  // 1er temps : tout est noté puis revérifié au 2e (la page redémarre entre les deux).
  const ok = check;
  const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg, { obtenu: a, attendu: b });
  // Téléchargements interceptés.
  const files = [];
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) files.push({ name: this.download, href: this.href }); else origClick.call(this); };
  const lastFile = async () => { const f = files.at(-1); return new File([await (await fetch(f.href)).blob()], f.name); };
  const count = () => S.tl.tracks.reduce((n, tr) => n + tr.clips.length + tr.fx.length, 0);

  await A.loadDemo();
  // Un enregistrement (son « rec: ») pour vérifier qu'il voyage dans les fichiers.
  const sr = 48000, n = sr / 2, wav = new ArrayBuffer(44 + n * 2), v = new DataView(wav);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 20) * 8000, true);
  await A.store.saveSample('rec:filetest', { name: 'Test rec', data: wav });
  S.tl.tracks[15].clips.push({ id: 'c-rec', start: 0, len: 2, sampleId: 'rec:filetest', name: 'Test rec', cat: 'rec', color: 1, bpm: 190, loop: false });
  A.setBpm(173);
  const n0 = count();
  ok(n0 > 10, 'démo chargée', n0);

  // Morceau.
  await A.saveFile('song');
  const songFile = await lastFile();
  const json = JSON.parse(await songFile.text());
  ok(songFile.name.endsWith('.gabber'), 'le morceau est un fichier .gabber', songFile.name);
  eq(json.kind, 'song', 'fichier de type morceau');
  eq(Object.keys(json.samples), ['rec:filetest'], 'seul l\'enregistrement est embarqué (les sons de la bibliothèque sont désignés par leur nom)');
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  A.setBpm(140);
  await A.loadFile(songFile);
  eq(count(), n0, 'morceau rouvert : tous les blocs reviennent');
  eq(S.bpm, 173, 'morceau rouvert : son tempo aussi');

  // Chaque outil : enregistrer, modifier, rouvrir -> identique.
  for (const id of Object.keys(A.TOOL_IO)) {
    const before = JSON.stringify(A.TOOL_IO[id].get());
    await A.saveFile(id);
    const f = await lastFile();
    if (id === 'tr') S.tr.pattern = (S.tr.pattern + 1) % 8;
    if (id === 'acid') S.acid.params.cutoff = 0.99;
    if (id === 'osc') S.osc.preset = 'laser';
    if (id === 'piano') S.preset = 'hoover';
    if (id === 'kick') S.kick.preset = 'custom';
    if (id === 'mix') S.mix.channels.pads.vol = 0.1;
    if (id === 'patch') S.patch.links = [];
    if (id === 'scenes') S.scenes[0] = null;
    await A.loadFile(f);
    eq(JSON.stringify(A.TOOL_IO[id].get()) === before, true, `réglages « ${id} » : enregistrés puis rouverts à l'identique`);
    ok(A.wm.isOpen(id), `réglages « ${id} » : la fenêtre s'ouvre`);
  }
  ok(t.$$('[data-win="tr"] .win-file').length === 2, 'boutons Enregistrer / Ouvrir dans la barre de titre des outils');
  eq(t.$$('[data-win="pads"] .win-file').length, 0, 'pas de boutons de fichier sur la fenêtre des pads');

  // Projet : enregistré, puis rouvert (redémarrage).
  S.tr.pattern = 3;
  await A.saveFile('project');
  const proj = await lastFile();
  const pj = JSON.parse(await proj.text());
  check(pj.kind === 'project', 'le projet est un fichier de type projet', pj.kind);
  check(Object.keys(pj.samples).includes('rec:filetest'), 'le projet embarque l\'enregistrement', Object.keys(pj.samples));
  check(pj.data.bpm === 173, 'le projet garde le tempo', pj.data.bpm);
  await A.store.deleteSample('rec:filetest');
  check(!t.errors.length, 'aucune erreur JavaScript avant le redémarrage', t.errors.slice(0, 3));
  sessionStorage.setItem(KEY, JSON.stringify({ count: count(), checks: first }));
  HTMLAnchorElement.prototype.click = origClick;
  await A.loadFile(proj);   // l'application redémarre : la suite du test se fait au 2e temps
  await new Promise(() => {});
}
