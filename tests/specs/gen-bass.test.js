// Générateur, onglet Basse : rythmes des styles (contretemps, reverse, roulante, acid), fondamentale de chaque accord
// dans l'octave choisie, note de passage, son du synthé ou du synthé à oscillateurs, brouillon, bloc posé sur une piste
// libre, écoute, réglages gardés (et valeurs invalides remplacées).
export default async function (t, A) {
  const S = A.state;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  t.$('#plugins button[data-plugin="gen"]').click();
  const box = t.$('#gen');
  box.querySelector('.gen-tabs button[data-tab="bass"]').click();
  t.eq(S.gen.tab, 'bass', 'onglet Basse');
  t.ok(!box.querySelector('[data-panel="bass"]').hidden, 'ses réglages sont affichés');
  const input = box.querySelector('#gen-prog');
  input.value = 'Fm Db Eb Cm'; input.dispatchEvent(new Event('input'));
  const set = (key, v) => { const el = box.querySelector(`[data-panel="bass"] select[data-key="${key}"], .gen-row:not(.gen-panel) select[data-key="${key}"]`); el.value = v; el.dispatchEvent(new Event('change')); };
  set('bars', '1'); set('repeat', '2');
  const passing = box.querySelector('#gen-passing');
  passing.checked = false; passing.dispatchEvent(new Event('change'));

  // Rythmes.
  const offs = () => [...new Set(A.draft('bass').seq.map(n => +(n.t % 1).toFixed(2)))].sort();
  set('style', 'offbeat');
  t.eq(offs(), [0.5], 'contretemps : une croche entre les temps');
  set('style', 'reverse');
  t.eq(offs(), [0.5, 0.75], 'reverse bass : les deux doubles croches après le contretemps');
  set('style', 'rolling');
  t.eq(offs(), [0.25, 0.5, 0.75], 'roulante : trois doubles croches entre les temps');
  const seq = A.draft('bass').seq;
  t.eq([0, 4, 8, 12].map(b => seq.find(n => n.t >= b)?.note % 12), [5, 1, 3, 0], 'la fondamentale de chaque accord (fa, ré♭, mi♭, do)');
  t.ok(seq.every(n => n.note >= 29 && n.note < 41), 'octave grave : entre fa1 et mi2', [Math.min(...seq.map(n => n.note)), Math.max(...seq.map(n => n.note))]);
  set('octave', 'mid');
  t.ok(A.draft('bass').seq.every(n => n.note >= 41 && n.note < 53), 'octave médium : une octave plus haut');
  set('style', 'sub');
  t.eq(A.draft('bass').seq.map(n => [n.t, n.len]), [[0, 4], [4, 4], [8, 4], [12, 4]], 'sub : la fondamentale tenue sur tout l’accord');
  passing.checked = true; passing.dispatchEvent(new Event('change'));
  t.eq(A.draft('bass').seq.map(n => n.t), [0, 3.5, 4, 7.5, 8, 11.5, 12, 15.5], 'note de passage sur le dernier contretemps de chaque accord');
  set('style', 'acid');
  const acid = A.draft('bass').seq;
  t.ok(acid.length > 16 && acid.every(n => n.t * 4 === Math.round(n.t * 4)) && acid.some(n => n.vel === 1), 'acid : doubles croches, avec des accents', acid.length);
  const seed = S.gen.bassline.seed;
  box.querySelector('#gen-bass-idea').click();
  A.stopGenPreview();
  t.ok(S.gen.bassline.seed !== seed, 'Idée : une autre variante');

  // Son du synthé à oscillateurs : bloc joué par lui ; écoute.
  set('style', 'reverse');
  const sound = box.querySelector('[data-panel="bass"] select[data-key="preset"]');
  t.ok([...sound.options].some(o => o.value === 'osc:acid_bass') && [...sound.options].some(o => o.value === 'reese'), 'sons : basses du synthé et du synthé à oscillateurs');
  sound.value = 'osc:acid_bass'; sound.dispatchEvent(new Event('change'));
  box.querySelector('#gen-listen').click();
  t.ok(A.genPreviewing(), 'Écouter joue la ligne');
  box.querySelector('#gen-listen').click();
  t.ok(!A.genPreviewing(), 'un deuxième clic l’arrête');
  box.querySelector('button.primary').click();
  await t.wait(50);
  const clip = S.tl.tracks.flatMap(tr => tr.clips).find(c => c.cat === 'bass');
  t.ok(clip && clip.osc === 'acid_bass' && !clip.preset && clip.len === 32 && clip.pat === 16, 'bloc posé : synthé à oscillateurs, la ligne répétée deux fois', clip && { osc: clip.osc, len: clip.len, pat: clip.pat });
  t.eq(clip.seq.length, A.draft('bass').seq.length, 'le bloc joue le brouillon');
  sound.value = 'bass'; sound.dispatchEvent(new Event('change'));

  // Réglages gardés ; valeurs invalides remplacées.
  const m = A.mergeGen({ tab: 'bass', bassline: { preset: 'osc:nope', style: 'x', octave: 'z', passing: false, seed: 5 } });
  t.eq([m.tab, m.bassline.preset, m.bassline.style, m.bassline.octave, m.bassline.passing, m.bassline.seed], ['bass', 'bass', 'offbeat', 'low', false, 5], 'sauvegarde relue : valeurs invalides remplacées');
  t.eq(A.mergeGen({ bassline: { preset: 'osc:reese' } }).bassline.preset, 'osc:reese', 'un son du synthé à oscillateurs est gardé');
  box.querySelector('.gen-tabs button[data-tab="chords"]').click();
}
