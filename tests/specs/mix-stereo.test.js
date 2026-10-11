// Stéréo (js/dynamics.js) : graves en mono sous la fréquence, image intacte au-dessus, largeur 0 / 100 / 200 % ;
// transparente coupée ; master (coupée par défaut, en tête de chaîne, fenêtre, sauvegarde), corrélation de phase, insert.
export default async function (t, A) {
  const S = A.state, E = A.engine, sr = 48000;

  // Rendu hors ligne d'un signal stéréo (g, d) à travers la stéréo.
  const run = async (l, r, p, on = true) => {
    const ctx = new OfflineAudioContext(2, l.length, sr);
    const fx = A.buildStereo(ctx);
    fx.update({ ...Object.fromEntries(Object.entries(A.STEREO_PARAMS).map(([k, v]) => [k, v[3]])), ...p }, on);
    const buf = ctx.createBuffer(2, l.length, sr);
    buf.copyToChannel(l, 0); buf.copyToChannel(r, 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(fx.input);
    fx.output.connect(ctx.destination);
    src.start(0);
    const out = await ctx.startRendering();
    return [out.getChannelData(0), out.getChannelData(1)];
  };
  const sine = (f, amp, ph = 0) => Float32Array.from({ length: sr }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr + ph));
  const rms = x => { let s = 0, n = 0; for (let i = sr / 4; i < x.length; i++, n++) s += x[i] * x[i]; return Math.sqrt(s / n); };
  const side = ([l, r]) => rms(l.map((v, i) => (v - r[i]) / 2));
  const mid = ([l, r]) => rms(l.map((v, i) => (v + r[i]) / 2));
  const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };

  // Un grave tout en côtés (G et D en opposition) : il disparaît sous la fréquence (mono = il ne reste que le milieu).
  const bassL = sine(50, 0.5), bassR = sine(50, -0.5);
  t.ok(side(await run(bassL, bassR, { freq: 120 })) < 0.5 * 0.1, 'graves mono : la partie stéréo d’un grave à 50 Hz disparaît');
  // Un aigu tout en côtés : intact au-dessus de la fréquence.
  const hiL = sine(2000, 0.5), hiR = sine(2000, -0.5);
  const hi = side(await run(hiL, hiR, { freq: 120 })) / side([hiL, hiR]);
  t.ok(Math.abs(hi - 1) < 0.03, 'au-dessus de la fréquence, la stéréo est intacte', hi);
  // Un son mono (milieu) n'est pas touché en niveau, ni dans le grave.
  const m = mid(await run(sine(50, 0.5), sine(50, 0.5), { freq: 120 })) / mid([sine(50, 0.5), sine(50, 0.5)]);
  t.ok(Math.abs(m - 1) < 0.02, 'le milieu garde son niveau', m);
  // Largeur : 0 % = mono, 200 % = côtés doublés.
  t.ok(side(await run(hiL, hiR, { width: 0 })) < 1e-4, 'largeur 0 % : mono');
  const wide = side(await run(hiL, hiR, { width: 200 })) / side([hiL, hiR]);
  t.ok(Math.abs(wide - 2) < 0.06, 'largeur 200 % : côtés doublés', wide);
  // Coupée : transparente.
  const [cl, cr] = await run(hiL, sine(300, 0.2, 1), { width: 0, freq: 300 }, false);
  t.ok(diff(cl, hiL) < 1e-6 && diff(cr, sine(300, 0.2, 1)) < 1e-6, 'coupée : transparente');

  // Master : coupée par défaut, en tête de chaîne, réglée depuis la fenêtre, enregistrée.
  t.eq(S.master.stereo.on, false, 'master : stéréo coupée par défaut');
  t.eq(Object.keys(A.MASTER_PARAMS)[0], 'stereo', 'en tête de la chaîne master');
  A.wm.toggle('mix', true);
  const box = t.$('#master-chain');
  t.eq(box.querySelectorAll('[data-g="stereo"][data-k]').length, 2, 'fenêtre : Mono sous et Largeur');
  box.querySelector('.mc-on[data-g="stereo"]').click();
  const inp = box.querySelector('input[data-g="stereo"][data-k="freq"]');
  inp.value = 150; inp.dispatchEvent(new Event('input'));
  t.eq([S.master.stereo.on, S.master.stereo.freq], [true, 150], 'réglée depuis la fenêtre');
  t.ok(/150 Hz/.test(inp.nextElementSibling.textContent), 'fréquence affichée en Hz', inp.nextElementSibling.textContent);
  const snap = JSON.parse(JSON.stringify(A.stateSnapshot().master));
  t.eq([snap.stereo.on, snap.stereo.freq], [true, 150], 'enregistrée avec le projet');
  t.eq(A.mergeMasterState({ comp: { on: true } }).stereo.on, false, 'ancienne sauvegarde : stéréo coupée');
  t.eq(A.mergeMasterState({ stereo: { width: 900 } }).stereo.width, 200, 'largeur ramenée dans ses bornes');

  // Corrélation de phase : affichée dans la fenêtre ; un son mono donne +1.
  t.ok(box.querySelector('[data-m="phase"]'), 'corrélation de phase dans les mesures');
  const osc = E.ctx.createOscillator(), g = E.ctx.createGain();
  g.gain.value = 0.2;
  osc.connect(g).connect(E.limitOut);
  osc.start();
  t.ok(await t.until(() => (E.phaseCorrelation() ?? 0) > 0.99, 2000), 'un son mono : corrélation +1', E.phaseCorrelation());
  osc.stop(); g.disconnect();
  S.master = A.defaultMasterState();
  A.applyMaster();

  // Insert : dans le menu, avec ses deux réglages.
  t.ok(A.fxOptions().includes('value="stereo"'), 'stéréo dans le menu des inserts');
  t.eq(Object.keys(A.newFx('stereo').p), ['freq', 'width'], 'insert : Mono sous et Largeur');
  t.eq(A.fxParamLabel('stereo', 'freq', 120), '120 Hz', 'libellé de la fréquence');
}
