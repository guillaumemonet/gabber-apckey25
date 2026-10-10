// Suggestions du Générateur (sans réseau de neurones) : trois mélodies mieux notées que la mélodie par défaut, écoute,
// choix (brouillon + goût appris), suites d'accords d'hymne dans la tonalité, sauvegarde.
export default async function (t, A) {
  const S = A.state;
  A.wm.toggle('gen', true);
  t.eq(A.mergeGen({}).taste, null, 'ancienne sauvegarde : aucun goût appris');
  const input = t.$('#gen-prog');
  input.value = 'Fm Db Eb C'; input.dispatchEvent(new Event('input'));
  t.$$('.gen-tabs button')[1].click();

  t.$('#gen-suggest').click();
  const cards = t.$$('#gen .gen-sugs .gen-sug');
  t.eq(cards.length, 3, 'trois idées');
  const chords = A.parseProgression('Fm Db Eb C').chords;
  const base = A.theoryScore(A.leadFeatures(A.leadSeq(chords), chords, 8));
  t.ok(A.leadSuggestions.every(s => s.score >= base - 0.02), 'mieux notées que la mélodie par défaut', [base, A.leadSuggestions.map(s => s.score)]);
  t.ok(A.leadSuggestions[0].score >= A.leadSuggestions[2].score, 'de la meilleure à la moins bonne');

  // Écouter une idée, puis la choisir.
  cards[1].querySelector('button[data-icon="play"]').click();
  t.ok(A.genPreviewing(), 'Écouter joue l’idée');
  const pick = A.leadSuggestions[1];
  cards[1].querySelector('button.primary').click();
  t.ok(!A.genPreviewing(), 'Choisir arrête l’écoute');
  t.eq(JSON.stringify(A.draft('lead').seq), JSON.stringify(pick.seq), 'l’idée choisie devient le brouillon de la mélodie');
  t.eq([S.gen.lead.seed, S.gen.lead.density], [pick.seed, pick.density], 'ses réglages (graine, densité) sont repris');
  t.eq(S.gen.taste?.n, 1, 'le goût apprend de ce choix');
  t.ok(t.$('#gen .gen-sugs').hidden, 'le panneau se referme');
  t.$('#gen-suggest').click();
  t.ok(/1/.test(t.$('#gen .gen-sugs .hint').textContent), 'le panneau compte les choix appris');

  // Suites d'accords.
  t.$$('.gen-tabs button')[0].click();
  t.$('#gen-suggest-prog').click();
  const chips = t.$$('#gen .gen-sugs .gen-chips button').map(b => b.textContent);
  t.ok(chips.length >= 6 && chips.includes('Fm Db Eb C'), 'suites d’hymne en fa mineur', chips);
  t.ok(chips.every(c => c.startsWith('Fm ')), 'elles partent toutes de la tonique');
  const choice = t.$$('#gen .gen-sugs .gen-chips button')[1];
  const text = choice.textContent;
  choice.click();
  t.eq(S.gen.prog, text, 'clic : la suite est utilisée');
  t.eq(A.draft('chords').seq.length > 0 && t.$('#gen-prog').value, text, 'et affichée, brouillon recalculé');
  // Dans une autre tonalité.
  t.ok(A.suggestProgressions(0)[0].text.startsWith('Cm '), 'en do mineur aussi');
  t.ok(A.stateSnapshot().gen.taste?.n === 1, 'goût enregistré avec le projet');
}
