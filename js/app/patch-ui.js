// Page de câblage : boîtes à effets et câbles.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { CHANNELS } from '../mixer.js';
import { BOX_ORDER, BOX_TYPES, SOURCE_COLORS, boxDefaults, wouldLoop } from '../patch.js';
import { $, patch, state } from './core.js';
import { toast } from './misc.js';
import { stripEls } from './mixer-ui.js';
import { save } from './save.js';
import { closeFxEditor, openParamEditor } from './trackfx-ui.js';

// ---------- Page de câblage ----------

export const NODE_W = 156;
export const boxLabel = b => b.name || t(`box.${b.type}`);

export function patchNodes() {
  return [
    ...CHANNELS.map(id => ({ id, kind: 'src', name: t(`mix.ch.${id}`), color: PALETTE[SOURCE_COLORS[id]] })),
    ...state.patch.boxes.map(b => ({ id: b.id, kind: 'box', name: boxLabel(b), color: PALETTE[BOX_TYPES[b.type].color], box: b })),
    { id: 'master', kind: 'master', name: t('patch.master'), color: '#ffffff' },
  ];
}

export function nodePos(n, i) {
  const saved = state.patch.pos[n.id];
  if (saved) return saved;
  const canvas = $('#patch-canvas');
  if (n.kind === 'src') return { x: 16, y: 16 + CHANNELS.indexOf(n.id) * 72 };
  if (n.kind === 'master') return { x: Math.max(560, (canvas?.clientWidth || 900) - NODE_W - 24), y: 170 };
  const k = state.patch.boxes.indexOf(n.box);
  return { x: 230 + (k % 3) * 180, y: 20 + Math.floor(k / 3) * 110 };
}

export function buildPatch() {
  const bar = $('#patch-add');
  for (const type of BOX_ORDER) {
    const b = document.createElement('button');
    b.textContent = `+ ${t(`box.${type}`)}`;
    b.title = t(`box.${type}.title`);
    b.style.setProperty('--c', PALETTE[BOX_TYPES[type].color]);
    b.addEventListener('click', () => addBox(type));
    bar.appendChild(b);
  }
  $('#patch-reset').addEventListener('click', () => {
    if (!confirm(t('patch.resetConfirm'))) return;
    state.patch.links = CHANNELS.map(id => ({ from: id, to: 'master' }));
    patchChanged();
  });
  renderPatch();
}

export function addBox(type) {
  const n = state.patch.boxes.filter(b => b.type === type).length + 1;
  const box = { id: `box:${crypto.randomUUID()}`, type, p: boxDefaults(type), name: `${t(`box.${type}`)} ${n}` };
  state.patch.boxes.push(box);
  patchChanged();
  toast(t('patch.added', { name: box.name }));
}

export function removeBox(box) {
  state.patch.boxes = state.patch.boxes.filter(b => b !== box);
  state.patch.links = state.patch.links.filter(l => l.from !== box.id && l.to !== box.id);
  delete state.patch.pos[box.id];
  closeFxEditor();
  patchChanged();
}

export function addLink(from, to) {
  const links = state.patch.links;
  if (links.some(l => l.from === from && l.to === to)) return;
  if (wouldLoop(links, from, to)) { toast(t('patch.loop'), 3000); return; }
  links.push({ from, to });
  patchChanged();
}

export function patchChanged() {
  patch.rebuild();
  renderPatch();
  renderMixerDest();
  save();
}

