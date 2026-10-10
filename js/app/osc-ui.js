// Fenêtre du synthé à oscillateurs.
import { t } from '../i18n.js';
import {
  FILTER_TYPES, OSC_KNOBS, OSC_PARAMS, OSC_PRESETS, OSC_WAVES, oscDefaults, oscFmt, oscToPos, oscValues, presetPositions
} from '../osc.js';
import { $, oscSynth, performer, state } from './core.js';
import { arcPath, renderKnobRow } from './knobs.js';
import { buildOscPresets, oscPresets } from './presets-bar.js';
import { save } from './save.js';

// ---------- Synthé à oscillateurs ----------

// Le clavier (APC ou ordinateur) joue le synthé de la fenêtre active : Synthé ou Synthé à oscillateurs.
export function setKeys(target) {
  if (state.keys === target) return;
  performer.allOff();
  state.keys = target;
  renderKeysTarget();
  save();
}
export function renderKeysTarget() {
  for (const [sel, id] of [['#osc-kb', 'osc'], ['#synth-kb', 'synth']]) {
    const b = $(sel);
    if (!b) continue;
    b.classList.toggle('active', state.keys === id);
    b.textContent = t(state.keys === id ? 'kb.here' : 'kb.play');
  }
}

// Réglages d'un bloc du synthé à oscillateurs : 'live' = réglage en cours, sinon un preset (intégré ou perso).
export const oscPresetCache = new Map();
export function oscPresetValues(id) {
  const user = state.osc.user.find(u => u.id === id);
  if (user) return oscValues(user.params);
  const p = OSC_PRESETS.find(p => p.id === id);
  if (!p) return null;
  if (!oscPresetCache.has(id)) oscPresetCache.set(id, oscValues(presetPositions(p.v)));
  return oscPresetCache.get(id);
}
export const oscFor = (clip, synth) => ({ synth, values: (clip.osc !== 'live' && oscPresetValues(clip.osc)) || synth.values });
export const oscPresetName = id => (id === 'live' ? t('osc.live') : state.osc.user.find(u => u.id === id)?.name ?? (OSC_PRESETS.some(p => p.id === id) ? t(`osc.preset.${id}`) : t('osc.live')));
// Son des nouveaux blocs et des prises : le preset choisi (tel quel), sinon le réglage en cours.
export const oscSound = () => state.osc.preset ?? 'live';

// Modules de la fenêtre : sélecteurs (boutons) et potentiomètres.
export const OSC_MODULES = [
  { id: 'o1', sel: ['o1w'], knobs: ['o1oct', 'o1semi', 'o1fine', 'o1lvl', 'o1pw', 'o1uni', 'o1det'] },
  { id: 'o2', sel: ['o2w'], knobs: ['o2oct', 'o2semi', 'o2fine', 'o2lvl', 'o2pw', 'o2uni', 'o2det'] },
  { id: 'o3', sel: ['o3w'], knobs: ['o3oct', 'o3semi', 'o3fine', 'o3lvl', 'o3pw', 'o3uni', 'o3det'] },
  { id: 'mod', sel: [], knobs: ['noise', 'ring', 'fm', 'pbend', 'ptime'] },
  { id: 'filter', sel: ['ftype', 'fslope'], knobs: ['cutoff', 'reso', 'fenv', 'ktrack', 'drive'] },
  { id: 'fenv', env: ['fa', 'fd', 'fs', 'fr'], sel: [], knobs: ['fa', 'fd', 'fs', 'fr'] },
  { id: 'aenv', env: ['aa', 'ad', 'as', 'ar'], sel: [], knobs: ['aa', 'ad', 'as', 'ar'] },
  { id: 'lfo', sel: ['lshape', 'ldest'], knobs: ['lrate', 'ldepth'] },
  { id: 'voice', sel: ['mode'], knobs: ['glide', 'width', 'vol'] },
];
// Icônes des sélecteurs (les autres montrent leur texte).
export const OSC_SEL_ICONS = {
  o1w: OSC_WAVES.map(w => `w-${w}`), o2w: OSC_WAVES.map(w => `w-${w}`), o3w: OSC_WAVES.map(w => `w-${w}`),
  ftype: FILTER_TYPES.map(f => `f-${f}`), lshape: ['w-sine', 'w-tri', 'w-saw', 'w-square'],
};
export const oscKnobEls = {};   // id -> élément
export const oscSelEls = {};    // id -> boutons
export const oscEnvEls = {};    // module -> svg

