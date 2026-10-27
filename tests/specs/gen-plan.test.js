// Plan de morceau : nettoyage (valeurs inconnues remplacées par celles du style avec un avertissement, bornes, notes),
// schéma JSON pour un modèle de langage, construction d'un plan complet (mélodie fournie, suite d'accords propre à
// une partie, éléments choisis partie par partie, réglages du kick, noms des repères), une seule étape d'annulation.
export default async function (t, A) {
  const S = A.state;
  window.confirm = () => true;

  // Nettoyage.
  t.eq(A.cleanPlan(null).plan, null, 'rien à construire');
  t.eq(A.cleanPlan({ style: 'gabber', sections: [] }).plan, null, 'aucune partie');
  const { plan: p1, warnings: w1 } = A.cleanPlan({
    style: 'nope', bpm: 999, prog: 'zz', kick: { preset: 'x', params: { drive: 2, foo: 1 } }, drums: { kit: 'early', hat: 'jazz' },
    bass: { style: 'acid', sound: 'piano?' }, lead: { sound: 'screech', notes: [{ t: 0, len: 1, note: 72 }, { t: -1, len: 1, note: 60 }, { t: 1, len: 1, note: 500 }] },
    sections: [{ type: 'drop', bars: 16, play: ['kick', 'cowbell'] }, { type: 'solo', bars: 8 }, { type: 'break', bars: 1000 }],
  });
  t.eq([p1.style, p1.bpm, p1.prog, p1.kick.preset, p1.kick.params, p1.drums.kit, p1.drums.hat, p1.bass.style, p1.bass.sound],
    ['anthem', 240, A.STYLES.anthem.prog, 'mainstream', { drive: 1 }, 'early', 'off', 'acid', 'sub_bass'], 'valeurs inconnues : celles du style');
  t.eq(p1.lead.notes, [{ t: 0, len: 1, note: 72, vel: 0.85 }], 'notes invalides écartées');
  t.eq(p1.sections.map(s => [s.type, s.bars, s.play.join(), s.lead]), [['drop', 16, 'kick', 'full'], ['break', 64, 'bass,chords,lead', 'calm']], 'parties nettoyées (anthem : sub dans le break)');
  for (const k of ['style', 'bpm', 'prog', 'kick.preset', 'kick.params.foo', 'drums.hat', 'bass.sound', 'sections.0.play', 'sections.1.type'])
    t.ok(w1.some(w => w.startsWith(`${k}:`)), `avertissement ${k}`, w1);

  // Schéma : les valeurs possibles viennent de l'application.
  const sch = A.planSchema();
  t.ok(sch.properties.style.enum.includes('frenchcore') && sch.properties.lead.properties.sound.enum.includes('screech')
    && sch.properties.bass.properties.sound.enum.includes('osc:reese') && sch.properties.sections.items.properties.play.items.enum.includes('drums'), 'schéma JSON');

  // Construction.
  S.tl.tracks.forEach(tr => { tr.clips = []; });
  const melody = [{ t: 0, len: 2, note: 77, vel: 1 }, { t: 2.5, len: 1, note: 75, vel: 0.9 }, { t: 4, len: 4, note: 72, vel: 0.9 }, { t: 9, len: 2, note: 80, vel: 0.9 }];
  const { plan, warnings } = A.cleanPlan({
    title: 'Nuit noire', style: 'frenchcore', bpm: 198, prog: 'Fm Db', kick: { preset: 'frenchcore', params: { drive: 0.9 } },
    lead: { sound: 'screech', style: 'riff', density: 'mid', notes: melody }, buildups: false,
    sections: [
      { type: 'intro', bars: 8, play: ['kick'], name: 'Ouverture' },
      { type: 'drop', bars: 16, play: ['kick', 'drums', 'bass', 'lead'] },
      { type: 'break', bars: 8, play: ['chords', 'lead'], prog: 'Ab Eb' },
    ],
  }, { isSound: A.isSynthSound, isBassSound: A.isBassSound });
  t.eq(warnings, [], 'plan valide');
  const res = await A.composeSong(plan);
  t.eq(res.bars, 32, 'longueur');
  t.eq(S.bpm, 198, 'tempo');
  t.eq(S.tl.tracks.slice(0, 5).map(tr => tr.name), ['kick', 'drums', 'bass', 'chords', 'lead'].map(p => A.t(`start.track.${p}`)), 'une piste par élément');
  t.eq(S.tl.markers.map(m => [m.beat, m.name]), [[0, 'Ouverture'], [32, A.t('start.sec.drop')], [96, A.t('start.sec.break')]], 'repères nommés');
  t.eq(S.tl.tracks[0].clips.map(c => c.start), [0, 32], 'kick : intro et drop');
  t.ok(Math.abs(S.kick.params.drive - 0.9) < 1e-9 && S.tl.tracks[0].clips[0].kick.drive === S.kick.params.drive, 'réglage du kick du plan');
  t.eq(S.tl.tracks[2].clips.map(c => c.start), [32], 'basse : drop seulement');
  const chords = S.tl.tracks[3].clips;
  t.eq([chords.length, chords[0].start, chords[0].name], [1, 96, 'Ab Eb'], 'accords : la suite propre au break');
  t.eq(Math.min(...chords[0].seq.map(n => n.note % 12)) >= 0 && chords[0].seq.some(n => n.note % 12 === 8), true, 'accords de la suite du break (la bémol)');
  const lead = S.tl.tracks[4].clips;
  t.eq(lead[0].seq.map(n => [n.t, n.note]), melody.map(n => [n.t, n.note]), 'drop : la mélodie fournie');
  t.eq([lead[0].pat, lead[0].preset], [16, 'screech'], 'phrase et son du lead');
  t.ok(lead[1].seq.length > 0 && !lead[1].seq.some(n => n.note === 77 && n.t === 0 && n.vel === 1), 'break : une autre mélodie (suite du break), plus calme');
  t.eq(S.gen.draft.lead.seq.map(n => n.note), melody.map(n => n.note), 'la mélodie reste dans le générateur');
  t.ok(S.tl.tracks.slice(5).every(tr => !tr.clips.length), 'sans montées');
  t.ok(/Nuit noire/.test(t.$('#toast').textContent), 'titre dans le message', t.$('#toast').textContent);
  A.tlUndo();
  t.ok(S.tl.tracks.every(tr => !tr.clips.length), 'un seul Ctrl+Z');
}
