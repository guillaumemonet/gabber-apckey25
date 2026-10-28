// Fenêtre Composer avec l'IA : une demande en quelques mots, le modèle de langage local (Ollama, ai/docker-compose.yml)
// répond par un plan de morceau, vérifié (cleanPlan) et résumé ici ; « Créer le morceau » fait écrire le lead et la
// basse par le compositeur musical (ai/music), puis construit le morceau (js/app/compose.js). « Autre version »
// redemande, « Modifier » fait retoucher le plan proposé.
import { AI_MODEL, AI_URL, MUSIC_URL, adjustReply, chatBody, musicJobs, parseReply, refineMessage, startChat } from '../aicompose.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { cleanNotes, cleanPlan } from '../songplan.js';
import { STYLE_IDS } from '../songstart.js';
import { composeSong } from './compose.js';
import { $, state } from './core.js';
import { isBassSound, isSynthSound } from './gen.js';
import { toast } from './misc.js';
import { save } from './save.js';

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const field = (label, input) => el('label', {}, el('span', { textContent: label }), input);

let chat = [];          // échange avec le modèle : consigne, demandes, plans proposés
let result = null;      // dernier plan : { plan, warnings }
let busy = null;        // demande en cours : AbortController

const userSounds = () => (state.synthUser ?? []).map(u => u.id);
const soundName = id => (id?.startsWith('osc:') ? t(`osc.preset.${id.slice(4)}`) : t(`preset.${id}`));

// ---- Serveur ----

