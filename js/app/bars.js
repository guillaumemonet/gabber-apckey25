// Insérer / supprimer des mesures dans tout le morceau (clic droit sur la règle des mesures) : tout ce qui suit est
// décalé (blocs, blocs d'effets, automation, marqueurs, tête de lecture). Un bloc à cheval sur l'endroit est coupé en
// deux (un bloc d'effet est allongé ou raccourci) ; « Annuler » revient en arrière.
import { t } from '../i18n.js';
import { BEATS_PER_BAR, autoAt } from '../timeline.js';
import { state, timeline } from './core.js';
import { canSplit, splitClip } from './clip-menu.js';
import { save } from './save.js';
import { renderTl, tlRec } from './tl.js';
import { tlSelect } from './tl-select.js';
import { toast } from './misc.js';

export const BAR_COUNTS = [1, 2, 4, 8, 16];
const r4 = v => +v.toFixed(4);
const MAX_BARS = 256;

// La lecture en cours reprend au même endroit du morceau (ce qui est programmé a changé).
function replayAfter(at, d) {
  if (!timeline.playing || tlRec) return;
  const pos = timeline.position();
  timeline.play(pos >= at ? Math.max(at, pos + d) : pos);
}

/** Insère `n` mesures à la mesure `bar` (0 = début) : tout ce qui suit glisse vers la droite. */
export function insertBars(bar, n) {
  const tl = state.tl, at = bar * BEATS_PER_BAR;
  n = Math.min(n, MAX_BARS - tl.bars);
  if (n <= 0 || tlRec) { if (n <= 0) toast(t('bars.full', { max: MAX_BARS }), 3000); return false; }
  const d = n * BEATS_PER_BAR;
  tl.tracks.forEach((tr, i) => {
    for (const c of [...tr.clips]) if (canSplit(c, at)) splitClip(i, c, at);
    for (const c of tr.clips) if (c.start >= at - 1e-6) c.start = r4(c.start + d);
    // Effet de piste à cheval : il couvre aussi les mesures insérées.
    for (const f of tr.fx) { if (f.start >= at - 1e-6) f.start = r4(f.start + d); else if (f.start + f.len > at + 1e-6) f.len = r4(f.len + d); }
    // Automation : la valeur à l'endroit est tenue pendant les mesures insérées.
    for (const [id, pts] of Object.entries(tr.auto ?? {})) {
      if (!pts.length || pts[pts.length - 1].b < at) continue;
      const v = autoAt(pts, at);
      const after = pts.filter(p => p.b >= at - 1e-6).map(p => ({ ...p, b: r4(p.b + d) }));
      tr.auto[id] = [...pts.filter(p => p.b < at - 1e-6), { b: at, v }, { b: r4(at + d), v }, ...after]
        .filter((p, k, a) => k === 0 || Math.abs(p.b - a[k - 1].b) > 1e-6 || p.v !== a[k - 1].v);
    }
  });
  for (const m of tl.markers) if (m.beat >= at - 1e-6) m.beat = r4(m.beat + d);
  if (tl.playhead >= at) tl.playhead = r4(tl.playhead + d);
  tl.bars += n;
  tlSelect(null, null);
  renderTl();
  save();
  replayAfter(at, d);
  toast(t('bars.inserted', { n, bar: bar + 1 }), 2500);
  return true;
}

/** Supprime `n` mesures à partir de la mesure `bar` : ce qu'elles contiennent disparaît, la suite glisse vers la gauche. */
export function removeBars(bar, n) {
  const tl = state.tl, at = bar * BEATS_PER_BAR;
  n = Math.min(n, tl.bars - bar);
  if (n <= 0 || tlRec || tl.bars - n < 1) return false;
  const d = n * BEATS_PER_BAR, end = at + d;
  tl.tracks.forEach((tr, i) => {
    for (const c of [...tr.clips]) if (canSplit(c, at)) splitClip(i, c, at);
    for (const c of [...tr.clips]) if (canSplit(c, end)) splitClip(i, c, end);
    tr.clips = tr.clips.filter(c => !(c.start >= at - 1e-6 && c.start < end - 1e-6));
    for (const c of tr.clips) if (c.start >= end - 1e-6) c.start = r4(c.start - d);
    // Effets de piste : retirés s'ils sont dedans, raccourcis s'ils la traversent, décalés après.
    tr.fx = tr.fx.filter(f => !(f.start >= at - 1e-6 && f.start + f.len <= end + 1e-6));
    for (const f of tr.fx) {
      const s = f.start, e = f.start + f.len;
      const keep = Math.max(0, Math.min(e, at) - s) + Math.max(0, e - Math.max(s, end));
      f.start = r4(s < at ? s : Math.max(at, s - d));
      f.len = r4(Math.max(0.25, keep));
    }
    for (const [id, pts] of Object.entries(tr.auto ?? {})) {
      if (!pts.length || pts[pts.length - 1].b < at) continue;
      const vEnd = autoAt(pts, end);
      const after = pts.filter(p => p.b > end + 1e-6).map(p => ({ ...p, b: r4(p.b - d) }));
      tr.auto[id] = [...pts.filter(p => p.b < at - 1e-6), ...(vEnd !== null ? [{ b: at, v: vEnd }] : []), ...after];
    }
  });
  tl.markers = tl.markers.filter(m => !(m.beat >= at - 1e-6 && m.beat < end - 1e-6));
  for (const m of tl.markers) if (m.beat >= end - 1e-6) m.beat = r4(m.beat - d);
  if (tl.playhead >= end) tl.playhead = r4(tl.playhead - d); else if (tl.playhead > at) tl.playhead = at;
  tl.bars = Math.max(1, tl.bars - n);
  tlSelect(null, null);
  renderTl();
  save();
  replayAfter(at, -d);
  toast(t('bars.removed', { n, bar: bar + 1 }), 2500);
  return true;
}

// ---------- Menu de la règle (clic droit sur une mesure) ----------

let menu = null;
export function closeBarMenu() {
  menu?.remove();
  menu = null;
  window.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('keydown', onKey, true);
}
const outside = e => { if (menu && !menu.contains(e.target)) closeBarMenu(); };
const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeBarMenu(); } };

/** Menu de la mesure `bar` (0 = première) : insérer ou supprimer 1, 2, 4, 8 ou 16 mesures. */
export function openBarMenu(bar, x, y) {
  closeBarMenu();
  menu = document.createElement('div');
  menu.className = 'clip-menu bar-menu';
  menu.setAttribute('role', 'menu');
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = t('bars.head', { bar: bar + 1 });
  menu.appendChild(head);
  const line = (label, title, fn, cls) => {
    const r = document.createElement('div');
    r.className = 'cm-row bar-row';
    const s = document.createElement('span');
    s.textContent = label;
    s.title = title;
    r.appendChild(s);
    const box = document.createElement('div');
    box.className = 'bar-counts';
    for (const n of BAR_COUNTS) {
      const b = document.createElement('button');
      b.textContent = n;
      b.dataset[cls] = n;
      b.title = title;
      b.addEventListener('click', () => { closeBarMenu(); fn(n); });
      box.appendChild(b);
    }
    r.appendChild(box);
    menu.appendChild(r);
  };
  line(t('bars.insert'), t('bars.insertTitle', { bar: bar + 1 }), n => insertBars(bar, n), 'ins');
  line(t('bars.remove'), t('bars.removeTitle', { bar: bar + 1 }), n => removeBars(bar, n), 'del');
  const hint = document.createElement('div');
  hint.className = 'hint bar-hint';
  hint.textContent = t('bars.hint');
  menu.appendChild(hint);
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  setTimeout(() => {
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
  });
}
