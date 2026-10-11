// Fenêtre du designer de kick : mode simple (12 potentiomètres) ou expert (clic, corps et queue réglés à part,
// chacun écoutable seul), note de la queue, accord sur la tonalité du générateur, mélodie de kick.
import { PALETTE } from '../apc.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { KICK_BASE_NOTE, KICK_LAYERS, KICK_PARAMS, KICK_PRESETS, KICK_SIMPLE, kickDefaults, kickFmt, kickNoteName, kickSteps, kickTailNote, renderKick as synthKick } from '../kickdesign.js';
import { prepareKickClips } from '../kicksynth.js';
import { catColor } from '../library.js';
import { download, encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { loadFileIntoPad } from './actions.js';
import { $, engine, sidechain, state } from './core.js';
import { arcPath } from './knobs.js';
import { renderLibrary, showLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { kickPresets } from './presets-bar.js';
import { openRoll } from './roll-ui.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { growSong, renderTl } from './tl.js';
import { freeTrack } from './tl-record.js';
import { tlSelect } from './tl-select.js';

// ---------- Designer de kick ----------

export let kickBuffer = null;       // dernier kick calculé (AudioBuffer)
export let kickRenderId = 0;
export const kickKnobEls = new Map();   // réglage -> potentiomètres qui l'affichent (simple et expert)
export const KICK_LAYER_COLORS = { click: '#ff8a5c', body: '#ffd166', tail: '#5cc8ff' };

function kickKnob(id) {
  const el = document.createElement('div');
  el.className = 'knob';
  el.dataset.param = id;
  el.innerHTML = `
    <svg viewBox="0 0 80 80">
      <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
    </svg>
    <div class="value"></div><div class="label">${t(`kick.p.${id}`)}</div>`;
  el.title = t(`kick.h.${id}`);
  const turn = (pos, done) => {
    const steps = kickSteps(id);
    state.kick.params[id] = Math.min(1, Math.max(0, steps ? Math.round(pos * (steps - 1)) / (steps - 1) : pos));
    state.kick.preset = null;
    renderKickKnobs();
    kickChanged(done);
  };
  let lastY = null;
  el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
  el.addEventListener('pointermove', e => {
    if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
    const step = kickSteps(id) ? 1 / (kickSteps(id) - 1) / 3 : 0.005;
    turn(state.kick.params[id] + (lastY - e.clientY) * step * (e.shiftKey ? 0.25 : 1), false);
    lastY = e.clientY;
  });
  el.addEventListener('pointerup', () => { if (lastY !== null) kickChanged(true); lastY = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); turn(state.kick.params[id] + (e.deltaY < 0 ? 0.02 : -0.02), true); }, { passive: false });
  el.addEventListener('dblclick', () => turn(kickDefaults()[id], true));
  if (!kickKnobEls.has(id)) kickKnobEls.set(id, []);
  kickKnobEls.get(id).push(el);
  return el;
}

export function buildKick() {
  const presets = $('#kick-presets');
  for (const id of Object.keys(KICK_PRESETS)) {
    const b = document.createElement('button');
    b.dataset.preset = id;
    b.textContent = t(`kick.preset.${id}`);
    b.addEventListener('click', () => {
      state.kick.params = { ...kickDefaults(), ...KICK_PRESETS[id] };
      state.kick.preset = id;
      kickChanged(true);
    });
    presets.appendChild(b);
  }
  for (const id of KICK_SIMPLE) $('#kick-knobs').appendChild(kickKnob(id));
  // Mode expert : une colonne par couche, avec son bouton Solo.
  const layers = $('#kick-layers');
  for (const [layer, ids] of Object.entries(KICK_LAYERS)) {
    const col = document.createElement('div');
    col.className = 'kick-layer';
    col.dataset.layer = layer;
    col.style.setProperty('--layer', KICK_LAYER_COLORS[layer]);
    const head = document.createElement('div');
    head.className = 'kick-layer-head';
    const name = document.createElement('b');
    name.textContent = t(`kick.layer.${layer}`);
    const solo = document.createElement('button');
    solo.className = 'kick-solo';
    solo.dataset.icon = 'phones';
    solo.textContent = t('kick.solo');
    solo.title = t('kick.solo.title');
    solo.addEventListener('click', () => {
      state.kick.solo = state.kick.solo === layer ? null : layer;
      renderKick();
      kickChanged(true);
    });
    head.append(name, solo);
    const knobs = document.createElement('div');
    knobs.className = 'mini-knobs kick-layer-knobs';
    for (const id of ids) knobs.appendChild(kickKnob(id));
    col.append(head, knobs);
    layers.appendChild(col);
  }
  for (const b of $('#kick-mode').querySelectorAll('button')) b.addEventListener('click', () => {
    state.kick.expert = b.dataset.mode === 'expert';
    if (!state.kick.expert) state.kick.solo = null;
    renderKick();
    kickRender();
    save();
  });
  $('#kick-play').addEventListener('click', () => playKick());
  $('#kick-auto').addEventListener('click', () => { state.kick.auto = !state.kick.auto; renderKick(); save(); });
  $('#kick-key').addEventListener('click', kickToKey);
  $('#kick-melody').addEventListener('click', kickMelody);
  $('#kick-to-pad').addEventListener('click', kickToPad);
  $('#kick-to-lib').addEventListener('click', kickToLibrary);
  $('#kick-wav').addEventListener('click', async () => {
    const buf = await kickRender();
    download(new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate)], { type: 'audio/wav' }), `${kickName().replace(/\s+/g, '-')}.wav`);
  });
  renderKick();
  kickRender();
}

