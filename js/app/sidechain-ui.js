// Sidechain : kicks des sons et fenêtre de réglage.
import { t } from '../i18n.js';
import { guessCat } from '../library.js';
import { SC_DUCKED, SC_SOURCES, defaultScState } from '../sidechain.js';
import { $, engine, kit, sidechain, state } from './core.js';
import { libManifest } from './library-ui.js';
import { save } from './save.js';

// ---------- Sidechain ----------

// Catégorie et kicks connus d'un son de la bibliothèque (sounds/banks.json).
export let soundInfo = null;
export function soundMeta(sampleId) {
  if (!soundInfo && libManifest) {
    soundInfo = new Map();
    for (const bank of libManifest?.banks ?? []) for (const p of bank.pads) if (p) soundInfo.set(`lib:${p.file}`, p);
  }
  return soundInfo?.get(sampleId);
}
// Kicks d'une boucle de la bibliothèque, en temps depuis son début (null si elle n'en a pas).
export const soundKicks = sampleId => soundMeta(sampleId)?.kicks?.map(s => s / 4) ?? null;
export function padCat(pad) {
  if (!pad) return null;
  const meta = soundMeta(pad.sampleId);
  if (meta?.cat) return meta.cat;
  if (pad.sampleId?.startsWith('builtin:')) return guessCat(kit[+pad.sampleId.slice(8)]?.name ?? pad.name);
  return guessCat(pad.name);
}
// Son baissé par le sidechain : mélodique (basse, nappe, lead, clavier, voix), et sans kick dedans.
export const isDuckedSound = (sampleId, cat) => SC_DUCKED.has(cat) && !soundKicks(sampleId);

// Kicks d'un bloc de la timeline : enregistrement de la 909, boucle de la bibliothèque, ou son de kick.
export function clipKicks(clip) {
  if (clip.kickBeats) return clip.kickBeats;
  const known = soundKicks(clip.sampleId);
  if (known) return known;
  return clip.cat === 'kick' ? [0] : null;
}

// Boucles des pads qui contiennent des kicks (pour le mode « kicks »).
export function padLoopKicks() {
  const out = [];
  for (const [key, v] of engine.padVoices) {
    if (v.mode !== 'loop' || !v.pad?.buffer) continue;
    const kicks = soundKicks(v.pad.sampleId) ?? (padCat(v.pad) === 'kick' ? [0] : null);
    if (!kicks) continue;
    const beats = v.pad.bpm ? v.pad.buffer.duration * v.pad.bpm / 60 : v.pad.buffer.duration * engine.bpm / 60;
    if (beats > 0.25) out.push({ key, startBeat: v.startBeat, beats, kicks });
  }
  return out;
}

export function setSidechain(changes) {
  Object.assign(state.sc, changes);
  sidechain.apply();
  renderSidechain();
  save();
}

export function buildSidechain() {
  const box = $('#sidechain');
  box.innerHTML = `
    <span class="sc-title">${t('sc.title')}</span>
    <button data-sc="on" title="${t('sc.onTitle')}">${t('sc.on')}</button>
    <label><span>${t('sc.source')}</span><select data-sc="source">${SC_SOURCES.map(s => `<option value="${s}">${t(`sc.src.${s}`)}</option>`).join('')}</select></label>
    <label class="sc-range"><span>${t('sc.depth')}</span><input type="range" min="0" max="1" step="0.01" data-sc="depth"><em></em></label>
    <label class="sc-range"><span>${t('sc.release')}</span><input type="range" min="0.05" max="0.6" step="0.01" data-sc="release"><em></em></label>
    <span class="sc-targets"><span>${t('sc.targets')}</span>
      <button data-sc="synth" title="${t('sc.synthTitle')}">${t('sc.synth')}</button>
      <button data-sc="samples" title="${t('sc.samplesTitle')}">${t('sc.samples')}</button>
    </span>
    <span class="sc-meter" title="${t('sc.meter')}"><i></i></span>`;
  for (const el of box.querySelectorAll('button[data-sc]')) el.addEventListener('click', () => setSidechain({ [el.dataset.sc]: !state.sc[el.dataset.sc] }));
  box.querySelector('select').addEventListener('change', e => setSidechain({ source: e.target.value }));
  for (const el of box.querySelectorAll('input[data-sc]')) {
    el.addEventListener('input', () => setSidechain({ [el.dataset.sc]: +el.value }));
    el.addEventListener('dblclick', () => setSidechain({ [el.dataset.sc]: defaultScState()[el.dataset.sc] }));
  }
  // Témoin : baisse du gain en cours, lue sur le bus du synthé.
  const probe = engine.ctx.createAnalyser();
  probe.fftSize = 256;
  sidechain.shaper.connect(probe);
  const data = new Float32Array(probe.fftSize);
  const bar = box.querySelector('.sc-meter i');
  (function frame() {
    probe.getFloatTimeDomainData(data);
    let min = 0;
    for (const v of data) min = Math.min(min, v);
    bar.style.width = state.sc.on ? `${Math.round(-min * 100)}%` : '0';
    requestAnimationFrame(frame);
  })();
  renderSidechain();
}

export function renderSidechain() {
  const s = state.sc;
  const box = $('#sidechain');
  box.classList.toggle('active', s.on);
  for (const el of box.querySelectorAll('button[data-sc]')) el.classList.toggle('active', !!s[el.dataset.sc]);
  box.querySelector('select').value = s.source;
  for (const el of box.querySelectorAll('input[data-sc]')) {
    el.value = s[el.dataset.sc];
    el.nextElementSibling.textContent = el.dataset.sc === 'depth' ? `${Math.round(s.depth * 100)}%` : `${Math.round(s.release * 1000)} ms`;
  }
}
