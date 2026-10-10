// Départ des pads calé sur la grille : le 1er pad part tout de suite, le suivant attend la mesure (il clignote vite,
// à l'écran et sur l'APC), une boucle rappuyée s'arrête en fin de mesure, un son court calé sur 1 temps, Libre = immédiat.
export default async function (t, A) {
  const S = A.state, E = A.engine, ctx = E.ctx;
  A.wm.toggle('pads', true);
  A.setBpm(120);
  A.setBank(15);   // Anthems : pads 25-32 = rythmiques en boucle
  const leds = [];
  Object.defineProperty(A.apc, 'connected', { get: () => true });
  A.apc.setPad = (i, c, m) => { if (i === 25) leds.push(m); };
  const sel = t.$('#pad-quant');
  t.eq([...sel.options].map(o => o.textContent), ['Libre', '1 temps', '2 temps', '3 temps', '1 mesure', '2 mesures', '4 mesures'], 'choix du départ');
  sel.value = '4'; sel.dispatchEvent(new Event('change'));
  t.eq(S.padQuant, 4, 'réglage enregistré dans l’état');
  const press = i => {
    A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: true } }));
    A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: false } }));
  };
  const key = i => 15 * 40 + i;
  const v = i => E.padVoices.get(key(i));
  const padEl = i => t.$$('#pads .pad').find(p => p.querySelector('.num').textContent === String(i + 1));
  const bar = 2;   // 1 mesure à 120 BPM

  press(24);
  t.ok(v(24), 'le premier pad joue');
  t.ok(v(24).startAt - ctx.currentTime < 0.05, 'rien ne joue encore : le premier pad part tout de suite', v(24).startAt - ctx.currentTime);
  await t.wait(500);
  press(25);
  const v2 = v(25);
  t.ok(v2, 'le second pad est programmé');
  const phase = (v2.startAt - E.origin) / bar;
  t.near(phase, Math.round(phase), 0.002, 'il part pile sur une barre de mesure');
  t.ok(v2.startAt - ctx.currentTime > 0.5, 'il attend la mesure suivante', v2.startAt - ctx.currentTime);
  await t.wait(300);
  t.ok(padEl(25).classList.contains('pending'), 'à l’écran, le pad en attente clignote');
  t.ok(leds.includes('on') && leds.includes('off'), 'sur l’APC, la LED alterne pendant l’attente', [...new Set(leds)]);
  await t.wait((v2.startAt - ctx.currentTime) * 1000 + 300);
  t.ok(!padEl(25).classList.contains('pending') && padEl(25).classList.contains('playing'), 'une fois parti, il joue normalement');
  t.eq(leds.at(-1), 'pulse', 'LED d’une boucle qui joue');

  // Rappuyer sur la boucle : arrêt à la fin de la mesure.
  press(25);
  const st = v(25)?.stopAt;
  t.ok(st > ctx.currentTime, 'arrêt programmé', st);
  const sb = (st - E.origin) / bar;
  t.near(sb - Math.round(sb), 0, 0.002, 'arrêt pile en fin de mesure');   // distance à la mesure la plus proche (0.9999… = pile)
  t.ok(v(25), 'la voix reste là jusqu’à l’arrêt');
  await t.wait((st - ctx.currentTime) * 1000 + 250);
  t.ok(!v(25), 'puis elle s’arrête');

  // Son court calé sur 1 temps pendant que la boucle 24 tourne.
  sel.value = '1'; sel.dispatchEvent(new Event('change'));
  A.setBank(16);   // Anthem drums : pad 1 = kick (un coup)
  await t.wait(100);
  press(0);
  const k = E.padVoices.get(16 * 40);
  t.ok(k, 'le kick est programmé');
  if (k) { const ph = (k.startAt - E.origin) / 0.5; t.near(ph, Math.round(ph), 0.002, 'il part pile sur un temps'); }
  // Libre : immédiat.
  sel.value = '0'; sel.dispatchEvent(new Event('change'));
  await t.wait(300);
  press(1);
  const k2 = E.padVoices.get(16 * 40 + 1);
  t.ok(k2 && k2.startAt - ctx.currentTime < 0.05, 'Libre : le son part tout de suite');
  E.stopAllPads();
}
