// Sons bretons du synthé (famille Breizh), mesurés hors temps réel et comparés à ce qu'on mesure sur de vrais
// enregistrements : corps (formants) de la bombarde, du biniou et du chalumeau, jeu de bourdons (deux ténors, une basse,
// battements lents), notes liées des cornemuses et détachées de la bombarde, niveau qui bouge un peu ; gamme propre
// de la cornemuse et ses notes d'agrément dans le Breizh generator.
export default async function (t, A) {
  const SR = 44100;
  const render = async (preset, notes, dur, cfg = {}) => {
    const ctx = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
    const e = new A.Engine(ctx);
    const p = A.presetPatch(preset);
    const patch = { cfg: { ...p.cfg, ...cfg }, values: p.values };
    const out = ctx.createGain();
    out.connect(ctx.destination);
    notes.forEach((n, i) => { e.noteOn(n.note, 0.9, n.t, `k${i}`, patch, out); e.noteOff(n.note, false, n.t + n.len, `k${i}`); });
    return (await ctx.startRendering()).getChannelData(0);
  };
  // Spectre de puissance (fenêtre de Hann, 2^bits points) à partir de l'échantillon `at`.
  const power = (x, at, bits = 14) => {
    const n = 1 << bits, re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = (x[at + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
    for (let i = 1, j = 0; i < n; i++) {
      let b = n >> 1;
      for (; j & b; b >>= 1) j ^= b;
      j ^= b;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len;
      for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k), s = Math.sin(a * k), u = i + k, v = u + len / 2;
        const tr = re[v] * c - im[v] * s, ti = re[v] * s + im[v] * c;
        re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
      }
    }
    return { p: Array.from({ length: n / 2 }, (_, i) => re[i] * re[i] + im[i] * im[i]), df: SR / n };
  };
  const band = (sp, f1, f2) => { let s = 1e-20; for (let i = Math.ceil(f1 / sp.df); i < f2 / sp.df; i++) s += sp.p[i]; return 10 * Math.log10(s); };
  const rmsEnv = (x, from, to, win = 882) => { const out = []; for (let i = Math.round(from); i + win <= to; i += win / 2) { let s = 0; for (let k = 0; k < win; k++) s += x[i + k] ** 2; out.push(Math.sqrt(s / win)); } return out; };
  const db = v => 20 * Math.log10(v + 1e-12);

  // Corps : formant de la bombarde vers 2 kHz et creux vers 3,5 kHz (≈ 20 dB d'écart sur de vrais pupitres de bombardes).
  const bomb = await render('bombarde', [{ t: 0, len: 2, note: 72 }], 2.3);
  let sp = power(bomb, SR / 2);
  t.ok(band(sp, 1700, 2400) - band(sp, 3200, 3800) > 18, 'bombarde : formant vers 2 kHz, creux vers 3,5 kHz', (band(sp, 1700, 2400) - band(sp, 3200, 3800)).toFixed(1));
  // Biniou : brillant jusqu'à 4-5 kHz puis plus rien (≈ 13 dB entre 3,5-4,6 kHz et 7,5-10 kHz sur un vrai biniou).
  const bin = await render('biniou', [{ t: 0, len: 2, note: 84 }], 2.3);
  sp = power(bin, SR / 2);
  t.ok(band(sp, 3500, 4600) - band(sp, 7500, 10000) > 10, 'biniou : éclat vers 4 kHz, peu au-delà de 7 kHz', (band(sp, 3500, 4600) - band(sp, 7500, 10000)).toFixed(1));
  // Chalumeau : harmoniques fortes jusqu'à 3 kHz, creux marqué vers 3,5 kHz (20 à 26 dB sur un vrai chalumeau).
  const pipe = await render('cornemuse', [{ t: 0, len: 2, note: 71 }], 2.3);
  sp = power(pipe, SR / 2);
  t.ok(band(sp, 900, 3000) - band(sp, 3200, 3800) > 15, 'cornemuse : creux du chalumeau vers 3,5 kHz', (band(sp, 900, 3000) - band(sp, 3200, 3800)).toFixed(1));
  // Pas de vibrato sur les cornemuses ; un peu sur la bombarde.
  t.ok(A.presetPatch('cornemuse').values.vibrato === 0 && A.presetPatch('bagad').values.vibrato === 0 && A.presetPatch('bombarde').values.vibrato > 0, 'vibrato : bombarde seulement');
  // Le niveau bouge un peu (pression du sac) : quelques pour cent, comme un vrai chalumeau (2 à 4 %).
  const env = rmsEnv(pipe, SR / 2, 2 * SR);
  const mean = env.reduce((a, b) => a + b) / env.length, sd = Math.sqrt(env.reduce((a, b) => a + (b - mean) ** 2, 0) / env.length);
  t.ok(sd / mean > 0.01 && sd / mean < 0.1, 'cornemuse : niveau un peu vivant, sans trémolo', (sd / mean * 100).toFixed(1));

  // Bourdons (ténors sur la note, basse à l'octave au-dessous) : l'harmonique la plus forte est la 4e de la basse
  // (2e des ténors, résonance vers 500 Hz) ; harmoniques impaires de la basse bien plus faibles ; battements lents.
  const fb = 440 * 2 ** ((57 - 12 - 69) / 12);   // la2 : ténors sur la3
  const drone = await render('bourdon', [{ t: 0, len: 11, note: 57 }], 11);
  sp = power(drone, 2 * SR, 15);
  const h = k => band(sp, k * fb * 0.985, k * fb * 1.015);
  const hs = Array.from({ length: 12 }, (_, i) => h(i + 1));
  t.eq(hs.indexOf(Math.max(...hs)) + 1, 4, 'bourdon : 4e harmonique de la basse la plus forte', hs.map(v => v.toFixed(0)).join(' '));
  const avg = ks => 10 * Math.log10(ks.reduce((a, k) => a + 10 ** (hs[k - 1] / 10), 0) / ks.length);
  t.ok(avg([2, 4, 6, 8, 10]) - avg([3, 5, 7, 9, 11]) > 5, 'bourdon : harmoniques impaires de la basse plus faibles', (avg([2, 4, 6, 8, 10]) - avg([3, 5, 7, 9, 11])).toFixed(1));
  // Battements des ténors : enveloppe de leur fondamentale (≈ 220 Hz), un passage par la moyenne toutes les secondes au plus.
  const beat = [];
  for (let at = 2 * SR; at + 8192 < 11 * SR; at += SR / 20) { const s = power(drone, at, 13); beat.push(band(s, 2 * fb * 0.97, 2 * fb * 1.03)); }
  const bm = beat.reduce((a, b) => a + b) / beat.length;
  let cross = 0;
  for (let i = 1; i < beat.length; i++) if ((beat[i] - bm) * (beat[i - 1] - bm) < 0) cross++;
  const rate = cross / 2 / ((beat.length - 1) / 20);
  t.ok(rate < 1 && Math.max(...beat) - Math.min(...beat) > 3, 'bourdon : battements lents entre les ténors (comme une vraie cornemuse, 0,2 à 0,5 Hz)', `${rate.toFixed(2)} Hz, ${(Math.max(...beat) - Math.min(...beat)).toFixed(1)} dB`);

  // Notes liées : entre deux notes de chalumeau le son ne s'arrête pas (≈ 1 dB de creux sur un vrai sonneur) ;
  // la bombarde détache ses notes d'un coup de langue (≈ 15 dB).
  const dip = async preset => {
    const x = await render(preset, [{ t: 0.05, len: 0.4, note: 72 }, { t: 0.45, len: 0.4, note: 76 }], 1.1);
    const e = rmsEnv(x, 0, x.length, 440), at = s => Math.round(s * SR / 220);
    const lvl = Math.min(...[0.25, 0.65].map(s => e[at(s)]));
    return db(Math.min(...e.slice(at(0.4), at(0.5))) / lvl);
  };
  const legato = await dip('cornemuse'), tongued = await dip('bombarde');
  t.ok(legato > -3, 'cornemuse : notes liées sans trou', legato.toFixed(1));
  t.ok(tongued < -8, 'bombarde : notes détachées (coup de langue)', tongued.toFixed(1));

  // Gamme de la cornemuse : intervalles justes autour de la tonique, sol grave très bas (7/8), sol aigu un peu haut.
  const tune = { root: 69, scale: 'pipe' };
  t.near(A.tunedNote(67, tune) - 67, -0.29, 0.001, 'sol grave : 29 centièmes sous le tempéré');
  t.near(A.tunedNote(79, tune) - 79, 0.17, 0.001, 'sol aigu : 17 centièmes au-dessus');
  t.near(A.tunedNote(73, tune) - 73, -0.09, 0.001, 'tierce : presque juste (5/4)');
  t.near(A.tunedNote(76, tune), 76.07, 1e-9, 'quinte');
  t.eq(A.tunedNote(81, tune), 81, 'octave');
  t.eq(A.tunedNote(64, null), 64, 'sans gamme propre : tempéré');

  // Breizh generator : la cornemuse et ses bourdons jouent dans la gamme du chalumeau ; agréments sur le sol aigu.
  const S = A.state;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  Object.assign(S.breizh, { instrument: 'cornemuse', dance: 'march', tonic: 9, mode: 'mixolydian', bars: 4, form: 'AB', repeat: 1, ornaments: 'light', drone: 'tonic', seed: 4, draft: null });
  A.renderBreizh();
  const seq = A.breizhDraft().seq, tonic = A.bzTonic('cornemuse', 9);
  const graces = seq.filter(n => n.len < 0.1);
  t.ok(graces.length >= 3 && graces.every(n => [tonic + 10, tonic + 12].includes(n.note)), 'agréments de la cornemuse : sol aigu (la aigu sur le sol aigu)', graces.map(n => n.note - tonic));
  A.generateBreizhClips();
  const clips = S.tl.tracks.flatMap(tr => tr.clips);
  t.ok(clips.length === 2 && clips.every(c => c.tune?.scale === 'pipe' && c.tune.root === tonic), 'les blocs de la cornemuse et du bourdon gardent la gamme du chalumeau', clips.map(c => c.tune));
  Object.assign(S.breizh, { instrument: 'bagad', draft: null });
  A.renderBreizh();
  t.eq(A.breizhParts().map(p => p.tune?.scale ?? null), ['pipe', null, 'pipe'], 'bagad : cornemuses et bourdon dans la gamme du chalumeau, bombardes tempérées');
  // Lecture : la note jouée est accordée (fréquence de la voix).
  const E = A.engine;
  t.$('#tl-play').click();
  const v = await t.until(() => [...E.voices.values()].find(x => x.patched && x.freq > 300), 4000);
  t.ok(v && clips[0].seq.some(n => Math.abs(440 * 2 ** ((A.tunedNote(n.note, clips[0].tune) - 69) / 12) - v.freq) < 0.01), 'la timeline joue la note accordée', v?.freq);
  t.$('#tl-play').click();
  await t.until(() => E.voices.size === 0, 4000);
}
