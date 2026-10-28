// Compositeur IA avec un faux serveur Ollama : état du serveur (prêt, modèle absent, introuvable), demande (consigne,
// schéma du plan, réponse lue au fil de l'eau), plan vérifié et résumé, modification, autre version, réponse
// illisible ; compositeur musical (faux) : le lead et la basse qu'il écrit vont dans le morceau, les générateurs
// prennent le relais s'il ne répond pas.
export default async function (t, A) {
  const S = A.state;
  window.confirm = () => true;
  const realFetch = window.fetch;
  const sent = [];
  let server = 'ok', reply = null, music = 'ok';
  const musicSent = [];
  const LEAD = [{ t: 0, len: 2, note: 81, vel: 0.9 }, { t: 2, len: 1, note: 79, vel: 0.8 }, { t: 3, len: 1, note: 76, vel: 0.8 }, { t: 8, len: 4, note: 77, vel: 0.9 }];
  const BASS = [{ t: 0, len: 1, note: 33, vel: 0.9 }, { t: 8, len: 1, note: 29, vel: 0.9 }];
  const plan = (title, extra = {}) => ({
    title, style: 'frenchcore', bpm: 202, prog: 'Am F C G', kick: { preset: 'frenchcore', params: { drive: 0.95 } },
    bass: { style: 'offbeat', sound: 'osc:reese' }, chords: { sound: 'dark_strings', rhythm: 'hold' }, lead: { sound: 'screech', style: 'riff', density: 'high' },
    buildups: false, sections: [{ type: 'intro', bars: 8, play: ['kick', 'drums'] }, { type: 'drop', bars: 16, play: ['kick', 'drums', 'bass', 'chords', 'lead'] },
      { type: 'break', bars: 8, play: ['chords', 'lead'], lead: 'calm', name: 'Pluie' }], ...extra,
  });
  const stream = text => {
    const chunks = text.match(/.{1,40}/gs).map(c => JSON.stringify({ message: { role: 'assistant', content: c }, done: false }) + '\n');
    chunks.push(JSON.stringify({ done: true }) + '\n');
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(enc.encode(x)); c.close(); } }));
  };
  window.fetch = async (url, opts) => {
    if (String(url).startsWith('http://localhost:11434')) {
      if (server === 'off') throw new TypeError('Failed to fetch');
      if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: server === 'ok' ? [{ name: 'qwen2.5:7b' }] : [{ name: 'llama3:8b' }] }));
      if (url.endsWith('/api/chat')) { sent.push(JSON.parse(opts.body)); return stream(typeof reply === 'string' ? reply : JSON.stringify(reply)); }
    }
    if (String(url).startsWith('http://127.0.0.1:8090')) {
      if (music === 'off') throw new TypeError('Failed to fetch');
      if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true }));
      const body = JSON.parse(opts.body);
      musicSent.push(body);
      return new Response(JSON.stringify({ notes: body.part === 'lead' ? LEAD : BASS }));
    }
    return realFetch(url, opts);
  };
  try {
    // Corrections : pas de basse dans un style où le kick la fait, sauf si le modèle l'a réglée ; graines neuves.
    const adj = A.adjustReply({ style: 'early', sections: [{ type: 'drop', bars: 16, play: ['kick', 'bass'] }] }, () => 7);
    t.eq([adj.sections[0].play, adj.lead.seed, adj.bass.seed], [['kick'], 7, 7], 'early : la basse retirée');
    t.eq(A.adjustReply({ style: 'early', bass: { style: 'acid' }, sections: [{ type: 'drop', bars: 16, play: ['kick', 'bass'] }] }).sections[0].play, ['kick', 'bass'], 'early : basse demandée gardée');
    const nodrop = A.adjustReply({ style: 'rave', sections: [{ type: 'intro', bars: 8, play: ['kick'] }, { type: 'build', bars: 8, play: ['chords'] }, { type: 'outro', bars: 8, play: ['kick'] }] });
    t.eq(nodrop.sections.map(s => s.type), ['intro', 'build', 'drop', 'outro'], 'un drop ajouté après la montée');
    t.eq(A.adjustReply({ style: 'rave', sections: [{ type: 'drop', bars: 16, play: ['kick', 'bass'] }] }).sections[0].play, ['kick', 'bass'], 'rave : basse gardée');

    S.tl.tracks.forEach(tr => { tr.clips = []; });
    A.wm.toggle('ai', true);
    const box = t.$('#ai-composer');
    const status = () => box.querySelector('.ai-status').textContent;
    t.ok(await t.until(() => status() === A.t('ai.ready', { model: 'qwen2.5:7b' }), 3000), 'serveur prêt', status());
    server = 'nomodel';
    box.querySelector('.gen-row button').click();
    t.ok(await t.until(() => status() === A.t('ai.noModel', { model: 'qwen2.5:7b' }), 3000), 'modèle absent', status());
    server = 'off';
    t.eq(await A.checkAi(), 'off', 'serveur introuvable');
    t.eq(status(), A.t('ai.off'), 'message serveur introuvable');
    server = 'ok';

    // Demande.
    const prompt = box.querySelector('#ai-prompt');
    prompt.value = 'Frenchcore sombre, break sous la pluie';
    prompt.dispatchEvent(new Event('input'));
    box.querySelector('#ai-style').value = 'frenchcore';
    reply = plan('Orage');
    box.querySelector('#ai-go').click();
    t.ok(await t.until(() => box.querySelector('.ai-result h3')?.textContent === 'Orage', 5000), 'plan reçu et résumé');
    const body = sent[0];
    t.eq([body.model, body.stream, body.messages.length, body.messages[0].role], ['qwen2.5:7b', true, 4, 'system'], 'requête au modèle : consigne, exemple, demande');
    t.ok(body.format.properties.sections.items.properties.play && /frenchcore: 200 BPM/.test(body.messages[0].content) && !body.format.properties.lead.properties.notes && /only write the fields you want to change/.test(body.messages[0].content), 'schéma et consigne');
    t.ok(/break sous la pluie/.test(body.messages[3].content) && /Style: frenchcore/.test(body.messages[3].content), 'demande et style');
    const { result } = A.aiSession();
    t.ok(result.plan.lead.seed > 0 && result.plan.bass.seed > 0 && !result.warnings.length, 'graines ajoutées, plan valide', result.warnings);
    t.eq(box.querySelectorAll('.ai-sec').length, 3, 'parties listées');
    t.ok(/Pluie/.test(box.querySelector('.ai-result').textContent) && /202 BPM/.test(box.querySelector('.ai-result').textContent), 'résumé : nom de partie, tempo');

    // Modification : l'échange continue.
    reply = plan('Orage 2', { style: 'nope', sections: [{ type: 'drop', bars: 32, play: ['kick', 'lead'] }] });
    box.querySelector('#ai-refine').value = 'un seul long drop';
    box.querySelector('#ai-refine-go').click();
    t.ok(await t.until(() => box.querySelector('.ai-result h3')?.textContent === 'Orage 2', 5000), 'plan modifié');
    t.eq(sent[1].messages.map(m => m.role), ['system', 'user', 'assistant', 'user', 'assistant', 'user'], 'échange : plan proposé puis modification');
    t.ok(/un seul long drop/.test(sent[1].messages[5].content), 'modification demandée');
    t.ok(/1/.test(box.querySelector('.ai-result .warn')?.textContent ?? ''), 'valeur non reconnue signalée');

    // Autre version : même demande, sans le dernier plan.
    reply = plan('Orage 3');
    box.querySelector('#ai-again').click();
    t.ok(await t.until(() => box.querySelector('.ai-result h3')?.textContent === 'Orage 3', 5000), 'autre version');
    t.eq([sent[2].messages.length, sent[2].options.temperature], [6, 0.9], 'autre version : même échange, plus de variété');

    // Réponse illisible : le plan d'avant reste.
    reply = 'désolé, je ne peux pas';
    box.querySelector('#ai-again').click();
    t.ok(await t.until(() => /L’IA|The AI/.test(status()) && sent.length === 4 && !box.querySelector('#ai-go').disabled, 5000), 'réponse illisible signalée', status());
    t.eq(box.querySelector('.ai-result h3')?.textContent, 'Orage 3', 'le plan d’avant reste');

    // Création.
    box.querySelector('#ai-create').click();
    t.ok(await t.until(() => /Orage 3/.test(t.$('#toast').textContent), 30000), 'morceau créé', t.$('#toast').textContent);
    t.eq(S.tl.markers[2].name, 'Pluie', 'repère nommé par l’IA');
    t.ok(S.tl.tracks[2].clips[0]?.osc === 'reese' && Math.abs(S.kick.params.drive - 0.95) < 1e-9, 'basse du synthé à oscillateurs, réglage du kick');
    t.eq(musicSent.map(b => [b.part, b.bpm, b.beats, b.chords.length, b.kick.length, b.density]), [['lead', 202, 32, 4, 32, 'high'], ['bass', 202, 32, 4, 32, 'mid']], 'compositeur musical : lead et basse demandés');
    t.eq(musicSent[0].chords.map(c => c.notes.map(n => n % 12)), [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]], 'accords envoyés (la mineur, fa, do, sol)');
    t.eq(S.tl.tracks[4].clips[0].seq.map(n => n.note), LEAD.map(n => n.note), 'le lead du morceau : celui de l’IA musicale');
    t.eq(S.tl.tracks[2].clips[0].seq.map(n => n.note), BASS.map(n => n.note), 'la basse : celle de l’IA musicale');
    t.eq(S.gen.draft.lead.seq.map(n => n.note), LEAD.map(n => n.note), 'le lead reste dans le générateur');

    // Compositeur musical absent : les générateurs écrivent la mélodie.
    music = 'off';
    musicSent.length = 0;
    t.eq(await A.checkMusic(), false, 'IA musicale introuvable');
    box.querySelector('#ai-create').click();
    t.ok(await t.until(() => /Orage 3/.test(t.$('#toast').textContent) && S.tl.tracks[4].clips.length > 0 && S.tl.tracks[4].clips[0].seq.map(n => n.note).join() !== LEAD.map(n => n.note).join(), 30000), 'morceau créé sans l’IA musicale');
    t.ok(/IA musicale|music AI/.test(status()), 'message : les générateurs ont pris le relais', status());
  } finally {
    window.fetch = realFetch;
    A.wm.toggle('ai', false);
  }
}
