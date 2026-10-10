// Édition des blocs : menu contextuel (clic droit), gain, fondus, inverser, transposer, dupliquer, supprimer,
// sélection multiple, annuler ; le rendu (export) suit les réglages.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const pad = find('Breakdown pad');
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; });
  S.sc.on = false;
  S.tl.bars = 2;
  const audio = { id: 'c-a', start: 0, len: 8, sampleId: 'lib:' + pad.file, name: pad.name, cat: pad.cat, color: 1, bpm: pad.bpm || 0, loop: true };
  const notes = { id: 'c-n', type: 'note', seq: [{ t: 0, len: 1, note: 60, vel: 0.8 }, { t: 1, len: 1, note: 64, vel: 0.8 }], pat: 4, len: 4, start: 0, name: 'Notes', cat: 'lead', loop: false };
  S.tl.tracks[0].clips.push(audio);
  S.tl.tracks[1].clips.push(notes);
  await A.loadTlBuffers();
  A.renderTl();
  A.save();   // point de départ de l'historique (Annuler)
  const el = id => t.$$('#tl-grid .tl-clip').find(e => e._obj?.id === id);
  const open = id => el(id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 400 }));
  const menu = () => t.$('.clip-menu');
  const rms = chans => { let s = 0, n = 0; for (const c of chans) for (let i = 0; i < c.length; i += 5) { s += c[i] * c[i]; n++; } return Math.sqrt(s / n); };
  const slice = (chans, a, b) => chans.map(c => c.subarray(Math.floor(a * E.ctx.sampleRate), Math.floor(b * E.ctx.sampleRate)));
  S.tl.tracks[1].mute = true;   // le rendu n'écoute que le bloc audio
  const ref = await A.renderSong();

  // Menu d'un bloc audio.
  open('c-a');
  t.ok(menu(), 'clic droit : menu du bloc');
  t.ok(menu().querySelector('.cm-gain input') && menu().querySelector('select[data-key="fadeIn"]') && menu().querySelector('.cm-check input'), 'gain, fondus et inverser pour un bloc audio');
  t.ok(menu().querySelector('.cm-transpose'), 'transposition d’un son (sans changer sa vitesse)');
  const g = menu().querySelector('.cm-gain input');
  g.value = -12; g.dispatchEvent(new Event('input')); g.dispatchEvent(new Event('change'));
  t.near(audio.gain, Math.pow(10, -12 / 20), 0.002, 'gain −12 dB');
  const quiet = await A.renderSong();
  t.near(rms(quiet) / rms(ref), Math.pow(10, -12 / 20), 0.05, 'le rendu est 12 dB plus bas', rms(quiet) / rms(ref));
  // Annuler : retour au gain d'origine.
  A.closeClipMenu();
  A.tlUndo();
  await t.wait(50);
  const a2 = S.tl.tracks[0].clips[0];
  t.ok(!(a2.gain < 0.9), 'Ctrl+Z annule le gain', a2.gain);

  // Fondu d'entrée de 4 temps : le début est beaucoup plus bas que la suite.
  open('c-a');
  const fi = menu().querySelector('select[data-key="fadeIn"]');
  fi.value = '4'; fi.dispatchEvent(new Event('change'));
  t.eq(S.tl.tracks[0].clips[0].fadeIn, 4, 'fondu d’entrée de 4 temps');
  t.ok(el('c-a').querySelector('canvas'), 'le fondu est dessiné dans le bloc');
  const bd = 60 / S.bpm;
  const faded = await A.renderSong();
  const early = rms(slice(faded, 0, bd * 0.5)), late = rms(slice(faded, bd * 5, bd * 6));
  const earlyRef = rms(slice(ref, 0, bd * 0.5));
  t.ok(early < earlyRef * 0.4 && late > early * 2, 'le rendu monte pendant le fondu', [early, earlyRef, late]);
  const fo = menu().querySelector('select[data-key="fadeOut"]');
  fo.value = '2'; fo.dispatchEvent(new Event('change'));
  t.eq(S.tl.tracks[0].clips[0].fadeOut, 2, 'fondu de sortie de 2 temps');

  // Inverser.
  const rev = menu().querySelector('.cm-check input');
  rev.checked = true; rev.dispatchEvent(new Event('change'));
  t.ok(S.tl.tracks[0].clips[0].reverse, 'bloc inversé');
  const back = await A.renderSong();
  let diff = 0; for (let i = 0; i < back[0].length; i += 97) diff += Math.abs(back[0][i] - faded[0][i]);
  t.ok(diff > 1, 'le rendu inversé est différent', diff);
  A.closeClipMenu();

  // Bloc de notes : transposer d'une octave.
  open('c-n');
  t.ok(menu().querySelector('.cm-transpose') && !menu().querySelector('select[data-key="fadeIn"]'), 'transposer pour un bloc de notes');
  [...menu().querySelectorAll('.cm-transpose button')].find(b => b.textContent === '+12').click();
  t.eq(S.tl.tracks[1].clips[0].seq.map(n => n.note), [72, 76], 'notes montées d’une octave');
  A.closeClipMenu();

  // Dupliquer à la suite.
  open('c-n');
  [...menu().querySelectorAll('.cm-item')].find(b => b.dataset.icon === 'plus').click();
  t.eq(S.tl.tracks[1].clips.map(c => c.start), [0, 4], 'copie posée juste après');
  t.ok(S.tl.tracks[1].clips[1].id !== 'c-n', 'avec son propre identifiant');

  // Sélection multiple : le gain s'applique aux deux blocs.
  A.tlSelect(1, S.tl.tracks[1].clips[0]);
  A.tlPicked.add(S.tl.tracks[1].clips[1]);
  A.renderTl();
  open('c-n');
  t.ok(/2/.test(menu().querySelector('.cm-head').textContent), 'menu de la sélection (2 blocs)');
  const g2 = menu().querySelector('.cm-gain input');
  g2.value = -6; g2.dispatchEvent(new Event('input')); g2.dispatchEvent(new Event('change'));
  t.ok(S.tl.tracks[1].clips.every(c => Math.abs(c.gain - Math.pow(10, -6 / 20)) < 0.002), 'gain appliqué à toute la sélection');
  // Supprimer.
  menu().querySelector('.cm-danger').click();
  t.eq(S.tl.tracks[1].clips.length, 0, 'Supprimer retire toute la sélection');
  t.ok(!menu(), 'le menu se ferme');
}
