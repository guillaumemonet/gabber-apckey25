// Designer de montée (js/buildup.js, js/app/buildup-ui.js) : roulement qui se resserre, éléments calculés à la bonne
// durée (riser qui monte, sub qui tombe), fenêtre, Générer (blocs audio avant le drop, filtre qui monte et silence sur
// les pistes qui jouent), pas de place avant le drop, sauvegarde, annuler.
export default async function (t, A) {
  const S = A.state, sr = A.engine.ctx.sampleRate;
  const rms = (d, a, b) => { let s = 0; const i0 = Math.round(a * sr), i1 = Math.round(b * sr); for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };

  // Roulement : noires, croches, doubles, triples croches (un quart de la montée chacun).
  const hits = A.rollHits(64, 4);
  const gaps = q => { const h = hits.filter(x => x >= q * 16 && x < (q + 1) * 16); return h[1] - h[0]; };
  t.eq([gaps(0), gaps(1), gaps(2), gaps(3)], [4, 2, 1, 0.5], 'roulement : noires, croches, doubles, triples croches');

  // Éléments : à la bonne durée, le riser monte, le sub tombe.
  S.bpm = 180;
  const bd = 60 / 180;
  const opts = { ...A.defaultBuildup(), bars: 4, gap: 1, kickroll: true };
  const parts = await A.buildupParts(opts, 180, sr, await A.synthKick(S.kick.params, sr));
  t.eq(parts.map(p => p.id), ['noise', 'tone', 'snare', 'kickroll', 'sub', 'impact'], 'tous les éléments');
  const noise = parts[0].buffer.getChannelData(0), sec = 15 * bd;
  t.near(parts[0].buffer.duration, sec, 0.01, 'la montée s’arrête au silence d’avant le drop (16 temps − 1)');
  t.ok(rms(noise, sec * 0.85, sec * 0.95) > rms(noise, 0.05, 0.5) * 4, 'riser : il monte');
  t.ok(parts[0].start === -16 && parts[4].start === 0, 'la montée avant le drop, le sub sur le drop');
  const sub = parts[4].buffer.getChannelData(0);
  const zc = (d, a, b) => { let n = 0; for (let i = Math.round(a * sr) + 1; i < Math.round(b * sr); i++) if (d[i - 1] < 0 && d[i] >= 0) n++; return n / (b - a); };
  t.ok(zc(sub, 0, 0.2) > zc(sub, 0.9, 1.2) * 1.5, 'sub drop : il tombe', [zc(sub, 0, 0.2), zc(sub, 0.9, 1.2)]);

  // Fenêtre.
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat');
  S.tl.tracks[0] = A.cleanTrack({ ...S.tl.tracks[0], clips: [{ id: 'b', start: 0, len: 32, sampleId: 'lib:' + beat.file, name: 'Beat', cat: beat.cat, color: 1, bpm: beat.bpm || 0, loop: true }] });
  S.tl.armed = 1;
  A.wm.toggle('buildup', true);
  await t.wait(30);
  S.tl.playhead = 8;
  Object.assign(S.buildup, { bars: 4 });
  A.renderBuildup();
  t.ok(/4|5/.test(t.$('#buildup .bu-where').textContent) && /place|room/i.test(t.$('#buildup .bu-where').textContent), 'drop mesure 3 : pas assez de place pour 4 mesures', t.$('#buildup .bu-where').textContent);
  S.tl.playhead = 24;   // drop sur la mesure 7
  A.renderBuildup();
  A.save();
  const res = await A.generateBuildup();
  t.ok(res && res.tracks.length === 5, 'Générer : un bloc par élément (sans roulement de kick)', res?.tracks);
  const blocks = S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.cat === 'fx');
  t.ok(blocks.some(c => c.start === 8 && c.sampleId.startsWith('rec:')) && blocks.some(c => c.start === 24), 'montée à partir de la mesure 3, sub et impact sur le drop', blocks.map(c => c.start));
  const fx = S.tl.tracks[0].fx.map(f => [f.fx, f.start, f.len]);
  t.eq(fx, [['hprise', 8, 15], ['mute', 23, 1]], 'piste qui joue : filtre qui monte, un temps de silence avant le drop');
  t.ok(JSON.parse(JSON.stringify(A.stateSnapshot().buildup)).bars === 4, 'réglages enregistrés avec le projet');
  t.eq(A.mergeBuildup({ bars: 3, gap: 9, noiseLevel: 5 }).noiseLevel, 1, 'valeurs ramenées dans leurs bornes');
  A.tlUndo();
  await t.wait(30);
  t.ok(!S.tl.tracks.flatMap(tr => tr.clips).some(c => c.cat === 'fx') && !S.tl.tracks[0].fx.length, 'Ctrl+Z : la montée disparaît');
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  A.wm.toggle('buildup', false);
}
