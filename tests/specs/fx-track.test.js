// Effets de piste : chaque effet de la banque agit pendant son bloc et reste transparent après ;
// empilement des blocs, éditeur au double-clic, annulation, onglet Effets de la bibliothèque, lecture, fenêtres.
const rms = (ch, sr, bd, b0, b1) => {
  const a = Math.floor(b0 * bd * sr), b = Math.floor(b1 * bd * sr);
  let s = 0;
  for (let i = a; i < b; i++) s += ch[i] * ch[i];
  return Math.sqrt(s / Math.max(1, b - a));
};

export default async function (t, A) {
  const S = A.state;
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; });
  S.tl.bars = 16;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const pad = find('Supersaw chords');
  await A.tlPlaceItem({ sampleId: 'lib:' + pad.file, name: pad.name, cat: pad.cat, bpm: pad.bpm, loop: true, bars: 4 }, 0, 0);
  const sr = A.engine.ctx.sampleRate, bd = 60 / S.bpm;
  const dry = (await A.renderSong(0))[0];
  const base = { a: rms(dry, sr, bd, 4, 12), b: rms(dry, sr, bd, 12, 16) };
  t.ok(base.a > 0.01 && base.b > 0.01, 'la nappe de référence sonne', base);

  // Chaque effet seul, du temps 4 au temps 12.
  const bad = [], silent = [];
  for (const item of A.fxItems()) {
    S.tl.tracks[0].fx = [];
    A.tlPlaceFx({ ...item, len: 8 }, 0, 4);
    let wet;
    try { wet = (await A.renderSong(0))[0]; } catch (e) { bad.push(`${item.sampleId}: ${e.message}`); continue; }
    let nan = false;
    for (let i = 0; i < wet.length; i += 97) if (!Number.isFinite(wet[i])) { nan = true; break; }
    let diff = 0, n = 0;
    for (let i = Math.floor(4 * bd * sr); i < Math.floor(12 * bd * sr); i += 3) { diff += (wet[i] - dry[i]) ** 2; n++; }
    const change = Math.sqrt(diff / n) / base.a;
    const after = rms(wet, sr, bd, 13, 16) / base.b;
    if (nan) bad.push(`${item.sampleId}: NaN`);
    if (Math.abs(after - 1) > 0.08) bad.push(`${item.sampleId}: après le bloc ${after.toFixed(2)}`);
    if (change < 0.01) silent.push(item.sampleId);
  }
  t.eq(bad, [], 'chaque effet : pas d\'erreur ni de NaN, transparent après son bloc');
  t.eq(silent, [], 'chaque effet change le son pendant son bloc');

  // Empilement, éditeur, annulation.
  S.tl.tracks[0].fx = [];
  const items = A.fxItems();
  const it = id => items.find(i => i.sampleId === 'fx:' + id);
  A.tlPlaceFx(it('fadein'), 0, 0);
  A.tlPlaceFx(it('pcf8'), 0, 4);
  A.tlPlaceFx(it('orbit3d'), 0, 8);
  const lane = t.$$('.tl-lane')[0];
  const blocks = [...lane.querySelectorAll('.tl-fx')];
  t.eq(blocks.length, 3, 'trois blocs d\'effet sur la piste');
  t.eq(blocks.map(b => b.style.top), ['1px', '17px', '1px'], 'les blocs qui se chevauchent passent sur une 2e ligne');
  const pcfObj = blocks.find(b => b.textContent.includes('PCF'))._obj;
  for (let k = 0; k < 2; k++) {   // double-clic réel (la timeline se redessine entre les deux clics)
    t.press(t.$$('.tl-fx').find(x => x._obj === pcfObj), 5, 5);
    await t.wait(60);
  }
  const ed = t.$('#fx-editor');
  t.ok(ed, 'le double-clic ouvre les réglages du bloc');
  t.ok(ed?.querySelector('b').textContent.includes('PCF'), 'réglages du PCF', ed?.querySelector('b').textContent);
  t.ok(ed?.querySelectorAll('.fx-param').length >= 5, 'réglages du PCF affichés');
  const sels = ed.querySelectorAll('select');
  sels[1].value = 'gallop';
  sels[1].dispatchEvent(new Event('change'));
  t.eq(S.tl.tracks[0].fx.find(b => b.fx === 'pcf').p.pattern, 'gallop', 'le motif choisi est appliqué');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const n0 = S.tl.tracks[0].fx.length;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
  await t.wait(50);
  const pcfAfter = S.tl.tracks[0].fx.find(b => b.fx === 'pcf');
  t.ok(S.tl.tracks[0].fx.length < n0 || pcfAfter?.p.pattern !== 'gallop', 'Ctrl+Z annule la dernière action');

  // Onglet Effets de la bibliothèque.
  t.$('#lib-tabs [data-tab="fx"]')?.click();
  await t.wait(50);
  t.ok(t.$$('#lib-list .lib-item').length > 0, 'l\'onglet Effets liste des effets');
  t.$('#lib-tabs [data-tab="sounds"]')?.click();

  // Lecture en direct avec des effets.
  A.timeline.play(0);
  await t.wait(1500);
  t.ok(A.timeline.playing, 'la timeline joue avec ses effets');
  A.timeline.stop();

  // Fenêtres : animation d'ouverture, fenêtre active, fermeture animée.
  A.wm.toggle('acid', true);
  A.wm.toggle('kick', true);
  await t.wait(50);
  const kick = t.$('[data-win="kick"]');
  t.ok(kick.classList.contains('win-in'), 'animation d\'ouverture');
  t.eq(A.wm.active, 'kick', 'la dernière fenêtre ouverte est active');
  t.ok(!t.$('[data-win="acid"]').classList.contains('active'), 'une seule fenêtre active');
  A.wm.toggle('kick', false);
  await t.wait(60);
  t.ok(kick.classList.contains('win-out') && getComputedStyle(kick).display !== 'none', 'fermeture animée');
  await t.wait(400);
  t.ok(getComputedStyle(kick).display === 'none', 'fenêtre fermée après l\'animation');
  t.ok(A.wm.active !== 'kick', 'une autre fenêtre devient active');
}
