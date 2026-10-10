// Piano roll : édition des blocs de notes, écoute du motif.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { clipEvents, mergeNotes, patLen, toSeq } from '../notes.js';
import { OSC_PRESETS } from '../osc.js';
import { PAT_LENGTHS, PianoRoll, ROLL_GRIDS } from '../pianoroll.js';
import { FAMILIES, PRESETS } from '../presets.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, defaultRoll, engine, oscSynth, state, timeline, uiColor, wm } from './core.js';
import { presetPatch } from './gen.js';
import { toast } from './misc.js';
import { oscFor, oscSound } from './osc-ui.js';
import { save } from './save.js';
import { armedTrack, beatPx, growSong, renderTl, tlRec, trackSource } from './tl.js';
import { freeTrack, noteLabel } from './tl-record.js';
import { tlFocus, tlSelect } from './tl-select.js';

// ---------- Piano pianoRoll ----------

// Le piano pianoRoll édite un bloc de notes de la timeline (retrouvé par son identifiant, y compris après « Annuler »).
export function mergeRoll(saved) {
  const r = defaultRoll();
  if (typeof saved?.clip === 'string') r.clip = saved.clip;
  if (ROLL_GRIDS.some(g => Math.abs(g - saved?.grid) < 1e-6)) r.grid = saved.grid;
  r.step = !!saved?.step;
  return r;
}

export let pianoRoll = null;
export let rollPlay = null;   // écoute du motif seul, en boucle : { t0, next, n, offs, timer, bpm }
export const ROLL_GRID_LABELS = ['1/4', '1/8', '1/16', '1/32', '1/8T', '1/16T'];

export function rollFind() {
  const id = state.roll.clip;
  if (!id) return null;
  for (let i = 0; i < state.tl.tracks.length; i++) {
    const clip = state.tl.tracks[i].clips.find(c => c.id === id);
    if (clip) return clip.type === 'note' ? { track: i, clip } : null;
  }
  return null;
}
// Son du bloc édité : { syn, V } (synthé à oscillateurs, ou synthé avec le preset du bloc).
export function rollSound() {
  const c = rollFind()?.clip;
  if (c?.osc) { const o = oscFor(c, oscSynth); return { syn: oscSynth, V: o.values === oscSynth.values ? { ...o.values } : o.values }; }
  return { syn: engine, V: c?.preset ? presetPatch(c.preset) : undefined };
}
export const rollHeld = new Map();   // note écoutée -> synthé qui la joue

// Ouvre un bloc de notes dans le piano pianoRoll (un ancien bloc passe au format du piano pianoRoll sans changer ce qu'il joue).
export function openRoll(clip, show) {
  if (clip.type !== 'note') return;
  const fresh = !clip.seq;
  toSeq(clip);
  if (state.roll.clip !== clip.id) rollStop();
  state.roll.clip = clip.id;
  if (show) wm.toggle('roll', true);
  requestAnimationFrame(() => pianoRoll.fit());
  renderRollBar();
  if (fresh) save();
}

