// Designer de kick, mode expert : trois couches (clic, corps, queue) réglées à part et écoutables seules, réglages
// experts neutres par défaut, deboom, départ de la queue, queue accordée sur une note ; accord sur la tonalité du
// Générateur ; mélodie de kick (bloc de notes joué par le kick, qui suit les accords), lecture, export, piano roll.
// Hauteur : passages à zéro montants entre a et b secondes.
function pitch(data, sr, a = 0.15, b = 0.3) {
  let n = 0;
  const i0 = Math.round(a * sr), i1 = Math.min(data.length - 1, Math.round(b * sr));
  for (let i = i0; i < i1; i++) if (data[i - 1] < 0 && data[i] >= 0) n++;
  return n / ((i1 - i0) / sr);
}
// Part de l'énergie à la fréquence f (Goertzel) entre a et b secondes.
function share(data, sr, f, a = 0.1, b = 0.3) {
  const i0 = Math.round(a * sr), i1 = Math.round(b * sr), w = 2 * Math.PI * f / sr;
  let s1 = 0, s2 = 0, e = 0;
  for (let i = i0; i < i1; i++) { const s = data[i] + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = s; e += data[i] * data[i]; }
  const p = s1 * s1 + s2 * s2 - 2 * Math.cos(w) * s1 * s2;
  return p / (e * (i1 - i0) / 2 + 1e-12);
}
const rms = (d, a, b, sr) => { let s = 0; const i0 = Math.round(a * sr), i1 = Math.round(b * sr); for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / (i1 - i0)); };

