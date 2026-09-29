// Piano roll : édite les notes d'un bloc de la timeline (hauteur, début, durée, vélocité).
// Tout est dessiné dans un canvas : clavier à gauche, règle en haut, grille des notes, vélocités en bas.
// - clic dans le vide : pose une note (glisser = sa durée) ; Maj / Ctrl + glisser : sélection au lasso ;
// - glisser une note : la déplace (Alt = copie) ; glisser son bord droit : sa durée ;
// - clic droit (ou glisser) : efface ; clic sur la règle : curseur (collage, saisie pas à pas) ;
// - molette : défile (Maj = en largeur, Ctrl = zoom).
// Le bloc est fourni par l'application (host), qui enregistre après chaque modification.

import { NOTE_LO, NOTE_HI, patLen, quantize } from './notes.js';

const KW = 46;          // largeur du clavier
const RH = 20;          // hauteur de la règle
const VH = 56;          // hauteur des vélocités
const GAP = 6;
const BAR = 4;
const SCALE = new Set([5, 7, 8, 10, 0, 1, 3]);   // fa mineur, la tonalité des banques
const BLACK = new Set([1, 3, 6, 8, 10]);
export const ROLL_GRIDS = [1, 0.5, 0.25, 0.125, 1 / 3, 1 / 6];
export const PAT_LENGTHS = [0.25, 0.5, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64];

const round = v => +v.toFixed(4);

