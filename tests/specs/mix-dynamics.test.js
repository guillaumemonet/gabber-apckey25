// Écrêteur et compression multibande façon OTT (js/dynamics.js, js/ott-worklet.js) : transparents coupés ou à Depth 0,
// bandes qui se somment à plat, l'écrêteur tient le plafond, le multibande remonte le faible et tient le fort ;
// chaîne master (coupés par défaut, fenêtre, sauvegarde, export) et inserts de piste / de bus.
export default async function (t, A) {
  const S = A.state, E = A.engine, sr = 48000, esr = E.ctx.sampleRate;

  // Rendu hors ligne d'un signal (mono, copié sur les deux canaux) à travers une chaîne de js/dynamics.js.
  const run = async (make, sig, p, on = true) => {
    const ctx = new OfflineAudioContext(2, sig.length, sr);
    await A.loadOttWorklet(ctx);
    const fx = make(ctx);
    fx.update(p, on);
    const buf = ctx.createBuffer(2, sig.length, sr);
    buf.copyToChannel(sig, 0); buf.copyToChannel(sig, 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(fx.input);
    fx.output.connect(ctx.destination);
    src.start(0);
    return (await ctx.startRendering()).getChannelData(0);
  };
  const sine = (f, amp, sec = 1.5) => Float32Array.from({ length: Math.round(sr * sec) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr));
  const rms = (x, from = 0.5) => { let s = 0, n = 0; for (let i = Math.round(from * sr); i < x.length; i++, n++) s += x[i] * x[i]; return Math.sqrt(s / n); };
  const peak = (x, from = 0.1) => { let p = 0; for (let i = Math.round(from * sr); i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; };
  const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
  const ott = p => ({ ...Object.fromEntries(Object.entries(A.OTT_PARAMS).map(([k, v]) => [k, v[3]])), ...p });
  const clip = p => ({ ...Object.fromEntries(Object.entries(A.CLIP_PARAMS).map(([k, v]) => [k, v[3]])), ...p });

  // Un signal riche : grave, médium, aigu et un peu de bruit, avec une enveloppe.
  const mix = Float32Array.from({ length: sr }, (_, i) => {
    const x = i / sr;
    return (0.4 * Math.sin(2 * Math.PI * 55 * x) + 0.2 * Math.sin(2 * Math.PI * 700 * x) + 0.1 * Math.sin(2 * Math.PI * 5000 * x) + 0.05 * (Math.random() * 2 - 1)) * (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * 4 * x)));
  });

  // Transparence : coupés, ou multibande à Depth 0 = le son d'entrée, à l'échantillon près.
  t.ok(diff(await run(A.buildOtt, mix, ott({ depth: 0 })), mix) < 1e-6, 'multibande à Depth 0 : transparent (soustraction nulle)');
  t.ok(diff(await run(A.buildOtt, mix, ott({ depth: 80 }), false), mix) < 1e-6, 'multibande coupé : transparent');
  t.ok(diff(await run(A.buildClipper, mix, clip({ drive: 12, ceiling: -12 }), false), mix) < 1e-6, 'écrêteur coupé : transparent');

  // Les trois bandes se somment à plat : à Depth 1 %, chaque fréquence ressort au même niveau (pas de creux aux coupures).
  const flat = [];
  for (const f of [40, 88, 300, 1000, 2500, 9000]) {
    const x = sine(f, 0.05, 1);
    flat.push(rms(await run(A.buildOtt, x, ott({ depth: 1, up: 0, down: 0 }))) / rms(x));
  }
  t.ok(flat.every(r => Math.abs(r - 1) < 0.03), 'bandes sommées à plat (40 Hz à 9 kHz)', flat.map(r => r.toFixed(3)));

  // OTT : le faible remonte, le fort est tenu, le silence (bruit de fond) n'est pas remonté.
  const quiet = sine(400, 0.01);   // −40 dBFS
  const loud = sine(400, 0.7);     // −3 dBFS
  const up = rms(await run(A.buildOtt, quiet, ott({ depth: 100 }))) / rms(quiet);
  const down = rms(await run(A.buildOtt, loud, ott({ depth: 100 }))) / rms(loud);
  t.ok(up > 2, 'multibande : un passage à −40 dB remonte de plus de 6 dB', up);
  t.ok(down < 0.7, 'multibande : un passage à −3 dB baisse de plus de 3 dB', down);
  const upOnly = rms(await run(A.buildOtt, loud, ott({ depth: 100, down: 0 }))) / rms(loud);
  t.ok(upOnly > down * 1.5, 'Down à 0 : le fort n’est plus tenu', [down, upOnly]);
  const floor = sine(400, 0.00003);   // −90 dBFS
  t.ok(rms(await run(A.buildOtt, floor, ott({ depth: 100 }))) / rms(floor) < 2, 'multibande : le bruit de fond n’est pas remonté');
  const half = rms(await run(A.buildOtt, quiet, ott({ depth: 50 }))) / rms(quiet);
  t.ok(half > 1.2 && half < up, 'Depth 50 % : entre les deux', [half, up]);

  // Écrêteur : la crête reste au plafond (au dépassement du suréchantillonnage près), dur ou doux.
  const hot = sine(110, 0.9);
  for (const soft of [0, 50, 100]) {
    const pk = peak(await run(A.buildClipper, hot, clip({ drive: 12, ceiling: -6, soft })));
    const c = Math.pow(10, -6 / 20);
    t.ok(pk <= c * 1.06 && pk > c * 0.9, `écrêteur (douceur ${soft} %) : crête au plafond de −6 dB`, pk);
  }
  const under = sine(440, 0.3);
  const thru = rms(await run(A.buildClipper, under, clip({ drive: 0, ceiling: 0, soft: 0 }))) / rms(under);
  t.ok(Math.abs(thru - 1) < 0.01, 'écrêteur dur sous le plafond : le son passe sans changement de niveau', thru);
  t.ok(A.clipCurve(-6, 0).every(v => Math.abs(v) <= Math.pow(10, -6 / 20) + 1e-7), 'courbe : jamais au-dessus du plafond');

  // Master : coupés par défaut, chaque étage avec son bouton dans la fenêtre.
  t.eq([S.master.ott.on, S.master.clip.on], [false, false], 'master : multibande et écrêteur coupés par défaut');
  A.wm.toggle('mix', true);
  const box = t.$('#master-chain');
  t.eq([...box.querySelectorAll('.mc-on')].map(b => b.dataset.g), ['stereo', 'comp', 'ott', 'clip', 'limit'], 'fenêtre : stéréo, compresseur, multibande, écrêteur, limiteur');
  t.eq(box.querySelectorAll('[data-g="ott"][data-k]').length, 5, 'multibande : Depth, Time, Up, Down, Sortie');
  t.eq(box.querySelectorAll('[data-g="clip"][data-k]').length, 3, 'écrêteur : drive, plafond, douceur');
  box.querySelector('.mc-on[data-g="ott"]').click();
  box.querySelector('.mc-on[data-g="clip"]').click();
  const setK = (g, k, v) => { const inp = box.querySelector(`input[data-g="${g}"][data-k="${k}"]`); inp.value = v; inp.dispatchEvent(new Event('input')); };
  setK('ott', 'depth', 60);
  setK('clip', 'drive', 6);
  t.eq([S.master.ott.on, S.master.clip.on, S.master.ott.depth, S.master.clip.drive], [true, true, 60, 6], 'réglés depuis la fenêtre');
  t.ok(/60/.test(box.querySelector('input[data-g="ott"][data-k="depth"]').nextElementSibling.textContent), 'valeur affichée');
  // Sauvegarde : enregistrés et relus tels quels ; fichier de réglages du mixeur.
  const snap = JSON.parse(JSON.stringify(A.stateSnapshot().master));
  t.eq([snap.ott.on, snap.ott.depth, snap.clip.on, snap.clip.drive], [true, 60, true, 6], 'enregistrés avec le projet');
  t.eq(A.mergeMasterState(snap), snap, 'relus tels quels');
  t.eq(A.TOOL_IO.mix.get().master.clip.drive, 6, 'dans le fichier de réglages du mixeur');
  const old = A.mergeMasterState({ comp: { on: true, threshold: -10 }, limit: { on: true, gain: 3 } });
  t.eq([old.ott.on, old.clip.on, old.comp.threshold, old.limit.gain], [false, false, -10, 3], 'ancienne sauvegarde : multibande et écrêteur coupés');
  t.eq(A.mergeMasterState({ ott: { on: true, depth: 500 }, clip: { drive: -4 } }).ott.depth, 100, 'valeurs ramenées dans leurs bornes');

  // Export : un morceau, chaîne coupée = Depth 0 (le son des anciens projets ne change pas) ; allumée = plus fort,
  // crête toujours sous le plafond du limiteur.
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat');
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.inserts = []; tr.mute = false; tr.solo = false; tr.bus = null; });
  S.tl.bars = 2;
  S.tl.tracks[0].clips.push({ id: 'c-dyn', start: 0, len: 8, sampleId: 'lib:' + beat.file, name: beat.name, cat: beat.cat, color: 1, bpm: beat.bpm || 0, loop: true });
  await A.loadTlBuffers();
  S.master = A.defaultMasterState();
  const ref = await A.renderSong();
  S.master.ott = { ...S.master.ott, on: true, depth: 0 };
  const zero = await A.renderSong();
  // (deux rendus identiques diffèrent déjà d'environ 3e-5 : on tolère 1e-4, soit −80 dB)
  t.ok(diff(ref[0], zero[0]) < 1e-4 && diff(ref[1], zero[1]) < 1e-4, 'export : multibande à Depth 0 = même fichier', diff(ref[0], zero[0]));
  S.master.ott.depth = 70;
  S.master.clip = { ...S.master.clip, on: true, drive: 9, ceiling: -1 };
  const ottOn = await A.renderSong();
  const lRef = A.measureLoudness(ref, esr), lOn = A.measureLoudness(ottOn, esr);
  t.ok(lOn.integrated > lRef.integrated + 1, 'export : multibande et écrêteur = plus fort', [lRef.integrated, lOn.integrated]);
  t.ok(lOn.peakDb <= S.master.limit.ceiling + 0.05, 'export : crête sous le plafond du limiteur', lOn.peakDb);
  // Un stem sort sans eux.
  const stem = A.measureLoudness(await A.renderSong(0), esr);
  t.ok(stem.integrated < lOn.integrated - 1, 'un stem sort sans la chaîne master', [stem.integrated, lOn.integrated]);
  S.master = A.defaultMasterState();
  A.applyMaster();

  // Inserts : dans le menu des pistes et des bus, avec leurs réglages ; un écrêteur sur la piste fait baisser la crête.
  t.ok(A.fxOptions().includes('value="ott"') && A.fxOptions().includes('value="clip"'), 'multibande et écrêteur dans le menu des inserts');
  A.wm.toggle('buses', true);
  const add = t.$$('#buses .fx-add')[0];
  add.value = 'clip'; add.dispatchEvent(new Event('change'));
  add.value = 'ott'; add.dispatchEvent(new Event('change'));
  t.eq(S.tl.buses[0].inserts.map(f => f.type), ['clip', 'ott'], 'ajoutés à un bus');
  t.eq(t.$$('#buses .fx-list')[0].querySelectorAll('input[type=range]').length, 8, 'leurs réglages dans le rack du bus');
  S.tl.buses[0].inserts = [];
  A.timeline.rebuildBusInserts(0);
  const dry = A.measureLoudness(await A.renderSong(), esr);
  S.tl.tracks[0].inserts = [A.newFx('clip'), A.newFx('ott')];
  Object.assign(S.tl.tracks[0].inserts[0].p, { drive: 0, ceiling: -12, soft: 0 });
  S.tl.tracks[0].inserts[1].p.depth = 0;
  const ins = A.measureLoudness(await A.renderSong(), esr);
  t.ok(ins.peakDb < dry.peakDb - 4, 'insert écrêteur à −12 dB : la crête de la piste baisse', [dry.peakDb, ins.peakDb]);
  t.eq(A.cleanInsert({ type: 'ott', p: { depth: 400 } }).p.depth, 100, 'réglages d’insert ramenés dans leurs bornes');
  S.tl.tracks[0].inserts = [];
  A.timeline.rebuildInserts(0);
}
