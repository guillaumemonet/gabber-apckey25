// Nouveau morceau : fenêtre ouverte depuis l'en-tête, style (tempo et suite d'accords), plan modifiable (parties
// déplacées, supprimées, ajoutées), création : tempo, pistes nommées, un bloc par partie là où l'élément joue (kick,
// batterie, basse du style, accords, lead), repères, montées avant les drops, générateur et designer de kick réglés,
// Ctrl+Z ramène la timeline d'avant ; style sans basse ; Breizhcore (air du Breizh generator).
export default async function (t, A) {
  const S = A.state;
  window.confirm = () => true;
  S.tl.tracks.forEach(tr => { tr.clips = []; });
  S.tl.tracks[0].clips.push({ id: 'old', type: 'note', seq: [{ t: 0, len: 1, note: 60, vel: 0.8 }], pat: 4, len: 4, start: 0, name: 'Ancien', cat: 'lead', loop: false });
  A.save();
  t.$('#file-new').click();
  t.ok(A.wm.isOpen('start'), 'Nouveau morceau… ouvre la fenêtre');
  const box = t.$('#newsong');
  const pick = (sel, v) => { const el = box.querySelector(sel); el.value = v; el.dispatchEvent(new Event('change')); };

  pick('#start-style', 'hardstyle');
  t.eq([S.start.bpm, box.querySelector('#start-bpm').value, S.start.prog], [150, '150', 'Fm Db Ab Eb'], 'le style règle le tempo et la suite d’accords');
  pick('#start-plan', 'short');
  t.eq(S.start.sections.map(s => s.type), ['intro', 'drop', 'break', 'build', 'drop'], 'plan Court');
  t.ok(/64/.test(box.querySelector('.start-total').textContent), 'longueur totale affichée', box.querySelector('.start-total').textContent);
  const rows = () => [...box.querySelectorAll('.start-sec')];
  rows()[0].querySelectorAll('button')[2].click();   // supprimer l'intro
  t.eq(S.start.sections.map(s => s.type), ['drop', 'break', 'build', 'drop'], 'une partie supprimée');
  rows()[0].querySelectorAll('button')[1].click();   // le drop descend
  t.eq(S.start.sections.map(s => s.type), ['break', 'drop', 'build', 'drop'], 'une partie déplacée');
  rows()[0].querySelectorAll('button')[1].click();
  box.querySelector('#start-add').click();
  t.eq(S.start.sections.length, 5, 'une partie ajoutée');
  pick('#start-plan', 'short');   // retour au plan Court
  t.ok([...box.querySelectorAll('.start-parts input')].every(c => c.checked), 'tout est coché par défaut');

  box.querySelector('#start-create').click();
  t.ok(await t.until(() => S.tl.markers.length === 5 && /150/.test(t.$('#toast').textContent), 30000), 'morceau créé', t.$('#toast').textContent);
  t.eq(S.bpm, 150, 'tempo du style');
  t.eq(S.tl.tracks.slice(0, 5).map(tr => tr.name), ['kick', 'drums', 'bass', 'chords', 'lead'].map(p => A.t(`start.track.${p}`)), 'pistes nommées');
  t.ok(!S.tl.tracks.some(tr => tr.clips.some(c => c.id === 'old')), 'la timeline est remplacée');
  t.eq(S.tl.markers.map(m => m.beat), [0, 32, 96, 160, 192], 'un repère au début de chaque partie');
  t.eq(S.tl.bars, 64, 'longueur du morceau');
  const on = (tr, start) => S.tl.tracks[tr].clips.some(c => c.start === start);
  // intro 0-32, drop 32-96, break 96-160, montée 160-192, drop 192-256.
  t.ok(on(0, 0) && on(0, 32) && !on(0, 96) && !on(0, 160) && on(0, 192), 'kick : intro et drops, pas dans le break ni la montée');
  const kick = S.tl.tracks[0].clips[0];
  t.ok(kick.kick && kick.kickSrc === 'p:raw' && kick.seq.length === 32 && kick.len === 32, 'mélodie de kick du preset du style, un kick par temps', kick.kickSrc);
  t.eq([S.kick.preset, S.gen.prog, S.gen.bassline.style], ['raw', 'Fm Db Ab Eb', 'reverse'], 'designer de kick et générateur réglés sur le style');
  const drums = S.tl.tracks[1].clips;
  t.ok(drums.length > 50 && drums.every(c => c.type === 'pad') && drums.some(c => c.start === 33) && drums.some(c => c.start === 32.5), 'batterie : clap sur 2 et 4, charleston sur les contretemps', drums.length);
  const bass = S.tl.tracks[2].clips;
  t.eq(bass.map(c => c.start), [32, 192], 'basse dans les drops');
  t.eq([...new Set(bass[0].seq.map(n => n.t % 1))].sort(), [0.5, 0.75], 'reverse bass de la hardstyle');
  t.eq(S.tl.tracks[3].clips.map(c => c.start), [32, 96, 160, 192], 'accords : drops, break, montée');
  const lead = S.tl.tracks[4].clips;
  t.eq(lead.map(c => c.start), [32, 96, 192], 'lead : drops et break');
  t.ok(lead[1].seq.length <= lead[0].seq.length, 'plus calme dans le break', [lead[0].seq.length, lead[1].seq.length]);
  const rises = S.tl.tracks.slice(5).flatMap(tr => tr.clips);
  t.ok(rises.length >= 2 && rises.every(c => c.sampleId?.startsWith('rec:')) && rises.some(c => c.start < 192 && c.start >= 160), 'montée : les éléments du designer avant le drop', rises.map(c => c.start));
  t.ok(S.tl.tracks[3].fx.some(f => f.fx === 'hprise'), 'filtre qui monte sur les accords pendant la montée');

  // Lecture du drop : le synthé joue les accords et le lead.
  A.timeline.play(32);
  t.ok(await t.until(() => A.engine.voices.size > 0, 4000), 'le drop joue', A.engine.voices.size);
  A.timeline.stop();

  // Annuler : la timeline d'avant revient.
  A.tlUndo();
  t.ok(S.tl.tracks.some(tr => tr.clips.some(c => c.id === 'old')), 'Ctrl+Z ramène la timeline d’avant');
  A.tlRedo();

  // Style où le kick fait la basse ; Breizhcore sans montées.
  pick('#start-style', 'gabber');
  const bassBox = box.querySelector('.start-parts input[data-part="bass"]');
  t.ok(!bassBox.disabled && !bassBox.checked, 'Gabber : basse décochée (le kick fait la basse), mais cochable');
  bassBox.checked = true; bassBox.dispatchEvent(new Event('change'));
  t.ok(S.start.parts.bass, 'basse ajoutée quand même');
  pick('#start-style', 'breizhcore');
  const bu = box.querySelector('.start-parts input[data-part="buildups"]');
  bu.checked = false; bu.dispatchEvent(new Event('change'));
  box.querySelector('#start-create').click();
  t.ok(await t.until(() => S.bpm === 190 && S.tl.tracks[4]?.clips.length > 0 && S.tl.tracks.slice(5).every(tr => !tr.clips.length), 30000), 'Breizhcore créé, sans montées');
  const air = S.tl.tracks[4].clips[0];
  t.ok(['bombardes', 'bombarde', 'biniou', 'cornemuse', 'bagad'].includes(air.preset), 'mélodie : l’air du Breizh generator', air.preset);
  bu.checked = true; bu.dispatchEvent(new Event('change'));

  // Hardcore sombre : plan Drops enchaînés, coupures, intro mélodique sans kick, montée séparée du drop par une coupure.
  pick('#start-style', 'dark');
  t.eq([S.start.plan, S.start.bpm, S.start.parts.bass], ['chain', 170, false], 'Hardcore sombre : son plan, son tempo, pas de basse');
  t.ok(S.start.sections.some(s => s.type === 'cut' && s.bars === 2), 'coupures de 2 mesures');
  await A.createSong();   // le bouton peut être encore grisé par la création précédente
  t.ok(await t.until(() => S.bpm === 170 && /Hardcore sombre|Dark hardcore/.test(t.$('#toast').textContent), 30000), 'Hardcore sombre créé', t.$('#toast').textContent);
  const secs = A.layoutSections(S.start.sections, 4);
  const at = type => secs.filter(s => s.type === type).map(s => s.start);
  const names = S.tl.tracks.map(tr => tr.name);
  const tr = p => S.tl.tracks[names.indexOf(A.t(`start.track.${p}`))].clips.map(c => c.start);
  t.ok(!names.includes(A.t('start.track.bass')), 'pas de piste de basse');
  t.ok(!tr('kick').includes(0) && at('cut').every(b => !tr('kick').includes(b)) && at('drop').every(b => tr('kick').includes(b)), 'kick : drops, pas dans l’intro ni les coupures');
  t.ok(tr('lead').includes(0) && at('cut').every(b => tr('lead').includes(b)), 'lead dès l’intro et dans les coupures');
  t.eq(S.kick.preset, 'dark', 'kick sombre');
  const firstCut = at('cut')[0], drop2 = at('drop')[1];
  const rise = S.tl.tracks.slice(names.indexOf(A.t('start.track.lead')) + 1).flatMap(x => x.clips);
  t.ok(rise.length && rise.some(c => c.start < firstCut) && rise.every(c => c.start <= drop2), 'montée avant la coupure, jusqu’au drop', rise.map(c => c.start));
  A.wm.toggle('start', false);
}
