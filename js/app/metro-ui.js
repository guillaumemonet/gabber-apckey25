// Métronome et indicateur de charge (CPU).
import { CpuMeter } from '../cpumeter.js';
import { t } from '../i18n.js';
import { Metronome } from '../metronome.js';
import { $, engine, metro, oscSynth, provide, state, timeline } from './core.js';
import { save } from './save.js';
import { countingIn, tlRec } from './tl.js';
import { closeFxEditor, fxEditing, fxOutside, setFxEditing } from './trackfx-ui.js';

// ---------- Métronome ----------

// Compteur de charge de l'en-tête : barres Audio / Interface, détail dans l'infobulle.
export let cpuMeter = null;
export function buildCpu() {
  const box = $('#cpu');
  const rows = Object.fromEntries([...box.querySelectorAll('.cpu-row')].map(r => [r.dataset.k, { em: r.querySelector('em'), txt: r.querySelector('small') }]));
  const voices = () => engine.voices.size + engine.padVoices.size + oscSynth.all.size + timeline.sources.length;
  const level = v => (v >= 0.85 ? 'hot' : v >= 0.6 ? 'warn' : 'ok');
  cpuMeter = new CpuMeter(engine.ctx, voices, m => {
    const show = (k, v, text) => {
      rows[k].em.style.width = `${Math.round(Math.min(1, v) * 100)}%`;
      rows[k].em.className = level(v);
      rows[k].txt.textContent = text;
    };
    // Sans mesure du navigateur, la barre audio ne bouge que si le moteur décroche.
    show('audio', m.precise ? m.audio : m.audio > 0 ? Math.max(0.85, m.audio) : 0, m.precise ? `${Math.round(m.audio * 100)}%` : m.audio > 0 ? t('cpu.lag') : t('cpu.ok'));
    show('ui', m.ui, `${Math.round(m.ui * 100)}%`);
    box.classList.toggle('hot', (m.precise ? m.audio >= 0.85 || m.underrun > 0 : m.audio > 0) || m.ui >= 0.85);
    box.title = [
      m.precise ? t('cpu.audioLoad', { n: Math.round(m.audio * 100) }) : m.audio > 0 ? t('cpu.audioLag', { n: Math.round(m.audio * 100) }) : t('cpu.audioOk'),
      t('cpu.uiLoad', { n: Math.round(m.ui * 100) }),
      t('cpu.voices', { n: m.voices }),
      m.precise ? '' : t('cpu.noMeasure'),
      t('cpu.help'),
    ].filter(Boolean).join('\n');
  });
}

export function buildMetro() {
  provide({ metro: new Metronome(engine, () => state.metro, () => state.metro.on && (state.metro.when === 'always' || !!tlRec)) });
  $('#metro').addEventListener('click', () => { state.metro.on = !state.metro.on; renderMetro(); save(); });
  $('#metro-opts').addEventListener('click', e => openMetroOptions(e.currentTarget));
  const dots = [...document.querySelectorAll('#metro .metro-dots i')];
  let lastBeat = -2;
  (function frame() {
    const b = state.metro.on || countingIn ? metro.current() : -1;
    if (b !== lastBeat) { dots.forEach((d, k) => { d.classList.toggle('on', k === b); d.classList.toggle('one', k === b && b === 0); }); lastBeat = b; }
    requestAnimationFrame(frame);
  })();
  renderMetro();
}

export function renderMetro() {
  $('#metro').classList.toggle('active', state.metro.on);
}

// Options : quand il bat, décompte avant REC, volume.
export function openMetroOptions(anchor) {
  const was = fxEditing?.metro;
  closeFxEditor();
  if (was) return;
  const m = state.metro;
  const box = document.createElement('div');
  box.id = 'fx-editor';
  box.className = 'fx-editor metro-opts';
  box.innerHTML = `<div class="fx-editor-head"><b>${t('metro.name')}</b><button class="win-close" title="${t('win.close')}">✕</button></div>
    <div class="fx-editor-body">
      <label class="fx-param"><span>${t('metro.when')}</span><select class="m-when"><option value="always">${t('metro.always')}</option><option value="rec">${t('metro.rec')}</option></select></label>
      <label class="fx-param check"><input type="checkbox" class="m-count"><span>${t('metro.countIn')}</span></label>
      <label class="fx-param"><span>${t('metro.vol')}</span><input type="range" min="0" max="1" step="0.01" class="m-vol"><em></em></label>
    </div>`;
  box.querySelector('.win-close').addEventListener('click', closeFxEditor);
  const when = box.querySelector('.m-when'), count = box.querySelector('.m-count'), vol = box.querySelector('.m-vol'), volLabel = box.querySelector('em');
  when.value = m.when;
  count.checked = m.countIn;
  vol.value = m.vol;
  const showVol = () => { volLabel.textContent = `${Math.round(m.vol * 100)}%`; };
  showVol();
  when.addEventListener('change', () => { m.when = when.value; save(); });
  count.addEventListener('change', () => { m.countIn = count.checked; save(); });
  vol.addEventListener('input', () => { m.vol = +vol.value; showVol(); });
  vol.addEventListener('change', save);
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, r.right - box.offsetWidth))}px`;
  box.style.top = `${r.bottom + 6}px`;
  setFxEditing({ box, metro: true });
  setTimeout(() => window.addEventListener('pointerdown', fxOutside, true), 0);
}
