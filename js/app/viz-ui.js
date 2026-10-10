// Visualiseur et fenêtre projecteur.
import { t } from '../i18n.js';
import { CHANNELS } from '../mixer.js';
import { toPos, toValue } from '../params.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { VIZ_2D, VIZ_3D, VIZ_FILTERS, VIZ_MODES, Visualizer } from '../visualizer.js';
import { $, engine, mixer, provide, state, viz, wm } from './core.js';
import { buildKnobRow, renderKnobRow } from './knobs.js';
import { toast } from './misc.js';
import { save } from './save.js';

// ---------- Visualiseur (façon Winamp) ----------

export const VIZ_ICONS = {
  spectrum: 'v-spectrum', scope: 'osc', milk: 'v-milk', vu: 'v-vu', bang: 'v-bang',
  particles: 'v-particles', copper: 'v-copper', spectrogram: 'v-sgram',
  tunnel: 'v-tunnel', terrain: 'v-terrain', blob: 'v-blob', starfield: 'v-stars', fractal: 'v-fractal', lasers: 'v-lasers',
  city: 'v-city', ledwall: 'v-led', metaballs: 'v-meta', plasma: 'v-plasma', rotozoom: 'v-roto', fluid: 'v-fluid', reaction: 'v-reaction',
};
// Réglages du visualiseur (potentiomètres de l'écran et de l'APC, page « Visualiseur ») : positions 0..1.
export const pct100 = v => `${Math.round(v * 100)}%`;
export const VIZ_KNOBS = [
  { id: 'speed', min: 0.25, max: 2, def: 1, curve: 'exp', fmt: v => `×${v.toFixed(2)}` },
  { id: 'hue', min: 0, max: 360, def: 0, fmt: v => `${Math.round(v)}°` },
  { id: 'flash', min: 0, max: 1.5, def: 1, fmt: pct100 },
  { id: 'sens', min: 0.5, max: 2.5, def: 1, curve: 'exp', fmt: v => `×${v.toFixed(2)}` },
  { id: 'crt', min: 0, max: 1, def: 0, fmt: pct100 },
  { id: 'kal', min: 0, max: 4, def: 0, steps: 5, fmt: v => (v ? `${4 + v * 2}` : '—') },
  { id: 'glitch', min: 0, max: 1, def: 0, fmt: pct100 },
  { id: 'strobe', min: 0, max: 1, def: 0, steps: 2, fmt: v => (v ? 'ON' : '—') },
];
export const vizKnobDefs = () => VIZ_KNOBS.map(d => ({ ...d, viz: true, label: t(`viz.k.${d.id}`) }));
export const vizKnobDefaults = () => Object.fromEntries(VIZ_KNOBS.map(d => [d.id, toPos(d, d.def)]));
export const vizVal = id => { const d = VIZ_KNOBS.find(k => k.id === id); return toValue(d, state.viz.k[id]); };
// Réglages -> visualiseur (les filtres s'allument dès que leur potentiomètre n'est plus à zéro).
export function applyVizKnobs() {
  viz.speed = vizVal('speed');
  viz.hueShift = vizVal('hue');
  viz.flashGain = vizVal('flash');
  viz.sens = vizVal('sens');
  const kal = vizVal('kal');
  viz.fx = { crt: vizVal('crt'), kaleido: kal ? 4 + kal * 2 : 0, glitch: vizVal('glitch'), strobe: vizVal('strobe') > 0 };
}
export const VIZ_FX_ICONS = { crt: 'v-crt', kaleido: 'v-kaleido', glitch: 'v-glitch', strobe: 'v-strobe' };
// Fonctions (et non constantes) : l'état de départ les appelle avant que ce code ne soit lu.
export function vizWordsDefault() { return 'HARDCORE, GABBER, TERROR, GABBERKEY'; }
export function defaultViz() { return { mode: 'spectrum', auto: false, k: vizKnobDefaults(), words: vizWordsDefault() }; }
export function mergeViz(saved) {
  const k = vizKnobDefaults();
  for (const id of Object.keys(k)) if (Number.isFinite(saved?.k?.[id])) k[id] = Math.min(1, Math.max(0, saved.k[id]));
  if (saved?.fx?.crt) k.crt = 1;   // ancienne sauvegarde : filtre CRT allumé
  return {
    mode: VIZ_MODES.includes(saved?.mode) ? saved.mode : 'spectrum',
    auto: !!saved?.auto,
    k,
    words: typeof saved?.words === 'string' ? saved.words.slice(0, 200) : vizWordsDefault(),
  };
}
export let vizLabelTimer;
export let projector = null;   // fenêtre projecteur : { win, cv }