export default async function (t, A) {
  const S = A.state, E = A.engine, sr = E.ctx.sampleRate;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  A.wm.toggle('kick', true);
  await t.wait(50);
  t.eq(A.mergeKickState({ expert: true }).expert, true, 'le mode expert est sauvegardé');
  t.eq(A.mergeKickState({}).expert, false, 'mode simple par défaut');

  // Bascule : les trois couches et leurs potentiomètres.
  t.$('#kick-mode [data-mode="expert"]').click();
  await t.wait(50);
  t.ok(t.$('#kick-knobs').hidden && !t.$('#kick-layers').hidden, 'mode expert : les couches à la place des 12 potentiomètres');
  t.eq(t.$$('#kick-layers .kick-layer').map(c => c.querySelectorAll('.knob').length), [5, 5, 13], 'clic 5, corps 5, queue 13 potentiomètres');

  // Réglages experts neutres : un kick d'usine n'a pas de corps ; la queue seule et le clic seul sonnent.
  const base = { ...A.kickDefaults(), ...A.KICK_PRESETS.rotterdam, tune: 0.5, length: 0.6, bend: 0, drive: 0.3, zaag: 0 };
  const peak = d => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  t.ok(peak(await A.synthKick(base, sr, { only: 'body' })) < 1e-4, 'kick d’usine : pas de corps');
  t.ok(peak(await A.synthKick(base, sr, { only: 'tail' })) > 0.3 && peak(await A.synthKick(base, sr, { only: 'click' })) > 0.01, 'la queue et le clic sonnent seuls');
  // Le clic est un transitoire : éteint après 15 ms (avant, le blip saturé traînait ~50 ms, un bourdonnement sur l'attaque).
  for (const name of ['mainstream', 'frenchcore', 'terror']) {
    const p = { ...A.kickDefaults(), ...A.KICK_PRESETS[name] };
    const clk = await A.synthKick(p, sr, { only: 'click' }), full = await A.synthKick(p, sr);
    t.ok(rms(clk, 0.015, 0.06, sr) < rms(full, 0.015, 0.06, sr) * 0.03, `${name} : le clic s’éteint en quelques millisecondes`, [rms(clk, 0.015, 0.06, sr), rms(full, 0.015, 0.06, sr)]);
  }

  // Corps : plonge jusqu'à une octave sous la queue (fa1 = 44 Hz).
  const body = await A.synthKick({ ...base, body: 1, bodyDecay: 1 }, sr, { only: 'body' });
  t.near(pitch(body, sr, 0.1, 0.25), 43.7, 4, 'le corps finit une octave sous la queue', pitch(body, sr, 0.1, 0.25));

  // Queue accordée sur une note (mélodie de kick) : fa4 = 349 Hz.
  const f4 = await A.synthKick(base, sr, { note: 65, only: 'tail' });
  t.near(pitch(f4, sr), 349.2, 349.2 * 0.05, 'queue accordée sur fa4', pitch(f4, sr));

  // Deboom : la fondamentale de la queue est retirée.
  const plain = await A.synthKick(base, sr, { only: 'tail' });
  const deboom = await A.synthKick({ ...base, deboom: 0.9 }, sr, { only: 'tail' });
  t.ok(share(deboom, sr, 87.3) < share(plain, sr, 87.3) * 0.3, 'deboom : la fondamentale de la queue s’efface', [share(plain, sr, 87.3), share(deboom, sr, 87.3)]);

  // Départ de la queue : elle entre en fondu, le début est fait par le clic et le corps.
  const late = await A.synthKick({ ...base, tailDelay: 1 }, sr, { only: 'tail' });
  t.ok(rms(late, 0, 0.01, sr) < rms(plain, 0, 0.01, sr) * 0.3, 'départ retardé : la queue est discrète au début');

  // Solo d'une couche : la couche est mise en avant, les autres pâlissent.
  t.$('#kick-layers [data-layer="body"] .kick-solo').click();
  await t.wait(50);
  t.eq(S.kick.solo, 'body', 'solo du corps');
  t.eq(t.$$('#kick-layers .kick-layer.muted').length, 2, 'les deux autres couches pâlissent');
  t.$('#kick-layers [data-layer="body"] .kick-solo').click();
  t.eq(S.kick.solo, null, 'deuxième clic : le kick entier');

  // Note de la queue affichée ; Accorder sur la tonalité (premier accord du Générateur).
  S.kick.params = { ...base };
  A.renderKick();
  t.ok(/fa2|F2/.test(t.$('#kick-note').textContent), 'note de la queue affichée', t.$('#kick-note').textContent);
  S.gen.prog = 'Gm Eb F Dm';
  t.$('#kick-key').click();
  await t.wait(80);
  t.eq(A.kickTailNote(S.kick.params), 43, 'accordée sur sol (le plus près de fa2)');

  // Mélodie de kick : un kick par temps, sur les fondamentales des accords (sol, mi♭, fa, ré), 2 mesures par accord.
  S.gen.bars = 2;
  t.$('#kick-melody').click();
  await t.wait(100);
  const clip = S.tl.tracks.flatMap(tr => tr.clips).find(c => c.kick);
  t.ok(clip && clip.len === 32 && clip.seq.length === 32, 'bloc de 8 mesures, un kick par temps', clip && [clip.len, clip.seq.length]);
  t.eq([0, 8, 16, 24].map(b => clip.seq.find(n => n.t === b).note), [43, 39, 41, 38], 'les notes suivent les accords, au plus près de la queue');
  t.eq(clip.kick.tune, S.kick.params.tune, 'le bloc garde les réglages du kick');
  t.ok(A.wm.isOpen('roll') && t.$('#roll-preset').value === 'kick', 'ouvert dans le piano roll, son « Kick du designer »');
  await A.prepareKickClips(S.tl.tracks, sr);
  t.ok(A.kickReady(clip.kick, 39), 'les kicks du bloc sont calculés à l’avance');

  // Lecture : le synthé de kick joue, chaque kick coupe le précédent.
  const level = t.meter(E.output);
  t.$('#tl-play').click();
  await t.wait(900);
  let p = 0; for (let i = 0; i < 20; i++) { p = Math.max(p, level()); await t.wait(20); }
  t.ok(p > 0.05, 'la mélodie de kick s’entend', p);
  t.ok(A.kickSynth.voices.size <= 2, 'un kick coupe le précédent', A.kickSynth.voices.size);
  t.$('#tl-play').click();
  t.ok(await t.until(() => A.kickSynth.voices.size === 0, 2000), 'à l’arrêt, plus de kick');

  // Export : la mélodie est dans le rendu.
  S.tl.bars = 8;
  const ch = await A.renderSong();
  const bd = 60 / S.bpm;
  t.ok(rms(ch[0], 0, 4 * bd, sr) > 0.02, 'export : la mélodie de kick est rendue', rms(ch[0], 0, 4 * bd, sr));

  // Piano roll : un autre son, puis de nouveau le kick.
  const sel = t.$('#roll-preset');
  sel.value = 'epic_strings'; sel.dispatchEvent(new Event('change'));
  t.ok(!clip.kick && clip.preset === 'epic_strings', 'un autre son : le bloc n’est plus un kick');
  sel.value = 'kick'; sel.dispatchEvent(new Event('change'));
  t.ok(clip.kick && !clip.preset, 'de nouveau le kick du designer');

  t.$('#kick-mode [data-mode="simple"]').click();
  t.ok(!t.$('#kick-knobs').hidden, 'retour au mode simple');
  for (const tr of S.tl.tracks) tr.clips = [];
}