// Calcule le kick entier (le dernier demandé gagne) et redessine sa forme d'onde ; en mode expert, chaque couche
// est dessinée dans sa couleur.
export async function kickRender() {
  const id = ++kickRenderId;
  const sr = engine.ctx.sampleRate, params = { ...state.kick.params };
  const data = await synthKick(params, sr);
  if (id !== kickRenderId) return kickBuffer;
  const buf = engine.ctx.createBuffer(1, data.length, sr);
  buf.copyToChannel(data, 0);
  kickBuffer = buf;
  if (!state.kick.expert) { drawKick(data); return buf; }
  const layers = await Promise.all(Object.keys(KICK_LAYERS).map(only => synthKick(params, sr, { only })));
  if (id === kickRenderId) drawKick(data, layers);
  return buf;
}

export let kickTimer;
export function kickChanged(play) {
  clearTimeout(kickTimer);
  kickTimer = setTimeout(async () => {
    await kickRender();
    if (play && state.kick.auto) playKick(false);
  }, 40);
  renderKick();
  save();
}

// Écoute : le kick entier, ou la couche en solo (mode expert).
export async function playKick(fresh = true) {
  let buf = fresh || !kickBuffer ? await kickRender() : kickBuffer;
  const solo = state.kick.expert && state.kick.solo;
  if (solo) {
    const data = await synthKick(state.kick.params, engine.ctx.sampleRate, { only: solo });
    buf = engine.ctx.createBuffer(1, data.length, engine.ctx.sampleRate);
    buf.copyToChannel(data, 0);
  }
  const src = engine.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(engine.padBus);
  src.start();
  sidechain.kick();
}

export function drawKick(data, layers = null) {
  const cv = $('#kick-wave');
  const w = cv.width = cv.clientWidth * devicePixelRatio || 600;
  const h = cv.height = 90 * devicePixelRatio;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  const step = data.length / w;
  const draw = (d, color, alpha) => {
    g.fillStyle = color;
    g.globalAlpha = alpha;
    for (let x = 0; x < w; x++) {
      let lo = 0, hi = 0;
      for (let i = Math.floor(x * step); i < Math.min(d.length, Math.floor((x + 1) * step)); i++) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); }
      g.fillRect(x, (1 - hi) * h / 2, 1, Math.max(1, (hi - lo) * h / 2));
    }
  };
  if (layers) {
    draw(data, PALETTE[3], 0.25);
    // La queue d'abord : le clic et le corps, plus courts, restent visibles par-dessus.
    for (const k of [2, 1, 0]) { const layer = Object.keys(KICK_LAYERS)[k]; if (!state.kick.solo || state.kick.solo === layer) draw(layers[k], KICK_LAYER_COLORS[layer], 0.85); }
    g.globalAlpha = 1;
  } else draw(data, PALETTE[5], 1);
  g.globalAlpha = 1;
  $('#kick-len').textContent = `${Math.round(data.length / engine.ctx.sampleRate * 1000)} ms`;
}

export const kickName = () => `Kick ${state.kick.user.find(u => u.id === state.kick.preset)?.name ?? (state.kick.preset ? t(`kick.preset.${state.kick.preset}`) : t('kick.custom'))}`;

// Tonalité du morceau : la fondamentale du premier accord du générateur (null s'il n'y en a pas).
export function songKey() {
  const c = parseProgression(state.gen?.prog ?? '').chords[0];
  return c ? c.root : null;
}
// Accorde la queue sur la tonalité (la note la plus proche de la note actuelle).
export function kickToKey() {
  const key = songKey();
  if (key === null) { toast(t('kick.noKey'), 3000); return; }
  const now = kickTailNote(state.kick.params);
  const d = ((key - now) % 12 + 18) % 12 - 6;   // -6..+5 demi-tons
  const tune = Math.min(12, Math.max(-12, now + d - KICK_BASE_NOTE));
  state.kick.params.tune = (tune + 12) / 24;
  state.kick.preset = null;
  kickChanged(true);
  toast(t('kick.keyDone', { note: kickNoteName(kickTailNote(state.kick.params)) }), 3000);
}