export class PianoRoll {
  // host : { clip(), changed(), noteOn(note, vel), noteOff(note), playhead(), color(), noteName(note) }
  constructor(canvas, host) {
    this.cv = canvas;
    this.host = host;
    this.rowH = 12;
    this.px = 56;           // largeur d'un temps
    this.x0 = 0;            // premier temps affiché
    this.top = 84;          // note la plus haute affichée
    this.grid = 0.25;
    this.lastLen = 0.5;
    this.lastVel = 0.85;
    this.sel = new Set();
    this.cursor = 0;
    this.clipboard = null;
    this.held = new Set();  // notes du clavier tenues (surlignées)
    this.step = null;       // saisie pas à pas : { at, notes }
    this.band = null;       // lasso : { x0, y0, x1, y1 }
    this.ref = null;        // bloc affiché (la sélection se vide quand il change)
    new ResizeObserver(() => this.draw()).observe(canvas);
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => this.wheel(e), { passive: false });
    canvas.addEventListener('pointermove', e => { if (!this.drag) this.hover(e); });
  }

  get clip() {
    const c = this.host.clip();
    if (c !== this.ref) { this.ref = c; this.sel.clear(); this.step = null; }
    return c;
  }
  get notes() { return this.clip?.seq ?? []; }
  get pat() { return this.clip ? patLen(this.clip) : BAR; }

  // Géométrie
  get W() { return this.cv.clientWidth; }
  get H() { return this.cv.clientHeight; }
  get gy1() { return this.H - VH - GAP; }
  bx(b) { return KW + (b - this.x0) * this.px; }
  ny(n) { return RH + (this.top - n) * this.rowH; }
  beatAt(x) { return this.x0 + (x - KW) / this.px; }
  noteAt(y) { return this.top - Math.floor((y - RH) / this.rowH); }
  snap(b) { return Math.max(0, Math.floor(b / this.grid + 1e-6) * this.grid); }
  get span() { return Math.max(this.pat + BAR, ...this.notes.map(n => n.t + n.len + BAR)); }   // largeur éditable

  // Centre la vue sur les notes du bloc (ou sur le do4).
  fit() {
    const ns = this.notes;
    const mid = ns.length ? (Math.min(...ns.map(n => n.note)) + Math.max(...ns.map(n => n.note))) / 2 : 62;
    const rows = Math.max(1, (this.gy1 - RH) / this.rowH);
    this.top = Math.round(Math.min(NOTE_HI, Math.max(NOTE_LO + rows - 1, mid + rows / 2)));
    this.x0 = 0;
    const w = this.W - KW - 8;
    if (w > 50) this.px = Math.max(12, Math.min(160, w / (Math.max(BAR, this.pat) + 1)));   // un temps de marge pour allonger
    this.draw();
  }

  scrollTo(top) {
    const rows = Math.floor((this.gy1 - RH) / this.rowH);
    this.top = Math.max(NOTE_LO + rows - 1, Math.min(NOTE_HI, Math.round(top)));
  }

  hit(x, y) {
    const note = this.noteAt(y);
    const b = this.beatAt(x);
    // La note posée par-dessus (la dernière) gagne.
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.note === note && b >= n.t && b < n.t + n.len) return n;
    }
    return null;
  }

  pos(e) {
    const r = this.cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  hover(e) {
    const [x, y] = this.pos(e);
    let cursor = 'default';
    if (y > RH && y < this.gy1 && x > KW) {
      const n = this.hit(x, y);
      cursor = n ? (x > this.bx(n.t + n.len) - 6 ? 'ew-resize' : 'grab') : 'crosshair';
    } else if (y > this.gy1 + GAP) cursor = 'ns-resize';
    else if (x < KW) cursor = 'pointer';
    this.cv.style.cursor = cursor;
  }

  // ---------- Souris ----------

  down(e) {
    if (!this.clip) return;
    const [x, y] = this.pos(e);
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* pointeur simulé */ }
    let move = () => {};
    let up = () => {};
    let changed = false;
    if (y < RH) {                                 // règle : curseur
      this.cursor = this.snap(this.beatAt(x));
    } else if (x < KW && y < this.gy1) {          // clavier : écouter
      let note = this.noteAt(y);
      this.host.noteOn(note, 0.85);
      move = (mx, my) => { const n = this.noteAt(my); if (n !== note) { this.host.noteOff(note); note = n; this.host.noteOn(note, 0.85); } };
      up = () => this.host.noteOff(note);
    } else if (y > this.gy1 + GAP) {              // vélocités
      const setVel = (mx, my) => {
        const v = Math.max(0.05, Math.min(1, 1 - (my - this.gy1 - GAP) / VH));
        const list = this.sel.size ? [...this.sel] : this.notes;
        for (const n of list) if (Math.abs(this.bx(n.t) - mx) < Math.max(4, this.px * this.grid / 2)) { n.vel = round(v); this.lastVel = n.vel; changed = true; }
      };
      setVel(x, y);
      move = setVel;
    } else if (e.button === 2) {                  // gomme
      const erase = (mx, my) => {
        const n = this.hit(mx, my);
        if (!n) return;
        const list = this.sel.has(n) ? [...this.sel] : [n];
        this.remove(list);
        changed = true;
      };
      erase(x, y);
      move = erase;
    } else if (e.button === 0) {
      const n = this.hit(x, y);
      if (!n && (e.shiftKey || e.ctrlKey || e.metaKey)) {   // lasso
        const keep = new Set(this.sel);
        this.band = { x0: x, y0: y, x1: x, y1: y };
        move = (mx, my) => {
          Object.assign(this.band, { x1: mx, y1: my });
          const [b0, b1] = [this.beatAt(Math.min(x, mx)), this.beatAt(Math.max(x, mx))];
          const [n0, n1] = [this.noteAt(Math.max(y, my)), this.noteAt(Math.min(y, my))];
          this.sel = new Set(keep);
          for (const k of this.notes) if (k.note >= n0 && k.note <= n1 && k.t < b1 && k.t + k.len > b0) this.sel.add(k);
        };
        up = () => { this.band = null; };
      } else {
        let target = n;
        let resize = !!n && x > this.bx(n.t + n.len) - 6 && this.px * n.len > 12;
        if (!n) {                                 // nouvelle note, dont on tire la durée
          const note = this.noteAt(y);
          if (note < NOTE_LO || note > NOTE_HI) return;
          target = { t: round(this.snap(this.beatAt(x))), len: this.lastLen, note, vel: this.lastVel };
          this.notes.push(target);
          this.sel = new Set([target]);
          resize = true;
          changed = true;
        } else if (e.shiftKey) {
          if (this.sel.has(n)) { this.sel.delete(n); this.draw(); return; }
          this.sel.add(n);
        } else if (!this.sel.has(n)) this.sel = new Set([n]);
        if (n && e.altKey && !resize) {           // Alt + glisser : copie
          const copies = [...this.sel].map(k => ({ ...k }));
          this.notes.push(...copies);
          target = copies[[...this.sel].indexOf(n)];
          this.sel = new Set(copies);
          changed = true;
        }
        let sounding = target.note;
        this.host.noteOn(sounding, target.vel);
        const list = [...this.sel];
        const orig = list.map(k => ({ t: k.t, len: k.len, note: k.note }));
        const fresh = !n;
        move = (mx, my, ev) => {
          const d = this.beatAt(mx) - this.beatAt(x);
          const g = ev.altKey && resize ? this.grid / 4 : this.grid;
          if (resize) {
            list.forEach((k, i) => {
              k.len = round(fresh ? Math.max(g, Math.ceil((this.beatAt(mx) - k.t) / g - 1e-6) * g) : Math.max(g, orig[i].len + Math.round(d / g) * g));
            });
            if (fresh && this.beatAt(mx) <= target.t + g) target.len = this.lastLen;
          } else {
            const minT = Math.min(...orig.map(o => o.t));
            const dt = Math.max(-minT, Math.round(d / g) * g);
            const lo = Math.min(...orig.map(o => o.note));
            const hi = Math.max(...orig.map(o => o.note));
            const dn = Math.max(NOTE_LO - lo, Math.min(NOTE_HI - hi, Math.round((y - my) / this.rowH)));
            list.forEach((k, i) => { k.t = round(orig[i].t + dt); k.note = orig[i].note + dn; });
            if (target.note !== sounding) { this.host.noteOff(sounding); sounding = target.note; this.host.noteOn(sounding, target.vel); }
          }
          changed = true;
        };
        up = () => {
          this.host.noteOff(sounding);
          if (resize) this.lastLen = target.len;
        };
      }
    }
    this.drag = true;
    this.draw();
    const onMove = ev => { const [mx, my] = this.pos(ev); move(mx, my, ev); this.draw(); };
    const onUp = () => {
      this.cv.removeEventListener('pointermove', onMove);
      this.cv.removeEventListener('pointerup', onUp);
      this.cv.removeEventListener('pointercancel', onUp);
      this.drag = false;
      up();
      if (changed) this.commit(); else this.draw();
    };
    this.cv.addEventListener('pointermove', onMove);
    this.cv.addEventListener('pointerup', onUp);
    this.cv.addEventListener('pointercancel', onUp);
  }

  wheel(e) {
    e.preventDefault();
    const [x] = this.pos(e);
    if (e.ctrlKey || e.metaKey) {
      const at = this.beatAt(x);
      this.px = Math.max(8, Math.min(240, this.px * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      this.x0 = Math.max(0, at - (x - KW) / this.px);
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const d = (e.shiftKey ? e.deltaY : e.deltaX) || e.deltaY;
      this.x0 = Math.max(0, Math.min(this.span - 1, this.x0 + d / this.px));
    } else {
      this.scrollTo(this.top - Math.sign(e.deltaY) * 3);
    }
    this.draw();
  }

  // ---------- Modifications ----------

  remove(list) {
    const gone = new Set(list);
    const seq = this.notes;
    for (let i = seq.length - 1; i >= 0; i--) if (gone.has(seq[i])) seq.splice(i, 1);
    for (const n of gone) this.sel.delete(n);
  }

  // Après une modification : les notes modifiées (sélectionnées) posées après le motif l'allongent (à la mesure),
  // puis l'application enregistre.
  commit() {
    const clip = this.clip;
    if (!clip) return;
    const end = Math.max(0, ...[...this.sel].map(n => n.t + 0.001));
    if (end > clip.pat) {
      const oneRep = clip.len <= clip.pat + 1e-6;
      clip.pat = Math.ceil(end / BAR) * BAR;
      if (oneRep || clip.len < clip.pat) clip.len = clip.pat;
    }
    this.notes.sort((a, b) => a.t - b.t || a.note - b.note);
    this.host.changed();
    this.draw();
  }

  // Durée d'un groupe de notes, arrondie au temps (à la mesure au-delà d'un temps) : pas du collage.
  static extent(list) {
    const t0 = Math.min(...list.map(n => n.t));
    const e = Math.max(...list.map(n => n.t + n.len)) - t0;
    return e > 1 ? Math.ceil(e / BAR - 1e-6) * BAR : Math.ceil(e - 1e-6) || 1;
  }

  copy() {
    if (!this.sel.size) return false;
    const list = [...this.sel];
    const t0 = Math.min(...list.map(n => n.t));
    this.clipboard = { notes: list.map(n => ({ ...n, t: n.t - t0 })), span: PianoRoll.extent(list) };
    this.cursor = t0 + this.clipboard.span;
    return true;
  }

  paste() {
    if (!this.clipboard || !this.clip) return;
    const copies = this.clipboard.notes.map(n => ({ ...n, t: round(this.cursor + n.t) }));
    this.notes.push(...copies);
    this.sel = new Set(copies);
    this.cursor += this.clipboard.span;
    this.commit();
  }

  duplicate() {
    if (!this.sel.size) return;
    const list = [...this.sel];
    const span = PianoRoll.extent(list);
    const copies = list.map(n => ({ ...n, t: round(n.t + span) }));
    this.notes.push(...copies);
    this.sel = new Set(copies);
    this.commit();
  }

  transpose(d) {
    const list = this.sel.size ? [...this.sel] : this.notes;
    if (!list.length) return;
    const lo = Math.min(...list.map(n => n.note));
    const hi = Math.max(...list.map(n => n.note));
    d = Math.max(NOTE_LO - lo, Math.min(NOTE_HI - hi, d));
    for (const n of list) n.note += d;
    this.commit();
  }

  shift(d) {
    const list = [...this.sel];
    if (!list.length) return;
    d = Math.max(-Math.min(...list.map(n => n.t)), d);
    for (const n of list) n.t = round(n.t + d);
    this.commit();
  }

  quantize() {
    const list = this.sel.size ? [...this.sel] : this.notes;
    if (!list.length) return;
    quantize(list, this.grid);
    this.commit();
  }

  // Raccourcis clavier quand la fenêtre est active ; renvoie true si la touche est prise.
  key(e) {
    if (!this.clip) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') { if (this.sel.size) { this.remove([...this.sel]); this.commit(); } return true; }
    if (e.key === 'Escape') { this.sel.clear(); this.draw(); return true; }
    if (ctrl && k === 'a') { this.sel = new Set(this.notes); this.draw(); return true; }
    if (ctrl && k === 'c') { this.copy(); this.draw(); return true; }
    if (ctrl && k === 'x') { if (this.copy()) { this.cursor -= this.clipboard.span; this.remove([...this.sel]); this.commit(); } return true; }
    if (ctrl && k === 'v') { this.paste(); return true; }
    if (ctrl && k === 'd') { this.duplicate(); return true; }
    if (ctrl) return false;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { this.transpose((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1)); return true; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { this.shift((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? BAR : this.grid)); return true; }
    if (e.code === 'KeyQ') { this.quantize(); return true; }
    return false;
  }

  // Saisie pas à pas : une note (ou un accord) au curseur, qui avance d'une case quand tout est relâché.
  stepNote(note, vel, on) {
    if (!this.clip) return;
    if (on) {
      if (!this.step) this.step = { at: this.cursor, notes: new Set() };
      if (this.step.notes.has(note)) return;
      this.step.notes.add(note);
      const n = { t: round(this.step.at), len: this.grid, note, vel: round(Math.max(0.05, vel || this.lastVel)) };
      this.notes.push(n);
      this.sel = new Set([...this.sel].filter(k => k.t === n.t).concat(n));
      if (n.note > this.top || n.note < this.noteAt(this.gy1 - 1)) this.scrollTo(n.note + 6);
      this.draw();
    } else if (this.step?.notes.has(note)) {
      this.step.notes.delete(note);
      if (!this.step.notes.size) {
        this.cursor = round(this.step.at + this.grid);
        this.step = null;
        const right = this.beatAt(this.W - 20);
        if (this.cursor > right) this.x0 = Math.max(0, this.cursor - (this.W - KW) / this.px / 2);
        this.commit();
      }
    }
  }

  setHeld(note, on) {
    if (on) this.held.add(note); else this.held.delete(note);
    this.draw();
  }

  // ---------- Dessin ----------

  draw() {
    const cv = this.cv;
    const dpr = window.devicePixelRatio || 1;
    const W = this.W, H = this.H;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#111214';
    g.fillRect(0, 0, W, H);
    const clip = this.clip;
    const gy1 = this.gy1;
    const pat = this.pat;
    const color = this.host.color();

    // Lignes de notes
    g.save();
    g.beginPath(); g.rect(KW, RH, W - KW, gy1 - RH); g.clip();
    for (let n = this.top; this.ny(n) < gy1 && n >= NOTE_LO; n--) {
      const y = this.ny(n), pc = ((n % 12) + 12) % 12;
      g.fillStyle = BLACK.has(pc) ? '#16171b' : '#1c1d22';
      g.fillRect(KW, y, W - KW, this.rowH);
      if (SCALE.has(pc)) { g.fillStyle = 'rgba(61,214,140,.05)'; g.fillRect(KW, y, W - KW, this.rowH); }
      g.fillStyle = pc === 0 ? '#34363d' : '#232429';
      g.fillRect(KW, y + this.rowH - 1, W - KW, 1);
    }
    // Colonnes : cases, temps, mesures ; au-delà du motif, grisé.
    const b0 = Math.floor(this.x0), b1 = this.beatAt(W);
    const fine = this.grid * this.px >= 6;
    for (let b = Math.floor(this.x0 / this.grid) * this.grid; b <= b1; b = round(b + this.grid)) {
      const isBeat = Math.abs(b - Math.round(b)) < 1e-6;
      if (!isBeat && !fine) continue;
      const bar = isBeat && Math.round(b) % BAR === 0;
      g.fillStyle = bar ? '#4a4d56' : isBeat ? '#2f3137' : '#212227';
      g.fillRect(Math.round(this.bx(b)), RH, 1, gy1 - RH);
    }
    const xp = this.bx(pat);
    if (xp < W) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(Math.max(KW, xp), RH, W - Math.max(KW, xp), gy1 - RH); g.fillStyle = '#ff5a36'; g.fillRect(xp - 1, RH, 2, gy1 - RH); }

    // Notes
    if (clip) {
      for (const n of this.notes) {
        const x = this.bx(n.t), y = this.ny(n.note), w = Math.max(3, n.len * this.px - 1);
        if (x > W || x + w < KW || y > gy1 || y + this.rowH < RH) continue;
        const sel = this.sel.has(n);
        g.globalAlpha = n.t >= pat - 1e-6 ? 0.35 : 1;
        g.fillStyle = color;
        g.fillRect(x, y + 1, w, this.rowH - 2);
        g.fillStyle = `rgba(0,0,0,${0.45 * (1 - (n.vel ?? 0.85))})`;
        g.fillRect(x, y + 1, w, this.rowH - 2);
        g.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.55)';
        g.lineWidth = sel ? 1.5 : 1;
        g.strokeRect(x + 0.5, y + 1.5, w - 1, this.rowH - 3);
        if (w > 30 && this.rowH >= 11) {
          g.fillStyle = '#fff';
          g.font = '9px system-ui, sans-serif';
          g.fillText(this.host.noteName(n.note), x + 3, y + this.rowH - 3);
        }
        g.globalAlpha = 1;
      }
    }
    if (this.band) {
      const { x0, y0, x1, y1 } = this.band;
      g.fillStyle = 'rgba(61,214,140,.12)'; g.strokeStyle = '#3dd68c'; g.lineWidth = 1;
      g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      g.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    g.restore();

    // Clavier
    g.save();
    g.beginPath(); g.rect(0, RH, KW, gy1 - RH); g.clip();
    for (let n = this.top; this.ny(n) < gy1 && n >= NOTE_LO; n--) {
      const y = this.ny(n), pc = ((n % 12) + 12) % 12;
      const on = this.held.has(n);
      g.fillStyle = on ? '#3dd68c' : BLACK.has(pc) ? '#26272c' : '#d9dade';
      g.fillRect(0, y, KW - 2, this.rowH - 1);
      if (pc === 0 || on) {
        g.fillStyle = on ? '#111' : '#555';
        g.font = '9px system-ui, sans-serif';
        g.fillText(this.host.noteName(n), 3, y + this.rowH - 3);
      }
    }
    g.restore();

    // Règle : numéros de mesure, curseur, tête de lecture
    g.fillStyle = '#1a1b1f';
    g.fillRect(0, 0, W, RH);
    g.save();
    g.beginPath(); g.rect(KW, 0, W - KW, RH); g.clip();
    g.font = '10px system-ui, sans-serif';
    for (let b = b0; b <= b1; b++) {
      const x = this.bx(b);
      if (b % BAR === 0) { g.fillStyle = '#8b8d94'; g.fillText(`${b / BAR + 1}`, x + 3, 13); g.fillRect(x, 4, 1, RH - 4); }
      else if (this.px >= 18) { g.fillStyle = '#3a3c43'; g.fillRect(x, RH - 6, 1, 6); }
    }
    const xc = this.bx(this.cursor);
    g.fillStyle = '#3dd68c';
    g.beginPath(); g.moveTo(xc - 5, 2); g.lineTo(xc + 5, 2); g.lineTo(xc, 10); g.fill();
    g.restore();
    g.save();
    g.beginPath(); g.rect(KW, RH, W - KW, gy1 - RH); g.clip();
    g.fillStyle = 'rgba(61,214,140,.5)';
    g.fillRect(xc, RH, 1, gy1 - RH);
    const ph = this.host.playhead();
    if (ph !== null && ph !== undefined) { g.fillStyle = '#fff'; g.fillRect(this.bx(ph), RH, 2, gy1 - RH); }
    g.restore();

    // Vélocités
    const vy = gy1 + GAP;
    g.fillStyle = '#16171b';
    g.fillRect(KW, vy, W - KW, VH);
    g.fillStyle = '#8b8d94';
    g.font = '9px system-ui, sans-serif';
    g.fillText('VEL', 8, vy + VH / 2 + 3);
    g.save();
    g.beginPath(); g.rect(KW, vy, W - KW, VH); g.clip();
    for (const n of this.notes) {
      const x = this.bx(n.t), h = (n.vel ?? 0.85) * (VH - 4);
      g.fillStyle = this.sel.has(n) ? '#fff' : color;
      g.fillRect(x, vy + VH - h, Math.max(2, Math.min(6, n.len * this.px - 2)), h);
    }
    g.restore();

    if (!clip) {
      g.fillStyle = 'rgba(17,18,20,.7)';
      g.fillRect(0, 0, W, H);
    }
  }
}
