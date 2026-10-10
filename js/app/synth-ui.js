// Fenêtre du synthé en couches : presets, familles, potentiomètres d’expression.
import { t } from '../i18n.js';
import { PAGES, SYNTH_KNOBS, toPos, toValue } from '../params.js';
import { ARP_RATES, CHORD_MODES } from '../performer.js';
import { FAMILIES, PRESETS, WHITE_KEYS, familyGroup, presetById } from '../presets.js';
import { $, engine, state } from './core.js';
import { arcPath, renderKnobs } from './knobs.js';
import { toast } from './misc.js';
import { buildPlayControls, setPlay } from './play.js';
import { buildSynthPresets, synthPresets, synthTouched } from './presets-bar.js';
import { save } from './save.js';

// ---------- Presets du synthé ----------

export let synthFamily = 'leads';   // famille affichée dans la fenêtre du synthé
export const synthKnobDefs = () => SYNTH_KNOBS[familyGroup(presetById(state.preset).family)].map(id => PAGES.synth.params.find(d => d.id === id));

export function applyPreset(id) {
  const preset = presetById(id);
  state.preset = preset.id;
  state.synthPick = null;
  state.synthDirty = false;
  synthFamily = preset.family;
  // Tous les potentiomètres du synthé : valeur du preset, sinon valeur par défaut.
  for (const def of PAGES.synth.params) {
    const v = preset.values[def.id] ?? def.def;
    state.globals[def.id] = Math.min(1, Math.max(0, toPos(def, v)));
    engine.set(def.id, toValue(def, state.globals[def.id]));
  }
  engine.setVoice(preset.voice);
  renderPresets();
  renderKnobs();
  toast(t('preset.toast', { name: `${t(`family.${preset.family}`)} · ${preset.name}` }));
  save();
}

// Maj + touche du clavier : touches blanches = presets de la famille, do# / ré# = famille précédente / suivante.
export function presetKey(note) {
  const pc = note % 12;
  if (pc === 6) { setPlay({ chord: CHORD_MODES[(CHORD_MODES.indexOf(state.play.chord) + 1) % CHORD_MODES.length] }, true); return true; }
  if (pc === 8) { setPlay({ arp: !state.play.arp }, true); return true; }
  if (pc === 10) { setPlay({ rate: ARP_RATES[(ARP_RATES.indexOf(state.play.rate) + 1) % ARP_RATES.length] }, true); return true; }
  if (pc === 1 || pc === 3) {
    const i = FAMILIES.indexOf(synthFamily);
    synthFamily = FAMILIES[(i + (pc === 1 ? -1 : 1) + FAMILIES.length) % FAMILIES.length];
    renderPresets();
    toast(t('preset.family', { name: t(`family.${synthFamily}`) }));
    return true;
  }
  const k = WHITE_KEYS.indexOf(pc);
  if (k < 0) return false;
  const list = PRESETS.filter(p => p.family === synthFamily);
  if (list[k]) applyPreset(list[k].id);
  return true;
}

export function buildPresets() {
  synthFamily = presetById(state.preset).family;
  for (const f of FAMILIES) {
    const btn = document.createElement('button');
    btn.dataset.family = f;
    btn.textContent = t(`family.${f}`);
    btn.addEventListener('click', () => { synthFamily = f; renderPresets(); });
    $('#synth-families').appendChild(btn);
  }
  buildSynthKnobs();
  buildPlayControls();
  buildSynthPresets();
  renderPresets();
}

export function renderPresets() {
  const current = presetById(state.preset);
  for (const btn of $('#synth-families').children) {
    btn.classList.toggle('active', btn.dataset.family === synthFamily);
    btn.classList.toggle('current', btn.dataset.family === current.family);
  }
  const box = $('#presets');
  box.innerHTML = '';
  PRESETS.filter(p => p.family === synthFamily).forEach((preset, k) => {
    const btn = document.createElement('button');
    btn.textContent = preset.name;
    btn.title = t('preset.title', { key: t('notes')[WHITE_KEYS[k]] });
    btn.classList.toggle('active', preset.id === state.preset);
    btn.addEventListener('click', () => applyPreset(preset.id));
    box.appendChild(btn);
  });
  renderSynthKnobs();
  synthPresets?.render();
}

// Les 8 potentiomètres d'expression dans la fenêtre du synthé (les mêmes que la page Synthé de l'APC).
export const synthKnobEls = [];
export function buildSynthKnobs() {
  const wrap = $('#synth-knobs');
  for (let k = 0; k < 8; k++) {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label"></div>`;
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      turnSynthKnob(k, { delta: (lastY - e.clientY) / 2 * (e.shiftKey ? 0.25 : 1) });
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turnSynthKnob(k, { delta: e.deltaY < 0 ? 2 : -2 }); }, { passive: false });
    el.addEventListener('dblclick', () => {
      const def = synthKnobDefs()[k];
      const preset = presetById(state.preset);
      turnSynthKnob(k, { value: toPos(def, preset.values[def.id] ?? def.def) });   // retour à la valeur du preset
    });
    synthKnobEls[k] = el;
    wrap.appendChild(el);
  }
}

export function turnSynthKnob(k, { delta, value }) {
  const def = synthKnobDefs()[k];
  const pos = value ?? Math.min(1, Math.max(0, state.globals[def.id] + delta * 0.01));
  state.globals[def.id] = pos;
  engine.set(def.id, toValue(def, pos));
  synthTouched();
  renderSynthKnobs();
  if (state.page === 'synth') renderKnobs();
  save();
}

export function renderSynthKnobs() {
  synthKnobDefs().forEach((def, k) => {
    const el = synthKnobEls[k];
    if (!el) return;
    const p = state.globals[def.id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.label').textContent = def.label;
    el.querySelector('.value').textContent = def.fmt(toValue(def, p));
  });
}

// Variables modifiées depuis d'autres modules.
export function setSynthFamily(v) { return (synthFamily = v); }