// Mélodie de kick : un bloc de notes joué par ce kick, un kick par temps. Il suit la suite d'accords du générateur
// (la fondamentale de chaque accord, au plus près de la note de la queue), sinon reste sur la note de la queue.
export function kickMelody() {
  const base = kickTailNote(state.kick.params);
  const { chords } = parseProgression(state.gen?.prog ?? '');
  const per = (state.gen?.bars ?? 1) * BEATS_PER_BAR;
  const len = chords.length ? Math.min(8 * BEATS_PER_BAR, chords.length * per) : 4 * BEATS_PER_BAR;
  const near = pc => base + ((pc - base) % 12 + 18) % 12 - 6;
  const seq = Array.from({ length: len }, (_, b) => ({
    t: b, len: 1, note: chords.length ? near(chords[Math.floor(b / per) % chords.length].root) : base, vel: b % BEATS_PER_BAR === 0 ? 1 : 0.9,
  }));
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const clip = { id: crypto.randomUUID(), type: 'note', seq, pat: len, len, start, kick: { ...state.kick.params }, name: t('kick.melodyName'), cat: 'kick', color: catColor('kick'), loop: false };
  const track = freeTrack(start, len);
  state.tl.tracks[track].clips.push(clip);
  growSong(clip);
  tlSelect(track, clip);
  prepareKickClips(state.tl.tracks, engine.ctx.sampleRate);
  openRoll(clip, true);
  renderTl();
  save();
  toast(t(chords.length ? 'kick.melodyChords' : 'kick.melodyDone', { track: track + 1, bars: len / BEATS_PER_BAR }), 4000);
}

// Le kick devient le son du pad sélectionné (banque affichée).
export async function kickToPad() {
  const buf = await kickRender();
  const wav = encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate);
  await loadFileIntoPad(new File([wav], `${kickName()}.wav`, { type: 'audio/wav' }), state.selected);
  toast(t('kick.toPadDone', { n: state.selected + 1, bank: state.bank + 1 }), 3000);
}

// Le kick rejoint la bibliothèque (catégorie Kicks) : on peut le glisser sur la timeline.
export async function kickToLibrary() {
  const buf = await kickRender();
  const wav = encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate);
  const sampleId = `user:${crypto.randomUUID()}`;
  const same = state.userSounds.filter(s => s.name.startsWith(kickName())).length;
  const name = same ? `${kickName()} ${same + 1}` : kickName();
  await store.saveSample(sampleId, { name, data: wav });
  bufferCache.set(sampleId, buf);
  state.userSounds.push({ sampleId, name, cat: 'kick' });
  showLibrary('sounds', 'kick', '');
  save();
  toast(t('kick.toLibDone', { name }), 3000);
}

// Retire un son créé dans l'application de la bibliothèque (s'il ne sert plus nulle part, son fichier est effacé).
export function removeUserSound(item) {
  if (!confirm(t('lib.removeConfirm', { name: item.name }))) return;
  state.userSounds = state.userSounds.filter(s => s.sampleId !== item.sampleId);
  const used = state.tl.tracks.some(tr => tr.clips.some(c => c.sampleId === item.sampleId)) || state.banks.flat().some(p => p?.sampleId === item.sampleId);
  if (!used) { store.deleteSample(item.sampleId).catch(() => {}); bufferCache.delete(item.sampleId); }
  renderLibrary();
  save();
}

export function renderKickKnobs() {
  for (const id of KICK_PARAMS) {
    const p = state.kick.params[id];
    for (const el of kickKnobEls.get(id) ?? []) {
      el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
      el.querySelector('.value').textContent = kickFmt(id, p);
    }
  }
  const note = kickTailNote(state.kick.params);
  $('#kick-note').textContent = t('kick.tailNote', { note: kickNoteName(note), hz: Math.round(440 * Math.pow(2, (note - 69) / 12)) });
}

export function renderKick() {
  for (const b of $('#kick-presets').children) b.classList.toggle('active', b.dataset.preset === state.kick.preset);
  kickPresets?.render();
  const expert = !!state.kick.expert;
  for (const b of $('#kick-mode').querySelectorAll('button')) b.classList.toggle('active', (b.dataset.mode === 'expert') === expert);
  $('#kick-knobs').hidden = expert;
  $('#kick-layers').hidden = !expert;
  for (const col of $('#kick-layers').children) {
    col.classList.toggle('solo', state.kick.solo === col.dataset.layer);
    col.classList.toggle('muted', !!state.kick.solo && state.kick.solo !== col.dataset.layer);
    col.querySelector('.kick-solo').classList.toggle('active', state.kick.solo === col.dataset.layer);
  }
  $('#kick-auto').classList.toggle('active', state.kick.auto);
  $('#kick-to-pad').title = t('kick.toPad.title', { n: state.selected + 1, bank: state.bank + 1 });
  renderKickKnobs();
}