export function buildOsc() {
  $('#osc-kb').addEventListener('click', () => setKeys('osc'));
  $('#synth-kb').addEventListener('click', () => setKeys('synth'));
  $('#osc-test').addEventListener('click', () => {
    for (const [k, n] of [[0, 60], [1, 63], [2, 67]]) {
      const key = `test:${k}`;
      oscSynth.noteOn(n, 0.85, undefined, key, { ...oscSynth.values });   // copie : l'accord joue en polyphonie
      setTimeout(() => oscSynth.noteOff(n, false, undefined, key), 700);
    }
  });
  buildOscPresets();
  const wrap = $('#osc-modules');
  for (const mod of OSC_MODULES) {
    const box = document.createElement('div');
    box.className = `osc-mod osc-${mod.id}`;
    box.innerHTML = `<h3>${t(`osc.m.${mod.id}`)}</h3>`;
    for (const id of mod.sel) {
      const d = OSC_PARAMS[id];
      const seg = document.createElement('div');
      seg.className = 'segmented osc-sel';
      seg.title = t(`osc.p.${id}`);
      oscSelEls[id] = [];
      for (let v = d.min; v <= d.max; v++) {
        const b = document.createElement('button');
        const icon = OSC_SEL_ICONS[id]?.[v];
        b.title = `${t(`osc.p.${id}`)} : ${d.fmt(v)}`;
        if (icon) { b.dataset.icon = icon; b.classList.add('icon-only'); b.setAttribute('aria-label', d.fmt(v)); } else b.textContent = d.fmt(v);
        b.addEventListener('click', () => { state.osc.params[id] = oscToPos(d, v); oscChanged(); });
        seg.appendChild(b);
        oscSelEls[id].push(b);
      }
      box.appendChild(seg);
    }
    if (mod.env) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 120 36');
      svg.classList.add('osc-env');
      svg.innerHTML = '<polyline fill="none" stroke-width="2" stroke-linejoin="round"/>';
      box.appendChild(svg);
      oscEnvEls[mod.id] = svg;
    }
    const knobs = document.createElement('div');
    knobs.className = 'mini-knobs osc-knobs';
    for (const id of mod.knobs) knobs.appendChild(oscKnob(id));
    box.appendChild(knobs);
    wrap.appendChild(box);
  }
  renderOsc();
  renderKeysTarget();
}

// Un potentiomètre du synthé à oscillateurs (ceux de la page APC portent leur numéro K1-K8).
export function oscKnob(id) {
  const d = OSC_PARAMS[id];
  const k = OSC_KNOBS.indexOf(id);
  const el = document.createElement('div');
  el.className = 'knob' + (k >= 0 ? ' osc-apc' : '');
  el.innerHTML = `
    <svg viewBox="0 0 80 80">
      <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      ${k >= 0 ? `<text x="40" y="46" text-anchor="middle" fill="#8b8d94" font-size="14">K${k + 1}</text>` : ''}
    </svg>
    <div class="value"></div><div class="label">${t(`osc.p.${id}`)}</div>`;
  el.title = t(`osc.h.${id}`) !== `osc.h.${id}` ? t(`osc.h.${id}`) : t(`osc.p.${id}`);
  const turn = pos => {
    const steps = d.steps;
    state.osc.params[id] = Math.min(1, Math.max(0, steps ? Math.round(pos * (steps - 1)) / (steps - 1) : pos));
    oscChanged();
  };
  let lastY = null;
  el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
  el.addEventListener('pointermove', e => {
    if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
    const step = d.steps ? 1 / (d.steps - 1) / 3 : 0.005;
    turn(state.osc.params[id] + (lastY - e.clientY) * step * (e.shiftKey ? 0.25 : 1));
    lastY = e.clientY;
  });
  el.addEventListener('pointerup', () => { lastY = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); turn(state.osc.params[id] + (e.deltaY < 0 ? 1 : -1) * (d.steps ? 1 / (d.steps - 1) : 0.02)); }, { passive: false });
  el.addEventListener('dblclick', () => turn(oscToPos(d, d.def)));
  oscKnobEls[id] = el;
  return el;
}

