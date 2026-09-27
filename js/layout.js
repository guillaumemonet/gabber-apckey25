// Espace de travail en grille magnétique : chaque outil est un panneau que l'on déplace par sa
// barre de titre et que l'on redimensionne par son coin. Positions en cases de grille
// (12 colonnes, rangées de hauteur fixe). Les panneaux ne se chevauchent jamais : ceux qui gênent
// sont poussés vers le bas, puis tout remonte (gravité vers le haut).

export const COLS = 12;
const ROW = 36;        // hauteur d'une rangée (px)
const GAP = 12;        // espace entre panneaux (px)
const NARROW = 980;    // en dessous : panneaux empilés, sans grille

// Disposition par défaut ; h: null = hauteur ajustée au contenu au premier affichage.
export const DEFAULT_LAYOUT = {
  pads: { x: 0, y: 0, w: 8, h: 12 },
  editor: { x: 8, y: 0, w: 4, h: null },
  knobs: { x: 0, y: 1, w: 12, h: null },
  perf: { x: 0, y: 2, w: 12, h: null },
  scenes: { x: 0, y: 3, w: 12, h: null },
  tr: { x: 0, y: 4, w: 12, h: null },
  tl: { x: 0, y: 5, w: 12, h: null },
  mix: { x: 0, y: 6, w: 6, h: null },
  piano: { x: 6, y: 6, w: 6, h: null },
  monitor: { x: 0, y: 7, w: 12, h: 3 },
};

const collides = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Pousse vers le bas tout ce qui chevauche `id`, en cascade.
function pushDown(layout, id, depth = 0) {
  const moved = layout[id];
  for (const [other, box] of Object.entries(layout)) {
    if (other === id || !collides(moved, box)) continue;
    box.y = moved.y + moved.h;
    if (depth < 50) pushDown(layout, other, depth + 1);
  }
}

// Supprime les chevauchements (dans l'ordre de lecture), puis tasse vers le haut.
export function settle(layout) {
  const placed = [];
  const ids = Object.keys(layout).sort((a, b) => layout[a].y - layout[b].y || layout[a].x - layout[b].x);
  for (const id of ids) {
    const box = layout[id];
    box.w = Math.max(2, Math.min(COLS, box.w));
    box.x = Math.max(0, Math.min(COLS - box.w, box.x));
    let hit;
    while ((hit = placed.filter(o => collides(box, o))).length) box.y = Math.max(...hit.map(o => o.y + o.h));
    placed.push(box);
  }
  compact(layout);
}

// Complète une disposition sauvegardée avec les panneaux ajoutés depuis.
export function mergeLayout(saved) {
  const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  if (!saved) return layout;
  for (const id of Object.keys(layout)) {
    if (saved[id]) layout[id] = { ...saved[id] };
    else layout[id].y = 999;   // nouveau panneau : placé en bas
  }
  return layout;
}

// Fait remonter chaque panneau tant qu'il ne touche rien (le panneau tenu reste en place).
function compact(layout, fixed) {
  const ids = Object.keys(layout).sort((a, b) => layout[a].y - layout[b].y || layout[a].x - layout[b].x);
  for (const id of ids) {
    if (id === fixed) continue;
    const box = layout[id];
    while (box.y > 0 && !ids.some(o => o !== id && collides({ ...box, y: box.y - 1 }, layout[o]))) box.y--;
  }
}

export class Workspace {
  constructor(container, getLayout, onChange) {
    this.el = container;
    this.getLayout = getLayout;
    this.onChange = onChange;
    this.panels = Object.fromEntries([...container.querySelectorAll('[data-panel]')].map(p => [p.dataset.panel, p]));
    this.grips = {};   // poignées de redimensionnement, posées sur la grille au coin de chaque panneau
    this.ghost = document.createElement('div');
    this.ghost.className = 'ws-ghost';
    container.appendChild(this.ghost);
    for (const [id, panel] of Object.entries(this.panels)) this.bindPanel(id, panel);
    new ResizeObserver(() => this.apply()).observe(container);
    this.fitMissingHeights();
    this.apply();
  }

  get layout() { return this.getLayout(); }
  get narrow() { return window.innerWidth < NARROW; }
  colWidth() { return (this.el.clientWidth - GAP * (COLS - 1)) / COLS; }

  rect(box) {
    const cw = this.colWidth();
    return {
      left: box.x * (cw + GAP), top: box.y * (ROW + GAP),
      width: box.w * cw + (box.w - 1) * GAP, height: box.h * ROW + (box.h - 1) * GAP,
    };
  }

