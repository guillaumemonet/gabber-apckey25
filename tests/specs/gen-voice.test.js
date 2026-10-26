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

  // ---- Phrases d'un seul tenant (modèle aux durées imposées, factice) ----
  // Jeton = caractère ; durée naturelle : voyelle 8 trames, consonne 4, liaison 1 ; rendu : voyelle à 180 Hz (phase
  // continue d'un jeton à l'autre), consonne = bruit.
  const HOP = 256, isV = c => /[aeiouy]/.test(c);
  let timedCalls = 0;
  const timedSynth = { phonemize: async lines => lines.map(l => [...l.toLowerCase().replace(/[^a-z ]/g, '')].concat(' ')), synth: async () => ({ data: vowel(180, 0.2), sr }) };
  timedSynth.timed = async () => {
    const chars = new Map(), id = c => { if (c === '_') return 0; if (!chars.has(c)) chars.set(c, chars.size + 1); return chars.get(c); };
    const charOf = i => [...chars].find(([, v]) => v === i)?.[0] ?? '_';
    return {
      sr, hop: HOP, id,
      durations: async ids => Float32Array.from(ids.map(i => { const c = charOf(i); return c === '_' ? 1 : isV(c) ? 8 : 4; })),
      render: async (ids, frames) => {
        timedCalls++;
        const out = new Float32Array(frames.reduce((a, b) => a + b, 0) * HOP);
        let p = 0, ph = 0, kind = 'n';
        ids.forEach((i, k) => {
          const c = charOf(i);
          if (c !== '_') kind = isV(c) ? 'v' : /[\^$ ]/.test(c) ? 's' : 'n';
          for (let j = 0; j < frames[k] * HOP; j++, p++) {
            ph += 2 * Math.PI * 180 / sr;
            out[p] = kind === 'v' ? 0.2 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph)) : kind === 'n' ? (Math.random() - 0.5) * 0.05 : 0;
          }
        });
        return out;
      },
    };
  };
  A.setVoiceBackend(timedSynth);
  const ph1 = await A.renderVoice('la ti lo', notes.slice(0, 3), 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'robot', octave: 0, choir: 1 });
  t.ok(ph1.phrase && timedCalls === 1, 'une seule phrase rendue d’un tenant', [ph1.phrase, timedCalls]);
  const pl1 = ph1.plans[0].at;
  t.ok(pl1.every((a, k) => Math.abs(a.v - notes[k].t * bd) < 1e-6), 'chaque voyelle commence sur sa note', pl1.map(a => a.v));
  t.ok(pl1.every(a => a.s0 < a.v), 'les consonnes d’attaque viennent juste avant');
  const vow = pl1.map((a, k) => { const s = Math.round((ph1.pre + a.v + 0.04) * sr), e = Math.round((ph1.pre + a.v + 0.8 * (a.e - a.v)) * sr); return midiOf(A.medianF0(A.pitchTrack(ph1.left.slice(s, e), sr))); });
  t.ok(vow.every((m, k) => Math.abs(m - notes[k].note) < 0.2), 'robot : chaque voyelle juste sur sa note', vow.map(m => m.toFixed(2)));
  const ph2 = await A.renderVoice('la ti lo', notes.slice(0, 3), 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'vocoder', octave: 0, choir: 1 });
  const vv = ph2.plans[0].at.map((a, k) => { const s = Math.round((ph2.pre + a.v + 0.04) * sr), e = Math.round((ph2.pre + a.v + 0.8 * (a.e - a.v)) * sr); return midiOf(A.medianF0(A.pitchTrack(ph2.left.slice(s, e), sr))); });
  t.ok(vv.every((m, k) => Math.abs(m - notes[k].note) < 0.3), 'vocodeur : la porteuse joue les notes', vv.map(m => m.toFixed(2)));
  t.ok((await A.renderVoice('la ti lo', notes.slice(0, 3), 8, bpm, { model: 'fr-siwis', speaker: 0, mode: 'robot', octave: 0, choir: 1, phrase: false })).phrase === false, 'syllabe par syllabe toujours possible');
  A.setVoiceBackend({ phonemize: timedSynth.phonemize, synth: async (model, p, { speaker = 0, length = 1 }) => {
    synthCalls++;
    const cons = Float32Array.from({ length: Math.round(sr * 0.03) }, () => (Math.random() - 0.5) * 0.05);
    const v = vowel(180 + 10 * (speaker % 5), 0.22 * length, speaker + 1);
    const out = new Float32Array(cons.length + v.length);
    out.set(cons);
    out.set(v, cons.length);
    return { data: out, sr };
  } });

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
  // Scandé (MC) sans bloc de notes : en rythme à partir de la tête de lecture, chaîne de voix d'MC.
  const srcSel = t.$('#voice-src');
  t.eq(srcSel.options[0].value, 'none', 'choix « aucun bloc » en tête de liste');
  srcSel.value = 'none'; srcSel.dispatchEvent(new Event('change'));
  const mode = t.$('#voice select[data-key="mode"]');
  mode.value = 'rap'; mode.dispatchEvent(new Event('change'));
  t.ok(!t.$('.voice-flow').hidden && t.$$('.voice-mc').every(e => !e.hidden), 'sans bloc : Débit ; scandé : Punch et Écho');
  S.voice.flow = '16'; S.voice.echo = '4';
  S.tl.playhead = 17;
  const rap = await A.voiceTake();
  const gap = rap.syllables[1].notes[0].t - rap.syllables[0].notes[0].t;
  t.near(gap, 60 / bpm / 4, 1e-6, 'une syllabe par double croche', gap);
  const tailBeats = rap.buffer.duration / (60 / bpm);
  t.ok(tailBeats > 4 * 0.25 + 4, 'l\'écho (noire) prolonge la voix', tailBeats);
  const made2 = await A.generateVoiceClip();
  t.ok(made2 && made2.clip.start < 16 && made2.clip.start > 15, 'posé à la mesure de la tête de lecture', made2?.clip.start);
  // La chaîne seule : plus brillante, plus dense, crêtes sous -1 dB, queue d'écho.
  const sr2 = 48000, n2 = sr2;
  const dry = Float32Array.from({ length: n2 }, (_, i) => (i % 12000 < 6000 ? (((i * 140 / sr2) % 1) * 2 - 1) * 0.3 : 0));   // dents de scie : riche comme une voix
  const [wl] = A.mcVoice([dry, dry], sr2, 190, { punch: 0.75, echo: '8d' });
  const hf = x => { let h = 0, e = 0; for (let i = 1; i < n2; i++) { const d = x[i] - x[i - 1]; h += d * d; e += x[i] * x[i]; } return h / e; };
  t.ok(hf(wl) > hf(dry) * 1.6, 'plus brillante (énergie des aigus)', [hf(dry), hf(wl)]);
  t.ok(wl.length > n2 && wl.reduce((m, v) => Math.max(m, Math.abs(v)), 0) <= 0.9, 'queue d\'écho ajoutée, crêtes sous -1 dB');
  const after = [0, 1, 2, 3].map(k => wl.slice(n2 + k * 6000, n2 + (k + 1) * 6000).reduce((m, v) => Math.max(m, Math.abs(v)), 0));
  t.ok(Math.max(...after) > 0.03, 'l\'écho sonne après la voix', after);
  mode.value = 'sing'; mode.dispatchEvent(new Event('change'));
  srcSel.value = 'c-voice'; srcSel.dispatchEvent(new Event('change'));
  // Sauvegarde.
  const snap = JSON.parse(JSON.stringify(A.stateSnapshot().voice));
  t.eq([snap.model, snap.text], ['fr-upmc', 'la la la la'], 'réglages enregistrés avec le projet');
  t.eq(A.mergeVoiceState({ model: 'nope', choir: 3, formant: 9 }), { ...A.defaultVoiceState(), formant: 1.2 }, 'valeurs inconnues ramenées aux défauts');
  A.setVoiceBackend(null);
  for (const tk of S.tl.tracks) tk.clips = [];
  A.wm.toggle('voice', false);
}
