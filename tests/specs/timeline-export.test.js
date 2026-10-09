// Export : mixage (longueur = fin du dernier bloc + queue), stem d'une piste, sidechain dans l'export,
// boutons WAV et stems (ZIP, une piste par fichier) ; le son en direct n'est pas touché.
export default async function (t, A) {
  const S = A.state;
  // Téléchargements interceptés (rien n'est écrit sur le disque).
  const downloads = [];
  HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, name: this.download }); };
  const stats = chans => {
    let peak = 0, sum = 0, n = 0;
    for (const c of chans) for (let i = 0; i < c.length; i += 7) { const v = Math.abs(c[i]); peak = Math.max(peak, v); sum += v * v; n++; }
    return { seconds: chans[0].length / A.engine.ctx.sampleRate, peak, rms: Math.sqrt(sum / n) };
  };
  await A.loadDemo();
  await t.wait(300);
  const end = A.songEndBeats();
  t.ok(end > 64, 'le morceau de démo a une fin', end);
  const mix = stats(await A.renderSong());
  t.near(mix.seconds, end * 60 / S.bpm + 3, 0.2, 'mixage : jusqu\'à la fin du dernier bloc, plus 3 s de queue');
  t.ok(mix.peak > 0.2 && mix.peak <= 1 && mix.rms > 0.02, 'mixage audible, sans dépasser', mix);
  // Stem : la piste des nappes seule, plus calme que le mixage.
  const tr = S.tl.tracks.findIndex(x => x.clips.some(c => c.cat === 'pad'));
  t.ok(tr >= 0, 'une piste de nappes', tr);
  const stem = stats(await A.renderSong(tr));
  t.near(stem.seconds, mix.seconds, 0.01, 'le stem a la longueur du morceau');
  t.ok(stem.rms > 0.002 && stem.rms < mix.rms, 'le stem ne contient que sa piste', { stem: stem.rms, mix: mix.rms });
  A.setSidechain({ on: true, source: 'beat' });
  const sc = stats(await A.renderSong(tr));
  A.setSidechain({ on: false, source: 'kicks' });
  t.ok(sc.rms < stem.rms * 0.95, 'le sidechain baisse les nappes dans l\'export', { sc: sc.rms, stem: stem.rms });
  // Morceau raccourci à 8 mesures pour les fichiers (le ZIP de toutes les pistes reste petit).
  for (const x of S.tl.tracks) x.clips = x.clips.filter(c => c.start < 32);
  // Bouton WAV.
  t.$('#tl-export').click();
  t.ok(await t.until(() => downloads.length >= 1, 60000), 'WAV : un fichier est proposé');
  const wav = await (await fetch(downloads[0].href)).arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(wav, 0, 4)) + new TextDecoder().decode(new Uint8Array(wav, 8, 4));
  t.eq(head, 'RIFFWAVE', 'fichier WAV valide');
  t.ok(/^gabberkey-\d{8}-\d{6}\.wav$/.test(downloads[0].name), 'nom daté', downloads[0].name);
  t.ok(wav.byteLength > 1e6, 'le fichier contient le morceau', wav.byteLength);
  // Bouton stems : désactivé pendant le rendu, puis un ZIP d'un WAV par piste non vide.
  t.$('#tl-stems').click();
  await t.wait(30);
  t.ok(t.$('#tl-stems').disabled && t.$('#tl-export').disabled, 'boutons désactivés pendant l\'export');
  t.ok(await t.until(() => downloads.length >= 2, 120000, 200), 'stems : un fichier est proposé');
  const zip = new Uint8Array(await (await fetch(downloads[1].href)).arrayBuffer());
  const entries = new DataView(zip.buffer).getUint16(zip.length - 22 + 10, true);
  const nonEmpty = S.tl.tracks.filter(x => !x.mute && x.clips.length).length;
  t.ok(zip[0] === 0x50 && zip[1] === 0x4b && /-stems\.zip$/.test(downloads[1].name), 'fichier ZIP', downloads[1].name);
  t.eq(entries, nonEmpty, 'un WAV par piste non vide');
  t.ok(await t.until(() => !t.$('#tl-stems').disabled, 2000), 'boutons réactivés après l\'export');
  // Le moteur en direct n'est pas touché.
  A.timeline.play(0);
  await t.wait(400);
  t.ok(A.timeline.playing && A.engine.ctx.state === 'running', 'la timeline joue toujours en direct');
  A.timeline.stop();
}
