// Horloge MIDI (appareil simulé) : envoi (position + Start ou Continue, 24 impulsions par temps, Stop) et suivi d'une
// horloge reçue (tempo, Start, Stop).
export default async function (t, A) {
  const S = A.state, hub = A.midiHub, E = A.engine;
  const box = { name: 'Drum box', sent: [], send(d) { this.sent.push([...d]); }, open: () => Promise.resolve() };
  hub.outputs = [box];
  hub.inputs = [{ name: 'Drum box' }];
  hub.emit('connection', { inputs: ['Drum box'], outputs: ['Drum box'] });
  A.wm.toggle('monitor', true);
  const out = t.$('#midi-learn .clock-out'), inp = t.$('#midi-learn .clock-in');
  t.ok([...out.options].some(o => o.value === 'Drum box'), 'la sortie est proposée pour l’horloge');
  out.value = 'Drum box'; out.dispatchEvent(new Event('change'));
  t.eq(S.midiClock.out, 'Drum box', 'horloge envoyée vers l’appareil');

  // Lecture depuis le début : position 0, Start, puis les impulsions.
  S.tl.playhead = 0;
  t.$('#tl-play').click();
  await t.wait(1000);
  t.$('#tl-play').click();
  const types = box.sent.map(m => m[0]);
  t.eq(box.sent.slice(0, 2), [[0xf2, 0, 0], [0xfa]], 'au départ : position 0 puis Start');
  const ticks = types.filter(x => x === 0xf8).length, perSec = 24 * E.bpm / 60;
  t.ok(ticks > perSec * 0.8 && ticks < perSec * 1.5, '24 impulsions par temps', [ticks, perSec]);
  t.eq(types[types.length - 1], 0xfc, 'à l’arrêt : Stop');

  // Reprise au temps 16 : position 64 (doubles croches) puis Continue.
  box.sent = [];
  S.tl.playhead = 16;
  t.$('#tl-play').click();
  await t.wait(100);
  t.$('#tl-play').click();
  t.eq(box.sent.slice(0, 2), [[0xf2, 64, 0], [0xfb]], 'reprise : position puis Continue');
  out.value = ''; out.dispatchEvent(new Event('change'));

  // Suivre une horloge reçue à 150 BPM.
  inp.value = 'Drum box'; inp.dispatchEvent(new Event('change'));
  const step = 60000 / (150 * 24);
  let ms = performance.now();
  for (let i = 0; i < 60; i++) { hub.onMessage('Drum box', new Uint8Array([0xf8]), ms); ms += step; }
  t.near(S.bpm, 150, 0.5, 'tempo suivi depuis l’horloge reçue', S.bpm);
  hub.onMessage('Drum box', new Uint8Array([0xfa]), ms);
  t.ok(A.timeline.playing && S.tl.playhead === 0, 'Start reçu : la timeline démarre au début');
  hub.onMessage('Drum box', new Uint8Array([0xfc]), ms);
  t.ok(!A.timeline.playing, 'Stop reçu : elle s’arrête');
  // Une autre entrée n'est pas suivie.
  for (let i = 0; i < 60; i++) { hub.onMessage('Other', new Uint8Array([0xf8]), ms); ms += 60000 / (120 * 24); }
  t.near(S.bpm, 150, 0.5, 'une autre entrée n’est pas suivie');
  t.eq(A.stateSnapshot().midiClock, { out: '', in: 'Drum box' }, 'réglage enregistré avec le projet');
}
