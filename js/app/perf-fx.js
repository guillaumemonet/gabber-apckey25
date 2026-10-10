// Effets de performance.
import { t } from '../i18n.js';
import { renderLeds } from './controller.js';
import { $, engine } from './core.js';

// ---------- Effets de performance ----------

export const perfActive = new Set();
export const heldRolls = [];
export const roll = div => ({ on: () => { heldRolls.push(div); engine.rollOn(div); },
  off: () => {
    const k = heldRolls.lastIndexOf(div);
    if (k >= 0) heldRolls.splice(k, 1);
    if (heldRolls.length) engine.rollOn(heldRolls[heldRolls.length - 1]); else engine.rollOff();
  } });
export const PERF = [
  { label: 'Roll 1/8', hint: t('perf.track', { n: 5 }), ...roll(8) },
  { label: 'Roll 1/16', hint: t('perf.track', { n: 6 }), ...roll(16) },
  { label: 'Roll 1/32', hint: t('perf.track', { n: 7 }), ...roll(32) },
  { label: t('perf.filterDown'), hint: t('perf.track', { n: 8 }), on: () => engine.sweep('lp', true), off: () => engine.sweep('lp', false) },
  { label: 'Roll 1/4', hint: t('perf.shift', { n: 5 }), ...roll(4) },
  { label: 'Tape stop', hint: t('perf.shift', { n: 6 }), on: () => engine.tapeStop(), momentary: 900 },
  { label: t('perf.filterUp'), hint: t('perf.shift', { n: 7 }), on: () => engine.sweep('hp', true), off: () => engine.sweep('hp', false) },
  { label: 'Pump', hint: t('perf.shift', { n: 8 }), toggle: true, on: () => engine.setPump(true), off: () => engine.setPump(false) },
];

export function perfDown(i) {
  const fx = PERF[i];
  if (fx.toggle && perfActive.has(i)) { perfActive.delete(i); fx.off(); }
  else if (!perfActive.has(i)) {
    perfActive.add(i);
    fx.on();
    if (fx.momentary) setTimeout(() => { perfActive.delete(i); renderPerf(); renderLeds(); }, fx.momentary);
  }
  renderPerf();
  renderLeds();
}

export function perfUp(i) {
  const fx = PERF[i];
  if (fx.toggle || fx.momentary || !perfActive.has(i)) return;
  perfActive.delete(i);
  fx.off();
  renderPerf();
  renderLeds();
}

export function buildPerf() {
  PERF.forEach((fx, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `${fx.label}<small>${fx.hint}</small>`;
    btn.addEventListener('pointerdown', e => { try { btn.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } perfDown(i); });
    btn.addEventListener('pointerup', () => perfUp(i));
    $('#perf').appendChild(btn);
  });
}

export function renderPerf() {
  [...$('#perf').children].forEach((btn, i) => btn.classList.toggle('active', perfActive.has(i)));
}
