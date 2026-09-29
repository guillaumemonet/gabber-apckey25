// Fenêtres des plugins (pads, TR-909, synthé, mixeur…) flottant au-dessus de la timeline.
// On les ouvre depuis la barre des plugins, on les déplace par leur barre de titre, on les
// redimensionne par leur coin en bas à droite ; elles s'aimantent aux bords de l'écran et entre elles.
// Le bouton ? de la barre de titre ouvre l'aide de la fenêtre (js/help.js).

import { t } from './i18n.js';
import { helpHtml } from './help.js';

export const WINDOWS = ['pads', 'editor', 'tr', 'acid', 'kick', 'decks', 'patch', 'piano', 'perf', 'mix', 'scenes', 'monitor'];
const SNAP = 14;   // distance d'aimantation (px)
const DEFAULT_SIZE = {
  pads: [780, null], editor: [360, null], tr: [900, null], acid: [920, null], kick: [720, null], decks: [980, null], patch: [1040, 600], piano: [760, null], knobs: [760, null],
  perf: [760, null], mix: [1060, null], scenes: [760, null], monitor: [640, 280],
};

export function mergeWindows(saved) {
  const out = {};
  WINDOWS.forEach((id, k) => {
    const [w, h] = DEFAULT_SIZE[id];
    out[id] = { open: false, x: 300 + k * 28, y: 150 + k * 24, w, h, ...(saved?.[id] ?? {}) };
  });
  return out;
}

export class WindowManager {
  constructor(getState, onChange, onToggle = () => {}) {
    this.getState = getState;
    this.onChange = onChange;
    this.onToggle = onToggle;
    this.z = 10;
    this.active = null;         // fenêtre active (au premier plan)
    this.onActive = () => {};
    this.els = Object.fromEntries(WINDOWS.map(id => [id, document.querySelector(`[data-win="${id}"]`)]).filter(([, el]) => el));
    for (const [id, el] of Object.entries(this.els)) this.bind(id, el);
    window.addEventListener('resize', () => this.applyAll());
    this.applyAll();
    this.pickActive();
  }

  get st() { return this.getState(); }
  isOpen(id) { return !!this.st[id]?.open; }

  toggle(id, open = !this.isOpen(id)) {
    if (open === this.isOpen(id)) { if (open) this.bring(id); return; }
    this.st[id].open = open;
    if (!open && this.helpId === id) this.closeHelp();
    const el = this.els[id];
    clearTimeout(el._animTimer);
    el.classList.remove('win-in', 'win-out');
    if (open) {
      this.apply(id);
      this.bring(id);
      this.animate(el, 'win-in');
    } else {
      // Transition 3D de fermeture : la fenêtre reste affichée le temps de se replier.
      el.classList.add('win-out');
      el._animTimer = setTimeout(() => { el.classList.remove('win-out'); this.apply(id); }, this.reduced() ? 0 : 240);
      if (this.active === id) this.pickActive();
    }
    this.onToggle(id, open);
    this.onChange();
  }

