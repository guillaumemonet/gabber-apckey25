// Chaîne master (fenêtre Mixeur) : compresseur, limiteur et compteur de sonie en LUFS (momentané, court terme, intégré),
// crête, réduction de gain, sonie du dernier export.
import { MASTER_PARAMS, defaultMasterState } from '../audio.js';
import { t } from '../i18n.js';
import { LoudnessMeter } from '../lufs.js';
import { $, engine, state, wm } from './core.js';
import { save } from './save.js';

export const masterMeter = new LoudnessMeter();
export let lastExport = null;      // { integrated, peakDb } du dernier export WAV
let gr = 1;                        // réduction de gain du limiteur (gain le plus bas de la dernière seconde)
const grs = [];
const TARGET = [-8, -6];           // sonie intégrée visée pour du hardcore (LUFS)

const num = (v, d = 1) => new Intl.NumberFormat(document.documentElement.lang || 'fr', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const fmtLufs = v => (Number.isFinite(v) ? `${num(v)} LUFS` : '−∞ LUFS');
export const fmtDb = v => (Number.isFinite(v) ? `${num(v)} dB` : '−∞ dB');
const UNITS = { threshold: 'dB', knee: 'dB', makeup: 'dB', gain: 'dB', ceiling: 'dB', attack: 'ms', release: 'ms', ratio: ':1' };
const fmtParam = (k, v) => (k === 'ratio' ? `${num(v, 1)}:1` : `${num(v, k === 'attack' || k === 'ceiling' ? 1 : k === 'release' ? 0 : 1)} ${UNITS[k]}`);

export function setLastExport(l) { lastExport = l; renderMasterMeters(); }

export function buildMaster() {
  const box = $('#master-chain');
  const groups = Object.keys(MASTER_PARAMS).map(g => {
    const sliders = Object.entries(MASTER_PARAMS[g]).map(([k, [min, max, step]]) =>
      `<label class="fx-param"><span>${t(`master.${k}`)}</span><input type="range" data-g="${g}" data-k="${k}" min="${min}" max="${max}" step="${step}"><em></em></label>`).join('');
    return `<div class="mc-group" data-group="${g}"><div class="mc-head"><b>${t(`master.${g}`)}</b><button class="mc-on" data-g="${g}">${t('master.on')}</button></div>${sliders}</div>`;
  }).join('');
  box.innerHTML = `${groups}
    <div class="mc-group mc-meters">
      <div class="mc-head"><b>${t('master.loudness')}</b><button class="mc-reset" title="${t('master.resetTitle')}">${t('master.reset')}</button></div>
      <div class="mc-lufs"><span>${t('master.momentary')}</span><b data-m="momentary"></b><span>${t('master.short')}</span><b data-m="shortTerm"></b><span>${t('master.integrated')}</span><b data-m="integrated"></b><span>${t('master.peak')}</span><b data-m="peak"></b><span>${t('master.gr')}</span><b data-m="gr"></b></div>
      <div class="mc-bar" title="${t('master.barTitle')}"><i class="mc-target"></i><i class="mc-level"></i></div>
      <div class="hint mc-hint">${t('master.target', { lo: TARGET[0], hi: TARGET[1] })}</div>
      <div class="hint mc-export"></div>
    </div>`;
  for (const inp of box.querySelectorAll('input[type=range]')) {
    const { g, k } = inp.dataset;
    inp.addEventListener('input', () => { state.master[g][k] = +inp.value; applyMaster(); });
    inp.addEventListener('dblclick', () => { state.master[g][k] = defaultMasterState()[g][k]; applyMaster(); });
  }
  for (const b of box.querySelectorAll('.mc-on')) b.addEventListener('click', () => { state.master[b.dataset.g].on = !state.master[b.dataset.g].on; applyMaster(); });
  box.querySelector('.mc-reset').addEventListener('click', () => { masterMeter.reset(); grs.length = 0; renderMasterMeters(); });
  // Mesures envoyées par le limiteur toutes les 100 ms.
  engine.onMeter = d => {
    masterMeter.push(d.e, d.peak);
    grs.push(d.gr);
    if (grs.length > 10) grs.shift();
    gr = Math.min(...grs);
  };
  setInterval(() => { if (wm?.isOpen('mix') && !document.hidden) renderMasterMeters(); }, 200);
  renderMaster();
}

export function applyMaster() {
  engine.setMaster(state.master);
  renderMaster();
  save();
}

export function renderMaster() {
  const box = $('#master-chain');
  if (!box) return;
  for (const inp of box.querySelectorAll('input[type=range]')) {
    const { g, k } = inp.dataset;
    inp.value = state.master[g][k];
    inp.nextElementSibling.textContent = fmtParam(k, state.master[g][k]);
  }
  for (const b of box.querySelectorAll('.mc-on')) {
    const on = state.master[b.dataset.g].on;
    b.classList.toggle('active', on);
    b.textContent = on ? t('master.on') : t('master.off');
    b.closest('.mc-group').classList.toggle('off', !on);
  }
  renderMasterMeters();
}

export function renderMasterMeters() {
  const box = $('#master-chain');
  if (!box) return;
  const m = masterMeter;
  const set = (k, v) => { box.querySelector(`[data-m="${k}"]`).textContent = v; };
  set('momentary', fmtLufs(m.momentary));
  set('shortTerm', fmtLufs(m.shortTerm));
  set('integrated', fmtLufs(m.integrated));
  set('peak', fmtDb(m.peak > 0 ? 20 * Math.log10(m.peak) : -Infinity));
  set('gr', gr < 0.999 ? fmtDb(20 * Math.log10(gr)) : fmtDb(0));
  // Barre : sonie court terme de -30 à 0 LUFS, zone visée en surbrillance.
  const pos = v => `${Math.min(100, Math.max(0, (v + 30) / 30 * 100))}%`;
  const target = box.querySelector('.mc-target');
  target.style.left = pos(TARGET[0]);
  target.style.width = `${(TARGET[1] - TARGET[0]) / 30 * 100}%`;
  const s = m.shortTerm;
  box.querySelector('.mc-level').style.width = Number.isFinite(s) ? pos(s) : '0%';
  box.querySelector('.mc-export').textContent = lastExport ? t('master.lastExport', { lufs: fmtLufs(lastExport.integrated), peak: fmtDb(lastExport.peakDb) }) : '';
}