export function renderPatch() {
  const canvas = $('#patch-canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.patch-node').forEach(n => n.remove());
  patchNodes().forEach((n, i) => {
    const pos = nodePos(n, i);
    const el = document.createElement('div');
    el.className = `patch-node ${n.kind}`;
    el.dataset.node = n.id;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.setProperty('--c', n.color);
    const sub = n.kind === 'src' ? t('patch.srcSub') : n.kind === 'master' ? t('patch.masterSub') : t('box.hint');
    el.innerHTML = `
      ${n.kind !== 'src' ? `<span class="jack in" data-node="${n.id}" title="${t('patch.in')}"></span>` : ''}
      <div class="patch-head"><b></b>${n.kind === 'box' ? `<button class="patch-del" title="${t('patch.remove')}">✕</button>` : ''}</div>
      <div class="patch-sub"></div>
      ${n.kind !== 'master' ? `<span class="jack out" data-node="${n.id}" title="${t('patch.out')}"></span>` : ''}`;
    el.querySelector('b').textContent = n.name;
    el.querySelector('.patch-sub').textContent = n.kind === 'box' ? `${t(`box.${n.box.type}`)} · ${sub}` : sub;
    el.querySelector('.patch-del')?.addEventListener('click', e => { e.stopPropagation(); removeBox(n.box); });
    if (n.kind === 'box') {
      el.addEventListener('dblclick', () => openParamEditor({
        title: boxLabel(n.box), color: n.color, params: BOX_TYPES[n.box.type].params, values: n.box.p, anchor: el,
        onInput: () => patch.update(n.box.id), onEnd: save,
      }));
    }
    // Déplacer le bloc par son titre.
    el.querySelector('.patch-head').addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = pos.x, oy = pos.y;
      const move = ev => {
        const p = { x: Math.max(0, ox + ev.clientX - sx), y: Math.max(0, oy + ev.clientY - sy) };
        state.patch.pos[n.id] = p;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        drawWires();
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); save(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    // Tirer un câble depuis la sortie.
    el.querySelector('.jack.out')?.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      temp.setAttribute('class', 'wire temp');
      temp.style.stroke = n.color;
      $('#patch-wires').appendChild(temp);
      const from = jackCenter(el.querySelector('.jack.out'));
      const move = ev => { const c = canvasPoint(ev); temp.setAttribute('d', wirePath(from, c)); highlightJack(ev); };
      const up = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        temp.remove();
        highlightJack(null);
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.jack.in, .patch-node:not(.src)');
        const to = target?.dataset.node;
        if (to && to !== n.id) addLink(n.id, to);
      };
      move(e);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    canvas.appendChild(el);
  });
  drawWires();
}

export function highlightJack(ev) {
  for (const j of document.querySelectorAll('.jack.in.hot')) j.classList.remove('hot');
  if (!ev) return;
  const node = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.patch-node:not(.src)');
  node?.querySelector('.jack.in')?.classList.add('hot');
}

export function canvasPoint(ev) {
  const c = $('#patch-canvas');
  const r = c.getBoundingClientRect();
  return { x: ev.clientX - r.left + c.scrollLeft, y: ev.clientY - r.top + c.scrollTop };
}

// Centre d'une prise, en coordonnées du plan de câblage (d'après la mise en page, insensible aux transitions 3D).
export function jackCenter(j) {
  const node = j.offsetParent;
  if (!node) return null;   // fenêtre fermée : pas de mise en page
  return { x: node.offsetLeft + j.offsetLeft + j.offsetWidth / 2, y: node.offsetTop + j.offsetTop + j.offsetHeight / 2 };
}

export const wirePath = (a, b) => {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

// Câbles : courbes colorées de la couleur de la source ; un clic sur un câble le retire.
export function drawWires() {
  const svg = $('#patch-wires');
  const canvas = $('#patch-canvas');
  if (!svg || !canvas) return;
  svg.setAttribute('width', canvas.scrollWidth);
  svg.setAttribute('height', canvas.scrollHeight);
  svg.querySelectorAll('.wire:not(.temp)').forEach(w => w.remove());
  for (const l of state.patch.links) {
    const a = canvas.querySelector(`.jack.out[data-node="${l.from}"]`);
    const z = canvas.querySelector(`.jack.in[data-node="${l.to}"]`);
    const pa = a && jackCenter(a), pz = z && jackCenter(z);
    if (!pa || !pz) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'wire');
    path.setAttribute('d', wirePath(pa, pz));
    path.style.stroke = canvas.querySelector(`.patch-node[data-node="${l.from}"]`)?.style.getPropertyValue('--c') || '#fff';
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = t('patch.wireTitle');
    path.appendChild(title);
    path.addEventListener('click', () => {
      state.patch.links = state.patch.links.filter(x => x !== l);
      patchChanged();
    });
    svg.appendChild(path);
  }
}

// Sous le nom de chaque voie du mixeur : où elle est câblée.
export function renderMixerDest() {
  for (const id of CHANNELS) {
    const el = stripEls[id]?.querySelector('.strip-dest');
    if (!el) continue;
    const to = state.patch.links.filter(l => l.from === id).map(l => (l.to === 'master' ? t('patch.master') : boxLabel(state.patch.boxes.find(b => b.id === l.to) ?? {})));
    el.textContent = to.length ? `→ ${to.join(', ')}` : t('patch.unplugged');
    el.classList.toggle('off', !to.length);
  }
}
