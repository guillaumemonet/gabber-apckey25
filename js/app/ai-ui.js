// Fenêtre Composer avec l'IA : une demande en quelques mots, le modèle de langage local (Ollama, ai/docker-compose.yml)
// répond par un plan de morceau, vérifié (cleanPlan) et résumé ici ; « Créer le morceau » le construit
// (js/app/compose.js). « Autre version » redemande, « Modifier » fait retoucher le plan proposé.
import { AI_MODEL, AI_URL, adjustReply, chatBody, parseReply, refineMessage, startChat } from '../aicompose.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { cleanPlan } from '../songplan.js';
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
  test.addEventListener('click', checkAi);
  const prompt = el('textarea', { id: 'ai-prompt', rows: 3, placeholder: t('ai.placeholder') });
  prompt.addEventListener('input', () => { a().prompt = prompt.value.slice(0, 2000); save(); });
  const style = el('select', { id: 'ai-style' });
  style.add(new Option(t('ai.anyStyle'), ''));
  for (const id of STYLE_IDS) style.add(new Option(t(`start.style.${id}`), id));
  const go = el('button', { id: 'ai-go', className: 'primary', textContent: t('ai.compose') });
  go.dataset.icon = 'wand';
  go.addEventListener('click', () => compose('new'));
  const stop = el('button', { id: 'ai-stop', textContent: t('ai.stop') });
  stop.dataset.icon = 'stop';
  stop.addEventListener('click', () => busy?.abort());
  box.append(
    el('div', { className: 'gen-row' }, field(t('ai.url'), url), field(t('ai.model'), model), test),
    el('div', { className: 'ai-status hint' }),
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
  if (document.activeElement !== box.querySelector('#ai-prompt')) box.querySelector('#ai-prompt').value = a.prompt;
  box.querySelector('#ai-go').disabled = !!busy;
  box.querySelector('#ai-stop').hidden = !busy;
  const out = box.querySelector('.ai-result');
  if (!result) { out.replaceChildren(); return; }
  const p = result.plan;
  const bars = p.sections.reduce((s, x) => s + x.bars, 0), sec = Math.round(bars * 4 * 60 / p.bpm);
  const chords = parseProgression(p.prog).chords.map(c => c.name).join(' – ');
  const lead = p.lead.breizh ? t('win.breizh') : `${soundName(p.lead.sound)} (${t(`gen.style.${p.lead.style}`)}${p.lead.notes ? `, ${t('ai.ownMelody')}` : ''})`;
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
    el('div', { className: 'hint', textContent: t('ai.sounds', { kick: t(`kick.preset.${p.kick.preset}`) + (p.kick.params ? ` (${t('ai.kickTuned')})` : ''), bass: `${soundName(p.bass.sound)} (${t(`gen.bstyle.${p.bass.style}`)})`, chords: soundName(p.chords.sound), lead }) }),
    parts,
    ...(result.warnings.length ? [el('div', { className: 'hint warn', title: result.warnings.join('\n'), textContent: t('ai.warnings', { n: result.warnings.length }) })] : []),
    el('div', { className: 'gen-row' }, refine, btn('ai-refine-go', t('ai.refine'), 'editor', () => compose('refine'))),
    el('div', { className: 'gen-row gen-actions' }, btn('ai-again', t('ai.again'), 'dice', () => compose('again')),
      btn('ai-create', t('start.create'), 'plus', async e => { e.target.disabled = true; try { await composeSong(result.plan); } finally { e.target.disabled = false; } }, true)),
  );
}

/** Ouverture de la fenêtre : état du serveur. */
export function aiWinOpened() {
  renderAi();
  checkAi();
}

/** Pour les tests : l'échange en cours et le dernier plan. */
export const aiSession = () => ({ chat, result });
export { compose as aiCompose };