/** État du serveur : 'ok' (modèle prêt), 'nomodel', 'off'. */
export async function checkAi() {
  const a = state.ai;
  setStatus(t('ai.checking'));
  try {
    const res = await fetch(`${a.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const names = (await res.json()).models?.map(m => m.name) ?? [];
    const has = names.some(n => n === a.model || n === `${a.model}:latest`);
    setStatus(has ? t('ai.ready', { model: a.model }) : t('ai.noModel', { model: a.model }), has ? 'ok' : 'warn');
    return has ? 'ok' : 'nomodel';
  } catch {
    setStatus(t('ai.off'), 'warn');
    return 'off';
  }
}
/** État du compositeur musical : true s'il répond. */
export async function checkMusic() {
  const a = state.ai;
  let ok = false;
  try { ok = !!(await (await fetch(`${a.musicUrl}/health`, { signal: AbortSignal.timeout(3000) })).json()).ok; } catch { /* absent */ }
  const s = $('#ai-composer .ai-music-status');
  if (s) {
    s.textContent = ok ? t('ai.musicReady') : t('ai.musicOff');
    s.className = `ai-music-status hint ${ok ? 'ok' : 'warn'}`;
  }
  return ok;
}

// Le compositeur musical écrit le lead et la basse du plan. -> { [prog]: { lead, bass } } (vide s'il ne répond pas)
async function writeMusic(plan) {
  const a = state.ai, notes = {}, jobs = musicJobs(plan);
  if (!a.music || !jobs.length) return notes;
  busy = new AbortController();
  renderAi();
  try {
    for (const [i, job] of jobs.entries()) {
      setStatus(t('ai.musicWriting', { part: t(`start.part.${job.part}`).toLowerCase(), i: i + 1, n: jobs.length }));
      const res = await fetch(`${a.musicUrl}/generate`, { method: 'POST', body: JSON.stringify(job.body), signal: busy.signal });
      const seq = cleanNotes((await res.json()).notes);
      if (!res.ok || !seq.length) throw new Error(`HTTP ${res.status}`);
      (notes[job.prog] ??= {})[job.part] = seq;
    }
    setStatus(t('ai.musicDone'), 'ok');
    return notes;
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    setStatus(t('ai.musicFailed'), 'warn');
    return notes;
  } finally {
    busy = null;
    renderAi();
  }
}

// Créer le morceau : les notes du compositeur musical, puis la construction.
async function create() {
  if (busy || !result) return;
  try {
    const notes = await writeMusic(result.plan);
    await composeSong(result.plan, notes);
  } catch (e) {
    if (e.name === 'AbortError') setStatus(t('ai.stopped'));
    else throw e;
  }
}

function setStatus(text, kind = '') {
  const s = $('#ai-composer .ai-status');
  if (!s) return;
  s.textContent = text;
  s.className = `ai-status hint ${kind}`;
}

// Envoie l'échange au modèle et lit sa réponse au fil de l'eau. -> texte de la réponse
async function ask(temperature) {
  const a = state.ai;
  busy = new AbortController();
  const t0 = performance.now();
  let text = '';
  const tick = setInterval(() => setStatus(t('ai.thinking', { s: Math.round((performance.now() - t0) / 1000), n: text.length })), 500);
  renderAi();
  try {
    const res = await fetch(`${a.url}/api/chat`, { method: 'POST', body: JSON.stringify(chatBody(chat, { model: a.model, extraSounds: userSounds(), temperature })), signal: busy.signal });
    if (!res.ok) throw new Error(res.status === 404 ? t('ai.noModel', { model: a.model }) : `HTTP ${res.status}`);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.error) throw new Error(msg.error);
        text += msg.message?.content ?? '';
      }
    }
    return text;
  } finally {
    clearInterval(tick);
    busy = null;
  }
}

// Demande un plan ; le garde s'il est utilisable. refine : demande de modification du plan proposé.
async function compose(mode) {
  if (busy) return;
  const a = state.ai;
  if (mode === 'new') {
    const style = $('#ai-style').value;
    const request = [a.prompt.trim() || t('ai.defaultPrompt'), style ? `Style: ${style}.` : ''].filter(Boolean).join('\n');
    chat = startChat(request, { extraSounds: userSounds() });
  } else if (mode === 'again') {
    if (chat.at(-1)?.role === 'assistant') chat.pop();
  } else {
    const req = $('#ai-refine').value.trim();
    if (!req || !result) return;
    chat.push({ role: 'user', content: refineMessage(req) });
  }
  try {
    const text = await ask(mode === 'again' ? 0.9 : 0.5);
    const raw = parseReply(text), reply = JSON.stringify(raw);
    const res = cleanPlan(adjustReply(raw), { isSound: isSynthSound, isBassSound });
    if (!res.plan) throw new Error(t('ai.unusable'));
    chat.push({ role: 'assistant', content: reply });   // le plan tel que proposé : la suite de l'échange le modifie
    result = res;
    if (mode === 'refine') $('#ai-refine').value = '';
    setStatus(t('ai.done'), 'ok');
  } catch (e) {
    if (mode === 'refine') chat.pop();
    if (e.name === 'AbortError') setStatus(t('ai.stopped'));
    else if (e instanceof TypeError) setStatus(t('ai.off'), 'warn');
    else setStatus(t('ai.error', { msg: e.message }), 'warn');
  }
  renderAi();
}

// ---- Fenêtre ----

export function buildAi() {
  const box = $('#ai-composer');
  const a = () => state.ai;
  const url = el('input', { id: 'ai-url', type: 'url', spellcheck: false, placeholder: AI_URL });
  url.addEventListener('change', () => { a().url = (url.value.trim() || AI_URL).replace(/\/+$/, ''); save(); checkAi(); });
  const model = el('input', { id: 'ai-model', type: 'text', spellcheck: false, placeholder: AI_MODEL });
  model.addEventListener('change', () => { a().model = model.value.trim() || AI_MODEL; save(); checkAi(); });
  const test = el('button', { textContent: t('ai.test') });
  test.dataset.icon = 'link';
  test.addEventListener('click', () => { checkAi(); checkMusic(); });
  const prompt = el('textarea', { id: 'ai-prompt', rows: 3, placeholder: t('ai.placeholder') });
  prompt.addEventListener('input', () => { a().prompt = prompt.value.slice(0, 2000); save(); });
  const style = el('select', { id: 'ai-style' });
  style.add(new Option(t('ai.anyStyle'), ''));
  for (const id of STYLE_IDS) style.add(new Option(t(`start.style.${id}`), id));
  const musicUrl = el('input', { id: 'ai-music-url', type: 'url', spellcheck: false, placeholder: MUSIC_URL });
  musicUrl.addEventListener('change', () => { a().musicUrl = (musicUrl.value.trim() || MUSIC_URL).replace(/\/+$/, ''); save(); checkMusic(); });
  const music = el('input', { id: 'ai-music', type: 'checkbox' });
  music.addEventListener('change', () => { a().music = music.checked; save(); });
  const go = el('button', { id: 'ai-go', className: 'primary', textContent: t('ai.compose') });
  go.dataset.icon = 'wand';
  go.addEventListener('click', () => compose('new'));
  const stop = el('button', { id: 'ai-stop', textContent: t('ai.stop') });
  stop.dataset.icon = 'stop';
  stop.addEventListener('click', () => busy?.abort());
  box.append(
    el('div', { className: 'gen-row' }, field(t('ai.url'), url), field(t('ai.model'), model), test),
    el('div', { className: 'ai-status hint' }),
    el('div', { className: 'gen-row' }, el('label', { className: 'start-part', title: t('ai.musicHint') }, music, el('span', { textContent: t('ai.music') })),
      field(t('ai.musicUrl'), musicUrl), el('span', { className: 'ai-music-status hint' })),
    el('div', { className: 'hint ai-setup', textContent: t('ai.setup') }),
    field(t('ai.request'), prompt),
    el('div', { className: 'gen-row' }, field(t('start.style'), style), go, stop),
    el('div', { className: 'ai-result' }),
  );
  renderAi();
}

export function renderAi() {
  const box = $('#ai-composer');
  if (!box?.childElementCount) return;
  const a = state.ai;
  box.querySelector('#ai-url').value = a.url;
  box.querySelector('#ai-model').value = a.model;
  box.querySelector('#ai-music-url').value = a.musicUrl;
  box.querySelector('#ai-music').checked = a.music;
  if (document.activeElement !== box.querySelector('#ai-prompt')) box.querySelector('#ai-prompt').value = a.prompt;
  box.querySelector('#ai-go').disabled = !!busy;
  box.querySelector('#ai-stop').hidden = !busy;
  const out = box.querySelector('.ai-result');
  if (!result) { out.replaceChildren(); return; }
  const p = result.plan;
  const bars = p.sections.reduce((s, x) => s + x.bars, 0), sec = Math.round(bars * 4 * 60 / p.bpm);
  const chords = parseProgression(p.prog).chords.map(c => c.name).join(' – ');
  const lead = p.lead.breizh ? t('win.breizh') : `${soundName(p.lead.sound)} (${a.music ? t('ai.byMusic') : t(`gen.style.${p.lead.style}`)})`;
  const parts = el('div', { className: 'start-sections' }, ...p.sections.map((s, k) => el('div', { className: `start-sec ai-sec start-sec-${s.type}` },
    el('span', { className: 'start-sec-n', textContent: String(k + 1) }),
    el('b', { textContent: s.name ?? t(`start.sec.${s.type}`) }),
    el('span', { textContent: t('tl.bars', { n: s.bars }) + (s.prog ? ` · ${s.prog}` : '') }),
    el('span', { className: 'hint', textContent: s.play.map(x => t(`start.part.${x}`)).join(', ') || '—' }))));
  const refine = el('input', { id: 'ai-refine', type: 'text', placeholder: t('ai.refineHint') });
  refine.addEventListener('keydown', e => { if (e.key === 'Enter') compose('refine'); });
  const btn = (id, label, icon, fn, primary = false) => {
    const b = el('button', { id, textContent: label, className: primary ? 'primary' : '', disabled: !!busy });
    b.dataset.icon = icon;
    b.addEventListener('click', fn);
    return b;
  };
  out.replaceChildren(
    el('h3', { textContent: p.title ?? t(`start.style.${p.style}`) }),
    el('div', { className: 'hint', textContent: t('ai.summary', { style: t(`start.style.${p.style}`), bpm: p.bpm, chords, bars, min: Math.floor(sec / 60), sec: String(sec % 60).padStart(2, '0') }) }),
    el('div', { className: 'hint', textContent: t('ai.sounds', { kick: t(`kick.preset.${p.kick.preset}`) + (p.kick.params ? ` (${t('ai.kickTuned')})` : ''), bass: `${soundName(p.bass.sound)} (${a.music ? t('ai.byMusic') : t(`gen.bstyle.${p.bass.style}`)})`, chords: soundName(p.chords.sound), lead }) }),
    parts,
    ...(result.warnings.length ? [el('div', { className: 'hint warn', title: result.warnings.join('\n'), textContent: t('ai.warnings', { n: result.warnings.length }) })] : []),
    el('div', { className: 'gen-row' }, refine, btn('ai-refine-go', t('ai.refine'), 'editor', () => compose('refine'))),
    el('div', { className: 'gen-row gen-actions' }, btn('ai-again', t('ai.again'), 'dice', () => compose('again')),
      btn('ai-create', t('start.create'), 'plus', create, true)),
  );
}

/** Ouverture de la fenêtre : état du serveur. */
export function aiWinOpened() {
  renderAi();
  checkAi();
  checkMusic();
}

/** Pour les tests : l'échange en cours et le dernier plan. */
export const aiSession = () => ({ chat, result });
export { compose as aiCompose };
