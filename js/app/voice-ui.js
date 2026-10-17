// Fenêtre Générateur de voix (js/voice.js) : un texte chanté, scandé ou dit en robot sur les notes d'un bloc de la
// timeline (lead, nappe), par une voix neuronale téléchargée à la première utilisation. Écouter, puis Générer : la voix
// devient un bloc audio sur une piste libre, enregistré avec le projet comme une prise.
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { clipEvents } from '../notes.js';
import { encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { MAX_VOICE_PARTS, VOICE_CHOIR, VOICE_MODELS, VOICE_MODES, loadVoice, renderVoice, voiceCached } from '../voice.js';
import { $, engine, state, timeline } from './core.js';
import { bounceTarget } from './freeze.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { growSong, renderTl, tlSel, trackName } from './tl.js';
import { tlSelect } from './tl-select.js';
import { noteLabel } from './tl-record.js';

export const VOICE_OCTAVES = ['auto', -2, -1, 0, 1, 2];
export const defaultVoiceState = () => ({ text: '', src: null, mode: 'sing', model: 'fr-siwis', speaker: 0, octave: 'auto', formant: 1, choir: 1, harmony: false, fill: false });

export function mergeVoiceState(saved) {
  const v = defaultVoiceState();
  if (!saved || typeof saved !== 'object') return v;
  if (typeof saved.text === 'string') v.text = saved.text.slice(0, 2000);
  if (typeof saved.src === 'string') v.src = saved.src;
  if (VOICE_MODES.includes(saved.mode)) v.mode = saved.mode;
  if (saved.model in VOICE_MODELS) v.model = saved.model;
  if (Number.isInteger(saved.speaker) && saved.speaker >= 0) v.speaker = saved.speaker % VOICE_MODELS[v.model].speakers;
  if (VOICE_OCTAVES.includes(saved.octave)) v.octave = saved.octave;
  if (Number.isFinite(saved.formant)) v.formant = Math.min(1.2, Math.max(0.8, saved.formant));
  if (VOICE_CHOIR.includes(saved.choir)) v.choir = saved.choir;
  v.harmony = !!saved.harmony;
  v.fill = !!saved.fill;
  return v;
}

// ---- Bloc de notes suivi ----

// Blocs de notes de la timeline : [{ track, clip }].
export function voiceSources() {
  const out = [];
  state.tl.tracks.forEach((tr, track) => { for (const clip of tr.clips) if (clip.type === 'note') out.push({ track, clip }); });
  return out.sort((a, b) => a.clip.start - b.clip.start || a.track - b.track);
}
// Le bloc choisi ; à défaut le bloc sélectionné, puis le premier lead, puis le premier bloc de notes.
export function voiceSource() {
  const all = voiceSources();
  return all.find(s => s.clip.id === state.voice.src) ?? all.find(s => s.clip === tlSel?.clip) ?? all.find(s => s.clip.cat === 'lead') ?? all[0] ?? null;
}

// ---- Rendu (gardé tant que rien ne change) ----

let last = null;   // { key, buffer, pre, syllables }
let busy = false;
const settingsKey = src => JSON.stringify([state.voice, state.bpm, src.clip.start, src.clip.len, clipEvents(src.clip)]);

// Le rendu de la voix en AudioBuffer (à la fréquence du moteur). -> { buffer, pre, syllables } ou null
export async function voiceTake() {
  const v = state.voice, src = voiceSource();
  if (!src) { toast(t('voice.noBlock'), 4000); return null; }
  if (!v.text.trim()) { toast(t('voice.noText'), 3000); $('#voice-text')?.focus(); return null; }
  const key = settingsKey(src);
  if (last?.key === key) return last;
  if (busy) return null;
  busy = true;
  renderVoiceBusy(true);
  try {
    setVoiceStatus(t('voice.loading'));
    await loadVoice(v.model, (got, total) => setVoiceStatus(t('voice.downloading', { pct: total ? Math.round(got / total * 100) : '…', mb: Math.round(got / 1e6) }), total ? got / total : null));
    setVoiceStatus(t('voice.rendering'), 0);
    const res = await renderVoice(v.text, clipEvents(src.clip), src.clip.len, state.bpm,
      { model: v.model, speaker: v.speaker, mode: v.mode, octave: v.octave, formant: v.formant, choir: v.choir, harmony: v.harmony, fill: v.fill, seed: 7 },
      p => setVoiceStatus(t('voice.rendering'), p));
    if (!res) { toast(t('voice.nothing'), 3000); return null; }
    const sr = engine.ctx.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(res.left.length * sr / res.sr), sr);
    const b = off.createBuffer(2, res.left.length, res.sr);
    b.copyToChannel(res.left, 0);
    b.copyToChannel(res.right, 1);
    const node = off.createBufferSource();
    node.buffer = b;
    node.connect(off.destination);
    node.start();
    const buffer = await off.startRendering();
    last = { key, buffer, pre: res.pre, syllables: res.syllables };
    renderVoiceSyllables();
    return last;
  } catch (err) {
    console.error(err);
    toast(t('voice.fail', { msg: err.message }), 6000);
    return null;
  } finally {
    busy = false;
    renderVoiceBusy(false);
    renderVoiceStatus();
  }
}

