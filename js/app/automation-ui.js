// Lignes d'automation de la timeline : sous une piste (bouton A de son en-tête), la courbe d'un réglage de la piste
// (volume, pano, filtres, envois) sur toute la durée du morceau. Clic = point (calé au quart de temps, Maj = libre),
// glisser = déplacer, clic droit = supprimer ; « Effacer » retire la courbe du réglage. Pendant la lecture, la courbe
// remplace le potentiomètre ; elle est dans l'export WAV.
import { t } from '../i18n.js';
import { AUTO_PARAMS, autoAt, autoPos, autoValue } from '../timeline.js';
import { state, timeline } from './core.js';
import { save } from './save.js';
import { TRACK_KNOBS, beatPx, renderTl } from './tl.js';

export const AUTO_H = 64;   // hauteur d'une ligne d'automation (px)
const SVG = 'http://www.w3.org/2000/svg';
const knob = id => TRACK_KNOBS.find(d => d.id === id);
export const fmtAuto = (id, v) => knob(id).fmt(autoValue(id, v));

// Bouton A et réglages (choix du réglage, effacer) dans l'en-tête de la piste.
export function autoHead(head, i) {
  const btn = document.createElement('button');
  btn.className = 'tl-auto';
  btn.textContent = 'A';
  btn.title = t('auto.toggle');
  btn.addEventListener('click', () => { const tr = state.tl.tracks[i]; tr.autoOpen = !tr.autoOpen; renderTl(); save(); });
  head.appendChild(btn);
  const ctl = document.createElement('div');
  ctl.className = 'tl-auto-ctl';
  const sel = document.createElement('select');
  for (const id of Object.keys(AUTO_PARAMS)) sel.add(new Option(t(`tl.k.${id}`), id));
  sel.addEventListener('change', () => { state.tl.tracks[i].autoParam = sel.value; renderTl(); save(); });
  const clear = document.createElement('button');
  clear.className = 'icon-only';
  clear.dataset.icon = 'trash';
  clear.title = t('auto.clear');
  clear.addEventListener('click', () => {
    const tr = state.tl.tracks[i];
    delete tr.auto[tr.autoParam];
    timeline.refreshAutomation(i);
    renderTl();
    save();
  });
  ctl.append(sel, clear);
  head.appendChild(ctl);
}

// En-tête : bouton allumé si la piste a des courbes ; réglages visibles si la ligne est ouverte.
export function renderAutoHead(head, tr, bottom) {
  const btn = head.querySelector('.tl-auto');
  btn.classList.toggle('active', Object.keys(tr.auto ?? {}).length > 0);
  btn.classList.toggle('open', !!tr.autoOpen);
  const ctl = head.querySelector('.tl-auto-ctl');
  ctl.hidden = !tr.autoOpen;
  ctl.style.bottom = `${bottom}px`;
  ctl.querySelector('select').value = tr.autoParam;
  for (const o of ctl.querySelectorAll('option')) o.textContent = `${t(`tl.k.${o.value}`)}${tr.auto?.[o.value]?.length ? ' •' : ''}`;
}

// Ligne d'automation d'une piste (dans son couloir, au-dessus de la ligne d'effets).
export function renderAutoLane(lane, i, bottom) {
  const tr = state.tl.tracks[i];
  let box = lane.querySelector('.tl-autolane');
  if (!tr.autoOpen) { box?.remove(); return 0; }
  if (!box) {
    box = document.createElement('div');
    box.className = 'tl-autolane';
    box.addEventListener('pointerdown', e => autoDown(e, i, box));
    box.addEventListener('contextmenu', e => e.preventDefault());
    lane.appendChild(box);
  }
  box.style.bottom = `${bottom}px`;
  box.style.height = `${AUTO_H}px`;
  drawAuto(box, tr);
  return AUTO_H;
}

const H = AUTO_H - 8;   // hauteur utile (4 px de marge en haut et en bas)
const yOf = v => 4 + (1 - v) * H;
const vOf = y => Math.min(1, Math.max(0, 1 - (y - 4) / H));

function drawAuto(box, tr) {
  const id = tr.autoParam, pts = tr.auto?.[id] ?? [];
  const w = state.tl.bars * state.tl.zoom, bp = beatPx();
  box.innerHTML = '';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', AUTO_H);
  // Ligne du potentiomètre quand il n'y a pas de courbe (pointillés), sinon la courbe.
  const line = document.createElementNS(SVG, 'polyline');
  const base = autoPos(id, tr[id] ?? AUTO_PARAMS[id].def);
  const xy = pts.length ? [[0, pts[0].v], ...pts.map(p => [p.b * bp, p.v]), [w, pts[pts.length - 1].v]] : [[0, base], [w, base]];
  line.setAttribute('points', xy.map(([x, v]) => `${x},${yOf(v)}`).join(' '));
  line.setAttribute('class', pts.length ? 'auto-line' : 'auto-line idle');
  svg.appendChild(line);
  pts.forEach((p, k) => {
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('cx', p.b * bp);
    c.setAttribute('cy', yOf(p.v));
    c.setAttribute('r', 4.5);
    c.setAttribute('class', 'auto-pt');
    c.dataset.k = k;
    const tip = document.createElementNS(SVG, 'title');
    tip.textContent = `${fmtAuto(id, p.v)} · ${t('auto.ptTitle')}`;
    c.appendChild(tip);
    svg.appendChild(c);
  });
  const label = document.createElement('span');
  label.className = 'tl-auto-label';
  label.textContent = pts.length ? t(`tl.k.${id}`) : t('auto.empty', { p: t(`tl.k.${id}`) });
  box.append(svg, label);
}

// Clic : nouveau point ou point existant ; glisser : déplacer ; clic droit : supprimer.
function autoDown(e, i, box) {
  e.stopPropagation();
  const tr = state.tl.tracks[i], id = tr.autoParam;
  const pts = (tr.auto[id] ??= []);
  const r = box.getBoundingClientRect(), bp = beatPx();
  const at = ev => {
    const raw = Math.max(0, (ev.clientX - r.left) / bp);
    return { b: ev.shiftKey ? +raw.toFixed(3) : Math.round(raw * 4) / 4, v: +vOf(ev.clientY - r.top).toFixed(4) };
  };
  const hit = e.target.closest?.('.auto-pt');
  let p = hit ? pts[+hit.dataset.k] : null;
  if (e.button === 2) {
    if (p) { pts.splice(pts.indexOf(p), 1); if (!pts.length) delete tr.auto[id]; timeline.refreshAutomation(i); renderTl(); save(); }
    return;
  }
  if (e.button !== 0) return;
  if (!p) {
    const n = at(e);
    p = pts.find(q => Math.abs(q.b - n.b) < 1e-6) ?? n;
    if (!pts.includes(p)) pts.push(p);
    p.v = n.v;
    pts.sort((a, b) => a.b - b.b);
  }
  timeline.refreshAutomation(i);
  drawAuto(box, tr);
  const onMove = ev => {
    const n = at(ev);
    p.b = n.b;
    p.v = n.v;
    pts.sort((a, b) => a.b - b.b);
    drawAuto(box, tr);
    timeline.refreshAutomation(i);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    // Deux points au même temps : le dernier déplacé gagne.
    tr.auto[id] = pts.filter((q, k) => q === p || Math.abs(q.b - p.b) > 1e-6 || k > pts.indexOf(p));
    renderTl();
    save();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

export { autoAt };