// Temps écoulés, au tempo : la grille des boucles si elle existe, sinon l'horloge audio.
export function vizBeats() {
  const t = engine.ctx.currentTime - (Number.isFinite(engine.origin) ? engine.origin : 0);
  return t * state.bpm / 60;
}

export const vizWords = () => state.viz.words.split(/[,;\n]/).map(w => w.trim()).filter(Boolean).slice(0, 16);

export function buildViz() {
  provide({ viz: new Visualizer(engine.ctx, engine.output, {
    beats: vizBeats,
    bpm: () => state.bpm,
    channels: [...CHANNELS.map(id => ({ id, label: t(`mix.short.${id}`) })), { id: 'master', label: 'Master' }],
    level: id => (id === 'master' ? masterPeak() : mixer.level(id)),
  }) });
  viz.mode = state.viz.mode;
  viz.words = vizWords();
  viz.onDrop = () => { if (state.viz.auto) vizStep(1, false); };   // en mode auto, le drop change de mode
  applyVizKnobs();
  // Modes en deux groupes : 2D, puis 3D / GPU.
  const modes = $('#viz-modes');
  for (const [group, list] of [['2d', VIZ_2D], ['3d', VIZ_3D]]) {
    if (!list.length) continue;
    const seg = document.createElement('div');
    seg.className = 'segmented';
    seg.title = t(`viz.group.${group}`);
    for (const m of list) {
      const b = document.createElement('button');
      b.dataset.mode = m;
      b.dataset.icon = VIZ_ICONS[m];
      b.className = 'icon-only';
      b.title = t(`viz.mode.${m}`);
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => setVizMode(m));
      seg.appendChild(b);
    }
    modes.appendChild(seg);
  }
  buildKnobRow($('#viz-knobs'), 'viz');
  const fxBox = $('#viz-fx');
  for (const f of VIZ_FILTERS) {
    const b = document.createElement('button');
    b.dataset.fx = f;
    b.dataset.icon = VIZ_FX_ICONS[f];
    b.textContent = t(`viz.fx.${f}`);
    b.title = t(`viz.fx.${f}.title`);
    b.addEventListener('click', () => toggleVizFx(f));
    fxBox.appendChild(b);
  }
  fxBox.hidden = !VIZ_FILTERS.length;
  const words = $('#viz-words');
  words.value = state.viz.words;
  words.addEventListener('input', () => { state.viz.words = words.value; viz.words = vizWords(); save(); });
  $('#viz-auto').addEventListener('click', () => { state.viz.auto = !state.viz.auto; renderViz(); save(); });
  $('#viz-full').addEventListener('click', vizFullscreen);
  $('#viz-proj').addEventListener('click', openProjector);
  const stage = $('#viz-stage');
  stage.addEventListener('dblclick', vizFullscreen);
  // En plein écran : clic = mode suivant.
  stage.addEventListener('click', () => { if (document.fullscreenElement === stage) vizStep(1); });
  document.addEventListener('fullscreenchange', () => { renderViz(); if (document.fullscreenElement === stage) vizLabel(); });
  // Raccourcis quand la fenêtre est active (ou en plein écran).
  window.addEventListener('keydown', e => {
    if (wm?.active !== 'viz' && document.fullscreenElement !== stage) return;
    if (vizKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // Mode automatique : un mode différent toutes les 8 mesures.
  let lastBlock = -1;
  setInterval(() => {
    if (!state.viz.auto || !viz.running) return;
    const block = Math.floor(vizBeats() / (8 * BEATS_PER_BAR));
    if (lastBlock >= 0 && block !== lastBlock) vizStep(1, false);
    lastBlock = block;
  }, 250);
  renderViz();
}

// 1-9 / 0 = mode, ← / → = précédent / suivant, F = plein écran ; renvoie true si la touche est prise.
export function vizKey(e, onFull = vizFullscreen) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return false;
  const n = /^Digit(\d)$/.exec(e.code)?.[1];
  if (n !== undefined && VIZ_MODES[(+n + 9) % 10]) setVizMode(VIZ_MODES[(+n + 9) % 10]);
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') vizStep(e.key === 'ArrowRight' ? 1 : -1);
  else if (e.code === 'KeyF') onFull();
  else return false;
  return true;
}

export const vizStep = (d, persist = true) => setVizMode(VIZ_MODES[(VIZ_MODES.indexOf(state.viz.mode) + d + VIZ_MODES.length) % VIZ_MODES.length], persist);

export let masterBuf = null;
export function masterPeak() {
  masterBuf ??= new Float32Array(engine.analyser.fftSize);
  engine.analyser.getFloatTimeDomainData(masterBuf);
  let p = 0;
  for (const v of masterBuf) p = Math.max(p, Math.abs(v));
  return p;
}

export function setVizMode(mode, persist = true) {
  state.viz.mode = mode;
  viz.setMode(mode);
  renderViz();
  vizLabel();
  if (persist) save();
}

// Bouton d'un filtre : l'allume (à un réglage moyen) ou l'éteint ; le kaléidoscope passe de 6 à 8, 10, 12 branches puis s'éteint.
export const VIZ_FX_KNOB = { crt: 'crt', kaleido: 'kal', glitch: 'glitch', strobe: 'strobe' };
export function toggleVizFx(f) {
  const k = state.viz.k, id = VIZ_FX_KNOB[f];
  if (f === 'kaleido') { const v = Math.round(k.kal * 4); k.kal = v === 0 ? 0.25 : v >= 4 ? 0 : (v + 1) / 4; }
  else k[id] = k[id] > 0 ? 0 : f === 'glitch' ? 0.6 : 1;
  if (f === 'strobe' && k.strobe > 0) toast(t('viz.strobeWarn'), 5000);
  applyVizKnobs();
  renderViz();
  renderKnobRow('viz');
  save();
}

// Nom du mode affiché un instant sur l'image.
export function vizLabel() {
  const el = $('#viz-label');
  el.textContent = t(`viz.mode.${state.viz.mode}`);
  el.classList.add('show');
  clearTimeout(vizLabelTimer);
  vizLabelTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

export function vizFullscreen() {
  const stage = $('#viz-stage');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else stage.requestFullscreen?.().catch(() => toast(t('viz.noFull'), 3000));
}

// Fenêtre projecteur : l'image seule, à glisser sur le deuxième écran (vidéoprojecteur) puis en plein écran.
export function openProjector() {
  if (projector && !projector.win.closed) { projector.win.focus(); return; }
  const win = window.open('', 'gabberkey-projector', 'popup,width=1280,height=720');
  if (!win) { toast(t('viz.popupBlocked'), 5000); return; }
  const d = win.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>GabberKey · ${t('viz.projector')}</title><style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; }
    body.idle { cursor: none; }
    .hint { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 14px 22px; border-radius: 10px;
      background: rgba(0, 0, 0, .6); color: #fff; font: 600 17px system-ui, sans-serif; text-align: center; transition: opacity 1s; }
    .hint.off { opacity: 0; }
  </style></head><body><canvas></canvas><div class="hint">${t('viz.projHint')}</div></body></html>`);
  d.close();
  const cv = d.querySelector('canvas');
  const hint = d.querySelector('.hint');
  setTimeout(() => hint.classList.add('off'), 4000);
  const full = () => (d.fullscreenElement ? d.exitFullscreen() : d.documentElement.requestFullscreen().catch(() => {}));
  d.addEventListener('dblclick', full);
  win.addEventListener('keydown', e => { if (vizKey(e, full)) e.preventDefault(); });
  // Le pointeur disparaît quand il ne bouge plus.
  let idle;
  d.addEventListener('mousemove', () => { d.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => d.body.classList.add('idle'), 2000); });
  viz.addOutput(cv);
  projector = { win, cv };
  const closed = () => {
    if (!projector || projector.win !== win) return;
    viz.removeOutput(cv);
    projector = null;
    clearInterval(watch);
    renderViz();
  };
  win.addEventListener('pagehide', closed);
  const watch = setInterval(() => { if (win.closed) closed(); }, 1000);
  window.addEventListener('pagehide', () => { try { win.close(); } catch { /* déjà fermée */ } });
  renderViz();
}

export function renderViz() {
  for (const b of $('#viz-modes').querySelectorAll('button')) b.classList.toggle('active', b.dataset.mode === state.viz.mode);
  for (const b of $('#viz-fx').children) {
    const f = b.dataset.fx;
    b.classList.toggle('active', !!viz.fx[f]);
    if (f === 'kaleido') b.textContent = viz.fx.kaleido ? `${t('viz.fx.kaleido')} ×${viz.fx.kaleido}` : t('viz.fx.kaleido');
  }
  $('#viz-auto').classList.toggle('active', state.viz.auto);
  $('#viz-proj').classList.toggle('active', !!projector);
  $('#viz-current').textContent = t(`viz.mode.${state.viz.mode}`);
  $('#viz-words').hidden = state.viz.mode !== 'bang';
}
