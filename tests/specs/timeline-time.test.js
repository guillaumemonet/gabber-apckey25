// Timeline : compteur de temps de lecture (temps écoulé, mesure.temps, durée du morceau).
export default async function (t, A) {
  const S = A.state;
  await A.loadDemoFile(2);
  await t.until(() => S.tl.tracks.length === 15, 10000);
  await t.wait(800);
  const parts = () => t.$$('#tl-time > *').map(e => e.textContent);
  const [t0, pos0, total] = parts();
  t.eq(t0, '0:00.0', 'temps à zéro au départ');
  t.eq(pos0, '1.1', 'position 1.1 au départ');
  const m = /(\d+):(\d\d)/.exec(total);
  const secs = m ? +m[1] * 60 + +m[2] : 0;
  t.ok(secs >= 78 && secs <= 90, 'durée du morceau ≈ 64 mesures à 190 BPM', total);
  // Lecture depuis la mesure 9 : 32 temps = 10,1 s.
  A.timeline.play(32);
  await t.wait(1500);
  const [t1, pos1] = parts();
  const now = A.timeline.position() * 60 / S.bpm;   // position réelle de la lecture (le compteur doit la suivre)
  A.timeline.stop();
  const [mm, ss] = t1.split(':');
  const el = +mm * 60 + +ss;
  t.ok(el >= 10.1 && Math.abs(el - now) < 0.4, 'le temps suit la lecture', [t1, +now.toFixed(1)]);
  t.ok(/^(9|10|11)\.\d$/.test(pos1), 'mesure.temps suit la lecture', pos1);
  // À l'arrêt, le compteur suit la tête de lecture déplacée.
  S.tl.playhead = 16;
  await t.wait(200);
  t.eq(parts()[1], '5.1', 'tête de lecture déplacée à la mesure 5');
}
