// Automation : bouton A, ligne sous la piste, points (clic, glisser, clic droit), le rendu suit la courbe de volume,
// pendant la lecture le réglage suit la courbe puis revient au potentiomètre à l'arrêt, Effacer, annuler.
export default async function (t, A) {
  const S = A.state, E = A.engine, TL = A.timeline;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const pad = find('Breakdown pad');
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; tr.auto = {}; tr.autoOpen = false; });
  S.sc.on = false;
  S.tl.bars = 4;
  S.tl.tracks[0].clips.push({ id: 'c-p', start: 0, len: 16, sampleId: 'lib:' + pad.file, name: pad.name, cat: pad.cat, color: 1, bpm: pad.bpm || 0, loop: true });
  await A.loadTlBuffers();
  A.renderTl();
  A.save();
  t.eq(A.mergeTlState({ tracks: [{ clips: [] }] }).tracks[0].auto, {}, 'une ancienne sauvegarde n’a pas d’automation');

  // Bouton A : la ligne s'ouvre sous la piste.
  const head = () => t.$$('#tl-grid .tl-head')[0];
  head().querySelector('.tl-auto').click();
  const lane = () => t.$$('#tl-grid .tl-lane')[0].querySelector('.tl-autolane');
  t.ok(S.tl.tracks[0].autoOpen && lane(), 'bouton A : ligne d’automation ouverte');
  t.ok(!head().querySelector('.tl-auto-ctl').hidden, 'choix du réglage dans l’en-tête');
  t.eq(S.tl.tracks[0].autoParam, 'vol', 'volume par défaut');

  // Deux points : silence au début, plein volume au temps 8.
  const r = () => lane().getBoundingClientRect();
  const down = (beat, v, opts = {}) => {
    const x = r().left + beat * A.beatPx(), y = r().top + 4 + (1 - v) * (A.AUTO_H - 8);
    lane().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: opts.button ?? 0, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  };
  down(0, 0);
  down(8, 2 / 3);   // 2/3 de 1,5 = volume 100 %
  const pts = () => S.tl.tracks[0].auto.vol ?? [];
  t.eq(pts().map(p => p.b), [0, 8], 'deux points posés (calés au quart de temps)');
  t.near(A.autoValue('vol', pts()[1].v), 1, 0.03, 'le second à 100 %');
  t.eq(lane().querySelectorAll('.auto-pt').length, 2, 'points dessinés');
  t.ok(head().querySelector('.tl-auto').classList.contains('active'), 'le bouton A s’allume');

  // Le rendu suit la courbe : début presque muet, fin forte.
  const ch = await A.renderSong();
  const sr = E.ctx.sampleRate, bd = 60 / S.bpm;
  const rms = (a, b) => { let s = 0, n = 0; for (const c of ch) for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i += 4) { s += c[i] * c[i]; n++; } return Math.sqrt(s / n); };
  const start = rms(0, bd), end = rms(9 * bd, 12 * bd);
  t.ok(start < end * 0.25 && end > 0.01, 'export : le volume monte avec la courbe', [start, end]);

  // Pendant la lecture, le réglage suit la courbe ; à l'arrêt, il revient au potentiomètre.
  S.tl.tracks[0].vol = 0.5;
  S.tl.playhead = 0;
  t.$('#tl-play').click();
  await t.wait(400 + bd * 2 * 1000);
  const s0 = [...TL.strips.get(0).values()][0];
  const live = s0.gain.gain.value, want = A.autoValue('vol', A.autoAt(pts(), TL.position()));
  t.near(live, want, 0.15, 'en lecture, le volume suit la courbe (pas le potentiomètre)', [live, want]);
  t.$('#tl-play').click();
  await t.wait(200);
  t.near(s0.gain.gain.value, 0.5, 0.02, 'à l’arrêt, le volume revient au potentiomètre');

  // Clic droit sur un point : supprimé.
  const c = lane().querySelectorAll('.auto-pt')[1];
  c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, clientX: c.getBoundingClientRect().left + 3, clientY: c.getBoundingClientRect().top + 3 }));
  t.eq(pts().length, 1, 'clic droit : point supprimé');
  // Annuler : il revient.
  A.tlUndo();
  await t.wait(50);
  t.eq((S.tl.tracks[0].auto.vol ?? []).length, 2, 'Ctrl+Z : le point revient');

  // Autre réglage : passe-bas, courbe vide ; Effacer retire la courbe du volume.
  const sel = head().querySelector('.tl-auto-ctl select');
  sel.value = 'lp'; sel.dispatchEvent(new Event('change'));
  t.ok(/passe-bas|low-pass/i.test(lane().textContent), 'la ligne montre le passe-bas', lane().textContent);
  sel.value = 'vol'; sel.dispatchEvent(new Event('change'));
  head().querySelector('.tl-auto-ctl button').click();
  t.ok(!S.tl.tracks[0].auto.vol, 'Effacer : plus de courbe de volume');
}
