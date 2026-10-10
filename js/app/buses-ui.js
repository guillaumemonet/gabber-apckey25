// Fenêtre Bus : quatre bus (A à D) qui regroupent des pistes de la timeline pour les traiter ensemble :
// nom, effets d'insert, panoramique, volume, muet / solo, vumètre, pistes envoyées.
import { t } from '../i18n.js';
import { BUS_COUNT, BUS_DEFAULTS, MAX_INSERTS } from '../timeline.js';
import { $, state, timeline, wm } from './core.js';
import { fxOptions, renderInsertRack } from './inserts-ui.js';
import { save } from './save.js';
import { renderTl, trackName } from './tl.js';

export const BUS_LETTERS = ['A', 'B', 'C', 'D'];
export const BUS_COLORS = ['#ff8a3d', '#3d9bff', '#3dd68c', '#b06bff'];
export const busName = b => state.tl.buses[b]?.name || t('bus.name', { l: BUS_LETTERS[b] });
const els = [];
const pct = v => `${Math.round(v * 100)}%`;
const panFmt = v => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `${t('fmt.left')}${Math.round(-v * 100)}` : `${t('fmt.right')}${Math.round(v * 100)}`);

export function buildBuses() {
  const wrap = $('#buses');
  for (let b = 0; b < BUS_COUNT; b++) {
    const el = document.createElement('div');
    el.className = 'strip bus-strip';
    el.style.setProperty('--bc', BUS_COLORS[b]);
    el.innerHTML = `
      <div class="bus-letter">${BUS_LETTERS[b]}</div>
      <input class="bus-name" maxlength="24" spellcheck="false" placeholder="${t('bus.name', { l: BUS_LETTERS[b] })}">
      <div class="bus-tracks hint"></div>
      <div class="fx-list"></div>
      <select class="fx-add"><option value="">${t('mix.addFx')}</option>${fxOptions()}</select>
      <label class="send"><span>${t('mix.pan')}</span><input type="range" min="-1" max="1" step="0.01" data-field="pan"><em></em></label>
      <div class="fader"><canvas class="vu" width="6" height="150"></canvas><input type="range" min="0" max="1.5" step="0.005" data-field="vol" orient="vertical"></div>
      <div class="db"></div>
      <div class="ms"><button class="mute" title="${t('bus.muteTitle')}">M</button><button class="solo" title="${t('bus.soloTitle')}">S</button></div>`;
    const bus = () => state.tl.buses[b];
    const name = el.querySelector('.bus-name');
    name.addEventListener('input', () => { bus().name = name.value.slice(0, 24); renderTl(); });
    name.addEventListener('change', () => { bus().name = name.value.trim().slice(0, 24); save(); });
    name.addEventListener('keydown', e => e.stopPropagation());
    for (const inp of el.querySelectorAll('input[data-field]')) {
      const f = inp.dataset.field;
      inp.addEventListener('input', () => { bus()[f] = +inp.value; timeline.updateBus(b); renderBus(b); });
      inp.addEventListener('change', () => save());   // au lâcher : une seule étape d'annulation par geste
      inp.addEventListener('dblclick', () => { bus()[f] = BUS_DEFAULTS[f]; timeline.updateBus(b); renderBus(b); save(); });
    }
    el.querySelector('.mute').addEventListener('click', () => { bus().mute = !bus().mute; timeline.updateMutes(); renderBus(b); renderTl(); save(); });
    el.querySelector('.solo').addEventListener('click', () => { bus().solo = !bus().solo; timeline.updateMutes(); renderBus(b); renderTl(); save(); });
    els[b] = el;
    wrap.appendChild(el);
  }
  renderBuses();
  // Vumètres (seulement quand la fenêtre est ouverte).
  const levels = [];
  (function frame() {
    if (wm?.isOpen('buses')) {
      for (let b = 0; b < BUS_COUNT; b++) {
        levels[b] = Math.max(timeline.busLevel(b), (levels[b] ?? 0) * 0.88);
        const cv = els[b].querySelector('.vu'), g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        const h = Math.min(1, levels[b]) * cv.height;
        g.fillStyle = levels[b] > 0.95 ? '#ff5a36' : levels[b] > 0.7 ? '#ffd23f' : '#3dd68c';
        g.fillRect(0, cv.height - h, cv.width, h);
      }
    }
    requestAnimationFrame(frame);
  })();
}

export function renderBus(b) {
  const el = els[b];
  if (!el) return;
  const bus = state.tl.buses[b];
  const name = el.querySelector('.bus-name');
  if (document.activeElement !== name) name.value = bus.name;
  for (const inp of el.querySelectorAll('input[data-field]')) {
    inp.value = bus[inp.dataset.field];
    const em = inp.nextElementSibling;
    if (em?.tagName === 'EM') em.textContent = panFmt(bus.pan);
  }
  el.querySelector('.db').textContent = pct(bus.vol);
  el.querySelector('.mute').classList.toggle('active', bus.mute);
  el.querySelector('.solo').classList.toggle('active', bus.solo);
  const tracks = state.tl.tracks.map((tr, i) => (tr.bus === b ? trackName(i) : null)).filter(Boolean);
  const list = el.querySelector('.bus-tracks');
  list.textContent = tracks.length ? tracks.join(', ') : t('bus.empty');
  list.title = list.textContent;
  renderInsertRack(el.querySelector('.fx-list'), el.querySelector('.fx-add'), () => state.tl.buses[b].inserts,
    { max: MAX_INSERTS, rebuild: () => timeline.rebuildBusInserts(b), update: k => timeline.updateBusInsert(b, k) });
}

export function renderBuses() { for (let b = 0; b < BUS_COUNT; b++) renderBus(b); }