export function buildRoll() {
  pianoRoll = new PianoRoll($('#roll-canvas'), {
    clip: () => rollFind()?.clip ?? null,
    changed: () => { const f = rollFind(); if (f) growSong(f.clip); renderTl(); save(); },
    noteOn: (n, v) => { const s = rollSound(); rollHeld.set(n, s.syn); s.syn.noteOn(n, v, undefined, `roll:${n}`, s.V); },
    noteOff: n => { (rollHeld.get(n) ?? engine).noteOff(n, false, undefined, `roll:${n}`); rollHeld.delete(n); },
    playhead: rollPlayhead,
    color: () => { const c = rollFind()?.clip; return PALETTE[uiColor(c?.color ?? catColor('lead'))]; },
    noteName: noteLabel,
  });
  pianoRoll.grid = state.roll.grid;
  $('#roll-play').addEventListener('click', () => (rollPlay ? rollStop() : rollStart()));
  $('#roll-new').addEventListener('click', rollNew);
  $('#roll-merge').addEventListener('click', rollMerge);
  $('#roll-quant').addEventListener('click', () => pianoRoll.quantize());
  $('#roll-step').addEventListener('click', () => { state.roll.step = !state.roll.step; renderRollBar(); save(); });
  $('#roll-shorter').addEventListener('click', () => rollLength(-1));
  $('#roll-longer').addEventListener('click', () => rollLength(1));
  const grid = $('#roll-grid');
  ROLL_GRIDS.forEach((g, i) => grid.add(new Option(ROLL_GRID_LABELS[i], i)));
  grid.addEventListener('change', () => { pianoRoll.grid = state.roll.grid = ROLL_GRIDS[+grid.value]; pianoRoll.draw(); save(); });
  const preset = $('#roll-preset');
  rollPresetOptions();
  preset.addEventListener('change', () => {
    const f = rollFind();
    if (!f) return;
    delete f.clip.preset;
    delete f.clip.osc;
    if (preset.value.startsWith('osc:')) f.clip.osc = preset.value.slice(4);
    else if (preset.value) f.clip.preset = preset.value;
    rollHeld.clear();
    renderTl();
    save();
  });
  const name = $('#roll-name');
  name.addEventListener('input', () => { const f = rollFind(); if (f) { f.clip.name = name.value || t('roll.clipName'); renderTl(); save(); } });
  // Raccourcis du piano pianoRoll quand sa fenêtre est active (avant ceux de la timeline).
  window.addEventListener('keydown', e => {
    if (wm?.active !== 'roll' || tlFocus || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space' && !e.ctrlKey) { e.preventDefault(); if (rollPlay) rollStop(); else rollStart(); return; }
    if (pianoRoll.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // Tête de lecture (écoute du motif ou lecture de la timeline).
  let wasMoving = false;
  (function frame() {
    const moving = !!(wm?.isOpen('roll') && (rollPlay || timeline.playing));
    if (moving || wasMoving) pianoRoll.draw();
    wasMoving = moving;
    requestAnimationFrame(frame);
  })();
  renderRollBar();
}

export function renderRollBar() {
  const f = rollFind();
  const clip = f?.clip;
  $('#roll-empty').hidden = !!clip;
  for (const id of ['#roll-play', '#roll-preset', '#roll-shorter', '#roll-longer', '#roll-quant', '#roll-merge', '#roll-name']) $(id).disabled = !clip;
  $('#roll-play').textContent = rollPlay ? t('tr.stop') : t('roll.listen');
  $('#roll-play').dataset.icon = rollPlay ? 'stop' : 'play';
  $('#roll-play').classList.toggle('active', !!rollPlay);
  $('#roll-step').classList.toggle('active', state.roll.step);
  $('#roll-grid').value = ROLL_GRIDS.findIndex(g => Math.abs(g - state.roll.grid) < 1e-6);
  const name = $('#roll-name');
  if (document.activeElement !== name) name.value = clip?.name ?? '';
  $('#roll-preset').value = clip?.osc ? `osc:${[...$('#roll-preset').options].some(o => o.value === `osc:${clip.osc}`) ? clip.osc : 'live'}` : clip?.preset && PRESETS.some(p => p.id === clip.preset) ? clip.preset : '';
  const pat = clip ? patLen(clip) : 0;
  $('#roll-len').textContent = clip ? rollLenLabel(pat) : '—';
  $('#roll-where').textContent = clip ? t('roll.where', {
    track: f.track + 1, bar: Math.floor(clip.start / BEATS_PER_BAR) + 1, n: clip.seq?.length ?? 0,
    reps: clip.len > pat + 1e-6 ? t('roll.reps', { n: +(clip.len / pat).toFixed(2) }) : '',
  }) : '';
  pianoRoll.draw();
}

export function rollPresetOptions() {
  const sel = $('#roll-preset');
  if (!sel) return;
  const value = sel.value;
  sel.innerHTML = '';
  sel.add(new Option(t('roll.currentSound'), ''));
  for (const f of FAMILIES) {
    const grp = document.createElement('optgroup');
    grp.label = t(`family.${f}`);
    for (const p of PRESETS.filter(p => p.family === f)) grp.appendChild(new Option(p.name, p.id));
    sel.appendChild(grp);
  }
  const grp = document.createElement('optgroup');
  grp.label = t('win.osc');
  grp.appendChild(new Option(t('osc.live'), 'osc:live'));
  for (const p of OSC_PRESETS) grp.appendChild(new Option(t(`osc.preset.${p.id}`), `osc:${p.id}`));
  for (const u of state.osc.user) grp.appendChild(new Option(`★ ${u.name}`, `osc:${u.id}`));
  sel.appendChild(grp);
  sel.value = value;
}

export const rollLenLabel = beats => (beats === BEATS_PER_BAR ? t('roll.bar1') : beats > BEATS_PER_BAR && beats % BEATS_PER_BAR === 0 ? t('tl.bars', { n: beats / BEATS_PER_BAR }) : t('roll.beats', { n: +beats.toFixed(3) }));

// Longueur du motif : un bloc joué une fois suit sa longueur ; un bloc qui répète le motif garde la sienne.
export function rollLength(dir) {
  const f = rollFind();
  if (!f) return;
  const clip = f.clip;
  const pat = patLen(clip);
  const next = dir > 0 ? PAT_LENGTHS.find(l => l > pat + 1e-6) : [...PAT_LENGTHS].reverse().find(l => l < pat - 1e-6);
  if (!next) return;
  const oneRep = clip.len <= pat + 1e-6;
  clip.pat = next;
  if (oneRep || clip.len < next) clip.len = next;
  growSong(clip);
  renderTl();
  save();
}

// Nouveau bloc vide d'une mesure à la tête de lecture, sur la piste armée (ou la suivante libre).
export function rollNew() {
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const len = BEATS_PER_BAR;
  const sound = state.keys === 'osc' ? { osc: oscSound() } : { preset: state.preset };
  const clip = { id: crypto.randomUUID(), type: 'note', seq: [], pat: len, len, start, ...sound, name: t('roll.clipName'), cat: 'lead', color: catColor('lead'), loop: false };
  const track = freeTrack(start, len);
  state.tl.tracks[track].clips.push(clip);
  growSong(clip);
  tlSelect(track, clip);
  pianoRoll.cursor = 0;
  openRoll(clip, true);
  renderTl();
  save();
}

// Regroupe dans ce bloc les blocs de notes voisins de la même piste (même son, écart d'une mesure au plus).
export function rollMerge() {
  const f = rollFind();
  if (!f) return;
  const list = state.tl.tracks[f.track].clips;
  const same = c => c.type === 'note' && (c.preset || '') === (f.clip.preset || '') && (c.osc || '') === (f.clip.osc || '');
  const group = [f.clip];
  let s = f.clip.start, e = f.clip.start + f.clip.len, grew = true;
  while (grew) {
    grew = false;
    for (const c of list) {
      if (group.includes(c) || !same(c) || c.start > e + BEATS_PER_BAR || c.start + c.len < s - BEATS_PER_BAR) continue;
      group.push(c);
      s = Math.min(s, c.start);
      e = Math.max(e, c.start + c.len);
      grew = true;
    }
  }
  if (group.length === 1) { toast(t('roll.mergeNone'), 3000); return; }
  const start = Math.floor(s / BEATS_PER_BAR) * BEATS_PER_BAR;
  const len = Math.ceil((e - start) / BEATS_PER_BAR - 1e-6) * BEATS_PER_BAR;
  const seq = mergeNotes(group, start);
  for (const c of group.slice(1)) list.splice(list.indexOf(c), 1);
  Object.assign(f.clip, { seq, pat: len, len, start });
  rollStop();
  pianoRoll.fit();
  renderTl();
  save();
  toast(t('roll.merged', { n: group.length }));
}

// Fin d'un enregistrement du synthé : les notes jouées deviennent un seul bloc (à la mesure), prêt pour le piano pianoRoll.
export function mergeTake(notes, events = {}) {
  const all = notes.filter(c => state.tl.tracks.some(tr => tr.clips.includes(c)));
  for (const osc of new Set(all.map(c => c.osc ?? ''))) {
    const home = osc ? events.osc ?? events.synth : events.synth ?? events.osc;
    mergeTakeSound(all.filter(c => (c.osc ?? '') === osc), osc, home ?? armedTrack(), home !== undefined ? trackSource(state.tl.tracks[home]) : null);
  }
}

export function mergeTakeSound(clips, osc, home, src) {
  if (!clips.length) return;
  for (const tr of state.tl.tracks) tr.clips = tr.clips.filter(c => !clips.includes(c));
  const start = Math.floor(Math.min(...clips.map(c => c.start)) / BEATS_PER_BAR) * BEATS_PER_BAR;
  const end = Math.ceil(Math.max(...clips.map(c => c.start + c.len)) / BEATS_PER_BAR - 1e-6) * BEATS_PER_BAR;
  const len = Math.max(BEATS_PER_BAR, end - start);
  const clip = { id: crypto.randomUUID(), type: 'note', seq: mergeNotes(clips, start), pat: len, len, start, name: t('roll.recName'), cat: 'lead', color: catColor('lead'), loop: false, ...(osc ? { osc } : {}) };
  const track = freeTrack(start, len, home, src);
  state.tl.tracks[track].clips.push(clip);
  tlSelect(track, clip);
  if (wm.isOpen('roll')) openRoll(clip, false);
}

// Clavier (APC ou ordinateur) : surligne la note dans le piano pianoRoll ; en saisie pas à pas, l'ajoute au curseur.
export function rollKey(note, velocity, on) {
  if (!pianoRoll || !wm?.isOpen('roll')) return;
  pianoRoll.setHeld(note, on);
  if (state.roll.step && wm.active === 'roll' && !tlRec && rollFind()) pianoRoll.stepNote(note, velocity, on);
}

export function rollPlayhead() {
  const f = rollFind();
  if (!f) return null;
  const pat = patLen(f.clip);
  if (rollPlay) {
    const b = (engine.ctx.currentTime - rollPlay.t0) * rollPlay.bpm / 60;
    return b < 0 ? null : b % pat;
  }
  if (!timeline.playing) return null;
  const p = timeline.position() - f.clip.start;
  return p < 0 || p >= f.clip.len ? null : p % pat;
}

// Écoute du motif seul, en boucle, programmée un peu en avance.
export function rollStart() {
  if (!rollFind()) return;
  rollStop();
  rollPlay = { t0: engine.ctx.currentTime + 0.06, next: 0, n: 0, offs: [], bpm: state.bpm };
  rollPlay.timer = setInterval(rollTick, 25);
  rollTick();
  renderRollBar();
}

export function rollTick() {
  const f = rollFind();
  if (!f || !rollPlay) { rollStop(); return; }
  const clip = f.clip;
  const pat = patLen(clip);
  const now = engine.ctx.currentTime;
  if (rollPlay.bpm !== state.bpm) {   // changement de tempo : la position actuelle est gardée
    const b = (now - rollPlay.t0) * rollPlay.bpm / 60;
    rollPlay.bpm = state.bpm;
    rollPlay.t0 = now - b * 60 / state.bpm;
  }
  const bd = 60 / state.bpm;
  const until = (now + 0.12 - rollPlay.t0) / bd;
  const { syn, V } = rollSound();
  while (pat > 0 && rollPlay.next < until) {
    const from = rollPlay.next;
    const base = Math.floor(from / pat + 1e-9) * pat;
    const to = Math.min(until, base + pat);
    for (const n of clip.seq ?? []) {
      const at = base + n.t;
      if (n.t >= pat - 1e-6 || at < from - 1e-9 || at >= to - 1e-9) continue;
      const key = `rollp:${rollPlay.n++}`;
      const when = rollPlay.t0 + at * bd;
      syn.noteOn(n.note, n.vel ?? 0.85, when, key, V);
      rollPlay.offs.push({ note: n.note, key, time: when + n.len * bd - 0.005, syn });
    }
    rollPlay.next = to;
  }
  rollPlay.offs.sort((a, b) => a.time - b.time);
  while (rollPlay.offs.length && rollPlay.offs[0].time < now + 0.1) {
    const o = rollPlay.offs.shift();
    o.syn.noteOff(o.note, false, o.time, o.key);
  }
}

export function rollStop() {
  if (!rollPlay) return;
  clearInterval(rollPlay.timer);
  for (const o of rollPlay.offs) o.syn.noteOff(o.note, true, undefined, o.key);
  rollPlay = null;
  if (pianoRoll) renderRollBar();
}

// Notes d'un bloc dessinées dans la timeline (motif répété marqué comme une boucle).
export function drawNoteClip(g, clip, w, h) {
  const ev = clipEvents(clip);
  if (!ev.length) return;
  const bp = beatPx();
  const lo = Math.min(...ev.map(e => e.note));
  const hi = Math.max(...ev.map(e => e.note));
  const top = 14, span = h - top - 3;
  const row = Math.min(4, span / (hi - lo + 1));
  const y0 = top + (span - row * (hi - lo + 1)) / 2;
  g.fillStyle = 'rgba(255,255,255,.8)';
  for (const e of ev) g.fillRect(e.t * bp, y0 + (hi - e.note) * row, Math.max(1.5, e.len * bp - 1), Math.max(1.5, row - 0.5));
  const pat = patLen(clip);
  if (clip.seq && clip.len > pat + 1e-6) {
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = pat * bp; x < w; x += pat * bp) g.fillRect(Math.round(x), 0, 1, h);
  }
}
