// Autotune (js/autotune.js, js/psola.js, js/app/tune-ui.js), sur des signaux de synthèse : une note fausse avec vibrato
// sort sur la note de la gamme ; « humain » garde le vibrato ; une mélodie suit un bloc de notes ; le bruit (consonne
// sourde, souffle) reste identique ; pas de clic ; l'enveloppe spectrale (formants) est gardée ; pas d'erreur d'octave
// sur une voix aiguë à fondamentale faible. Puis la fenêtre : appliquer sur un bloc audio, annuler, retirer.
export default async function (t, A) {
  const S = A.state, sr = 44100;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12), midi = f => 69 + 12 * Math.log2(f / 440);
  // Voyelle : harmoniques pondérées par trois formants (700, 1220, 2600 Hz).
  const FORM = [[700, 130, 1], [1220, 150, 0.5], [2600, 250, 0.25]];
  const env = f => FORM.reduce((s, [fc, bw, a]) => s + a / (1 + ((f - fc) / bw) ** 2), 0.02);
  const vowel = (midiAt, sec, amp = 0.3, rate = sr) => {
    const n = Math.round(rate * sec), out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const f = hz(midiAt(i / rate));
      ph += 2 * Math.PI * f / rate;
      let v = 0;
      for (let h = 1; h * f < 5000; h++) v += env(h * f) * Math.sin(h * ph);
      out[i] = amp * v;
    }
    return out;
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const noise = (sec, amp) => Float32Array.from({ length: Math.round(sr * sec) }, () => amp * rnd());
  const cat = (...a) => { const o = new Float32Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
  // Écarts (cents) de la hauteur mesurée à la note visée entre a et b secondes : { med, max }.
  const err = (y, a, b, note, rate = sr) => {
    const tr = A.analyzePitch(y, rate), e = [];
    let sum = 0;
    for (let k = 0; k < tr.f0.length; k++) { const s = k * tr.hop / rate; if (s >= a && s < b && tr.f0[k]) { const d = (midi(tr.f0[k]) - note(s)) * 100; sum += d; e.push(Math.abs(d)); } }
    e.sort((p, q) => p - q);
    return { n: e.length, med: e[e.length >> 1] ?? Infinity, max: e[e.length - 1] ?? Infinity, mean: e.length ? sum / e.length : Infinity };
  };
  const d2 = y => { let m = 0; for (let i = 2; i < y.length; i++) m = Math.max(m, Math.abs(y[i] - 2 * y[i - 1] + y[i - 2])); return m; };

  // ---- Note fausse (+35 cents) avec vibrato (±40 cents, 5,5 Hz), la mineur ----
  const vib = s => 57.35 + 0.4 * Math.sin(2 * Math.PI * 5.5 * s);
  const x1 = vowel(vib, 2);
  const t0 = performance.now();
  const r1 = A.autotune([x1], sr, { mode: 'scale', root: 9, scale: 'minor', speed: 0, humanize: 0 });
  const ms = performance.now() - t0;
  const e1 = err(r1.chans[0], 0.2, 1.8, () => 57);
  t.ok(e1.n > 250 && e1.med < 5 && e1.max < 12, 'robot : la note sort sur la3, juste à quelques cents près', e1);
  t.ok(err(x1, 0.2, 1.8, () => 57).med > 25, 'l’entrée était bien fausse');
  t.ok(ms < 3000, 'calcul rapide (2 s de voix)', ms);
  const r1h = A.autotune([x1], sr, { mode: 'scale', root: 9, scale: 'minor', speed: 0, humanize: 1 });
  const e1h = err(r1h.chans[0], 0.3, 1.7, s => vib(s) - 0.35);
  t.ok(e1h.med < 6, 'humain : le vibrato est gardé, autour de la note juste', e1h);
  const r1s = A.autotune([x1], sr, { mode: 'scale', root: 9, scale: 'minor', speed: 150, humanize: 0 });
  const e1s = err(r1s.chans[0], 1.0, 1.8, () => 57);
  t.ok(Math.abs(e1s.mean) < 5 && e1s.max > 20, 'vitesse lente : la note est juste en moyenne, le vibrato passe encore', e1s);

  // ---- Mélodie fausse avec glissés, do majeur ----
  const notes = [[60.3, 60], [62.4, 62], [64.35, 64], [67.4, 67], [65.3, 65]], seg = 0.4;
  const melo = s => { const i = Math.min(notes.length - 1, Math.floor(s / seg)), u = s - i * seg, p = notes[Math.max(0, i - 1)][0]; return u < 0.05 && i ? p + (notes[i][0] - p) * u / 0.05 : notes[i][0]; };
  const x2 = vowel(melo, seg * notes.length);
  const r2 = A.autotune([x2], sr, { mode: 'scale', root: 0, scale: 'major', speed: 0 });
  const e2 = notes.map(([, n], i) => err(r2.chans[0], i * seg + 0.1, (i + 1) * seg - 0.05, () => n).med);
  t.ok(e2.every(e => e < 5), 'mélodie : chaque note sur la gamme', e2.map(e => e.toFixed(1)));
  t.ok(d2(r2.chans[0]) < d2(x2) * 1.5, 'pas de clic aux changements de note', [d2(r2.chans[0]), d2(x2)]);

  // ---- Bloc de notes : une voix fixe (200 Hz) suit la mélodie, chaque note dans l’octave la plus proche ----
  const x3 = vowel(() => midi(200), 2);
  const nts = [{ t0: 0, t1: 0.5, note: 69 }, { t0: 0.5, t1: 1, note: 60 }, { t0: 1, t1: 1.5, note: 55 }, { t0: 1.5, t1: 2, note: 64 }];
  const r3 = A.autotune([x3], sr, { mode: 'notes', notes: nts, speed: 0 });
  const want = nts.map(n => n.note + 12 * Math.round((midi(200) - n.note) / 12));
  t.eq(want, [57, 60, 55, 52], 'octaves choisies au plus près de la voix');
  const e3 = nts.map((n, i) => err(r3.chans[0], n.t0 + 0.06, n.t1 - 0.03, () => want[i]).med);
  t.ok(e3.every(e => e < 5), 'bloc de notes : la voix suit la mélodie', e3.map(e => e.toFixed(1)));

  // ---- Bruit entre deux voyelles : recopié tel quel ; pas de clic ----
  const x4 = cat(vowel(() => 57.3, 0.5), noise(0.3, 0.2), vowel(() => 59.7, 0.5));
  const r4 = A.autotune([x4, x4], sr, { mode: 'scale', root: 9, scale: 'minor', speed: 0 });
  let md = 0;
  for (let i = Math.round(0.52 * sr); i < Math.round(0.78 * sr); i++) md = Math.max(md, Math.abs(r4.chans[0][i] - x4[i]), Math.abs(r4.chans[1][i] - x4[i]));
  t.eq(md, 0, 'consonne sourde / souffle : identique, sur les deux canaux');
  t.ok(d2(r4.chans[0]) <= d2(x4) * 1.2, 'pas de discontinuité aux bords voisé / sourd', [d2(r4.chans[0]), d2(x4)]);
  t.eq([...A.analyzePitch(noise(1, 0.3), sr).f0].filter(Boolean).length, 0, 'bruit blanc : aucune hauteur détectée');
  t.ok(err(r4.chans[0], 0.1, 0.45, () => 57).med < 5 && err(r4.chans[0], 0.85, 1.2, () => 60).med < 5, 'les voyelles autour sont corrigées');

  // ---- Formants : l’enveloppe spectrale reste en place (+3 demi-tons), sauf si on la déplace ----
  const envelope = (y, a) => {
    const N = 8192, i0 = Math.round(a * sr), tr = A.analyzePitch(y.subarray(i0, i0 + N), sr);
    const fs = [...tr.f0].filter(Boolean).sort((p, q) => p - q), f0 = fs[fs.length >> 1];
    const mag = f => { let s = 0, c = 0; for (let i = 0; i < N; i++) { const v = y[i0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); s += v * Math.sin(2 * Math.PI * f * i / sr); c += v * Math.cos(2 * Math.PI * f * i / sr); } return 20 * Math.log10(Math.hypot(s, c) + 1e-9); };
    const hs = [];
    for (let h = 1; h * f0 < 4500; h++) hs.push([h * f0, mag(h * f0)]);
    const out = [];
    for (let f = 400; f < 4000; f *= 1.06) { let j = 0; while (j + 2 < hs.length && hs[j + 1][0] < f) j++; out.push(hs[j][1] + (hs[j + 1][1] - hs[j][1]) * (f - hs[j][0]) / (hs[j + 1][0] - hs[j][0])); }
    const m = Math.max(...out);
    return out.map(v => v - m);
  };
  const x7 = vowel(() => 55, 1);
  const up = A.autotune([x7], sr, { mode: 'notes', notes: [{ t0: 0, t1: 1, note: 58 }], speed: 0 }).chans[0];
  const upF = A.autotune([x7], sr, { mode: 'notes', notes: [{ t0: 0, t1: 1, note: 58 }], speed: 0, formant: 3 }).chans[0];
  const ref = envelope(x7, 0.3), mad = e => e.reduce((s, v, i) => s + Math.abs(v - ref[i]), 0) / e.length;
  const dKeep = mad(envelope(up, 0.3)), dShift = mad(envelope(upF, 0.3));
  t.ok(err(up, 0.2, 0.8, () => 58).med < 5, '+3 demi-tons', err(up, 0.2, 0.8, () => 58));
  t.ok(dKeep < 2.5 && dShift > dKeep + 1.5, 'formants gardés (écart moyen en dB), déplacés avec le réglage Formants', [dKeep.toFixed(2), dShift.toFixed(2)]);

  // ---- Voix aiguë, fondamentale faible, jitter : pas d’erreur d’octave (48 kHz) ----
  const hard = (base, rate) => {
    const n = rate * 2, out = new Float32Array(n);
    let ph = 0, jit = 0;
    for (let i = 0; i < n; i++) {
      if (i % 200 === 0) jit = 0.02 * rnd();
      ph += 2 * Math.PI * hz(base + 0.3 * Math.sin(2 * Math.PI * 5 * i / rate)) * (1 + jit) / rate;
      out[i] = 0.15 * (0.08 * Math.sin(ph) + Math.sin(2 * ph) + 0.5 * Math.sin(3 * ph) + 0.6 * Math.sin(4 * ph + 1)) + 0.01 * rnd();
    }
    return out;
  };
  const gross = [45, 60, 74, 81].map(b => { const tr = A.analyzePitch(hard(b, 48000), 48000); let bad = 0; tr.f0.forEach((f, k) => { const s = k * tr.hop / 48000; if (f && Math.abs(midi(f) - b - 0.3 * Math.sin(2 * Math.PI * 5 * s)) > 1) bad++; }); return bad; });
  t.eq(gross, [0, 0, 0, 0], 'aucune erreur d’octave du la1 au la5');

  // ---- Fenêtre : un bloc audio (prise) suit un bloc de notes ; Appliquer, Annuler, Rétablir, Retirer ----
  const E = A.engine, R = E.ctx.sampleRate, bpm = 120;
  S.bpm = bpm;
  E.setBpm?.(bpm);
  for (const tk of S.tl.tracks) tk.clips = [];
  const take = vowel(() => midi(200), 2, 0.3, R);
  const buf = E.ctx.createBuffer(1, take.length, R);
  buf.copyToChannel(take, 0);
  const sid = `rec:test-tune-${Date.now()}`;
  A.bufferCache.set(sid, buf);
  const audio = { id: 'c-take', start: 4, len: 4, sampleId: sid, name: 'Take', cat: 'rec', color: 1, loop: false };
  S.tl.tracks[0].clips.push(audio);
  const lead = { id: 'c-lead', type: 'note', preset: 'hardstyle_lead', cat: 'lead', color: 1, start: 4, len: 4, loop: false, name: 'Lead', seq: [{ t: 0, len: 2, note: 69, vel: 0.9 }, { t: 2, len: 2, note: 64, vel: 0.9 }], pat: 4 };
  S.tl.tracks[1].clips.push(lead);
  A.renderTl();
  S.gen.prog = 'Fm Db Eb Cm';
  t.eq(A.genTuneKey(), { root: 5, scale: 'minor' }, 'tonalité du générateur : fa mineur');
  A.openTune(0, audio);
  await t.wait(50);
  t.ok(A.wm.isOpen('tune') && /Take/.test(t.$('#tune-clip').textContent), 'la fenêtre s’ouvre sur le bloc');
  t.ok(/(fa|F) (mineur|minor)/i.test(t.$('#tune-key').options[0].text), 'tonalité proposée : celle du générateur', t.$('#tune-key').options[0].text);
  const mode = t.$('#tune select[data-key="mode"]');
  mode.value = 'notes'; mode.dispatchEvent(new Event('change'));
  t.eq(A.tuneNoteClip()?.clip.id, 'c-lead', 'mélodie : le bloc de notes qui recouvre la prise');
  const made = await A.applyTune();
  const clip = S.tl.tracks[0].clips[0];
  t.ok(made && clip.sampleId !== sid && clip.sampleId.startsWith('rec:') && clip.tune?.src === sid, 'Appliquer : nouveau son, l’original est gardé', clip.tune);
  const out = A.bufferCache.get(clip.sampleId).getChannelData(0);
  const e5 = [err(out, 0.1, 0.95, () => 57, R).med, err(out, 1.1, 1.95, () => 52, R).med];
  t.ok(e5.every(e => e < 5), 'le son du bloc suit la mélodie (la3 puis mi3, octave de la voix)', e5);
  t.ok(t.$('#tune-curve').width > 0 && /\d+ %/.test(t.$('#tune-status').textContent), 'courbe et mesures affichées', t.$('#tune-status').textContent);
  t.ok(A.songSampleIds().includes(sid), 'le son d’origine est enregistré avec le projet');
  A.tlUndo();
  t.eq(S.tl.tracks[0].clips[0].sampleId, sid, 'Annuler : le son d’origine revient');
  A.tlRedo();
  t.ok(S.tl.tracks[0].clips[0].tune?.src === sid, 'Rétablir : corrigé à nouveau');
  A.tlSelect(0, S.tl.tracks[0].clips[0]);
  A.renderTuneWin();
  t.ok(!t.$('#tune-remove').hidden, 'bouton Retirer sur un bloc corrigé');
  t.ok(A.removeTune() && S.tl.tracks[0].clips[0].sampleId === sid && !S.tl.tracks[0].clips[0].tune, 'Retirer : le bloc retrouve son son');
  t.eq(A.mergeTuneState({ mode: 'x', key: 14, speed: 9999, humanize: -1 }), { ...A.defaultTuneState(), speed: 400, humanize: 0 }, 'valeurs inconnues ramenées aux bornes');
  t.eq(A.stateSnapshot().tune.mode, 'notes', 'réglages enregistrés');
  for (const tk of S.tl.tracks) tk.clips = [];
  A.wm.toggle('tune', false);
}
