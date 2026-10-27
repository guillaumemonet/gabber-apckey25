// Designer de kick : réglages invalides d'une ancienne sauvegarde nettoyés, hauteur de la queue accordée,
// presets, potentiomètre qui rend le son « perso », envoi vers un pad et vers la bibliothèque, retrait, aide.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, kick: { params: { zaag: 'x', drive: 3 }, preset: 'nope' },
        userSounds: [{ sampleId: 'lib:bad' }, null], banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}
// Hauteur de la queue : passages à zéro montants entre 150 et 300 ms.
function pitch(data, sr) {
  let n = 0;
  const a = Math.round(0.15 * sr), b = Math.min(data.length - 1, Math.round(0.3 * sr));
  for (let i = a; i < b; i++) if (data[i - 1] < 0 && data[i] >= 0) n++;
  return n / ((b - a) / sr);
}

export default async function (t, A) {
  const S = A.state, sr = A.engine.ctx.sampleRate;
  t.eq(S.kick.preset, null, 'preset inconnu de la sauvegarde ignoré');
  t.ok(S.kick.params.drive >= 0 && S.kick.params.drive <= 1, 'drive ramené dans 0..1', S.kick.params.drive);
  t.ok(Number.isFinite(S.kick.params.zaag), 'zaag invalide remplacé par une valeur par défaut', S.kick.params.zaag);
  t.eq(S.userSounds.length, 0, 'sons perso invalides écartés');
  A.wm.toggle('kick', true);
  await t.wait(50);
  t.eq(t.$$('#kick-knobs .knob').length, 12, '12 potentiomètres');
  const presets = t.$$('#kick-presets button');
  t.eq(presets.length, 13, '13 presets');
  // Hauteur de la queue : fa (87 Hz), puis une octave au-dessus.
  const base = { ...S.kick.params, length: 0.6, bend: 0, drive: 0.3, zaag: 0 };
  const k1 = await A.synthKick(base, sr);
  const k2 = await A.synthKick({ ...base, tune: 1 }, sr);
  let peak = 0; for (const v of k1) peak = Math.max(peak, Math.abs(v));
  t.ok(peak > 0.3 && peak <= 1.0001, 'kick rendu à bon niveau', peak);
  // Hauteur attendue : fa2 (87 Hz, comme les kicks des banques) décalé de Tune (-12..+12 demi-tons), voir js/kickdesign.js.
  const expect = tune => 440 * 2 ** ((41 + Math.round(tune * 24) - 12 - 69) / 12);
  t.near(pitch(k1, sr), expect(base.tune), expect(base.tune) * 0.05, 'queue accordée sur Tune (fa2 au centre)');
  t.near(pitch(k2, sr), expect(1), expect(1) * 0.05, 'Tune au maximum : une octave au-dessus de fa2');
  // Presets early hardcore : queues accordées dans la gamme de fa mineur, entre 50 et 130 Hz (la#1, ré#2, fa2).
  t.eq(['hall', 'doef', 'clipped'].map(id => A.kickTailNote(A.KICK_PRESETS[id])), [34, 39, 41], 'presets early : notes des queues');
  const hall = await A.synthKick({ ...A.kickDefaults(), ...A.KICK_PRESETS.hall }, sr);
  t.near(pitch(hall, sr), 58.3, 58.3 * 0.08, 'preset Grande salle : queue vers 58 Hz', pitch(hall, sr));
  // Chaque preset change le son.
  const lens = new Set();
  for (const b of presets) {
    b.click();
    await t.wait(80);
    lens.add(Math.round((await A.kickRender()).duration * 1000));
  }
  t.ok(lens.size >= 4, 'les presets donnent des kicks différents', [...lens]);
  t.eq(t.$('#kick-presets button.active')?.dataset.preset, presets.at(-1).dataset.preset, 'le dernier preset choisi est actif');
  // Molette sur un potentiomètre : le son devient « perso ».
  const knob = t.$$('#kick-knobs .knob')[5];
  const z0 = S.kick.params.zaag;
  knob.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  await t.wait(150);
  t.ok(S.kick.params.zaag !== z0, 'le potentiomètre change le réglage');
  t.eq(S.kick.preset, null, 'le son devient perso');
  // Envoyer vers… : la grille des pads, banque 20, pad 1.
  t.$('#kick-to-pad').click();
  await t.wait(30);
  t.ok(t.$('.send-menu') && !t.$('.send-menu .send-tabs [data-target="launcher"]'), 'Envoyer vers… : la grille des pads (pas le lanceur)');
  const bk = t.$('.send-menu .send-bank');
  bk.value = '19'; bk.dispatchEvent(new Event('change'));
  t.$('.send-menu .send-cell[data-cell="0"]').click();
  const pad = await t.until(() => S.banks[19][0]?.buffer && S.banks[19][0], 5000);
  t.ok(pad?.name?.startsWith('Kick'), 'le kick arrive sur le pad choisi', pad?.name);
  t.ok(pad?.sampleId?.startsWith('rec:'), 'enregistré avec le projet (rec:)');
  S.banks[19][0] = null;
  // → Bibliothèque, puis retrait.
  t.$('#kick-to-lib').click();
  await t.until(() => S.userSounds.length === 1, 5000);
  t.eq(S.userSounds.length, 1, 'le kick rejoint la bibliothèque');
  t.eq(S.userSounds[0]?.cat, 'kick', 'catégorie Kicks');
  await t.wait(200);
  const own = t.$$('#lib-list .lib-item').find(r => r.textContent.includes(S.userSounds[0].name));
  t.ok(own, 'il est listé dans la bibliothèque');
  own?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await t.wait(200);
  t.eq(S.userSounds.length, 0, 'clic droit : retiré de la bibliothèque');
  t.$('[data-win="kick"] .win-help').click();
  t.ok(t.$$('.win-help-pop li').length >= 4, 'aide de la fenêtre');
}
