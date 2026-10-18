// Appareils branchés (js/app/devices.js) : indicateur de l'en-tête (nombre d'appareils), liste au clic, instrument
// associé à chaque appareil (ses notes le jouent, ses potentiomètres pilotent sa page), APC associé à un instrument
// (sa page ne suit plus la fenêtre active), sauvegarde, anciennes sauvegardes.
export default async function (t, A) {
  const S = A.state, E = A.engine, hub = A.midiHub;
  const dev = 'Fake Keys 61';
  const send = (...bytes) => hub.onMessage(dev, new Uint8Array(bytes));
  hub.inputs = [{ name: dev, id: 'fk' }];
  hub.emit('connection', { inputs: [dev] });
  t.ok(/1/.test(t.$('#status-text').textContent) && t.$('#status').classList.contains('on'), 'en-tête : 1 appareil branché', t.$('#status-text').textContent);
  t.ok(!t.$('header #apc-page'), 'plus de sélecteur de page dans l’en-tête');
  t.eq(A.cleanDevices({ x: { inst: 'nope' }, y: { inst: 'osc' } }), { y: { inst: 'osc' } }, 'associations invalides écartées');
  t.eq(A.deviceInst(dev), 'auto', 'par défaut : suit la fenêtre active');

  // Liste au clic.
  t.$('#status').click();
  await t.wait(30);
  const row = () => t.$(`.dev-panel .dev-row[data-id="${dev}"]`);
  t.ok(row() && row().querySelector('.dev-inst').value === 'auto', 'liste : l’appareil et son instrument');
  t.ok(t.$('.dev-panel .dev-foot') && t.$$('.dev-panel .dev-foot button').length === 2, 'Reconnecter et Paramètres');
  send(0x90, 61, 100);
  t.ok(row().querySelector('.dev-led').classList.contains('on'), 'la LED de l’appareil s’allume quand il envoie');
  send(0x80, 61, 0);

  // Fenêtre active : comme avant (le synthé de la fenêtre active).
  A.setKeys('synth');
  send(0x90, 60, 100);
  t.ok(E.voices.size > 0, 'fenêtre active : la note joue le synthé');
  send(0x80, 60, 0);
  await t.wait(80);

  // Associé au synthé à oscillateurs : il le joue, même si le clavier joue le synthé.
  const sel = row().querySelector('.dev-inst');
  sel.value = 'osc'; sel.dispatchEvent(new Event('change'));
  t.eq(S.devices[dev], { inst: 'osc' }, 'association enregistrée');
  const before = E.voices.size;
  send(0x90, 62, 100);
  t.ok(A.oscSynth.voices.size > 0 && E.voices.size === before, 'synthé à oscillateurs joué (pas le synthé)');
  send(0x80, 62, 0);
  await t.wait(80);

  // TR-909 : plan de batterie (36 = grosse caisse, 42 = charleston fermé).
  const hits = [];
  const trig = A.drum.trigger;
  A.drum.trigger = (id, ...r) => { hits.push(id); return trig.call(A.drum, id, ...r); };
  A.setDeviceInst(dev, 'tr');
  send(0x90, 36, 100); send(0x80, 36, 0);
  send(0x90, 42, 100); send(0x80, 42, 0);
  A.drum.trigger = trig;
  t.eq(hits, ['bd', 'ch'], 'TR-909 : les notes jouent les instruments du plan de batterie');

  // Kick du designer : la note joue le kick accordé dessus.
  A.setDeviceInst(dev, 'kick');
  send(0x90, 48, 100);
  t.ok(await t.until(() => A.kickSynth.voices.has(`dev:${dev}:48`), 3000), 'kick du designer joué');
  send(0x80, 48, 0);

  // Rien : les notes ne jouent plus.
  A.setDeviceInst(dev, 'none');
  const v0 = E.voices.size;
  send(0x90, 64, 100);
  t.eq(E.voices.size, v0, 'Rien : la note ne joue pas');
  send(0x80, 64, 0);

  // Potentiomètre appris (K1) : il pilote la page de l'instrument de l'appareil, pas la page en cours.
  S.midiMap = [{ port: dev, ch: 0, kind: 'cc', n: 20, target: 'knob:0' }];
  A.setDeviceInst(dev, 'synth');
  A.setPage('tr');
  const def = A.knobDefs('synth')[0];
  send(0xb0, 20, 0);
  send(0xb0, 20, 127);
  t.near(S.globals[def.id], 1, 0.01, 'K1 de l’appareil règle la page Synthé (son instrument) alors que la page est TR-909');
  S.midiMap = [];

  // APC associé à un instrument : sa page suit l'instrument, plus la fenêtre active.
  A.setDeviceInst('apc', 'osc');
  t.eq(S.page, 'osc', 'APC sur le synthé à oscillateurs : page Synthé à oscillateurs');
  A.wm.onActive('tr');
  t.eq(S.page, 'osc', 'la fenêtre active ne change plus sa page');
  A.setDeviceInst('apc', 'auto');
  A.wm.onActive('tr');
  t.eq(S.page, 'tr', 'Fenêtre active : la page suit de nouveau');

  // Sauvegarde.
  t.eq(JSON.parse(JSON.stringify(A.stateSnapshot().devices)), { [dev]: { inst: 'synth' } }, 'enregistré avec le projet');
  A.setDeviceInst(dev, 'auto');
  t.eq(S.devices, {}, 'Fenêtre active : rien à enregistrer');
  A.closeDevices();
  hub.inputs = [];
  hub.emit('connection', { inputs: [] });
}
