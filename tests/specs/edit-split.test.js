// Couper un bloc : un son coupé en deux sonne exactement pareil (la seconde moitié continue dans le son), un bloc de
// notes garde ses notes de chaque côté, les fondus restent aux bons bouts, menu « Couper ici », Ctrl+E, annuler.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat');
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; tr.arm = false; });
  S.sc.on = false;
  S.tl.bars = 2;
  const audio = { id: 'c-a', start: 0, len: 8, sampleId: 'lib:' + beat.file, name: beat.name, cat: beat.cat, color: 1, bpm: beat.bpm || 0, loop: true, fadeIn: 1, fadeOut: 1 };
  S.tl.tracks[0].clips.push(audio);
  await A.loadTlBuffers();
  A.renderTl();
  A.save();
  const ref = await A.renderSong();

  // Couper le son au temps 3 (en plein milieu de sa première mesure).
  const second = A.splitClip(0, audio, 3);
  A.renderTl();
  const [a, b] = S.tl.tracks[0].clips;
  t.ok(second && b === second, 'deux blocs');
  t.eq([a.start, a.len, b.start, b.len, b.offset], [0, 3, 3, 5, 3], 'le second commence 3 temps plus loin dans le son');
  t.ok(a.fadeIn === 1 && !a.fadeOut && b.fadeOut === 1 && !b.fadeIn, 'fondu d’entrée sur le premier, de sortie sur le second');
  const cut = await A.renderSong();
  // Même son, à l'arrêt anti-clic près (quelques millisecondes à la coupe).
  let d = 0, r = 0;
  for (let i = 0; i < ref[0].length; i += 3) { d += (cut[0][i] - ref[0][i]) ** 2; r += ref[0][i] ** 2; }
  t.ok(Math.sqrt(d / r) < 0.12, 'coupé en deux, le son est le même', Math.sqrt(d / r));

  // Annuler : un seul bloc à nouveau.
  A.save();
  A.tlUndo();
  await t.wait(50);
  t.eq(S.tl.tracks[0].clips.length, 1, 'Ctrl+Z recolle le bloc');

  // Menu « Couper ici » (clic droit au temps 4).
  A.renderTl();
  const el = t.$$('#tl-grid .tl-clip').find(e => e._obj?.id === 'c-a');
  const lane = el.closest('.tl-lane').getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: lane.left + 4 * A.beatPx() + 2, clientY: lane.top + 10 }));
  const here = [...t.$$('.clip-menu .cm-item')].find(x => /ici|here/i.test(x.textContent));
  t.ok(here, 'menu : Couper ici');
  here.click();
  t.eq(S.tl.tracks[0].clips.map(c => [c.start, c.len]), [[0, 4], [4, 4]], 'coupé au temps 4 (à l’endroit du clic)');

  // Bloc de notes : les notes de chaque côté.
  const notes = { id: 'c-n', type: 'note', seq: [0, 1, 2, 3].map(i => ({ t: i, len: 0.5, note: 60 + i, vel: 0.8 })), pat: 4, len: 4, start: 8, name: 'N', cat: 'lead', loop: false };
  S.tl.tracks[1].clips.push(notes);
  A.splitClip(1, notes, 10);
  const [n1, n2] = S.tl.tracks[1].clips;
  t.eq(n1.len, 2, 'première moitié de 2 temps');
  t.eq(A.clipEvents(n1).map(e => e.note), [60, 61], 'ses deux premières notes');
  t.eq([n2.start, n2.len, n2.seq.map(n => [n.t, n.note])], [10, 2, [[0, 62], [1, 63]]], 'la seconde reprend à 0 avec les deux suivantes');
  t.ok(!A.canSplit({ type: 'pad', start: 0, len: 1 }, 0.5), 'un coup de pad ne se coupe pas');

  // Ctrl+E : coupe la sélection à la tête de lecture.
  A.tlSelect(0, S.tl.tracks[0].clips[1]);
  S.tl.playhead = 6;
  A.setTlFocus(true);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));
  await t.wait(30);
  t.eq(S.tl.tracks[0].clips.map(c => [c.start, c.len]).sort((x, y) => x[0] - y[0]), [[0, 4], [4, 2], [6, 2]], 'Ctrl+E coupe à la tête de lecture');
  A.setTlFocus(false);
}
