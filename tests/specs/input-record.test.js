// Entrée audio (micro simulé par Firefox) : fenêtre, activation, vumètre, source « Entrée audio » d'une piste armée,
// enregistrement -> bloc audio non silencieux, compensation de latence, réglages enregistrés.
export default async function (t, A) {
  const S = A.state;
  A.wm.toggle('input', true);
  t.ok(t.$('#input-open') && t.$('#input-device'), 'fenêtre Entrée audio');
  t.eq(A.cleanInputState(undefined), { device: '', level: 1, monitor: false, latency: null }, 'ancienne sauvegarde : réglages par défaut');
  t.$('#input-open').click();
  t.ok(await t.until(() => A.input.stream, 5000), 'entrée activée (micro simulé)');
  t.ok(/Active|Actif|Active/i.test(t.$('#input-status').textContent), 'état affiché', t.$('#input-status').textContent);
  t.ok(await t.until(() => A.inputLevel() > 0.01, 3000), 'le vumètre reçoit le son', A.inputLevel());
  t.ok(!S.input.monitor, 'écoute de retour coupée par défaut');

  // Latence : automatique, puis réglée à la main.
  t.ok(A.inputLatency() > 0 && A.inputLatency() < 0.5, 'latence automatique estimée', A.inputLatency());
  const auto = t.$('#input-latency-auto');
  auto.checked = false; auto.dispatchEvent(new Event('change'));
  const lat = t.$('#input-latency');
  lat.value = 40; lat.dispatchEvent(new Event('input')); lat.dispatchEvent(new Event('change'));
  t.eq(S.input.latency, 40, 'latence réglée à 40 ms');
  t.near(A.inputLatency(), 0.04, 1e-6, 'utilisée pour recaler la prise');

  // Enregistrer : piste 3 armée sur l'entrée audio.
  S.tl.tracks.forEach(tr => { tr.arm = false; tr.clips = tr.clips.filter(c => !c.sampleId?.startsWith('rec:')); });
  S.tl.tracks[2].arm = true;
  S.tl.tracks[2].src = 'input';
  S.tl.playhead = 0;
  S.metro.on = false;
  t.$('#tl-rec').click();
  t.ok(await t.until(() => A.tlRec, 3000), 'enregistrement lancé');
  await t.wait(1500);
  t.$('#tl-rec').click();
  const clip = await t.until(() => S.tl.tracks[2].clips.find(c => c.sampleId?.startsWith('rec:')), 6000);
  t.ok(clip, 'la prise devient un bloc sur la piste armée');
  t.ok(/Entrée audio|Audio input/.test(clip?.name ?? ''), 'nommé d’après l’entrée', clip?.name);
  const buf = A.clipBuffer(clip.sampleId);
  let p = 0; for (let i = 0; i < buf.length; i += 11) p = Math.max(p, Math.abs(buf.getChannelData(0)[i]));
  t.ok(buf.duration > 1 && p > 0.01, 'elle contient le son de l’entrée', [buf.duration, p]);
  t.eq(A.stateSnapshot().input.latency, 40, 'réglages enregistrés avec le projet');
  t.$('#input-open').click();
  t.ok(!A.input.stream, 'entrée coupée');
}
