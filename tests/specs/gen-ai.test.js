// Compositeur IA avec un faux serveur Ollama : état du serveur (prêt, modèle absent, introuvable), demande (consigne,
// schéma du plan, réponse lue au fil de l'eau), plan vérifié et résumé, modification, autre version, réponse
// illisible, création du morceau.
export default async function (t, A) {
  const S = A.state;
  window.confirm = () => true;
  const realFetch = window.fetch;
  const sent = [];
  let server = 'ok', reply = null;
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
  } finally {
    window.fetch = realFetch;
    A.wm.toggle('ai', false);
  }
}
