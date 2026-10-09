// Designer de kick : réglages invalides d'une ancienne sauvegarde nettoyés, hauteur de la queue accordée,
// presets, potard qui rend le son « perso », envoi vers un pad et vers la bibliothèque, retrait, aide.
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
  t.eq(t.$$('#kick-knobs .knob').length, 12, '12 potards');
  const presets = t.$$('#kick-presets button');
  t.eq(presets.length, 8, '8 presets');
  // Hauteur de la queue : fa (87 Hz), puis une octave au-dessus.
  const base = { ...S.kick.params, length: 0.6, bend: 0, drive: 0.3, zaag: 0 };
  const k1 = await A.synthKick(base, sr);
  const k2 = await A.synthKick({ ...base, tune: 1 }, sr);
  let peak = 0; for (const v of k1) peak = Math.max(peak, Math.abs(v));
  t.ok(peak > 0.3 && peak <= 1.0001, 'kick rendu à bon niveau', peak);
  // Hauteur attendue : fa3 (175 Hz) décalé de Tune (-12..+12 demi-tons), voir js/kickdesign.js.
  const expect = tune => 440 * 2 ** ((53 + Math.round(tune * 24) - 12 - 69) / 12);
  t.near(pitch(k1, sr), expect(base.tune), expect(base.tune) * 0.05, 'queue accordée sur Tune (fa3 au centre)');
  t.near(pitch(k2, sr), expect(1), expect(1) * 0.05, 'Tune au maximum : une octave au-dessus de fa3');
  // Chaque preset change le son.
  const lens = new Set();
  for (const b of presets) {
    b.click();
    await t.wait(80);
    lens.add(Math.round((await A.kickRender()).duration * 1000));
  }
  t.ok(lens.size >= 4, 'les presets donnent des kicks différents', [...lens]);
  t.eq(t.$('#kick-presets button.active')?.dataset.preset, presets.at(-1).dataset.preset, 'le dernier preset choisi est actif');
  // Molette sur un potard : le son devient « perso ».
  const knob = t.$$('#kick-knobs .knob')[5];
  const z0 = S.kick.params.zaag;
  knob.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  await t.wait(150);
  t.ok(S.kick.params.zaag !== z0, 'le potard change le réglage');
  t.eq(S.kick.preset, null, 'le son devient perso');
  // → Pad.
  t.$('#kick-to-pad').click();
  const pad = await t.until(() => S.banks[S.bank][S.selected]?.buffer && S.banks[S.bank][S.selected], 5000);
  t.ok(pad?.name?.startsWith('Kick'), 'le kick arrive sur le pad sélectionné', pad?.name);
  t.ok(pad?.sampleId?.startsWith('user:'), 'son importé (user:)');
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