// ---- Écouter ----

let preview = null;
export function stopVoicePreview() {
  if (!preview) return false;
  try { preview.stop(); } catch { /* déjà fini */ }
  preview = null;
  $('#voice-listen')?.classList.remove('active');
  return true;
}
export async function previewVoice() {
  if (stopVoicePreview()) return;
  const take = await voiceTake();
  if (!take) return;
  const node = engine.ctx.createBufferSource();
  node.buffer = take.buffer;
  node.connect(engine.master);
  node.onended = () => { if (preview === node) { preview = null; $('#voice-listen')?.classList.remove('active'); } };
  node.start();
  preview = node;
  $('#voice-listen')?.classList.add('active');
}

// ---- Générer : un bloc audio sur une piste libre ----

export async function generateVoiceClip() {
  stopVoicePreview();
  const src = voiceSource();
  const take = await voiceTake();
  if (!take || !src) return null;
  const bpm = state.bpm, sr = take.buffer.sampleRate, bd = 60 / bpm;
  // Le début de la voix (consonnes avant la première note) tombe avant le bloc ; coupé au temps 0 du morceau.
  const pre = Math.min(take.pre, src.clip.start * bd);
  const cut = Math.round((take.pre - pre) * sr);
  const n = take.buffer.length - cut;
  const buf = engine.ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) buf.copyToChannel(take.buffer.getChannelData(c).subarray(cut), c);
  const j = bounceTarget(src.track);
  if (j < 0) { toast(t('frz.noTrack'), 3500); return null; }
  const id = `rec:${crypto.randomUUID()}`;
  const name = `${t('voice.clipName')} · ${state.voice.text.trim().replace(/\s+/g, ' ')}`.slice(0, 24);
  bufferCache.set(id, buf);
  const start = src.clip.start - pre / bd;
  const clip = { id: crypto.randomUUID(), start, len: Math.max(1, Math.ceil(buf.duration / bd - 1e-3)), sampleId: id, name, cat: 'voice', color: catColor('voice'), bpm, loop: false };
  const dst = state.tl.tracks[j];
  if (!dst.clips.length) dst.name = t('voice.trackName');
  dst.clips.push(clip);
  growSong(clip);
  tlSelect(j, clip);
  timeline.updateTrack(j);
  renderTl();
  save();
  toast(t('voice.done', { track: trackName(j), bar: Math.floor(src.clip.start / BEATS_PER_BAR) + 1 }), 4000);
  // Enregistré comme une prise (« rec: ») : sauvegardé avec le projet.
  store.saveSample(id, { name, data: encodeWav([0, 1].map(c => buf.getChannelData(c)), sr) }).then(renderLibrary).catch(err => console.warn('Voix', err));
  renderLibrary();
  return { track: j, clip };
}

