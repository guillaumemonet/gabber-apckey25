// Morceaux de démonstration.
import { soundName, t } from '../i18n.js';
import { catColor } from '../library.js';
import { BEATS_PER_BAR, MAX_TRACKS, newTrack } from '../timeline.js';
import { FX_BANK, bankName } from '../trackfx.js';
import { state, timeline } from './core.js';
import { curveName } from './curve-ui.js';
import { loadFile } from './files.js';
import { libManifest, renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { refreshLibNames, save } from './save.js';
import { setBpm } from './tempo.js';
import { loadBuffers, renderTl, tlRec, tlStopRec } from './tl.js';
import { tlSelect } from './tl-select.js';
import { closeFxEditor, fxEditing, fxOutside, setFxEditing } from './trackfx-ui.js';

// ---------- Démo ----------

// Le bouton Démo propose les deux morceaux : boucles de la bibliothèque, ou un morceau fait avec tous les outils.
export const DEMOS = [{ id: 1, icon: 'lib', load: () => loadDemo() }, ...[2, 3, 4, 5].map(id => ({ id, icon: id === 2 ? 'star' : 'wand', load: () => loadDemoFile(id) }))];
export function openDemoMenu(anchor) {
  const was = fxEditing?.demo;
  closeFxEditor();
  if (was) return;
  const box = document.createElement('div');
  box.id = 'fx-editor';
  box.className = 'fx-editor demo-menu';
  box.innerHTML = `<div class="fx-editor-head"><b>${t('demo.menu')}</b><button class="win-close" title="${t('win.close')}">✕</button></div>
    <div class="fx-editor-body">${DEMOS.map(d => `<button class="demo-pick" data-demo="${d.id}" data-icon="${d.icon}"><b>${t(`demo.${d.id}`)}</b><small>${t(`demo.${d.id}.desc`)}</small></button>`).join('')}</div>`;
  box.querySelector('.win-close').addEventListener('click', closeFxEditor);
  for (const b of box.querySelectorAll('.demo-pick')) b.addEventListener('click', () => { closeFxEditor(); DEMOS.find(d => d.id === +b.dataset.demo).load(); });
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, r.left))}px`;
  box.style.top = `${r.bottom + 6}px`;
  setFxEditing({ box, demo: true });
  setTimeout(() => window.addEventListener('pointerdown', fxOutside, true), 0);
}

// Démo 2 : un fichier morceau (.gabber) avec ses prises 909 / 303 et le kick du designer embarqués.
// Démos 2 à 5 : des fichiers morceau (.gabber) ; la 2 embarque ses prises 909 / 303, les autres n'utilisent que la bibliothèque Anthem.
export const loadDemo2 = () => loadDemoFile(2);
export async function loadDemoFile(n) {
  if (state.tl.tracks.some(tr => tr.clips.length || tr.fx.length) && !confirm(t('tl.demoConfirm'))) return;
  const name = `gabberkey-demo-${n}.gabber`;
  const blob = await fetch(`demo/${name}`, { cache: 'no-cache' }).then(r => (r.ok ? r.blob() : null)).catch(() => null);
  if (!blob) { toast(t('lib.loadFail'), 3000); return; }
  await loadFile(new File([blob], name), true);
  // Noms des sons et des effets dans la langue de l'interface.
  refreshLibNames();
  for (const tr of state.tl.tracks) for (const b of tr.fx) {
    const m = FX_BANK.find(x => x.fx === b.fx && Object.entries(x.p ?? {}).every(([k, v]) => b.p[k] === v));
    if (m) b.name = bankName(m);
    if (b.fx === 'curve') b.name = curveName(b.p.curve);
  }
  renderTl();
  save();
}

// Charge le morceau de démonstration (demo/demo.json) dans la timeline, avec les sons de la bibliothèque.
export async function loadDemo() {
  if (state.tl.tracks.some(tr => tr.clips.length) && !confirm(t('tl.demoConfirm'))) return;
  const demo = await fetch('demo/demo.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!demo || !libManifest) { toast(t('lib.loadFail'), 3000); return; }
  if (tlRec) await tlStopRec();
  timeline.stop(true);
  setBpm(demo.bpm);
  const find = (bank, sound) => libManifest.banks.find(b => b.name === bank)?.pads.find(p => p?.name === sound);
  const tracks = Array.from({ length: Math.min(MAX_TRACKS, Math.max(state.tl.tracks.length, demo.tracks.length)) }, newTrack);
  const pending = [];
  demo.tracks.slice(0, tracks.length).forEach((list, i) => {
    for (const e of list) {
      const p = find(e.bank, e.sound);
      if (!p) continue;
      const clip = {
        id: crypto.randomUUID(), start: e.bar * BEATS_PER_BAR, len: e.bars ? e.bars * BEATS_PER_BAR : null,
        sampleId: `lib:${p.file}`, name: soundName(p.name), cat: p.cat, color: catColor(p.cat),
        bpm: p.bpm || 0, loop: p.mode === 2, gain: (e.gain ?? 1) * (demo.gain ?? 1),
      };
      tracks[i].clips.push(clip);
      pending.push(clip);
    }
  });
  await loadBuffers(pending.map(c => c.sampleId));
  for (const clip of pending) if (clip.len === null) clip.len = Math.max(1, Math.ceil(timeline.naturalBeats(clip) - 0.05));
  // Les enregistrements remplacés restent stockés jusqu'au prochain démarrage : « Annuler » peut ramener l'ancienne timeline.
  state.tl.tracks = tracks;
  state.tl.bars = demo.bars;
  state.tl.playhead = 0;
  tlSelect(null, null);
  renderTl();
  renderLibrary();
  save();
  toast(t('tl.demoLoaded', { bpm: demo.bpm }), 5000);
}
