// Contrôleur APC Key 25 : boutons, pads, potentiomètres, clavier, LED.
import { BTN } from '../apc.js';
import { t } from '../i18n.js';
import { acidKey } from './acid-ui.js';
import { padPending, panic, releasePad, selectPad, setBank, setPage, triggerPad, turnKnob } from './actions.js';
import { $, PAGE_ORDER, apc, padKey, performer, playing, setShiftHeld, shiftHeld, state, timeline, wm } from './core.js';
import { toast } from './misc.js';
import { MIX_PAGES } from './mixer-ui.js';
import { buildSwatches, renderEditor, renderPads } from './pads.js';
import { perfActive, perfDown, perfUp } from './perf-fx.js';
import { onSustainButton, setPianoKey } from './piano.js';
import { save } from './save.js';
import { launchRow, launcherMode, launcherPad, renderLauncherLeds, stopAllClips, toggleLauncherMode } from './launcher.js';
import { captureScene, launchScene, renderSceneLeds, sceneMode, toggleSceneMode } from './scenes.js';
import { presetKey } from './synth-ui.js';
import { tlRec, tlRecToggle, tlToggle } from './tl.js';
import { renderTrLeds, toggleTrMode, trMode, trPad } from './tr909-ui.js';

// ---------- Contrôleur ----------

export function bindController() {
  apc.addEventListener('connection', ({ detail }) => {
    if (detail.model) {
      if (state.model !== detail.model) {
        state.model = detail.model;
        buildSwatches();
        renderPads();
        renderEditor();
        save();
      }
      setStatus(true, t('status.connected', { model: detail.model === 'mk2' ? 'mk2' : '(mk1)' }));
      apc.clearAll();
      renderLeds();
    } else {
      const seen = detail.allInputs.length ? t('status.portsSeen', { ports: detail.allInputs.join(', ') }) : t('status.noPorts');
      setStatus(false, t('status.notFound', { seen }));
    }
    renderPorts();
  });
  apc.addEventListener('portError', ({ detail }) => {
    setStatus(false, t('status.portBusy', { port: detail.port, msg: detail.message }));
  });
  apc.addEventListener('roles', renderPorts);
  // Grille de l'APC passée au lanceur : les modes 909 et scènes s'arrêtent.
  window.addEventListener('gk-grid-mode', () => {
    if (launcherMode) { if (trMode) toggleTrMode(false); if (sceneMode) toggleSceneMode(false); }
    renderLeds();
  });

  apc.addEventListener('pad', ({ detail: { index, pressed } }) => {
    if (launcherMode) { if (pressed) launcherPad(index, shiftHeld); return; }
    if (sceneMode) { if (pressed) { if (shiftHeld) captureScene(index); else launchScene(index); } return; }
    if (trMode) { if (pressed) trPad(index); return; }
    if (!pressed) return releasePad(index);
    if (shiftHeld) selectPad(index); else triggerPad(index);
  });

  const perfHeld = new Map();   // bouton de piste -> effet déclenché (Maj peut être relâchée avant)
  apc.addEventListener('button', ({ detail: { name, pressed } }) => {
    if (name === 'shift') { setShiftHeld(pressed); return; }
    if (name.startsWith('track') && +name.slice(5) >= 5) {
      // Pistes 5-8 : effets de performance (avec Maj : 2e ligne).
      if (pressed) {
        const idx = +name.slice(5) - 5 + (shiftHeld ? 4 : 0);
        perfHeld.set(name, idx);
        perfDown(idx);
      } else if (perfHeld.has(name)) {
        perfUp(perfHeld.get(name));
        perfHeld.delete(name);
      }
      return;
    }
    if (!pressed) return;
    // PLAY = timeline (Maj + PLAY = grille 909) ; REC = enregistrement de l'outil choisi dans la timeline.
    if (name === 'play') { if (shiftHeld) { toggleLauncherMode(false); toggleTrMode(); } else tlToggle(); return; }
    if (name.startsWith('scene') && launcherMode && !shiftHeld) { launchRow(+name.slice(5) - 1); return; }   // lanceur : une ligne
    if (name.startsWith('scene')) {
      toggleLauncherMode(false);
      if (trMode) toggleTrMode(false);   // choisir une banque ramène la grille aux pads
      if (sceneMode) toggleSceneMode(false);
      const k = +name.slice(5) - 1;
      // Maj + SCENE LAUNCH : groupes 6-10, 11-15, 16-20, 21-25, puis retour à 6-10.
      const b = shiftHeld ? (state.bank % 5 === k && state.bank >= 5 && state.bank < 20 ? state.bank + 5 : k + 5) : k;
      setBank(b);
      if (shiftHeld) toast(t('bank.toast', { n: b + 1 }));   // la LED clignote pour toutes les banques 6-25
    }
    else if (name.startsWith('track')) setPage((shiftHeld ? MIX_PAGES : PAGE_ORDER)[+name.slice(5) - 1]);
    else if (name === 'stopAll') { if (launcherMode && !shiftHeld) stopAllClips(); else if (shiftHeld) { toggleLauncherMode(false); toggleSceneMode(); } else panic(); }
    else if (name === 'record') { if (shiftHeld) setPage(state.page === 'acid' ? 'decks' : state.page === 'decks' ? 'synth' : 'acid'); else tlRecToggle(); }
  });

  apc.addEventListener('knob', ({ detail }) => turnKnob(detail.index, detail));

  apc.addEventListener('key', ({ detail: { note, velocity, on } }) => {
    // Maj + touche : choisir un preset au lieu de jouer.
    if (on && shiftHeld && presetKey(note)) return;
    if (acidKey(note, velocity, on)) return;
    if (on) performer.noteOn(note, velocity); else performer.noteOff(note);
    setPianoKey(note, on);
  });

  apc.addEventListener('sustain', ({ detail }) => onSustainButton(detail.on));

  apc.addEventListener('raw', ({ detail }) => monitorLog(detail));
}

