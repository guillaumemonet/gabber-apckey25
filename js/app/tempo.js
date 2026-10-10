// Tempo : champ BPM, tap tempo.
import { t } from '../i18n.js';
import { PAGES, toValue } from '../params.js';
import { $, currentPad, decks, engine, patch, state } from './core.js';
import { renderDecks } from './decks-ui.js';
import { renderEditor } from './pads.js';
import { save } from './save.js';
import { requestWarps } from './warp.js';

// ---------- Tempo ----------

export function setBpm(bpm) {
  bpm = Math.round(Math.min(240, Math.max(40, bpm)) * 100) / 100;
  if (!bpm) return;
  state.bpm = bpm;
  engine.setBpm(bpm);
  if (decks) { decks.update(); renderDecks(); }   // les decks synchronisés suivent le tempo
  patch?.tempoChanged();   // delays et LFO des boîtes calés sur le tempo
  requestWarps(bpm);       // sons « Garder la hauteur » recalculés au nouveau tempo
  $('#bpm').value = Math.round(bpm * 10) / 10;
  save();
}

export function bindTempo() {
  $('#bpm').value = state.bpm;
  $('#bpm').addEventListener('change', e => setBpm(+e.target.value));
  // Tap tempo : chaque clic clignote ; dès le 2e, le tempo (moyenne des derniers clics) s'affiche sur le bouton.
  const taps = [];
  const tap = $('#tap');
  let tapTimer;
  tap.addEventListener('click', () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    tap.classList.remove('tapped');
    void tap.offsetWidth;
    tap.classList.add('tapped');
    if (taps.length >= 2) {
      const bpm = 60000 * (taps.length - 1) / (now - taps[0]);
      if (bpm >= 40 && bpm <= 240) { setBpm(bpm); tap.textContent = t('tap.bpm', { bpm: Math.round(bpm) }); }
    } else tap.textContent = t('tap.first');
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps.length = 0; tap.textContent = 'Tap'; }, 2500);
  });

  $('#ed-bpm').addEventListener('change', e => {
    const pad = currentPad();
    if (!pad) return;
    pad.bpm = +e.target.value || 0;
    save();
  });
  // Suppose un nombre entier de mesures (1, 2, 4, 8…) et prend le tempo le plus proche du tempo global.
  $('#ed-bpm-auto').addEventListener('click', () => {
    const pad = currentPad();
    if (!pad?.buffer) return;
    const dur = pad.buffer.duration * (1 - toValue(PAGES.pad.params[4], pad.p.start));
    const candidates = [0.25, 0.5, 1, 2, 4, 8, 16].map(bars => 240 * bars / dur);
    pad.bpm = Math.round(candidates.reduce((a, b) => (Math.abs(Math.log2(b / state.bpm)) < Math.abs(Math.log2(a / state.bpm)) ? b : a)) * 100) / 100;
    renderEditor();
    save();
  });
}
