// Potentiomètres : réglages globaux, pages pilotées par l'APC, rangées de potentiomètres à l'écran.
import { t } from '../i18n.js';
import { PAGES, toPos, toValue } from '../params.js';
import { renderAcidKnobs } from './acid-ui.js';
import { knobDefs, knobTarget, setPage, turnKnob } from './actions.js';
import { $, UI_PAGES, engine, setShiftHeld, state } from './core.js';
import { renderDecks } from './decks-ui.js';
import { mixField, renderMixer } from './mixer-ui.js';
import { renderOsc } from './osc-ui.js';
import { renderEditorKnobs } from './pads.js';
import { renderSynthKnobs } from './synth-ui.js';

export function globalDef(id) {
  return ['synth', 'fx', 'eq'].map(p => PAGES[p].params.find(d => d.id === id)).find(Boolean);
}
export function globalValue(id, p) { return toValue(globalDef(id), p); }

// Applique les réglages globaux ; ceux qui n'existent plus (anciennes versions) sont retirés.
export function applyGlobals() {
  for (const [id, p] of Object.entries(state.globals)) {
    if (!globalDef(id) || !Number.isFinite(p)) { delete state.globals[id]; continue; }
    engine.set(id, globalValue(id, p));
  }
}

// ---------- Interface : potentiomètres ----------
// Pas de fenêtre de potentiomètres globale : chaque instrument a les siens dans sa fenêtre. Les potentiomètres de l'APC pilotent
// une page (choisie dans l'en-tête, par les boutons de piste, ou automatiquement : celle de la fenêtre active).

export const pageLabel = page => PAGES[page]?.label ?? t(`page.${page}`);

// Sélecteur de la page des potentiomètres de l'APC, dans l'en-tête.
export function buildApcPage() {
  const sel = $('#apc-page');
  for (const page of UI_PAGES) sel.add(new Option(pageLabel(page), page));
  sel.addEventListener('change', () => setPage(sel.value));
}

// Groupe de potentiomètres d'une fenêtre qui correspond à une page (entouré quand l'APC le pilote).
export const PAGE_GROUP = { viz: '#viz-knobs', osc: '#osc-modules', synth: '#synth-knobs', pad: '#pad-knobs, #ed-knobs', acid: '#acid-knobs', decks: '.decks', tr: '#tr-knobs', eq: '#master-eq', fx: '#master-fx' };
export const pageGroup = page => (mixField(page) ? '#mixer' : PAGE_GROUP[page]);

export function renderPages() {
  const sel = $('#apc-page');
  if (sel) sel.value = state.page;
  for (const el of document.querySelectorAll('.apc-live')) el.classList.remove('apc-live');
  const g = pageGroup(state.page);
  if (g) for (const el of document.querySelectorAll(g)) el.classList.add('apc-live');
}

// Fenêtre active -> page des potentiomètres de l'APC (les autres fenêtres ne changent rien).
export function pageForWindow(id) {
  if (id === 'mix') return mixField(state.page) || ['eq', 'fx'].includes(state.page) ? null : 'mix_vol';
  return { piano: 'synth', osc: 'osc', viz: 'viz', tr: 'tr', acid: 'acid', decks: 'decks', editor: 'pad', pads: 'pad' }[id] ?? null;
}

export const ARC = 270;
export function arcPath(p) {
  const r = 30, cx = 40, cy = 40;
  const a0 = (-ARC / 2 - 90) * Math.PI / 180;
  const a1 = a0 + p * ARC * Math.PI / 180;
  const large = p * ARC > 180 ? 1 : 0;
  const pt = a => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${pt(a0)} A ${r} ${r} 0 ${large} 1 ${pt(a1)}`;
}

// Une rangée de 8 potentiomètres liée à une page (numérotés K1-K8 comme sur l'APC).
export const knobRows = {};   // page -> éléments
export function buildKnobRow(wrap, page) {
  const els = [];
  for (let k = 0; k < 8; k++) {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="7" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="7" stroke-linecap="round"/>
        <text x="40" y="46" text-anchor="middle" fill="#8b8d94" font-size="14">K${k + 1}</text>
      </svg>
      <div class="value"></div><div class="label"></div>`;
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null) return;
      const dy = lastY - e.clientY;
      if (Math.abs(dy) < 2) return;
      lastY = e.clientY;
      setShiftHeld(e.shiftKey);
      turnKnob(k, { delta: dy / 2 }, page);
    });
    el.addEventListener('pointerup', () => { lastY = null; setShiftHeld(false); });
    el.addEventListener('wheel', e => { e.preventDefault(); turnKnob(k, { delta: e.deltaY < 0 ? 2 : -2 }, page); }, { passive: false });
    el.addEventListener('dblclick', () => {
      const def = knobDefs(page)[k];
      if (!knobTarget(def, page)) return;
      turnKnob(k, { value: toPos(def, def.def) }, page);
    });
    els.push(el);
    wrap.appendChild(el);
  }
  knobRows[page] = els;
  renderKnobRow(page);
}

export function renderKnobRow(page) {
  const els = knobRows[page];
  if (!els) return;
  const defs = knobDefs(page);
  els.forEach((el, k) => {
    const def = defs[k];
    if (!def) {   // potentiomètre inutilisé sur cette page
      el.querySelector('.arc').setAttribute('d', '');
      el.querySelector('.label').textContent = '';
      el.querySelector('.value').textContent = '';
      el.style.opacity = 0.25;
      return;
    }
    const target = knobTarget(def, page);
    const p = target ? target[def.id] : 0;
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.label').textContent = def.label;
    el.querySelector('.value').textContent = target ? def.fmt(toValue(def, p)) : '—';
    el.style.opacity = target ? 1 : 0.4;
  });
}

// Le potentiomètre tourné s'allume un instant (dans la rangée de sa page, s'il y en a une).
export const flashTimers = {};
export function flashKnob(page, k) {
  renderKnobRow(page);
  const el = knobRows[page]?.[k];
  if (!el) return;
  el.classList.add('flash');
  clearTimeout(flashTimers[`${page}${k}`]);
  flashTimers[`${page}${k}`] = setTimeout(() => el.classList.remove('flash'), 250);
}

export function renderKnobs() {
  for (const page of Object.keys(knobRows)) renderKnobRow(page);
  if (state.page === 'synth') renderSynthKnobs();
  if (state.page === 'pad') renderEditorKnobs();
  if (state.page === 'acid') renderAcidKnobs();
  if (state.page === 'osc') renderOsc();
  if (state.page === 'decks') renderDecks();
  if (mixField(state.page)) renderMixer();
}
