// Fenêtre du designer de kick.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { KICK_PARAMS, KICK_PRESETS, kickDefaults, kickFmt, kickSteps, renderKick as synthKick } from '../kickdesign.js';
import { download, encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { loadFileIntoPad } from './actions.js';
import { $, engine, sidechain, state } from './core.js';
import { arcPath } from './knobs.js';
import { renderLibrary, showLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { kickPresets } from './presets-bar.js';
import { save } from './save.js';
import { bufferCache } from './tl.js';

// ---------- Designer de kick ----------

export let kickBuffer = null;       // dernier kick calculé (AudioBuffer)
export let kickRenderId = 0;
export const kickKnobEls = [];

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
  const wrap = $('#kick-knobs');
  KICK_PARAMS.forEach((id, k) => {
    const el = document.createElement('div');
    el.className = 'knob';
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
    kickKnobEls[k] = el;
    wrap.appendChild(el);
  });
  $('#kick-play').addEventListener('click', () => playKick());
  $('#kick-auto').addEventListener('click', () => { state.kick.auto = !state.kick.auto; renderKick(); save(); });
  $('#kick-to-pad').addEventListener('click', kickToPad);
  $('#kick-to-lib').addEventListener('click', kickToLibrary);
  $('#kick-wav').addEventListener('click', async () => {
    const buf = await kickRender();
    download(new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(0)], buf.sampleRate)], { type: 'audio/wav' }), `${kickName().replace(/\s+/g, '-')}.wav`);
  });
  renderKick();
  kickRender();
}

// Calcule le kick (le dernier demandé gagne) et redessine sa forme d'onde.
export async function kickRender() {
  const id = ++kickRenderId;
  const data = await synthKick(state.kick.params, engine.ctx.sampleRate);
  if (id !== kickRenderId) return kickBuffer;
  const buf = engine.ctx.createBuffer(1, data.length, engine.ctx.sampleRate);
  buf.copyToChannel(data, 0);
  kickBuffer = buf;
  drawKick(data);
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

export async function playKick(fresh = true) {
  const buf = fresh || !kickBuffer ? await kickRender() : kickBuffer;
  const src = engine.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(engine.padBus);
  src.start();
  sidechain.kick();
}

export function drawKick(data) {
  const cv = $('#kick-wave');
  const w = cv.width = cv.clientWidth * devicePixelRatio || 600;
  const h = cv.height = 90 * devicePixelRatio;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = PALETTE[5];
  const step = data.length / w;
  for (let x = 0; x < w; x++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(x * step); i < Math.floor((x + 1) * step); i++) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
    g.fillRect(x, (1 - hi) * h / 2, 1, Math.max(1, (hi - lo) * h / 2));
  }
  $('#kick-len').textContent = `${Math.round(data.length / engine.ctx.sampleRate * 1000)} ms`;
}

export const kickName = () => `Kick ${state.kick.user.find(u => u.id === state.kick.preset)?.name ?? (state.kick.preset ? t(`kick.preset.${state.kick.preset}`) : t('kick.custom'))}`;

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
  KICK_PARAMS.forEach((id, k) => {
    const el = kickKnobEls[k];
    if (!el) return;
    const p = state.kick.params[id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = kickFmt(id, p);
  });
}

export function renderKick() {
  for (const b of $('#kick-presets').children) b.classList.toggle('active', b.dataset.preset === state.kick.preset);
  kickPresets?.render();
  $('#kick-auto').classList.toggle('active', state.kick.auto);
  $('#kick-to-pad').title = t('kick.toPad.title', { n: state.selected + 1, bank: state.bank + 1 });
  renderKickKnobs();
}