  // Hauteur au plus juste pour les panneaux sans hauteur enregistrée (premier lancement).
  fitMissingHeights() {
    const layout = this.layout;
    let changed = false;
    for (const [id, box] of Object.entries(layout)) {
      if (box.h || !this.panels[id]) continue;
      const panel = this.panels[id];
      panel.style.width = `${this.rect({ ...box, h: 1 }).width}px`;
      panel.style.height = 'auto';
      box.h = Math.max(2, Math.ceil((panel.scrollHeight + GAP) / (ROW + GAP)));
      changed = true;
    }
    if (changed) this.onChange();
    settle(layout);
  }

  apply(skip) {
    this.el.classList.toggle('ws-flow', this.narrow);
    const layout = this.layout;
    if (this.narrow) {
      // Écran étroit : ordre de lecture de la grille, sans positionnement.
      Object.keys(layout).sort((a, b) => layout[a].y - layout[b].y || layout[a].x - layout[b].x)
        .forEach((id, k) => { if (this.panels[id]) Object.assign(this.panels[id].style, { order: k, left: '', top: '', width: '', height: '' }); });
      this.el.style.height = '';
      return;
    }
    let bottom = 0;
    for (const [id, box] of Object.entries(layout)) {
      const panel = this.panels[id];
      if (!panel) continue;
      const r = this.rect(box);
      bottom = Math.max(bottom, r.top + r.height);
      if (id === skip) continue;
      Object.assign(panel.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      Object.assign(this.grips[id].style, { left: `${r.left + r.width - 16}px`, top: `${r.top + r.height - 16}px` });
    }
    this.el.style.height = `${bottom}px`;
  }

  bindPanel(id, panel) {
    const grip = document.createElement('div');
    grip.className = 'ws-resize';
    this.el.appendChild(grip);
    this.grips[id] = grip;
    const handle = panel.querySelector('.section-title') ?? panel.querySelector('summary');
    handle?.classList.add('ws-handle');
    handle?.addEventListener('pointerdown', e => {
      // Les boutons et réglages de la barre de titre restent utilisables.
      if (e.button !== 0 || this.narrow || e.target.closest('button, input, select, a, .segmented, label')) return;
      this.startGesture(e, id, panel, 'move');
    });
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.narrow) return;
      e.stopPropagation();
      this.startGesture(e, id, panel, 'resize');
    });
  }

  startGesture(e, id, panel, mode) {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, box: { ...this.layout[id] }, rect: this.rect(this.layout[id]) };
    const saved = JSON.parse(JSON.stringify(this.layout));
    panel.classList.add('ws-dragging');
    this.grips[id].classList.add('hidden');
    this.ghost.classList.add('show');
    let moved = false;

    const onMove = ev => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      const cw = this.colWidth() + GAP;
      const rh = ROW + GAP;
      // Le panneau suit la souris ; sa case d'arrivée (le « fantôme ») est aimantée à la grille.
      const layout = JSON.parse(JSON.stringify(saved));
      const box = layout[id];
      if (mode === 'move') {
        Object.assign(panel.style, { left: `${start.rect.left + dx}px`, top: `${start.rect.top + dy}px` });
        box.x = Math.max(0, Math.min(COLS - box.w, Math.round((start.rect.left + dx) / cw)));
        box.y = Math.max(0, Math.round((start.rect.top + dy) / rh));
      } else {
        Object.assign(panel.style, { width: `${Math.max(80, start.rect.width + dx)}px`, height: `${Math.max(60, start.rect.height + dy)}px` });
        box.w = Math.max(2, Math.min(COLS - box.x, Math.round((start.rect.width + dx + GAP) / cw)));
        box.h = Math.max(2, Math.round((start.rect.height + dy + GAP) / rh));
      }
      pushDown(layout, id);
      compact(layout, id);
      Object.assign(this.layout, layout);
      const r = this.rect(box);
      Object.assign(this.ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      this.apply(id);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      panel.classList.remove('ws-dragging');
      this.grips[id].classList.remove('hidden');
      this.ghost.classList.remove('show');
      if (moved) {
        compact(this.layout);
        this.onChange();
      }
      this.apply();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  reset() {
    const layout = this.layout;
    for (const id of Object.keys(layout)) delete layout[id];
    Object.assign(layout, JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    this.fitMissingHeights();
    this.apply();
    this.onChange();
  }
}
