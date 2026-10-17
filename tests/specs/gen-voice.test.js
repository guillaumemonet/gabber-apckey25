// Générateur de voix (js/voice.js, js/psola.js, js/app/voice-ui.js). La voix neuronale et espeak sont remplacés par un
// moteur factice (pas de réseau) : phonèmes = lettres du texte, syllabe = voyelle de synthèse à 200 Hz précédée d'un
// bruit (consonne). Vérifie : mots, syllabes, « _ », placement sur les notes, PSOLA (hauteur et durée), rendu juste sur
// les notes, octave auto, chœur et harmonie, fenêtre, Générer (bloc audio sur une piste libre), sauvegarde.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  const midiOf = f => 69 + 12 * Math.log2(f / 440);

  // ---- Mots et syllabes ----
  const ph = [...'bɔ̃ʒˈuʁ la- fˈul, ləvˈe le- mˈɛ̃!'];
  t.eq(A.phonemeWords(ph).map(w => w.join('')), ['bɔ̃ʒˈuʁ', 'la', 'fˈul', 'ləvˈe', 'le', 'mˈɛ̃'], 'mots, nasales recollées, ponctuation retirée');
  t.eq(A.syllabify([...'ʒuʁnal'], 'fr').map(s => s.join('')), ['ʒuʁ', 'nal'], 'deux consonnes : partagées');
  t.eq(A.syllabify([...'apʁɑ̃dʁ'].map(c => c), 'fr').length, 2, 'groupe consonne + r : attaque de la syllabe suivante');
  t.eq(A.syllabify(['h', 'ˈ', 'a', 'ɪ'], 'en').length, 1, 'diphtongue anglaise : une syllabe');
  const syls = A.textSyllables('Bonjour la foule, levez _ les mains !', ph, 'fr');
  t.eq(syls.map(s => s.label), ['Bon', 'jour', 'la', 'foule', 'le', 'vez', '_', 'les', 'mains'], 'syllabes écrites, « _ » gardé');
  t.ok(syls[6].hold, '« _ » prolonge la syllabe');

  // ---- Placement sur les notes ----
  const slots = A.noteSlots([{ t: 0, len: 1, note: 60 }, { t: 0, len: 1, note: 64 }, { t: 1, len: 2, note: 62 }, { t: 2, len: 1, note: 65 }]);
  t.eq(slots.map(s => [s.t, s.len, s.notes]), [[0, 1, [60, 64]], [1, 1, [62]], [2, 1, [65]]], 'accords regroupés, une note coupée au départ de la suivante');
  const placed = A.placeSyllables(syls, slots, 4);
  t.eq(placed.length, 8, 'une syllabe par note (le « _ » ne fait pas de syllabe)');
  t.eq(placed[5].notes.length, 2, '« _ » : la syllabe d’avant tient deux notes');
  t.eq(placed[3].notes[0].t, 4, 'plus de syllabes que de notes : le motif est répété');
  t.eq(A.placeSyllables(syls.slice(0, 2), slots, 4, { fill: true }).length, 3, 'Répéter le texte : jusqu’à la dernière note');

  // ---- PSOLA : hauteur et durée, timbre gardé ----
  const sr = 22050;
  const vowel = (f, sec, seed = 1) => Float32Array.from({ length: Math.round(sr * sec) }, (_, i) => {
    let v = 0;
    for (let h = 1; h <= 12; h++) v += Math.sin(2 * Math.PI * f * h * i / sr + h * seed) / h * (h === 3 ? 2 : 1);   // une « formante » à 600 Hz
    return 0.2 * v;
  });
  const x = vowel(200, 0.4);
  const tr = A.pitchTrack(x, sr);
  t.near(A.medianF0(tr), 200, 3, 'hauteur détectée (YIN)', A.medianF0(tr));
  const marks = A.pitchMarks(x, sr, tr);
  const up = A.psola(x, sr, marks, { len: sr * 0.8, map: ts => ts * 0.5, pitch: () => 300 });
  t.near(A.medianF0(A.pitchTrack(up, sr)), 300, 5, 'PSOLA : 200 Hz -> 300 Hz', A.medianF0(A.pitchTrack(up, sr)));
  t.ok(Math.abs(up.length / sr - 0.8) < 1e-6 && Math.abs(up[Math.round(sr * 0.7)]) + Math.abs(up[Math.round(sr * 0.71)]) > 0, 'PSOLA : durée doublée, le son tient jusqu’au bout');

  // ---- Moteur factice ----
  let synthCalls = 0;
  A.setVoiceBackend({
    // « hardcore » dans une ligne : espeak le couperait en deux mots (le générateur reprend alors mot par mot).
    phonemize: async lines => lines.map(l => [...l.toLowerCase().replace(/[^a-zéè ]/g, '').replace(/hardcore/g, l.includes(' ') ? 'hard core' : 'hardcore')].concat(' ')),
    synth: async (model, p, { speaker = 0, length = 1 }) => {
      synthCalls++;
      const cons = Float32Array.from({ length: Math.round(sr * 0.03) }, () => (Math.random() - 0.5) * 0.05);
      const v = vowel(180 + 10 * (speaker % 5), 0.22 * length, speaker + 1);
      const out = new Float32Array(cons.length + v.length);
      out.set(cons);
      out.set(v, cons.length);
      return { data: out, sr };
    },
  });
  const notes = [{ t: 0, len: 1, note: 69 }, { t: 1, len: 1, note: 71 }, { t: 2, len: 2, note: 72 }, { t: 4, len: 1, note: 67 }];
  const bpm = 120, bd = 60 / bpm;
  const res = await A.renderVoice('la la la la', notes, 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'robot', octave: 0, choir: 1 });
  t.eq(res.syllables.length, 4, 'quatre syllabes, quatre notes');
  const split = await A.renderVoice('la hardcore', notes, 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'robot', octave: 0, choir: 1 });
  t.eq(split.syllables.map(s => s.label).join(''), 'lahardcore', 'mots coupés par espeak : les syllabes gardent le mot écrit', split.syllables.map(s => s.label));
  const at = (r, n) => {
    const a = Math.round((r.pre + n.t * bd + n.len * bd * 0.3) * r.sr), b = Math.round((r.pre + n.t * bd + n.len * bd * 0.8) * r.sr);
    return midiOf(A.medianF0(A.pitchTrack(r.left.slice(a, b), r.sr)));
  };
  const sung = notes.map(n => at(res, n));
  t.ok(sung.every((m, i) => Math.abs(m - notes[i].note) < 0.3), 'robot : chaque syllabe juste sur sa note', sung.map(m => m.toFixed(2)));
  // Le son de la syllabe longue (2 temps) tient jusqu’au bout de sa note.
  const tail = res.left.slice(Math.round((res.pre + 3.7 * bd) * res.sr), Math.round((res.pre + 3.9 * bd) * res.sr));
  t.ok(tail.some(v => Math.abs(v) > 0.01), 'une note longue est tenue jusqu’au bout');
  // Octave auto : la voix (≈ 180 Hz, fa#3) chante au plus près de sa hauteur naturelle.
  const auto = await A.renderVoice('la la la la', notes, 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'robot', octave: 'auto', choir: 1 });
  t.eq(auto.octave, -1, 'octave auto : une octave plus bas pour cette voix');
  // Chœur et harmonie : une partie par voix, réparties en stéréo.
  const chords = [{ t: 0, len: 2, note: 57 }, { t: 0, len: 2, note: 60 }, { t: 0, len: 2, note: 64 }, { t: 2, len: 2, note: 59 }, { t: 2, len: 2, note: 62 }, { t: 2, len: 2, note: 67 }];
  const harm = await A.renderVoice('la la', chords, 4, bpm, { model: 'fr-mls', speaker: 0, mode: 'sing', octave: 0, choir: 2, harmony: true });
  t.eq(harm.parts, 6, 'harmonie à 3 voix × chœur de 2 = 6 parties');
  let dl = 0;
  for (let i = 0; i < harm.left.length; i++) dl = Math.max(dl, Math.abs(harm.left[i] - harm.right[i]));
  t.ok(dl > 0.01, 'chœur réparti en stéréo');
  t.ok(Math.max(...harm.left.map(Math.abs)) <= 0.9, 'pas de saturation');

  // ---- Fenêtre ----
  for (const tk of S.tl.tracks) tk.clips = [];
  S.bpm = bpm;
  t.eq(A.voiceSource(), null, 'aucun bloc de notes : pas de source');
  const lead = { id: 'c-voice', type: 'note', preset: 'hardstyle_lead', cat: 'lead', color: 1, start: 8, len: 8, loop: false, name: 'Lead', seq: notes.map(n => ({ ...n, vel: 0.9 })), pat: 8 };
  S.tl.tracks[2].clips.push(lead);
  A.wm.toggle('voice', true);
  await t.wait(50);
  A.renderVoiceWin();
  t.eq(t.$('#voice-src').value, 'c-voice', 'le bloc de notes est proposé');
  t.ok(t.$('#voice-names').hidden && t.$('.voice-who').hidden, 'une seule voix : pas de choix d’interprète');
  const model = t.$('#voice select[data-key="model"]');
  model.value = 'fr-mls'; model.dispatchEvent(new Event('change'));
  t.ok(!t.$('#voice-speaker').hidden && +t.$('#voice-speaker').max === 124, 'modèle à 125 voix : numéro d’interprète');
  model.value = 'fr-upmc'; model.dispatchEvent(new Event('change'));
  t.eq([...t.$('#voice-names').options].map(o => o.text), ['Jessica', 'Pierre'], 'deux voix : leurs noms');
  t.ok(/CC BY-SA/.test(t.$('#voice-credit').textContent), 'licence de la voix affichée');
  const text = t.$('#voice-text');
  text.value = 'la la la la'; text.dispatchEvent(new Event('input'));
  t.eq(S.voice.text, 'la la la la', 'texte enregistré');
  synthCalls = 0;
  const made = await A.generateVoiceClip();
  t.ok(made && made.track !== 2 && made.clip.sampleId.startsWith('rec:') && made.clip.cat === 'voice', 'Générer : un bloc audio sur une autre piste', made && [made.track, made.clip.sampleId]);
  t.ok(made && made.clip.start < 8 && made.clip.start > 7, 'calé sur le bloc (les consonnes juste avant)', made?.clip.start);
  t.ok(t.$$('#voice-syls span').length === 4, 'syllabes affichées avec leur note');
  const calls = synthCalls;
  await A.voiceTake();
  t.eq(synthCalls, calls, 'rien ne change : le rendu est gardé');
  // Sauvegarde.
  const snap = JSON.parse(JSON.stringify(A.stateSnapshot().voice));
  t.eq([snap.model, snap.text], ['fr-upmc', 'la la la la'], 'réglages enregistrés avec le projet');
  t.eq(A.mergeVoiceState({ model: 'nope', choir: 3, formant: 9 }), { ...A.defaultVoiceState(), formant: 1.2 }, 'valeurs inconnues ramenées aux défauts');
  A.setVoiceBackend(null);
  for (const tk of S.tl.tracks) tk.clips = [];
  A.wm.toggle('voice', false);
}