  reduced() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }

  animate(el, cls) {
    if (this.reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth;   // relance l'animation
    el.classList.add(cls);
    el._animTimer = setTimeout(() => el.classList.remove(cls), 420);
  }

  // Fenêtre au premier plan = fenêtre active : bien visible (et, plus tard, celle que pilotent les commandes MIDI).
  bring(id) {
    this.els[id].style.zIndex = ++this.z;
    this.setActive(id);
  }

  setActive(id) {
    if (this.active === id) return;
    this.active = id;
    for (const [k, el] of Object.entries(this.els)) el.classList.toggle('active', k === id);
    this.onActive(id);
  }

  // Après une fermeture : la fenêtre ouverte la plus en avant devient active.
  pickActive() {
    const open = Object.entries(this.els).filter(([k]) => this.isOpen(k));
    open.sort((a, b) => (+b[1].style.zIndex || 0) - (+a[1].style.zIndex || 0));
    this.setActive(open[0]?.[0] ?? null);
  }

  applyAll() { for (const id of Object.keys(this.els)) this.apply(id); }

  apply(id) {
    const el = this.els[id];
    const box = this.st[id];
    el.classList.toggle('open', box.open);
    if (!box.open) return;
    // Toujours visible, même si l'écran a rétréci depuis.
    const w = Math.min(box.w, window.innerWidth - 16);
    box.x = Math.max(0, Math.min(box.x, window.innerWidth - Math.min(w, 120)));
    box.y = Math.max(0, Math.min(box.y, window.innerHeight - 40));
    Object.assign(el.style, {
      left: `${box.x}px`, top: `${box.y}px`, width: `${w}px`,
      height: box.h ? `${Math.min(box.h, window.innerHeight - box.y - 8)}px` : '',
      maxHeight: `${window.innerHeight - box.y - 8}px`,
    });
  }

  // Bords (écran et autres fenêtres ouvertes) vers lesquels une fenêtre s'aimante.
  edges(id) {
    const xs = [0, window.innerWidth];
    const ys = [0, window.innerHeight];
    for (const [other, el] of Object.entries(this.els)) {
      if (other === id || !this.isOpen(other)) continue;
      const r = el.getBoundingClientRect();
      xs.push(r.left, r.right);
      ys.push(r.top, r.bottom);
    }
    return { xs, ys };
  }

  static near(v, list) { return list.find(t => Math.abs(t - v) < SNAP); }

  // Position aimantée : le bord gauche/haut, sinon le bord droit/bas.
  snap(x, y, w, h, id) {
    const { xs, ys } = this.edges(id);
    const nx = WindowManager.near(x, xs);
    const nr = WindowManager.near(x + w, xs);
    const ny = WindowManager.near(y, ys);
    const nb = WindowManager.near(y + h, ys);
    return [nx ?? (nr !== undefined ? nr - w : x), ny ?? (nb !== undefined ? nb - h : y)];
  }

  // Chaque fenêtre : barre de titre (titre à gauche ; aide ? et fermeture ✕ en haut à droite),
  // contenu qui défile, poignée de redimensionnement dans la marge du bas, à droite.
  bind(id, el) {
    el.addEventListener('pointerdown', () => this.bring(id), true);
    const title = el.querySelector('.section-title');
    const bar = document.createElement('div');
    bar.className = 'win-bar win-handle';
    bar.appendChild(title?.querySelector('h2') ?? document.createElement('h2'));   // le titre garde son id (éditeur)
    const actions = document.createElement('div');
    actions.className = 'win-actions';
    const help = document.createElement('button');
    help.className = 'win-help';
    help.textContent = '?';
    help.title = t('win.help');
    help.setAttribute('aria-label', t('win.help'));
    help.addEventListener('click', () => this.toggleHelp(id));
    const close = document.createElement('button');
    close.className = 'win-close';
    close.textContent = '✕';
    close.title = t('win.close');
    close.setAttribute('aria-label', t('win.close'));
    close.addEventListener('click', () => this.toggle(id, false));
    actions.append(help, close);
    bar.appendChild(actions);
    const body = document.createElement('div');
    body.className = 'win-body';
    while (el.firstChild) body.appendChild(el.firstChild);
    // La barre d'outils de la fenêtre reste ; vide (titre parti, aide dans ?), elle disparaît.
    const useful = title && [...title.children].some(c => !c.classList.contains('spacer') && !(c.classList.contains('hint') && !c.id));
    if (title && !useful) title.classList.add('win-empty');
    const grip = document.createElement('div');
    grip.className = 'win-resize';
    el.append(bar, body, grip);
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, select, a')) return;
      this.drag(e, id, el, 'move');
    });
    grip.addEventListener('pointerdown', e => { if (e.button === 0) { e.stopPropagation(); this.drag(e, id, el, 'resize'); } });
  }

  // Fenêtre d'aide du contenu d'une fenêtre, posée à côté d'elle.
  toggleHelp(id) {
    if (this.helpId === id) { this.closeHelp(); return; }
    if (!this.help) this.buildHelp();
    const el = this.els[id];
    this.helpId = id;
    this.help.querySelector('h2').textContent = t('help.title', { name: el.querySelector('.win-bar h2').textContent });
    const body = this.help.querySelector('.win-body');
    body.innerHTML = helpHtml(id);
    body.scrollTop = 0;
    for (const b of document.querySelectorAll('.win-help.active')) b.classList.remove('active');
    el.querySelector('.win-help').classList.add('active');
    const pop = this.help;
    pop.hidden = false;
    pop.style.zIndex = ++this.z + 1000;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let x = r.right + 10;
    if (x + w > window.innerWidth - 8) x = r.left - w - 10;
    if (x < 8) x = Math.max(8, r.right - w - 16);
    const y = Math.max(8, Math.min(r.top, window.innerHeight - h - 8));
    Object.assign(pop.style, { left: `${x}px`, top: `${y}px` });
  }

  closeHelp() {
    if (!this.help) return;
    this.help.hidden = true;
    this.helpId = null;
    for (const b of document.querySelectorAll('.win-help.active')) b.classList.remove('active');
  }

  buildHelp() {
    const pop = document.createElement('div');
    pop.className = 'win-help-pop';
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = `<div class="win-bar win-handle"><h2></h2><div class="win-actions"><button class="win-close" title="${t('win.close')}" aria-label="${t('win.close')}">✕</button></div></div><div class="win-body"></div>`;
    pop.querySelector('.win-close').addEventListener('click', () => this.closeHelp());
    pop.querySelector('.win-bar').addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      const r = pop.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const move = ev => Object.assign(pop.style, {
        left: `${Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - sx))}px`,
        top: `${Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - sy))}px`,
      });
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.helpId) this.closeHelp(); });
    document.body.appendChild(pop);
    this.help = pop;
  }

  drag(e, id, el, mode) {
    e.preventDefault();
    const box = this.st[id];
    const r = el.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height };
    el.classList.add('dragging');
    const onMove = ev => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (mode === 'move') {
        [box.x, box.y] = this.snap(start.left + dx, start.top + dy, start.w, start.h, id);
      } else {
        // On tire le bord droit / bas : c'est lui qui s'aimante.
        const { xs, ys } = this.edges(id);
        const right = start.left + Math.max(260, start.w + dx);
        const bottom = start.top + Math.max(140, start.h + dy);
        box.w = (WindowManager.near(right, xs) ?? right) - start.left;
        box.h = (WindowManager.near(bottom, ys) ?? bottom) - start.top;
      }
      this.apply(id);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.classList.remove('dragging');
      this.onChange();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Remet toutes les fenêtres à leur place et leur taille de départ (en gardant celles qui sont ouvertes).
  reset() {
    const fresh = mergeWindows(null);
    for (const id of WINDOWS) Object.assign(this.st[id], { ...fresh[id], open: this.st[id].open });
    this.applyAll();
    this.onChange();
  }
}
