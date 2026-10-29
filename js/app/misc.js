// Divers : message temporaire, vumètre, rendu global, boutons Panique et Réinitialiser.
import { t } from '../i18n.js';
import * as store from '../storage.js';
import { panic } from './actions.js';
import { renderLeds } from './controller.js';
import { everyFrame } from '../ticker.js';
import { $, engine } from './core.js';
import { levelMeter, peakOf } from './meters.js';
import { renderKnobs, renderPages } from './knobs.js';
import { renderBanks, renderEditor, renderPads } from './pads.js';

// ---------- Divers ----------

export let toastTimer;
export function toast(text, duration = 1800) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

export function drawMeter() {
  const data = new Float32Array(engine.analyser.fftSize);
  const meter = levelMeter($('#meter'), { decay: 0.9, yellow: false });
  everyFrame(() => {
    engine.analyser.getFloatTimeDomainData(data);
    meter(peakOf(data));
  });
}

export function renderAll() {
  renderPads();
  renderBanks();
  renderEditor();
  renderPages();
  renderKnobs();
  renderLeds();
}

$('#panic').addEventListener('click', () => engine && panic());
$('#reset').addEventListener('click', async () => {
  if (!confirm(t('reset.confirm'))) return;
  await store.clearAll();
  location.reload();
});
