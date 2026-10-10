// Claviers MIDI autres que l'APC (simulés) : les notes jouent le synthé, la pédale tient les notes ; MIDI learn d'un
// potentiomètre (K1 de la page active), d'un fader du mixeur, d'un bouton (lecture) ; une note assignée ne joue plus ;
// retrait, sauvegarde, anciennes sauvegardes.
export default async function (t, A) {
  const S = A.state, E = A.engine, hub = A.midiHub;
  const dev = 'Oxygen 49';
  const send = (...bytes) => hub.onMessage(dev, new Uint8Array(bytes));
  hub.inputs = [{ name: dev }];
  hub.emit('connection', { inputs: [dev] });
  A.wm.toggle('monitor', true);
  t.ok(/Oxygen 49/.test(t.$('#midi-learn .midi-devices').textContent), 'l’appareil est listé dans la fenêtre MIDI');
  t.ok(t.$$('#midi-learn .learn-row').length >= 20, 'cibles du MIDI learn');
  t.eq(A.cleanMidiMap(undefined), [], 'ancienne sauvegarde : aucune assignation');

  // Notes : le synthé joue (comme le clavier de l'APC).
  A.setKeys('synth');
  send(0x90, 60, 100);
  t.ok(E.voices.size > 0, 'une touche du clavier MIDI joue le synthé');
  send(0x80, 60, 0);
  await t.wait(50);
  // Pédale : la note reste tenue après relâchement.
  send(0xb0, 64, 127);
  send(0x90, 64, 100);
  send(0x80, 64, 0);
  t.ok(E.sustain && E.voices.size > 0, 'pédale enfoncée : la note reste tenue');
  send(0xb0, 64, 0);
  await t.wait(50);
  t.ok(!E.sustain, 'pédale relâchée');

  // MIDI learn : K1 de la page active <- CC 21.
  const row = id => t.$(`#midi-learn .learn-row[data-target="${id}"]`);
  row('knob:0').querySelector('.learn-btn').click();
  t.ok(hub.learning && row('knob:0').classList.contains('learning'), 'apprentissage en cours');
  send(0xb0, 21, 10);
  t.eq(S.midiMap.map(m => [m.port, m.kind, m.n, m.target]), [[dev, 'cc', 21, 'knob:0']], 'CC 21 assigné à K1');
  t.ok(!hub.learning && /CC 21/.test(row('knob:0').textContent), 'assignation affichée');
  A.setPage('synth');
  const def = A.knobDefs('synth')[0];
  send(0xb0, 21, 127);
  t.near(S.globals[def.id], 1, 0.01, 'le potentiomètre de l’appareil règle K1 de la page Synthé');
  send(0xb0, 21, 0);
  t.near(S.globals[def.id], 0, 0.01, 'dans les deux sens');

  // Fader du mixeur <- CC 7.
  row('mix:pads').querySelector('.learn-btn').click();
  send(0xb0, 7, 90);
  send(0xb0, 7, 64);
  t.near(S.mix.channels.pads.vol, 64 / 127, 0.01, 'fader des pads piloté par le CC 7');

  // Bouton lecture <- note 36 (pad de l'appareil) : elle ne joue plus de note.
  row('play').querySelector('.learn-btn').click();
  send(0x90, 36, 100);
  send(0x80, 36, 0);
  t.eq(S.midiMap.find(m => m.target === 'play')?.n, 36, 'note 36 assignée à la lecture');
  E.allNotesOff();
  send(0x90, 36, 100);
  t.ok(A.timeline.playing, 'appui : la timeline démarre');
  t.eq(E.voices.size, 0, 'la note assignée ne joue pas le synthé');
  send(0x80, 36, 0);
  send(0x90, 36, 100);
  send(0x80, 36, 0);
  t.ok(!A.timeline.playing, 'nouvel appui : elle s’arrête');

  // Réassigner le même CC à une autre cible le retire de la première ; corbeille.
  row('master').querySelector('.learn-btn').click();
  send(0xb0, 7, 50);
  t.ok(!S.midiMap.some(m => m.target === 'mix:pads') && S.midiMap.some(m => m.target === 'master'), 'un CC ne pilote qu’une cible');
  row('master').querySelector('button[data-icon="trash"]').click();
  t.ok(!S.midiMap.some(m => m.target === 'master'), 'corbeille : assignation retirée');
  // Échap annule un apprentissage.
  row('rec').querySelector('.learn-btn').click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  t.ok(!hub.learning, 'Échap annule l’apprentissage');
  t.ok(A.stateSnapshot().midiMap.length === 2, 'assignations enregistrées avec le projet', A.stateSnapshot().midiMap);
}