// Un réglage a changé : le son suit tout de suite ; le preset devient « perso ».
export function oscChanged(custom = true) {
  if (custom) state.osc.preset = null;
  oscSynth.setValues(oscValues(state.osc.params));
  renderOsc();
  if (state.page === 'osc') renderKnobRow('osc');
  save();
}

export function loadOscPreset(id) {
  const user = state.osc.user.find(u => u.id === id);
  const p = OSC_PRESETS.find(p => p.id === id);
  if (!user && !p) return;
  state.osc.params = user ? { ...oscDefaults(), ...user.params } : presetPositions(p.v);
  state.osc.preset = id;
  oscChanged(false);
}

export function renderOsc() {
  if (!$('#osc-modules')?.children.length) return;
  const pos = state.osc.params;
  for (const [id, el] of Object.entries(oscKnobEls)) {
    const p = pos[id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = oscFmt(id, p);
  }
  const V = oscSynth.values;
  for (const [id, btns] of Object.entries(oscSelEls)) btns.forEach((b, v) => b.classList.toggle('active', V[id] === OSC_PARAMS[id].min + v));
  // Les modules inutiles sont estompés (oscillateur éteint, pas de LFO…).
  for (const k of [1, 2, 3]) $(`.osc-o${k}`).classList.toggle('dim', !(V[`o${k}lvl`] > 0 || (k === 1 && (V.ring || V.fm)) || (k === 2 && V.ring) || (k === 3 && V.fm)));
  $('.osc-lfo').classList.toggle('dim', !V.ldepth);
  for (const [mod, [a, dd, s, r]] of Object.entries({ fenv: ['fa', 'fd', 'fs', 'fr'], aenv: ['aa', 'ad', 'as', 'ar'] })) {
    // Enveloppe dessinée : chaque durée sur une échelle en racine carrée.
    const w = x => Math.sqrt(x) * 18;
    const x1 = 2 + w(V[a]), x2 = x1 + w(V[dd]), x3 = x2 + 22, x4 = Math.min(118, x3 + w(V[r]));
    const y = v => 34 - v * 30;
    oscEnvEls[mod].querySelector('polyline').setAttribute('points', `2,34 ${x1},${y(1)} ${x2},${y(V[s])} ${x3},${y(V[s])} ${x4},34`);
  }
  // Presets : intégrés puis les tiens.
  const list = $('#osc-presets');
  list.innerHTML = '';
  const add = (id, name, user) => {
    const b = document.createElement('button');
    b.textContent = name;
    if (user) b.dataset.icon = 'user';
    b.classList.toggle('active', state.osc.preset === id);
    b.classList.toggle('user', user);
    b.addEventListener('click', () => loadOscPreset(id));
    list.appendChild(b);
  };
  for (const p of OSC_PRESETS) add(p.id, t(`osc.preset.${p.id}`), false);
  for (const u of state.osc.user) add(u.id, u.name, true);
  oscPresets?.render();
  $('#osc-current').textContent = state.osc.preset ? oscPresetName(state.osc.preset) : t('osc.custom');
}