// ---- Fenêtre ----

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const field = (label, input) => el('label', {}, el('span', { textContent: label }), input);
function vSelect(key, options, cast = v => v) {
  const s = el('select');
  s.dataset.key = key;
  for (const o of options) {
    if (o.group) { const g = el('optgroup', { label: o.group }); for (const [v, text] of o.items) g.append(new Option(text, v)); s.append(g); }
    else s.add(new Option(o[1], o[0]));
  }
  s.addEventListener('change', () => { state.voice[key] = cast(s.value); onVoiceChange(); });
  return s;
}
function onVoiceChange() {
  stopVoicePreview();
  const v = state.voice;
  v.speaker %= VOICE_MODELS[v.model].speakers;
  save();
  renderVoiceWin();
}
const modelLabel = id => t(`voice.model.${id}`);

export function buildVoiceWin() {
  const box = $('#voice');
  const row = (...els) => el('div', { className: 'gen-row' }, ...els);
  const text = el('textarea', { id: 'voice-text', rows: 3, maxLength: 2000, spellcheck: false, placeholder: t('voice.placeholder') });
  text.addEventListener('input', () => { state.voice.text = text.value; save(); });
  text.addEventListener('keydown', e => e.stopPropagation());   // les touches du texte ne jouent pas les raccourcis
  const srcSel = el('select', { id: 'voice-src' });
  srcSel.addEventListener('change', () => { state.voice.src = srcSel.value; onVoiceChange(); });
  srcSel.addEventListener('focus', renderVoiceSources);
  const models = ['fr', 'en'].map(lang => ({ group: t(`voice.lang.${lang}`), items: Object.keys(VOICE_MODELS).filter(k => VOICE_MODELS[k].lang === lang).map(k => [k, modelLabel(k)]) }));
  const speaker = el('input', { id: 'voice-speaker', type: 'number', min: 0, step: 1 });
  speaker.addEventListener('change', () => { state.voice.speaker = Math.max(0, Math.round(+speaker.value) || 0); onVoiceChange(); });
  speaker.addEventListener('keydown', e => e.stopPropagation());
  const dice = el('button', { id: 'voice-dice', className: 'icon-only', title: t('voice.diceTitle') });
  dice.dataset.icon = 'wand';
  dice.addEventListener('click', () => { state.voice.speaker = Math.floor(Math.random() * VOICE_MODELS[state.voice.model].speakers); onVoiceChange(); });
  const names = vSelect('speaker', [], Number);
  names.id = 'voice-names';
  const timbre = el('input', { id: 'voice-formant', type: 'range', min: 0.8, max: 1.2, step: 0.01 });
  timbre.addEventListener('input', () => { state.voice.formant = +timbre.value; onVoiceChange(); });
  timbre.addEventListener('dblclick', () => { state.voice.formant = 1; onVoiceChange(); });
  const check = (key, label) => {
    const c = el('input', { type: 'checkbox' });
    c.dataset.key = key;
    c.addEventListener('change', () => { state.voice[key] = c.checked; onVoiceChange(); });
    return field(label, c);
  };
  const listen = el('button', { id: 'voice-listen', textContent: t('gen.listen') });
  listen.dataset.icon = 'play';
  listen.addEventListener('click', previewVoice);
  const go = el('button', { id: 'voice-go', className: 'primary', textContent: t('gen.go') });
  go.addEventListener('click', generateVoiceClip);
  const actions = row(listen, go);
  actions.classList.add('gen-actions');
  box.append(
    el('p', { className: 'hint', textContent: t('voice.intro') }),
    field(t('voice.text'), text),
    row(field(t('voice.src'), srcSel),
      field(t('voice.mode'), vSelect('mode', VOICE_MODES.map(m => [m, t(`voice.mode.${m}`)]))),
      check('fill', t('voice.fill'))),
    row(field(t('voice.model'), vSelect('model', models)),
      el('label', { className: 'voice-who' }, el('span', { textContent: t('voice.speaker') }), speaker, names, dice),
      field(t('voice.octave'), vSelect('octave', VOICE_OCTAVES.map(o => [o, o === 'auto' ? t('voice.octAuto') : `${o > 0 ? '+' : ''}${o}`]), x => (x === 'auto' ? x : +x))),
      field(t('voice.formant'), timbre),
      field(t('voice.choir'), vSelect('choir', VOICE_CHOIR.map(n => [n, n === 1 ? t('voice.solo') : `×${n}`]), Number)),
      check('harmony', t('voice.harmony'))),
    actions,
    el('div', { className: 'voice-status' }, el('span', { className: 'hint', id: 'voice-status' }), el('progress', { id: 'voice-progress', max: 1, hidden: true })),
    el('div', { className: 'voice-syls', id: 'voice-syls' }),
    el('p', { className: 'hint voice-credit', id: 'voice-credit' }));
  renderVoiceWin();
}

