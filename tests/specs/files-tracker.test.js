// Modules de tracker : lecture d'un .mod (volume, glissement vers la note, glissement de volume, arpège, coupure, fin
// de pattern) et d'un .xm (note relative, boucle aller-retour, enveloppe de volume, note relâchée, glissement vers le
// haut, tempo ramené entre 40 et 240), puis import par « Ouvrir… » (samples sur les pads d'une banque vide, voies en
// blocs de notes joués par l'instrument échantillon, tempo du module), lecture, fichier illisible.

// .mod ProTracker à 4 voies : cells[ligne][voie] = [période, sample, effet, paramètre].
function buildMod(samples, cells) {
  const pat = new Uint8Array(64 * 4 * 4);
  for (const [r, row] of Object.entries(cells)) row.forEach((c, ch) => {
    if (!c) return;
    const [per, smp, fx, p] = c, at = (r * 4 + ch) * 4;
    pat.set([(smp & 0xf0) | (per >> 8), per & 255, ((smp & 15) << 4) | fx, p], at);
  });
  const head = new Uint8Array(1084);
  head.set([...'tracker test'].map(c => c.charCodeAt(0)), 0);
  samples.forEach((s, i) => {
    const at = 20 + i * 30;
    head.set([...s.name].map(c => c.charCodeAt(0)), at);
    head.set([s.data.length >> 9, (s.data.length >> 1) & 255, 0, s.vol, 0, (s.ls ?? 0) >> 1, 0, (s.ll ?? 2) >> 1], at + 22);
  });
  head[950] = 1;
  head.set([...'M.K.'].map(c => c.charCodeAt(0)), 1080);
  return new Uint8Array([...head, ...pat, ...samples.flatMap(s => [...s.data])]).buffer;
}

// .xm à 2 voies, un instrument, un sample 16 bits ; cells[ligne][voie] = [note, instrument, volume, effet, paramètre].
function buildXm({ speed, tempo, rows, cells, sample, env, fadeout }) {
  const b = [];
  const u8 = v => b.push(v & 255), u16 = v => { u8(v); u8(v >> 8); }, u32 = v => { u16(v); u16(v >>> 16); };
  const txt = (s, n) => { for (let i = 0; i < n; i++) u8(s.charCodeAt(i) || 0); };
  txt('Extended Module: ', 17); txt('xm test', 20); u8(0x1a); txt('test', 20); u16(0x104);
  u32(276); u16(1); u16(0); u16(2); u16(1); u16(1); u16(1); u16(speed); u16(tempo);
  for (let i = 0; i < 256; i++) u8(0);
  u32(9); u8(0); u16(rows); u16(rows * 2 * 5);
  for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) for (const v of cells[r]?.[c] ?? [0, 0, 0, 0, 0]) u8(v);
  const ins = b.length;
  u32(263); txt('lead', 22); u8(0); u16(1); u32(40);
  for (let i = 0; i < 96; i++) u8(0);
  for (let i = 0; i < 12; i++) { u16(env.pts[i]?.[0] ?? 0); u16(env.pts[i]?.[1] ?? 0); }
  for (let i = 0; i < 48; i++) u8(0);
  u8(env.pts.length); u8(0); u8(env.sus); u8(0); u8(0); u8(0); u8(0); u8(0); u8(1 | 2); u8(0); u8(0); u8(0); u8(0); u8(0); u16(fadeout);
  while (b.length < ins + 263) u8(0);
  const n = sample.data.length;
  u32(n * 2); u32(sample.ls * 2); u32(sample.ll * 2); u8(64); u8(0); u8(0x12); u8(128); u8(sample.rel); u8(0); txt('pingpong', 22);
  let prev = 0;
  for (const v of sample.data) { u16((v - prev) & 0xffff); prev = v; }
  return new Uint8Array(b).buffer;
}

