// Fenêtres des plugins (pads, TR-909, synthé, mixeur…) flottant au-dessus de la timeline.
// On les ouvre depuis la barre des plugins, on les déplace par leur barre de titre, on les
// redimensionne par leur coin ; elles s'aimantent aux bords de l'écran et entre elles.

export const WINDOWS = ['pads', 'editor', 'tr', 'piano', 'knobs', 'perf', 'mix', 'scenes', 'monitor'];
const SNAP = 14;   // distance d'aimantation (px)
const DEFAULT_SIZE = {
  pads: [780, null], editor: [360, null], tr: [900, null], piano: [760, null], knobs: [760, null],
  perf: [760, null], mix: [620, null], scenes: [760, null], monitor: [640, 280],
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
    this.els = Object.fromEntries(WINDOWS.map(id => [id, document.querySelector(`[data-win="${id}"]`)]).filter(([, el]) => el));
    for (const [id, el] of Object.entries(this.els)) this.bind(id, el);
    window.addEventListener('resize', () => this.applyAll());
    this.applyAll();
  }

  get st() { return this.getState(); }
  isOpen(id) { return !!this.st[id]?.open; }

  toggle(id, open = !this.isOpen(id)) {
    this.st[id].open = open;
    this.apply(id);
    if (open) this.bring(id);
    this.onToggle(id, open);
    this.onChange();
  }

  bring(id) { this.els[id].style.zIndex = ++this.z; }

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

  bind(id, el) {
    el.addEventListener('pointerdown', () => this.bring(id), true);
    const title = el.querySelector('.section-title');
    const close = document.createElement('button');
    close.className = 'win-close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle(id, false));
    title?.appendChild(close);
    title?.classList.add('win-handle');
    title?.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, select, a, .segmented, label')) return;
      this.drag(e, id, el, 'move');
    });
    const grip = document.createElement('div');
    grip.className = 'win-resize';
    el.appendChild(grip);
    grip.addEventListener('pointerdown', e => { if (e.button === 0) { e.stopPropagation(); this.drag(e, id, el, 'resize'); } });
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