// Journal du moniteur MIDI (APC et autres appareils) : les 80 derniers messages.
const monitorLines = [];
export function monitorLog(detail) {
  if (!wm?.isOpen('monitor')) return;
  const log = $('#log');
  const hex = detail.data.map(b => b.toString(16).padStart(2, '0')).join(' ');
  monitorLines.push(`${hex.padEnd(10)}  ${describe(detail.data)}   ← ${detail.port}`);
  if (monitorLines.length > 80) monitorLines.shift();
  log.textContent = monitorLines.join('\n');
  log.scrollTop = log.scrollHeight;
}

export function describe([st, d1, d2]) {
  const type = st & 0xf0, ch = (st & 15) + 1;
  if (type === 0x90) return `note on  ch${ch} n=${d1} v=${d2}`;
  if (type === 0x80) return `note off ch${ch} n=${d1}`;
  if (type === 0xb0) return `CC       ch${ch} #${d1} = ${d2}`;
  return '';
}

export function setStatus(on, text) {
  $('#status').classList.toggle('on', on);
  $('#status').classList.toggle('off', !on);
  $('#status-text').textContent = text;
}

export function renderPorts() {
  const info = apc.portsInfo();
  $('#ports').textContent = info.length ? '— ' + info.map(p => `${p.name} [${p.role === 'tout' ? t('monitor.roleAll') : p.role}]`).join(' · ') : '';
  $('#swap-roles').hidden = !(apc.model === 'mk2' && info.length > 1);
}
$('#swap-roles').addEventListener('click', () => apc.swapRoles());

// Pads : couleur atténuée si chargé, pleine lumière pendant la lecture, pulsation pour une boucle.
export function renderLeds() {
  if (!apc?.connected) return;
  const bank = state.banks[state.bank];
  if (launcherMode) { renderLauncherLeds(); }
  for (let i = 0; i < 40 && !trMode && !sceneMode && !launcherMode; i++) {
    const pad = bank[i];
    const mode = playing.get(padKey(state.bank, i));
    let led = 'off';
    if (pad) {   // chargé ou non (une banque se charge quand elle s'affiche)
      if (padPending(padKey(state.bank, i))) led = Math.floor(performance.now() / 110) % 2 ? 'on' : 'off';   // clignotement rapide
      else if (mode) led = mode === 'loop' ? 'pulse' : 'on';
      else led = state.page === 'pad' && i === state.selected ? 'on' : 'dim';
    }
    apc.setPad(i, pad?.color ?? 0, led);
  }
  // Banques 1-5 : LED fixe ; banques 6-25 : LED clignotante.
  BTN.scene.forEach((n, b) => apc.setButton(n, b === state.bank % 5 ? (state.bank >= 5 ? 2 : 1) : 0));
  BTN.track.forEach((n, t) => apc.setButton(n, t < 4
    ? (PAGE_ORDER[t] === state.page ? 1 : MIX_PAGES[t] === state.page ? 2 : 0)
    : (perfActive.has(t - 4) || perfActive.has(t) ? 1 : 0)));
  apc.setButton(BTN.record, tlRec ? 2 : 0);
  apc.setButton(BTN.play, timeline?.playing ? 1 : 0);
  if (trMode) renderTrLeds();
  if (sceneMode) renderSceneLeds();
}