export default async function (t, A) {
  const S = A.state;
  // --- .mod ---
  const saw = { name: 'saw', vol: 64, data: Array.from({ length: 64 }, (_, i) => (i * 4) & 255), ls: 0, ll: 64 };
  const noise = { name: 'hat', vol: 32, data: Array.from({ length: 200 }, (_, i) => (i * 97) & 255) };
  const mod = buildMod([saw, noise], {
    0: [[428, 1, 12, 0x20], [428, 2, 0, 0]],
    4: [[381, 0, 3, 0x10]],
    8: [[0, 0, 10, 0x02]],
    12: [[339, 1, 0, 0x37]],
    16: [[0, 0, 14, 0xc2]],
    20: [null, null, [214, 1, 0, 0]],
    31: [[0, 0, 13, 0]],
  });
  t.eq(A.trackerKind(mod), 'mod', 'module MOD reconnu (signature M.K.)');
  const m = A.readTracker(mod);
  t.eq([m.format, m.bpm, m.beats], ['mod', 125, 8], 'tempo (vitesse 6, 125) et durée : 32 lignes = 8 temps');
  t.near(m.samples[0].root, 60, 0.01, 'sample : do2 de ProTracker = note MIDI 60 à vitesse normale');
  t.eq(m.samples[0].loop, [0, 64], 'boucle du sample');
  const [n1, n2] = m.channels[0];
  t.eq([n1.t, n1.note, n1.vel], [0, 60, 0.5], 'première note : do, volume Cxx (32/64)');
  t.near(n1.pp.at(-1)[1], 12 * Math.log2(428 / 381), 0.02, 'glissement vers la note : il arrive au ré sans rejouer la note');
  t.ok(n1.pv.length >= 5 && n1.pv.at(-1)[1] < 0.36, 'glissement de volume : le volume baisse à chaque tick', n1.pv);
  t.eq([n2.t, n2.note], [3, 64], 'note suivante : mi, ligne 12');
  t.ok([3, 7].every(s => n2.pp.some(([, v]) => v === s)), 'arpège 0x37 : tierce et quinte', n2.pp);
  t.near(n2.len, 1 + 2 / 24, 1e-3, 'coupée au 2e tick de la ligne 16 (EC2)');
  t.eq(m.channels[2].map(n => [n.t, n.note]), [[5, 72]], 'voie 3 : do3 de ProTracker = note 72');
  t.ok(m.channels[1][0].len < 0.1, 'sample sans boucle : la note dure le temps du son', m.channels[1][0].len);

  // --- .xm ---
  const xm = buildXm({ speed: 3, tempo: 150, rows: 8, fadeout: 0x800,
    cells: { 0: [[49, 1, 0x50, 0, 0], [61, 1, 0, 1, 8]], 2: [[97, 0, 0, 0, 0]] },
    sample: { data: Array.from({ length: 60 }, (_, i) => Math.round(Math.sin(i / 3) * 20000)), ls: 20, ll: 40, rel: 12 },
    env: { pts: [[0, 64], [10, 32], [20, 0]], sus: 1 } });
  const x = A.readTracker(xm);
  t.eq([x.format, x.bpm], ['xm', 150], 'XM : vitesse 3 à 150 = 300 BPM, ramené à 150');
  t.eq([x.samples[0].rate, x.samples[0].loop, x.samples[0].data.length], [16726, [20, 100], 100], 'note relative +12 dans la fréquence ; boucle aller-retour dépliée');
  const [c1] = x.channels[0];
  t.eq([c1.note, c1.vel], [60, 1], 'do4 de FastTracker = note 60, volume 64');
  t.ok(c1.pv.some(([, v]) => v > 0.5 && v < 1) && c1.pv.at(-1)[1] === 0, 'enveloppe : le volume descend, puis s’éteint après la note relâchée', c1.pv);
  t.near(c1.len, 20 / 60 * 150 / 60, 0.03, 'la note finit quand l’enveloppe arrive à zéro (20 ticks)');
  t.near(x.channels[1][0].pp.at(-1)[1], 1, 1e-6, 'glissement vers le haut 1x08 : un demi-ton sur deux ticks (linéaire)');

  // --- Import par « Ouvrir… » ---
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.arm = false; });
  S.tl.tracks[0].arm = true;
  S.tl.playhead = 0;
  const free = S.banks.findIndex((bank, b) => b >= S.bank && bank.every(p => !p));
  const input = t.$('#file-input');
  const dt = new DataTransfer();
  dt.items.add(new File([mod], 'test.mod'));
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
  const blocks = () => S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.smps);
  t.ok(await t.until(() => blocks().length === 3, 3000), 'trois voies importées en blocs de notes', blocks().length);
  t.eq(S.bpm, 125, 'timeline vide : le tempo du module est repris');
  const pads = S.banks[free].slice(0, 2);
  t.eq(pads.map(p => p?.name), ['saw', 'hat'], 'samples sur les pads de la première banque vide', free);
  t.ok(pads[0].smp && Math.abs(pads[0].smp.root - 60) < 0.01 && Math.abs(pads[0].smp.loop[1] - 64 / pads[0].buffer.sampleRate) < 1e-6, 'le pad garde sa note et sa boucle', pads[0].smp);
  const first = blocks().find(c => c.seq.some(n => n.note === 64));
  t.eq(first.smps, [{ bank: free, pad: 0 }], 'le bloc joue le pad du sample');
  t.ok(/test|tracker/.test(t.$('#toast').textContent) && new RegExp(String(free + 1)).test(t.$('#toast').textContent), 'message : banque et tempo', t.$('#toast').textContent);
  t.ok(A.padsInUse().includes(pads[0]), 'pads joués par la timeline : décodés au démarrage');

  // Lecture : l'instrument échantillon joue.
  A.timeline.play(0);
  t.ok(await t.until(() => A.timeline.sampler?.all.size > 0, 3000), 'la timeline joue les notes avec l’instrument échantillon');
  A.timeline.stop();
  t.ok(await t.until(() => [...A.timeline.sampler.all].every(v => v.released), 2000), 'arrêt : les voies sont coupées');

  // Piano roll : le menu des sons montre les samples ; un autre son les met de côté, on peut y revenir.
  A.openRoll(first, true);
  const sel = t.$('#roll-preset');
  t.eq(sel.value, A.ROLL_SMP, 'menu des sons : « Samples du module »');
  sel.value = sel.options[2].value;
  sel.dispatchEvent(new Event('change'));
  t.ok(!first.smps && first.smpsOff && first.preset === sel.options[2].value, 'un preset du synthé remplace les samples', first.preset);
  sel.value = A.ROLL_SMP;
  sel.dispatchEvent(new Event('change'));
  t.ok(first.smps?.length === 1 && !first.smpsOff && !first.preset, 'retour aux samples du module');
  A.wm.toggle('roll', false);

  // Fichier illisible.
  t.eq(await A.importTrackerFile(new File([new Uint8Array(700)], 'bad.xm')), 0, 'fichier illisible : rien n’est importé');
  t.ok(/illisible|Unreadable/i.test(t.$('#toast').textContent), 'et un message l’explique');
}
