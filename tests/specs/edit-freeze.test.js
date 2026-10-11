// Geler une piste / la rendre en audio (js/app/freeze.js) : le son gelé contient les blocs, inserts et filtres de la piste
// (pas les autres pistes), le volume reste en direct, la lecture joue le son gelé à la place des blocs (kicks compris),
// blocs verrouillés, badge, dégeler, annuler, sauvegarde, export inchangé, lanceur ; rendre en audio (piste, sélection).
export default async function (t, A) {
  const S = A.state, E = A.engine, sr = E.ctx.sampleRate;
  const pads = A.libManifest.banks.flatMap(b => b.pads).filter(Boolean);
  const beat = pads.find(p => p.name === 'Mainstream beat');
  const other = pads.find(p => p.mode === 2 && p.file !== beat.file && p.bpm);
  const clipOf = (p, id, start, len) => ({ id, start, len, sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, color: 1, bpm: p.bpm || 0, loop: true });
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; tr.arm = false; tr.frozen = false; });
  S.sc.on = false;
  S.tl.bars = 4;
  S.tl.loop = true;
  const tr0 = S.tl.tracks[0];
  const audio = { ...clipOf(beat, 'f-a', 0, 8), kickBeats: [0, 1, 2, 3] };
  tr0.clips.push(audio);
  tr0.inserts.push(A.newFx('dist'));
  tr0.lp = 3000;
  S.tl.tracks[1].clips.push(clipOf(other, 'f-b', 0, 8));
  await A.loadTlBuffers();
  A.renderTl();
  A.save();
  // Écart relatif entre deux rendus (deux rendus hors temps réel du même son diffèrent de quelques 1e-4 au plus).
  const maxDiff = (a, b, n = Math.min(a.length, b.length)) => { let d = 0, r = 0; for (let i = 0; i < n; i++) { d += (a[i] - b[i]) ** 2; r += a[i] ** 2; } return Math.sqrt(d / r); };
  const rms = x => { let s = 0; for (let i = 0; i < x.length; i += 3) s += x[i] * x[i]; return Math.sqrt(s / (x.length / 3)); };
  const refMix = await A.renderSong();

  // Geler : le son est rendu, la piste est marquée, le badge et les blocs grisés apparaissent.
  await A.freezeTrack(0);
  t.ok(tr0.frozen, 'la piste est gelée');
  const frozen = A.frozenFor(0)?.buf;
  t.ok(frozen && frozen.numberOfChannels === 2, 'son gelé prêt (stéréo)');
  const dur = 8 * 60 / S.bpm;
  t.ok(frozen.duration > dur - 0.05 && frozen.duration <= dur + 3.05, 'il dure jusqu’à la fin des blocs de la piste (plus la queue)', frozen.duration);
  t.ok(rms(frozen.getChannelData(0)) > 0.01, 'il n’est pas silencieux', rms(frozen.getChannelData(0)));
  const head = t.$$('#tl-grid .tl-head')[0], lane = t.$$('#tl-grid .tl-lane')[0];
  t.ok(!head.querySelector('.tl-frozen').hidden && head.classList.contains('frozen'), 'badge « gelée » dans l’en-tête');
  t.ok(lane.classList.contains('frozen'), 'blocs grisés et verrouillés');

  // Ce qui est figé dans le son : les autres pistes n'y sont pas ; volume / pano restent en direct, filtres et inserts non.
  const keep1 = S.tl.tracks[1].clips;
  S.tl.tracks[1].clips = [];
  const alone = await A.renderSong(0, { freeze: true });
  S.tl.tracks[1].clips = keep1;
  t.ok(maxDiff(frozen.getChannelData(0), alone[0]) < 1e-3, 'le son gelé ne contient que sa piste', maxDiff(frozen.getChannelData(0), alone[0]));
  const key = A.freezeKey(tr0);
  tr0.vol = 0.5; tr0.pan = -0.3; tr0.rev = 0.2;
  t.eq(A.freezeKey(tr0), key, 'volume, pano, envois : le son gelé reste valable (réglés en direct)');
  const loud = await A.renderSong(0, { freeze: true });
  t.ok(maxDiff(loud[0], alone[0]) < 1e-3, 'le rendu gelé ne dépend pas du volume de la piste');
  tr0.lp = 1000;
  t.ok(A.freezeKey(tr0) !== key, 'filtre changé : le son gelé est à refaire');
  t.eq(A.frozenFor(0), null, 'en attendant, la piste joue en direct');
  tr0.lp = 3000;
  Object.assign(tr0, { vol: 1, pan: 0, rev: 0 });
  t.ok(A.frozenFor(0)?.buf === frozen, 'filtre remis : le même son gelé resservit');
  // Comparé au stem (même piste, réglages neutres) : le même son, à la chaîne du master près.
  const stem = await A.renderSong(0);
  let xy = 0, xx = 0, yy = 0;
  for (let i = 0; i < Math.min(stem[0].length, frozen.length); i += 2) { const x = stem[0][i], y = frozen.getChannelData(0)[i]; xy += x * y; xx += x * x; yy += y * y; }
  t.ok(xy / Math.sqrt(xx * yy) > 0.9, 'le son gelé ressemble au stem de la piste', xy / Math.sqrt(xx * yy));

  // L'export rejoue les blocs : le mixage est le même qu'avant le gel.
  const mix = await A.renderSong();
  t.ok(maxDiff(mix[0], refMix[0]) < 1e-3, 'export : même mixage avec la piste gelée', maxDiff(mix[0], refMix[0]));

  // Lecture : le son gelé joue à la place des blocs, par une tranche sans inserts (volume en direct), kicks compris.
  const kicks = [];
  const onKick = A.timeline.onKick;
  A.timeline.onKick = (time, ti) => { kicks.push(ti); onKick(time, ti); };
  A.timeline.play(0);
  await t.wait(400);
  const bufs = A.timeline.sources.map(s => s.src.buffer);
  t.ok(bufs.includes(frozen), 'la lecture joue le son gelé', bufs.length);
  t.ok(!bufs.includes(A.clipBuffer(audio.sampleId)), 'les blocs de la piste gelée ne jouent pas');
  t.ok(bufs.includes(A.clipBuffer('lib:' + other.file)), 'les autres pistes jouent en direct');
  t.ok(kicks.filter(k => k === 0).length >= 1, 'les kicks de la piste gelée pompent toujours le sidechain', kicks);
  const strip = A.timeline.strips.get(0)?.get(E.master);
  t.ok(strip?.bare && strip.inserts.length === 0, 'tranche de la piste gelée : sans inserts (ils sont dans le son)');
  const level = t.meter(strip.mute);
  await t.wait(200);
  t.ok(level() > 0.01, 'le son gelé sort de la tranche', level());
  tr0.vol = 0;
  A.timeline.updateTrack(0);
  await t.wait(300);
  t.ok(level() < 0.002, 'le volume de la piste agit en direct sur le son gelé', level());
  tr0.vol = 1;
  A.timeline.updateTrack(0);
  A.timeline.onKick = onKick;

  // Blocs verrouillés : rien ne se pose, rien ne se supprime.
  await A.tlPlaceItem({ sampleId: 'lib:' + other.file, name: other.name, cat: other.cat, bpm: other.bpm, loop: true }, 0, 8);
  t.eq(tr0.clips.length, 1, 'rien ne se pose sur une piste gelée');
  A.tlPicked.add(audio);
  A.tlDeletePicked();
  t.eq(tr0.clips.length, 1, 'ses blocs ne se suppriment pas');

  // Dégeler : les blocs rejouent en direct (la lecture reprend au même endroit).
  A.unfreezeTrack(0);
  await t.wait(400);
  const live = A.timeline.sources.map(s => s.src.buffer);
  t.ok(!tr0.frozen && live.includes(A.clipBuffer(audio.sampleId)) && !live.includes(frozen), 'dégelée : les blocs rejouent');
  A.timeline.stop();

  // Annuler, sauvegarde.
  await A.freezeTrack(0);
  A.tlUndo();
  await t.wait(50);
  t.ok(!S.tl.tracks[0].frozen, 'Ctrl+Z dégèle');
  A.tlRedo();
  await t.wait(50);
  t.ok(S.tl.tracks[0].frozen && A.frozenFor(0)?.buf, 'Ctrl+Y regèle, sans refaire le rendu');
  t.ok(A.cleanTrack({ frozen: true }).frozen && !A.cleanTrack({}).frozen, 'l’état « gelée » est enregistré');
  t.ok(A.mergeTlState({ tracks: S.tl.tracks }).tracks[0].frozen, 'et rechargé avec le projet');

  // Lanceur : un clip de la piste gelée joue en direct.
  A.setSlot(0, 0, S.tl.tracks[0].clips[0]);
  await A.launch(0, 0);
  t.ok(await t.until(() => A.lnPlaying(0) === 0, 3000), 'lanceur : le clip d’une piste gelée se lance');
  A.haltLauncher();
  A.setSlot(0, 0, null);

  // Menu de la piste (clic droit sur l'en-tête).
  t.$$('#tl-grid .tl-head')[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
  await t.wait(30);
  const items = t.$$('.track-menu .cm-item').map(b => b.textContent);
  t.ok(items.length >= 3 && items.some(x => /dégeler|unfreeze/i.test(x)) && items.some(x => /audio/i.test(x)), 'menu de la piste : dégeler, refaire, rendre en audio', items);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t.ok(!t.$('.track-menu'), 'Échap ferme le menu');

  // Rendre en audio : un bloc audio sur une piste libre, piste d'origine muette ; même son que le gel (table neutre).
  const T0 = S.tl.tracks[0];   // (« Annuler » a remplacé les objets des pistes)
  T0.frozen = false;
  T0.vol = 0.8;
  const n = S.tl.tracks.length;
  const res = await A.bounceTrack(0);
  t.ok(res && res.track === 2, 'bloc audio posé sur la première piste libre', res?.track);
  const dst = S.tl.tracks[res.track], bc = res.clip;
  t.ok(S.tl.tracks[0].mute, 'la piste d’origine est muette');
  t.ok(bc.sampleId.startsWith('rec:') && A.clipBuffer(bc.sampleId), 'son rangé comme un enregistrement');
  t.eq([bc.start, dst.vol, dst.clips.length, S.tl.tracks.length], [0, 0.8, 1, n], 'au même endroit, avec le volume de la piste');
  t.ok(/audio/.test(dst.name), 'piste nommée d’après l’originale', dst.name);
  t.eq(bc.kickBeats?.slice(0, 4), [0, 1, 2, 3], 'les kicks de la piste suivent le bloc audio (sidechain)');
  const bb = A.clipBuffer(bc.sampleId).getChannelData(0);
  t.ok(maxDiff(bb, frozen.getChannelData(0)) < 1e-3, 'même son que la piste (table de mixage neutre)', maxDiff(bb, frozen.getChannelData(0)));
  A.tlUndo();
  await t.wait(50);
  t.ok(!S.tl.tracks[0].mute && !S.tl.tracks[2].clips.length, 'Ctrl+Z annule le rendu en audio');

  // Rendre la sélection en audio : les blocs choisis deviennent un bloc audio, ils sont retirés de leur piste.
  const t3 = S.tl.tracks[3];
  t3.clips.push(clipOf(other, 'f-c', 0, 4), clipOf(other, 'f-d', 8, 4));
  A.renderTl();
  const sel = await A.bounceTrack(3, new Set(['f-d']));
  t.ok(sel && sel.clip.start === 8, 'le bloc audio commence avec la sélection', sel?.clip.start);
  t.eq(t3.clips.map(c => c.id), ['f-c'], 'le bloc rendu est retiré, l’autre reste');
  t.ok(!t3.mute, 'la piste n’est pas rendue muette');
}
