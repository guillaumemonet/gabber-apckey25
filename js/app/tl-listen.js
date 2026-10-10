// Écoute d'un bloc de la timeline (double-clic).
import { t } from '../i18n.js';
import { BEATS_PER_BAR, Timeline } from '../timeline.js';
import { engine, mixer, oscSynth, padKey, state, timeline } from './core.js';
import { presetPatch } from './gen.js';
import { toast } from './misc.js';
import { oscFor } from './osc-ui.js';
import { openRoll } from './roll-ui.js';
import { clipBuffer, ensureBuffer, renderTl } from './tl.js';
import { isFxBlock } from './tl-select.js';
import { openFxEditor } from './trackfx-ui.js';

// ---------- Écoute d'un bloc de la timeline ----------

// Le bloc seul, tel qu'il sonne dans le morceau : au tempo, sur toute sa longueur, avec les potentiomètres de sa piste
// (sans ses effets de piste). Un deuxième appui l'arrête. Elle a sa propre petite timeline : le morceau n'est pas dérangé.
export let tlPrev = null;   // { tl, clipId, start, dur }
export async function tlPreviewClip(track, clip) {
  const again = tlPrev?.clipId === clip.id;
  stopTlPreview();
  if (again) return;
  if (clip.sampleId && !(await ensureBuffer(clip.sampleId))) { toast(t('lib.loadFail'), 3000); return; }
  const beats = timeline.clipBeats(clip);
  const one = { ...clip, id: `prev-${clip.id}`, start: 0 };
  // Longueur = celle du bloc : l'écoute s'arrête pile à sa fin.
  const st = { bars: beats / BEATS_PER_BAR, loop: false, playhead: 0, tracks: [{ ...state.tl.tracks[track], mute: false, clips: [one], fx: [] }] };
  const tl = new Timeline(engine, () => st, clipBuffer, mixer.input('tl'));
  Object.assign(tl, { getPad: timeline.getPad, padKey, getPatch: presetPatch, getOsc: c => oscFor(c, oscSynth), keyPrefix: 'tlp:', warpOf: timeline.warpOf });
  tl.onStop = () => { if (tlPrev?.tl === tl) { tlPrev = null; renderTl(); } };
  const origin = engine.origin;
  tl.play(0);
  if (origin !== null) engine.origin = origin;   // la grille des boucles et de la 909 reste celle du morceau
  tlPrev = { tl, clipId: clip.id, start: engine.ctx.currentTime, dur: (beats * 60) / state.bpm };
  renderTl();
}

export function stopTlPreview() {
  if (!tlPrev) return;
  const { tl } = tlPrev;
  tlPrev = null;
  tl.stop(true);
  renderTl();
}

// Double-clic sur un bloc (détecté à la main : le premier clic redessine la timeline).
export let tlLastTap = { obj: null, t: 0 };
export function tlTap(track, obj) {
  const now = performance.now();
  if (tlLastTap.obj !== obj || now - tlLastTap.t > 380) { tlLastTap = { obj, t: now }; return; }
  tlLastTap = { obj: null, t: 0 };
  if (isFxBlock(obj)) {
    const el = [...document.querySelectorAll('.tl-fx')].find(x => x._obj === obj);
    openFxEditor(track, obj, el ?? document.body);
  } else if (obj.type === 'note') openRoll(obj, true);
  else if (obj.type === 'pad' && state.banks[obj.bank]?.[obj.pad]) engine.playPad(padKey(obj.bank, obj.pad), state.banks[obj.bank][obj.pad], { oneShot: true });
  else tlPreviewClip(track, obj);
}
