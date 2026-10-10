// Fenêtre de la table de mixage.
import { t } from '../i18n.js';
import { CHANNELS, MAX_FX, MIX_FIELDS, mixKnobDefs } from '../mixer.js';
import { PAGES, toValue } from '../params.js';
import { $, engine, mixer, patch, state } from './core.js';
import { fxOptions, renderInsertRack } from './inserts-ui.js';
import { renderKnobs } from './knobs.js';
import { renderMixerDest } from './patch-ui.js';
import { save } from './save.js';

// ---------- Table de mixage ----------

export const MIX_PAGES = MIX_FIELDS.map(f => `mix_${f}`);   // pages de potentiomètres : Maj + piste 1 à 4
export const mixField = page => (page?.startsWith('mix_') ? page.slice(4) : null);
export const masterDef = () => PAGES.fx.params.find(d => d.id === 'master');
export const stripEls = {};
export const DEFAULT_FIELD = { vol: 0.75, pan: 0.5, delay: 0, reverb: 0 };

export function fieldFmt(field, id, v) { return mixKnobDefs(field).find(d => d.ch === id).fmt(v); }

export function buildMixer() {
  const wrap = $('#mixer');
  for (const id of CHANNELS) {
    const el = document.createElement('div');
    el.className = 'strip';
    el.innerHTML = `
      <div class="strip-name">${t(`mix.ch.${id}`)}</div>
      <div class="strip-dest" title="${t('patch.destTitle')}"></div>
      <div class="fx-list"></div>
      <select class="fx-add"><option value="">${t('mix.addFx')}</option>${fxOptions()}</select>
      ${['reverb', 'delay', 'pan'].map(f => `<label class="send"><span>${t(`mix.${f}`)}</span><input type="range" min="0" max="1" step="0.01" data-field="${f}"><em></em></label>`).join('')}
      <div class="fader"><canvas class="vu" width="6" height="150"></canvas><input type="range" min="0" max="1" step="0.005" data-field="vol" orient="vertical"></div>
      <div class="db"></div>
      <div class="ms"><button class="mute" title="${t('mix.mute')}">M</button><button class="solo" title="${t('mix.solo')}">S</button></div>`;
    const ch = () => state.mix.channels[id];
    for (const inp of el.querySelectorAll('input[data-field]')) {
      const field = inp.dataset.field;
      inp.addEventListener('input', () => { ch()[field] = +inp.value; onMixChange(id); });
      inp.addEventListener('dblclick', () => { ch()[field] = DEFAULT_FIELD[field]; onMixChange(id); });
    }
    el.querySelector('.mute').addEventListener('click', () => { ch().mute = !ch().mute; onMixChange(id); });
    el.querySelector('.solo').addEventListener('click', () => { ch().solo = !ch().solo; onMixChange(id); });
    stripEls[id] = el;
    wrap.appendChild(el);
    renderFx(id);
  }
  // Voie master : volume général du moteur et vumètre de sortie.
  const m = document.createElement('div');
  m.className = 'strip master';
  m.innerHTML = `<div class="strip-name">${t('mix.master')}</div><div class="spacer"></div>
    <div class="fader"><canvas class="vu" width="6" height="150"></canvas><input type="range" min="0" max="1" step="0.005" orient="vertical"></div>
    <div class="db"></div>`;
  const mi = m.querySelector('input');
  mi.addEventListener('input', () => {
    state.globals.master = +mi.value;
    engine.set('master', toValue(masterDef(), state.globals.master));
    renderMixer();
    if (mixField(state.page) || state.page === 'fx') renderKnobs();
    save();
  });
  stripEls.master = m;
  wrap.appendChild(m);
  renderMixer();
  drawMixerMeters();
}

export function onMixChange(id) {
  mixer.update();
  renderStrip(id);
  if (mixField(state.page)) renderKnobs();
  save();
}

export function renderStrip(id) {
  const ch = state.mix.channels[id];
  const el = stripEls[id];
  for (const inp of el.querySelectorAll('input[data-field]')) {
    const field = inp.dataset.field;
    inp.value = ch[field];
    const em = inp.nextElementSibling;
    if (em?.tagName === 'EM') em.textContent = fieldFmt(field, id, ch[field]);
  }
  el.querySelector('.db').textContent = fieldFmt('vol', id, ch.vol);
  el.querySelector('.mute').classList.toggle('active', ch.mute);
  el.querySelector('.solo').classList.toggle('active', ch.solo);
}

export function renderMixer() {
  if (!stripEls.master) return;
  for (const id of CHANNELS) renderStrip(id);
  if (patch) renderMixerDest();
  stripEls.master.querySelector('input').value = state.globals.master;
  stripEls.master.querySelector('.db').textContent = masterDef().fmt(toValue(masterDef(), state.globals.master));
}

export function renderFx(id) {
  const el = stripEls[id];
  renderInsertRack(el.querySelector('.fx-list'), el.querySelector('.fx-add'), () => state.mix.channels[id].fx,
    { max: MAX_FX, rebuild: () => mixer.rebuild(id), update: k => mixer.updateFx(id, k) });
}

export function drawMixerMeters() {
  const levels = {};
  const master = new Float32Array(engine.analyser.fftSize);
  const draw = (cv, lvl) => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const h = Math.min(1, lvl) * cv.height;
    g.fillStyle = lvl > 0.95 ? '#ff5a36' : lvl > 0.7 ? '#ffd23f' : '#3dd68c';
    g.fillRect(0, cv.height - h, cv.width, h);
  };
  (function frame() {
    for (const id of CHANNELS) {
      levels[id] = Math.max(mixer.level(id), (levels[id] ?? 0) * 0.88);
      draw(stripEls[id].querySelector('.vu'), levels[id]);
    }
    engine.analyser.getFloatTimeDomainData(master);
    let peak = 0;
    for (const v of master) peak = Math.max(peak, Math.abs(v));
    levels.master = Math.max(peak, (levels.master ?? 0) * 0.88);
    draw(stripEls.master.querySelector('.vu'), levels.master);
    requestAnimationFrame(frame);
  })();
}