export function renderVoiceSources() {
  const sel = $('#voice-src');
  if (!sel) return;
  const all = voiceSources(), cur = voiceSource();
  sel.replaceChildren(...(all.length ? all.map(({ track, clip }) => new Option(t('voice.srcItem', { track: trackName(track), name: clip.name ?? '', bar: Math.floor(clip.start / BEATS_PER_BAR) + 1 }), clip.id))
    : [new Option(t('voice.noBlockShort'), '')]));
  sel.value = cur?.clip.id ?? '';
  sel.disabled = !all.length;
}

// Réglages affichés (après le chargement d'un projet, d'un fichier…).
export function renderVoiceWin() {
  const box = $('#voice');
  if (!box) return;
  const v = state.voice, m = VOICE_MODELS[v.model];
  const text = $('#voice-text');
  if (document.activeElement !== text) text.value = v.text;
  for (const s of box.querySelectorAll('select[data-key]')) if (s.dataset.key !== 'speaker') s.value = String(v[s.dataset.key]);
  for (const c of box.querySelectorAll('input[type=checkbox][data-key]')) c.checked = !!v[c.dataset.key];
  $('#voice-formant').value = v.formant;
  // Interprète : un nom (deux voix), un numéro (beaucoup de voix), rien (une seule voix).
  const speaker = $('#voice-speaker'), names = $('#voice-names');
  speaker.hidden = !(m.speakers > 1 && !m.names);
  $('#voice-dice').hidden = speaker.hidden;
  names.hidden = !m.names;
  if (m.names) { names.replaceChildren(...m.names.map((n, i) => new Option(n, i))); names.value = String(v.speaker); }
  speaker.max = m.speakers - 1;
  speaker.value = v.speaker;
  box.querySelector('.voice-who').hidden = m.speakers <= 1;
  $('#voice-credit').textContent = t('voice.credit', { name: modelLabel(v.model), credit: m.credit, license: m.license });
  renderVoiceSources();
  renderVoiceSyllables();
  renderVoiceStatus();
}

let status = null;
function setVoiceStatus(text, progress) {
  status = text;
  const s = $('#voice-status'), p = $('#voice-progress');
  if (!s) return;
  s.textContent = text;
  p.hidden = progress === undefined;
  if (progress === null) p.removeAttribute('value'); else if (progress !== undefined) p.value = progress;
}
async function renderVoiceStatus() {
  if (busy) return;
  const v = state.voice, m = VOICE_MODELS[v.model];
  const parts = Math.min(MAX_VOICE_PARTS, v.choir * (v.harmony ? 4 : 1));
  const cached = await voiceCached(v.model);
  if (busy) return;
  setVoiceStatus(cached ? t('voice.ready', { parts }) : t('voice.toDownload', { mb: m.mb }));
}
function renderVoiceBusy(on) {
  for (const id of ['#voice-listen', '#voice-go']) { const b = $(id); if (b) b.disabled = on; }
}

// Syllabes du dernier rendu, chacune avec sa note (pour vérifier le placement).
function renderVoiceSyllables() {
  const box = $('#voice-syls');
  if (!box) return;
  const src = voiceSource();
  const fresh = last && src && last.key === settingsKey(src);
  box.replaceChildren(...(fresh ? last.syllables.map(s => el('span', { title: s.notes.map(n => noteLabel(n.notes[n.notes.length - 1])).join(' → ') },
    el('b', { textContent: s.label }), el('i', { textContent: s.notes.map(n => noteLabel(n.notes[n.notes.length - 1])).join('·') }))) : []));
  box.hidden = !fresh;
}
