// Compteur CPU de l'en-tête : au repos tout est « OK », une interface occupée fait monter la barre Interface,
// une surcharge du moteur audio allume la barre Audio (« retard »), qui revient à OK ensuite.
export default async function (t, A) {
  const rows = () => Object.fromEntries(t.$$('#cpu .cpu-row').map(r => [r.dataset.k, { w: parseFloat(r.querySelector('em').style.width) || 0, txt: r.querySelector('small').textContent }]));
  await t.wait(2500);
  let r = rows();
  t.ok(r.audio && r.ui, 'deux barres : Audio et Interface');
  t.ok(r.audio.txt === 'OK' || /%/.test(r.audio.txt), 'audio au repos : OK', r.audio);
  t.ok(r.ui.w >= 0 && r.ui.w <= 100 && /%/.test(r.ui.txt), 'barre Interface en pourcentage', r.ui);   // au repos la valeur dépend de la charge de la machine
  t.ok(/\n/.test(t.$('#cpu').title) || t.$('#cpu').title.length > 20, 'infobulle détaillée');

  // Interface occupée : 40 ms de calcul toutes les 50 ms.
  const busy = setInterval(() => { const e = performance.now() + 40; while (performance.now() < e); }, 50);
  await t.wait(2000);
  clearInterval(busy);
  r = rows();
  t.ok(r.ui.w >= 25, 'interface occupée : la barre monte', r.ui);
  await t.wait(1500);

  // Surcharge audio : des milliers d'oscillateurs filtrés.
  const ctx = A.engine.ctx, heavy = [];
  for (let k = 0; k < 6000; k++) { const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); o.connect(f).connect(A.engine.master); o.start(); heavy.push(o); }
  const lag = await t.until(() => rows().audio.w >= 80 || A.cpuMeter.precise && A.cpuMeter.audio > 0.5, 8000, 250);
  for (const o of heavy) { o.stop(); o.disconnect(); }
  t.ok(lag, 'surcharge audio détectée', rows().audio);
  const back = await t.until(() => rows().audio.txt === 'OK' || A.cpuMeter.precise, 8000, 250);
  t.ok(back, 'le moteur audio revient à OK', rows().audio);
}
