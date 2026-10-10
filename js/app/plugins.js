// Barre des plugins et ouverture des fenêtres.
import { DECK_IDS } from '../decks.js';
import { t } from '../i18n.js';
import { WINDOWS } from '../windows.js';
import { $, viz, wm } from './core.js';
import { curvePreviewStop, renderCurveCanvas } from './curve-ui.js';
import { inputWinOpened } from './audio-input.js';
import { renderBuses } from './buses-ui.js';
import { drawDeckWave } from './decks-ui.js';
import { renderGenRoll, stopGenPreview } from './gen.js';
import { renderPatch } from './patch-ui.js';
import { buildPiano } from './piano.js';
import { pianoRoll, rollStop } from './roll-ui.js';

// ---------- Fenêtres des plugins ----------

// Barre des plugins rangée en groupes : instruments, outils, studio, système.
export const PLUGIN_GROUPS = [
  ['instruments', ['pads', 'tr', 'acid', 'piano', 'osc', 'decks']],
  ['tools', ['roll', 'editor', 'kick', 'curve', 'gen']],
  ['studio', ['mix', 'buses', 'patch', 'launcher', 'scenes', 'perf', 'viz']],
  ['system', ['monitor', 'input']],
];

export const PLUGIN_ICONS = { pads: 'pads', tr: 'tr', acid: 'acid', piano: 'keys', osc: 'osc', decks: 'decks', roll: 'roll', editor: 'editor', kick: 'kick', curve: 'curve', gen: 'wand', buses: 'mix', launcher: 'grid', input: 'rec', mix: 'mix', patch: 'patch', scenes: 'scenes', perf: 'perf', monitor: 'monitor', viz: 'viz' };

export function buildPluginBar() {
  const nav = $('#plugins');
  for (const [group, ids] of PLUGIN_GROUPS) {
    const g = document.createElement('div');
    g.className = 'plugin-group';
    const label = document.createElement('span');
    label.className = 'plugin-group-label';
    label.textContent = t(`plugins.group.${group}`);
    g.appendChild(label);
    for (const id of ids.filter(i => WINDOWS.includes(i))) {
      const btn = document.createElement('button');
      btn.dataset.plugin = id;
      btn.dataset.icon = PLUGIN_ICONS[id];
      btn.textContent = t(`win.${id}`);
      btn.addEventListener('click', () => wm.toggle(id));
      g.appendChild(btn);
    }
    nav.appendChild(g);
  }
  renderPluginBar();
}

export function renderPluginBar() {
  for (const btn of $('#plugins').querySelectorAll('button[data-plugin]')) btn.classList.toggle('active', wm.isOpen(btn.dataset.plugin));
}

export function onWindowToggle(id, open) {
  renderPluginBar();
  if (open && id === 'piano') buildPiano();
  if (open && id === 'decks') requestAnimationFrame(() => DECK_IDS.forEach(drawDeckWave));   // à la bonne largeur
  if (open && id === 'patch') requestAnimationFrame(renderPatch);
  if (open && id === 'roll') requestAnimationFrame(() => pianoRoll.fit());
  if (!open && id === 'roll') rollStop();
  if (!open && id === 'curve') curvePreviewStop();
  if (open && id === 'curve') requestAnimationFrame(renderCurveCanvas);
  if (open && id === 'gen') requestAnimationFrame(() => renderGenRoll(true));
  if (open && id === 'buses') renderBuses();
  if (open && id === 'input') inputWinOpened();
  if (!open && id === 'gen') stopGenPreview();
  if (id === 'viz') { if (open) viz.addOutput($('#viz-canvas')); else viz.removeOutput($('#viz-canvas')); }
}
