// Timeline : enregistrement, pistes, blocs, dessin, temps de lecture.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { catColor } from '../library.js';
import { toPos, toValue } from '../params.js';
import { presetById } from '../presets.js';
import { Recorder, encodeWav } from '../recorder.js';
import * as store from '../storage.js';
import { BEATS_PER_BAR, MAX_INSERTS, MAX_TRACKS, MIN_TRACKS, REC_SOURCES, TRACK_DEFAULTS, newTrack, trackAudible } from '../timeline.js';
import { renderAcid } from './acid-ui.js';
import { renderLeds } from './controller.js';
import { $, acid, drum, engine, metro, mixer, state, timeline, uiColor, wm } from './core.js';
import { openDemoMenu } from './demo.js';
import { exportSong, songEndBeats } from './export.js';
import { BUS_COLORS, BUS_LETTERS, busName, renderBuses } from './buses-ui.js';
import { openClipMenu } from './clip-menu.js';
import { renderMarkers } from './markers.js';
import { fxOptions, renderInsertRack } from './inserts-ui.js';
import { arcPath } from './knobs.js';
import { renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { oscPresetName } from './osc-ui.js';
import { drawNoteClip, mergeTake, openRoll, pianoRoll, renderRollBar } from './roll-ui.js';
import { save } from './save.js';
import { bufferCache, loadPads, loadSound, padsInUse } from './sounds.js';
import { stopTlPreview, tlPrev, tlPreviewClip } from './tl-listen.js';
import { growHeldNote, lastRecRender, setLastRecRender } from './tl-record.js';
import { setTlFocus, tlGroupDown, tlKey, tlLaneDown, tlPicked, tlSelect } from './tl-select.js';
import { renderTr } from './tr909-ui.js';
import { FX_ROW, closeFxEditor, fxEditing, fxEl, fxOutside, fxRows, setFxEditing } from './trackfx-ui.js';

// ---------- Timeline (écran principal, façon eJay) ----------

// Pads et synthé : blocs posés en jouant ; TR-909 : enregistrement audio.
export const TL_SOURCES = REC_SOURCES;   // pads, synthé, synthé à oscillateurs, TR-909, TB-303, platines
export const peaksCache = new Map();    // sampleId -> crêtes pour dessiner la forme d'onde
export let tlRecorder = null;
export let tlRec = null;                // enregistrement en cours : { beat, time, events, audio, open, notes, startedDrum, startedAcid, bpm }
export let tlSel = null;                // bloc sélectionné : { track, clip }

export const TL_HEAD = 204;   // largeur des en-têtes de piste (px) : la 1re colonne de .tl dans css/style.css
export const beatPx = () => state.tl.zoom / BEATS_PER_BAR;
export const snapBeat = (v, fine) => (fine ? Math.round(v) : Math.round(v / BEATS_PER_BAR) * BEATS_PER_BAR);

// Buffer d'un son : cache, sinon pad qui utilise ce son.
export function clipBuffer(sampleId) {
  if (!sampleId) return null;   // blocs de notes du synthé : pas de son
  if (bufferCache.has(sampleId)) return bufferCache.get(sampleId);
  const pad = state.banks.flat().find(p => p?.sampleId === sampleId && p.buffer);
  if (pad) bufferCache.set(sampleId, pad.buffer);
  return pad?.buffer ?? null;
}

// Charge des sons (js/app/sounds.js), sauf ceux déjà décodés pour un pad.
export async function loadBuffers(ids) {
  await Promise.all([...new Set(ids)].map(id => (clipBuffer(id) ? null : loadSound(id))));
}
// Sons de la timeline : blocs de son, pads joués par les blocs de pads, sons créés dans l'application.
export const loadTlBuffers = () => Promise.all([
  loadBuffers([...state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)), ...state.userSounds.map(s => s.sampleId)].filter(Boolean)),
  loadPads(padsInUse()),
]);
export async function ensureBuffer(id) { if (!clipBuffer(id)) await loadBuffers([id]); return clipBuffer(id); }

export function tlToggle() {
  if (tlRec) return tlStopRec();
  stopTlPreview();
  try {
    if (timeline.playing) timeline.stop(); else timeline.play(state.tl.playhead);
  } finally {   // le bouton et la tête de lecture suivent toujours l'état réel
    renderTl();
    renderLeds();
  }
}
export let countingIn = false;   // décompte du métronome en cours (le REC attend)
export const tlRecToggle = () => (countingIn ? null : tlRec ? tlStopRec() : tlStartRec());

// Point de captation de l'outil enregistré (après son fader, avant le master).
export function tlSourceNode(source) {
  return source === 'master' ? engine.output : mixer.strips[source].mute;
}

// Pistes armées et l'instrument que chacune enregistre (le sien, sinon le choix « Enregistrer » de la barre).
export const AUDIO_SOURCES = new Set(['tr', 'acid', 'decks']);
export const trackSource = tr => tr.src || state.tl.source;
export const armedTrack = () => Math.max(0, state.tl.tracks.findIndex(tr => tr.arm));

// Enregistrement : chaque piste armée enregistre son instrument, toutes en même temps.
// Pads / synthés : chaque coup ou note devient un bloc, en direct ; TR-909 / TB-303 / platines : audio.
export async function tlStartRec() {
  if (timeline.playing) timeline.stop(true);
  const targets = state.tl.tracks.map((tr, i) => ({ track: i, src: trackSource(tr), arm: tr.arm })).filter(x => x.arm);
  if (!targets.length) { toast(t('tl.noArmed'), 3500); return; }
  const events = {};
  for (const x of targets) if (!AUDIO_SOURCES.has(x.src) && events[x.src] === undefined) events[x.src] = x.track;
  const audio = [];
  for (const x of targets) if (AUDIO_SOURCES.has(x.src) && !audio.some(r => r.source === x.src)) audio.push({ source: x.src, track: x.track, kicks: [] });
  for (const r of audio) { r.recorder = new Recorder(engine.ctx, tlSourceNode(r.source)); await r.recorder.start(); }
  if (state.metro.on && state.metro.countIn) {   // une mesure de décompte avant de lancer l'enregistrement
    countingIn = true;
    renderLeds();
    const end = metro.countIn();
    await new Promise(r => setTimeout(r, Math.max(0, (end - engine.ctx.currentTime - 0.08) * 1000)));
    countingIn = false;
  }
  const beat = Math.round(state.tl.playhead);
  timeline.recording = audio.length > 0;   // l'audio s'enregistre d'un trait (sans boucle)
  const time = timeline.play(beat);
  let startedDrum = false, startedAcid = false;
  const has = src => audio.some(r => r.source === src);
  if (has('tr') && !drum.running) { drum.start(true); startedDrum = true; }   // la 909 joue calée sur la timeline
  if (has('acid') && !acid.playing) { if (state.acid.link) { if (!drum.running) { drum.start(true); startedDrum = true; } } else acid.start(true); startedAcid = true; }
  tlRec = { beat, time, events, audio, open: new Map(), notes: [], dirty: false, startedDrum, startedAcid, bpm: state.bpm };
  renderTl();
  renderTr();
  renderLeds();
}

export async function tlStopRec() {
  const rec = tlRec;
  if (!rec) return;
  for (const clip of rec.open.values()) growHeldNote(clip);
  tlRec = null;
  timeline.recording = false;
  const raws = [];
  for (const r of rec.audio) raws.push(await r.recorder.stopRaw().catch(() => null));
  timeline.stop(true);
  if (rec.startedDrum) drum.stop();
  if (rec.startedAcid) acid.stop();
  renderAcid();
  try { mergeTake(rec.notes, rec.events); } catch (err) { console.warn('Take', err); }
  rec.audio.forEach((r, k) => { if (raws[k]) saveAudioTake(rec, r, raws[k]); });
  for (const tr of state.tl.tracks) for (const c of tr.clips) growSong(c);
  renderLibrary();
  save();
  renderTl();
  renderTr();
  renderLeds();
}

// Une prise audio devient un bloc sur sa piste (et un son de la rubrique Enregistrements).
export async function saveAudioTake(rec, r, raw) {
  const sr = raw.sampleRate;
  // Retire ce qui a été capté avant le temps de départ.
  const skip = Math.max(0, Math.round((rec.time - raw.startedAt) * sr));
  const chans = raw.channels.map(c => c.subarray(skip));
  if (chans[0].length <= sr * 0.05) return;
  const buffer = engine.ctx.createBuffer(2, chans[0].length, sr);
  chans.forEach((c, i) => buffer.copyToChannel(c, i));
  const id = `rec:${crypto.randomUUID()}`;
  const n = state.tl.tracks.flatMap(tr => tr.clips).filter(c => c.sampleId?.startsWith('rec:')).length + 1;
  const name = `${t(`tl.src.${r.source}`)} ${n}`;
  bufferCache.set(id, buffer);
  const len = Math.max(1, Math.round(buffer.duration * rec.bpm / 60));
  const clip = { id: crypto.randomUUID(), start: rec.beat, len, sampleId: id, name, cat: 'rec', color: catColor('rec'), bpm: rec.bpm, loop: false };
  const kicks = r.kicks.map(k => (k - rec.time) * rec.bpm / 60).filter(k => k >= 0 && k < len);
  if (kicks.length) clip.kickBeats = kicks.map(k => Math.round(k * 1000) / 1000);   // sidechain
  state.tl.tracks[r.track].clips.push(clip);
  growSong(clip);
  tlSelect(r.track, clip);
  renderTl();
  await store.saveSample(id, { name, data: encodeWav(chans, sr) });
  renderLibrary();
  save();
}

export function growSong(clip) {
  state.tl.bars = Math.max(state.tl.bars, Math.ceil((clip.start + clip.len) / BEATS_PER_BAR));
}

// Pose un son de la bibliothèque : une boucle occupe ses mesures, un son court sa durée arrondie au temps.
export async function tlPlaceItem(item, track, beat) {
  const buf = await ensureBuffer(item.sampleId);
  if (!buf) { toast(t('lib.loadFail'), 3000); return; }
  const natural = item.bpm ? buf.duration * item.bpm / 60 : buf.duration / timeline.beatDur;
  const len = item.loop ? (item.bars ? item.bars * BEATS_PER_BAR : Math.max(BEATS_PER_BAR, snapBeat(natural))) : Math.max(1, Math.ceil(natural - 0.05));
  const clip = { id: crypto.randomUUID(), start: beat, len, sampleId: item.sampleId, name: item.name, cat: item.cat, color: catColor(item.cat), bpm: item.bpm, loop: item.loop };
  state.tl.tracks[track].clips.push(clip);
  growSong(clip);
  tlSelect(track, clip);
  renderTl();
  save();
}

export function tlDelete(track, clip) {
  const list = state.tl.tracks[track].clips;
  list.splice(list.indexOf(clip), 1);
  // Un enregistrement qui ne sert plus reste stocké jusqu'au prochain démarrage (voir cleanRecordings) : « Annuler » peut le ramener.
  if (clip.sampleId?.startsWith('rec:')) renderLibrary();
  if (tlSel?.clip === clip) tlSel = null;
  tlPicked.delete(clip);
  renderTl();
  save();
}

// Case visée sous la souris : { track, beat } (calée à la mesure, au temps avec Maj).
export function tlTarget(ev) {
  const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
  if (!lane) return null;
  const r = lane.getBoundingClientRect();
  const raw = (ev.clientX - r.left) / beatPx();
  const beat = ev.shiftKey ? Math.floor(raw) : Math.floor(raw / BEATS_PER_BAR) * BEATS_PER_BAR;
  return { track: +lane.dataset.track, beat: Math.max(0, beat), lane };
}

export function buildTl() {
  $('#tl-play').addEventListener('click', tlToggle);
  $('#tl-demo').addEventListener('click', e => openDemoMenu(e.currentTarget));
  $('#tl-export').addEventListener('click', () => exportSong(false));
  $('#tl-stems').addEventListener('click', () => exportSong(true));
  $('#tl-rec').addEventListener('click', tlRecToggle);
  $('#tl-loop').addEventListener('click', () => { state.tl.loop = !state.tl.loop; renderTl(); save(); });
  $('#tl-less').addEventListener('click', () => { state.tl.bars = Math.max(4, state.tl.bars - 4); renderTl(); save(); });
  $('#tl-more').addEventListener('click', () => { state.tl.bars = Math.min(256, state.tl.bars + 4); renderTl(); save(); });
  $('#tl-zoom-in').addEventListener('click', () => { state.tl.zoom = Math.min(240, state.tl.zoom * 1.25); renderTl(); save(); });
  $('#tl-zoom-out').addEventListener('click', () => { state.tl.zoom = Math.max(16, state.tl.zoom / 1.25); renderTl(); save(); });
  const sel = $('#tl-source');
  sel.innerHTML = TL_SOURCES.map(s => `<option value="${s}">${t(`tl.src.${s}`)}</option>`).join('');
  sel.addEventListener('change', () => { state.tl.source = sel.value; save(); });

  const grid = $('#tl-grid');
  grid.innerHTML = '<div class="tl-corner"></div><div class="tl-ruler" id="tl-ruler"></div>';
  $('#tl-ruler').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    state.tl.playhead = Math.max(0, Math.min(timeline.length - 1, snapBeat((e.clientX - r.left) / beatPx() - (e.shiftKey ? 0.5 : 2), e.shiftKey)));
    if (timeline.playing && !tlRec) timeline.play(state.tl.playhead);
    save();
  });
  const line = document.createElement('div');
  line.className = 'tl-playhead';
  line.id = 'tl-playhead';
  grid.appendChild(line);
  buildTrackRows();
  $('#tl-tracks-less').addEventListener('click', tlRemoveTrack);
  $('#tl-tracks-more').addEventListener('click', tlAddTrack);
  window.addEventListener('keydown', e => {
    tlKey(e);
    if (e.key === 'Escape') closeFxEditor();
  });
  // Les raccourcis (Suppr, Ctrl+C / V…) vont à la timeline quand on vient de cliquer dedans.
  document.addEventListener('pointerdown', e => { setTlFocus(!!e.target.closest?.('#timeline, #library')); }, true);
  timeline.onStop = () => { renderTl(); renderLeds(); };
  const scroll = $('#tl-scroll');
  (function frame() {
    if (tlRec) {
      for (const clip of tlRec.open.values()) growHeldNote(clip);
      if ((tlRec.dirty || tlRec.open.size) && performance.now() - lastRecRender > 100) { tlRec.dirty = false; setLastRecRender(performance.now()); renderTl(); }
    }
    const pos = timeline.position();
    renderTlTime(pos);
    const x = TL_HEAD + pos * beatPx();
    line.style.left = `${x}px`;
    // Pendant la lecture, la vue suit la tête de lecture.
    if (timeline.playing && (x > scroll.scrollLeft + scroll.clientWidth - 60 || x < scroll.scrollLeft + TL_HEAD)) scroll.scrollLeft = x - 200;
    requestAnimationFrame(frame);
  })();
  renderTl();
}

// Une ligne par piste : en-tête (nom, armer, muet, potentiomètres) et couloir des blocs.
export function buildTrackRows() {
  const grid = $('#tl-grid');
  for (const el of grid.querySelectorAll('.tl-head, .tl-lane')) el.remove();
  const line = $('#tl-playhead');
  state.tl.tracks.forEach((_, i) => {
    const head = document.createElement('div');
    head.className = 'tl-head';
    head.innerHTML = `<i class="tl-src" hidden></i><span class="tl-name" title="${t('tl.renameTitle')}"></span><b class="tl-bus" hidden></b><button class="tl-knobs icon-only" data-icon="dial" title="${t('tl.knobs')}" aria-label="${t('tl.knobs')}"></button><button class="tl-arm" title="${t('tl.arm')}">●</button><button class="tl-mute" title="${t('mix.mute')}">M</button><button class="tl-solo" title="${t('tl.soloTitle')}">S</button>`;
    head.querySelector('.tl-name').addEventListener('dblclick', e => renameTrack(i, e.currentTarget));
    head.querySelector('.tl-arm').addEventListener('click', () => { const tr = state.tl.tracks[i]; tr.arm = !tr.arm; renderTl(); save(); });
    head.querySelector('.tl-mute').addEventListener('click', () => { state.tl.tracks[i].mute = !state.tl.tracks[i].mute; timeline.updateMutes(); renderTl(); save(); });
    head.querySelector('.tl-solo').addEventListener('click', () => { state.tl.tracks[i].solo = !state.tl.tracks[i].solo; timeline.updateMutes(); renderTl(); save(); });
    head.querySelector('.tl-knobs').addEventListener('click', e => openTrackKnobs(i, e.currentTarget));
    const lane = document.createElement('div');
    lane.className = 'tl-lane';
    lane.dataset.track = i;
    const fxLane = document.createElement('div');
    fxLane.className = 'tl-fxlane';
    fxLane.title = t('tfx.laneTitle');
    lane.appendChild(fxLane);
    // Clic dans une case vide : pose le dernier son choisi dans la bibliothèque.
    lane.addEventListener('pointerdown', e => {
      if ((e.target !== lane && !e.target.classList.contains('tl-fxlane')) || e.button !== 0) return;
      tlLaneDown(e);
    });
    grid.insertBefore(head, line);
    grid.insertBefore(lane, line);
  });
}

// Ajouter / retirer une piste (la dernière ; une piste qui contient des blocs demande confirmation, et « Annuler » la ramène).
export function tlAddTrack() {
  if (state.tl.tracks.length >= MAX_TRACKS) { toast(t('tl.tracksMax', { n: MAX_TRACKS }), 3000); return; }
  state.tl.tracks.push(newTrack());
  renderTl();
  save();
  const scroll = $('#tl-scroll');
  scroll.scrollTop = scroll.scrollHeight;
}

export function tlRemoveTrack() {
  const tracks = state.tl.tracks;
  if (tracks.length <= MIN_TRACKS) return;
  const last = tracks[tracks.length - 1];
  if ((last.clips.length || last.fx.length) && !confirm(t('tl.trackDelConfirm', { n: tracks.length }))) return;
  if (tlRec) return;
  timeline.stop(true);
  tracks.pop();
  tlSelect(null, null);
  closeFxEditor();
  renderTl();
  save();
}

// Potentiomètres d'une piste : un petit panneau sous son bouton (tourner = glisser verticalement ou molette, double-clic = défaut).
export const TRACK_KNOBS = [
  { id: 'vol', min: 0, max: 1.5, def: 1, fmt: v => `${Math.round(v * 100)}%` },
  { id: 'pan', min: -1, max: 1, def: 0, fmt: v => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `${t('fmt.left')}${Math.round(-v * 100)}` : `${t('fmt.right')}${Math.round(v * 100)}`) },
  { id: 'lp', min: 200, max: 20000, def: 20000, curve: 'exp', fmt: v => (v >= 19900 ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}Hz`) },
  { id: 'hp', min: 20, max: 2000, def: 20, curve: 'exp', fmt: v => (v <= 20.5 ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}Hz`) },
  { id: 'dly', min: 0, max: 1, def: 0, fmt: v => `${Math.round(v * 100)}%` },
  { id: 'rev', min: 0, max: 1, def: 0, fmt: v => `${Math.round(v * 100)}%` },
];
export const trackTouched = tr => tr.inserts?.length > 0 || TRACK_KNOBS.some(d => Math.abs((tr[d.id] ?? d.def) - d.def) > 1e-6);

export function openTrackKnobs(i, anchor) {
  const was = fxEditing?.track === i;
  closeFxEditor();
  if (was) return;   // second clic sur le même bouton : fermer
  const tr = state.tl.tracks[i];
  const box = document.createElement('div');
  box.id = 'fx-editor';
  box.className = 'fx-editor track-knobs';
  box.innerHTML = `<div class="fx-editor-head"><b></b><button class="win-close" title="${t('win.close')}">✕</button></div>
    <div class="track-meta">
      <label>${t('tl.trackName')}<input class="tk-name" maxlength="24" spellcheck="false"></label>
      <label>${t('tl.trackSrc')}<select class="tk-src"></select></label>
      <label>${t('tl.trackBus')}<select class="tk-bus"></select></label>
      <div class="tk-colors"><span>${t('tl.trackColor')}</span></div>
    </div>
    <div class="mini-knobs track-knob-row"></div><div class="row track-knob-foot"><button class="tk-reset" data-icon="reset">${t('tl.knobsReset')}</button></div>
    <div class="track-inserts"><div class="tk-ins-head"><span>${t('tl.inserts')}</span><select class="fx-add"><option value="">${t('mix.addFx')}</option>${fxOptions()}</select></div><div class="fx-list"></div></div>`;
  box.querySelector('.win-close').addEventListener('click', closeFxEditor);
  const title = () => { box.querySelector('b').textContent = `${trackName(i)} · ${t('tl.knobs')}`; };
  title();
  const nameIn = box.querySelector('.tk-name');
  nameIn.value = tr.name;
  nameIn.placeholder = t('tl.track', { n: i + 1 });
  nameIn.addEventListener('input', () => { tr.name = nameIn.value.slice(0, 24); title(); renderTrackHeads(); });
  nameIn.addEventListener('change', () => { tr.name = nameIn.value.trim().slice(0, 24); save(); });
  nameIn.addEventListener('keydown', e => e.stopPropagation());
  const srcSel = box.querySelector('.tk-src');
  srcSel.add(new Option(t('tl.srcAuto', { src: t(`tl.src.${state.tl.source}`) }), ''));
  for (const src of REC_SOURCES) srcSel.add(new Option(t(`tl.src.${src}`), src));
  srcSel.value = tr.src || '';
  srcSel.addEventListener('change', () => { tr.src = srcSel.value || null; renderTrackHeads(); save(); });
  const busSel = box.querySelector('.tk-bus');
  busSel.add(new Option(t('bus.none'), ''));
  BUS_LETTERS.forEach((l, b) => busSel.add(new Option(busName(b), b)));
  busSel.value = tr.bus ?? '';
  busSel.addEventListener('change', () => {
    tr.bus = busSel.value === '' ? null : +busSel.value;
    timeline.routeTrack(i);
    timeline.updateMutes();
    renderTl();
    renderBuses();
    save();
  });
  const colors = box.querySelector('.tk-colors');
  for (const c of [null, ...TRACK_COLORS]) {
    const b = document.createElement('button');
    b.className = 'tk-color' + (c ? '' : ' none');
    b.style.setProperty('--c', c || 'transparent');
    b.title = c ? c : t('tl.noColor');
    b.classList.toggle('active', (tr.color || null) === c);
    b.addEventListener('click', () => {
      tr.color = c;
      for (const x of colors.querySelectorAll('.tk-color')) x.classList.toggle('active', x === b);
      renderTl();
      save();
    });
    colors.appendChild(b);
  }
  const row = box.querySelector('.track-knob-row');
  const render = [];
  const changed = () => { timeline.updateTrack(i); render.forEach(f => f()); renderTrackHeads(); };
  for (const d of TRACK_KNOBS) {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label">${t(`tl.k.${d.id}`)}</div>`;
    const pos = () => toPos(d, tr[d.id] ?? d.def);
    const set = p => { tr[d.id] = +toValue(d, Math.min(1, Math.max(0, p))).toFixed(4); changed(); };
    const draw = () => {
      const p = d.id === 'pan' ? pos() : pos();
      el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
      el.querySelector('.value').textContent = d.fmt(tr[d.id] ?? d.def);
    };
    render.push(draw);
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      set(pos() + (lastY - e.clientY) * (e.shiftKey ? 0.0012 : 0.005));
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { if (lastY !== null) save(); lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); set(pos() + (e.deltaY < 0 ? 0.02 : -0.02)); save(); }, { passive: false });
    el.addEventListener('dblclick', () => { tr[d.id] = d.def; changed(); save(); });
    row.appendChild(el);
  }
  box.querySelector('.tk-reset').addEventListener('click', () => { Object.assign(tr, TRACK_DEFAULTS); changed(); save(); });
  // Effets d'insert de la piste : toujours actifs (les blocs d'effet, eux, n'agissent que pendant leur durée).
  renderInsertRack(box.querySelector('.track-inserts .fx-list'), box.querySelector('.track-inserts .fx-add'), () => tr.inserts,
    { max: MAX_INSERTS, rebuild: () => { timeline.rebuildInserts(i); renderTrackHeads(); }, update: k => timeline.updateInsert(i, k) });
  render.forEach(f => f());
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left))}px`;
  box.style.top = `${r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
  setFxEditing({ box, track: i });
  setTimeout(() => window.addEventListener('pointerdown', fxOutside, true), 0);
}

export const trackName = i => state.tl.tracks[i]?.name || t('tl.track', { n: i + 1 });
export const SRC_ICONS = { pads: 'pads', synth: 'keys', osc: 'osc', tr: 'tr', acid: 'acid', decks: 'decks' };
// Couleurs de fond des pistes.
export const TRACK_COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#6e56cf', '#d6409f', '#8d8d86'];

// Renommer une piste : un champ à la place du nom (Entrée = valider, Échap = annuler, vide = nom par défaut).
export function renameTrack(i, el) {
  const tr = state.tl.tracks[i];
  const input = document.createElement('input');
  input.className = 'tl-rename';
  input.maxLength = 24;
  input.value = tr.name;
  input.placeholder = t('tl.track', { n: i + 1 });
  el.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = ok => {
    if (done) return;
    done = true;
    if (ok) { tr.name = input.value.trim().slice(0, 24); save(); }
    input.replaceWith(el);
    renderTrackHeads();
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
}

// En-têtes : nom, instrument enregistré, armée, muette, potentiomètres touchés (le bouton s'allume), couleur.
export function renderTrackHeads() {
  $('#tl-grid').querySelectorAll('.tl-head').forEach((h, i) => {
    const tr = state.tl.tracks[i];
    if (!tr) return;
    const name = h.querySelector('.tl-name');
    if (name) name.textContent = trackName(i);
    const src = h.querySelector('.tl-src');
    src.hidden = !tr.src;
    if (tr.src) { src.dataset.icon = SRC_ICONS[tr.src]; src.title = t('tl.recordsThis', { src: t(`tl.src.${tr.src}`) }); }
    h.style.setProperty('--tc', tr.color || 'transparent');
    h.classList.toggle('colored', !!tr.color);
    h.querySelector('.tl-arm').classList.toggle('active', tr.arm);
    h.querySelector('.tl-mute').classList.toggle('active', tr.mute);
    h.querySelector('.tl-solo').classList.toggle('active', !!tr.solo);
    const bus = h.querySelector('.tl-bus');
    bus.hidden = tr.bus === null || tr.bus === undefined;
    if (!bus.hidden) { bus.textContent = BUS_LETTERS[tr.bus]; bus.style.setProperty('--bc', BUS_COLORS[tr.bus]); bus.title = t('tl.inBus', { bus: busName(tr.bus) }); }
    const k = h.querySelector('.tl-knobs');
    k.classList.toggle('active', trackTouched(tr));
    k.classList.toggle('open', fxEditing?.track === i);
  });
}

// Temps de lecture : temps écoulé depuis le début du morceau, mesure.temps, durée totale (fin du dernier bloc).
export let tlTimeKey = '';
export let tlSongBeats = 0;
export const fmtTime = (s, tenths) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}${tenths ? `.${Math.floor((s * 10) % 10)}` : ''}`;
export function renderTlTime(pos) {
  const bd = 60 / state.bpm;
  const key = `${Math.floor(pos * bd * 10)}|${Math.floor(pos)}|${tlSongBeats}|${state.bpm}`;
  if (key === tlTimeKey) return;
  tlTimeKey = key;
  const el = $('#tl-time');
  el.querySelector('b').textContent = fmtTime(pos * bd, true);
  el.querySelector('small').textContent = `${Math.floor(pos / BEATS_PER_BAR) + 1}.${Math.floor(pos % BEATS_PER_BAR) + 1}`;
  el.querySelector('em').textContent = `/ ${fmtTime(tlSongBeats * bd, false)}`;
}

export function renderTl() {
  tlSongBeats = songEndBeats();
  const st = state.tl;
  const grid = $('#tl-grid');
  if (!grid.querySelector('.tl-ruler')) return;
  if (grid.querySelectorAll('.tl-lane').length !== st.tracks.length) buildTrackRows();
  const lanes = [...grid.querySelectorAll('.tl-lane')];
  const bp = beatPx();
  grid.style.setProperty('--beat', `${bp}px`);
  grid.style.setProperty('--bar', `${st.zoom}px`);
  grid.style.setProperty('--w', `${st.bars * st.zoom}px`);
  const every = st.zoom < 30 ? 4 : st.zoom < 50 ? 2 : 1;
  $('#tl-ruler').innerHTML = Array.from({ length: st.bars }, (_, b) => (b % every ? '' : `<span style="left:${b * st.zoom}px">${b + 1}</span>`)).join('');
  renderMarkers();
  $('#tl-bars').textContent = t('tl.bars', { n: st.bars });
  $('#tl-source').value = st.source;
  $('#tl-loop').classList.toggle('active', st.loop);
  const play = $('#tl-play');
  play.textContent = timeline.playing && !tlRec ? t('tr.stop') : t('tr.play');
  play.dataset.icon = timeline.playing && !tlRec ? 'stop' : 'play';
  play.classList.toggle('active', timeline.playing && !tlRec);
  const rec = $('#tl-rec');
  rec.textContent = tlRec ? t('tl.recStop') : t('tl.rec');
  rec.dataset.icon = tlRec ? 'stop' : 'rec';
  rec.classList.toggle('active', !!tlRec);
  renderTrackHeads();
  $('#tl-tracks').textContent = t('tl.tracks', { n: st.tracks.length });
  $('#tl-tracks-less').disabled = st.tracks.length <= MIN_TRACKS;
  $('#tl-tracks-more').disabled = st.tracks.length >= MAX_TRACKS;
  lanes.forEach((lane, i) => {
    lane.classList.toggle('muted', !trackAudible(st.tracks, i, st.buses));
    lane.style.setProperty('--tc', st.tracks[i].color || 'transparent');
    lane.classList.toggle('colored', !!st.tracks[i].color);
    lane.querySelectorAll('.tl-clip').forEach(c => c.remove());
    for (const clip of st.tracks[i].clips) lane.appendChild(clipEl(i, clip));
    const fxLane = lane.querySelector('.tl-fxlane');
    fxLane.innerHTML = '';
    const { rows, count } = fxRows(st.tracks[i].fx);
    fxLane.style.height = `${count * FX_ROW}px`;
    lane.style.height = `${38 + count * FX_ROW}px`;
    for (const b of st.tracks[i].fx) fxLane.appendChild(fxEl(i, b, rows.get(b)));
  });
  if (pianoRoll) renderRollBar();
}

export function peaks(sampleId) {
  if (peaksCache.has(sampleId)) return peaksCache.get(sampleId);
  const buf = clipBuffer(sampleId);
  if (!buf) return null;
  const data = buf.getChannelData(0);
  const n = 400;
  const step = Math.max(1, Math.floor(data.length / n));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * step; j < (i + 1) * step && j < data.length; j += 8) m = Math.max(m, Math.abs(data[j]));
    out[i] = m;
  }
  peaksCache.set(sampleId, out);
  return out;
}

// Forme d'onde du bloc ; une boucle est redessinée à chaque répétition.
export function drawClip(cv, clip) {
  const w = cv.width = Math.max(1, Math.floor(cv.clientWidth));
  const h = cv.height = Math.max(1, Math.floor(cv.clientHeight));
  const g = cv.getContext('2d');
  if (clip.type === 'note') { drawNoteClip(g, clip, w, h); return; }
  const p = peaks(clip.sampleId);
  if (!p) return;
  const natural = timeline.naturalBeats(clip) * beatPx();
  const bp = beatPx();
  const fi = (clip.fadeIn ?? 0) * bp, fo = (clip.fadeOut ?? 0) * bp;
  const level = Math.min(2, clip.gain ?? 1);
  g.fillStyle = 'rgba(0,0,0,.4)';
  const offPx = (clip.offset ?? 0) * bp;   // bloc coupé : la forme d'onde commence plus loin dans le son
  for (let x = 0; x < w; x++) {
    const xs = x + offPx;
    let pos = clip.loop ? (xs % natural) / natural : xs / natural;
    if (pos >= 1) break;
    if (clip.reverse) pos = 1 - pos - 1e-9;
    const fade = (fi ? Math.min(1, x / fi) : 1) * (fo ? Math.min(1, (w - x) / fo) : 1);
    const bar = Math.max(1, Math.min(1, p[Math.floor(pos * p.length)] * level * fade) * h * 0.9);
    g.fillRect(x, (h - bar) / 2, 1, bar);
  }
  // Fondus : lignes qui montent du coin bas gauche, descendent vers le coin bas droit.
  if (fi || fo) {
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = 1.5;
    g.beginPath();
    if (fi) { g.moveTo(0, h); g.lineTo(Math.min(w, fi), 1); }
    if (fo) { g.moveTo(Math.max(0, w - fo), 1); g.lineTo(w, h); }
    g.stroke();
  }
  if (clip.loop) {   // repère de chaque répétition
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = natural - (offPx % natural); x < w; x += natural) if (x > 0) g.fillRect(Math.round(x), 0, 1, h);
  }
}

export function clipEl(track, clip) {
  const bp = beatPx();
  const el = document.createElement('div');
  el.className = 'tl-clip' + (tlPicked.has(clip) ? ' selected' : '') + (clip.loop ? ' loop' : '') + (clip.type ? ` ${clip.type}` : '');
  el.style.left = `${clip.start * bp}px`;
  el.style.width = `${Math.max(4, timeline.clipBeats(clip) * bp - 1)}px`;
  el.style.setProperty('--c', PALETTE[uiColor(clip.color ?? catColor(clip.cat))]);
  el.title = `${clip.name}${clip.osc ? ` · ${t('win.osc')} : ${oscPresetName(clip.osc)}` : clip.preset ? ` · ${presetById(clip.preset).name}` : ''} — ${t('tl.clipTitle')}`;
  const cv = document.createElement('canvas');
  const label = document.createElement('span');
  label.textContent = clip.name;
  const grip = document.createElement('div');
  grip.className = 'tl-grip';
  // ▶ (au survol) : écouter le bloc seul ; pendant l'écoute, une barre avance sur le bloc.
  const play = document.createElement('button');
  play.className = 'tl-play icon-only';
  play.dataset.icon = tlPrev?.clipId === clip.id ? 'stop' : 'play';
  play.title = t('tl.playClip');
  play.addEventListener('pointerdown', e => e.stopPropagation());
  play.addEventListener('click', e => { e.stopPropagation(); tlPreviewClip(track, clip); });
  el.append(cv, label, play, grip);
  if (tlPrev?.clipId === clip.id) {
    el.classList.add('previewing');
    const bar = document.createElement('i');
    bar.className = 'tl-prev-bar';
    bar.style.animationDuration = `${tlPrev.dur}s`;
    bar.style.animationDelay = `${-(engine.ctx.currentTime - tlPrev.start)}s`;
    el.appendChild(bar);
  }
  el._obj = clip;
  requestAnimationFrame(() => drawClip(cv, clip));
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    // Endroit du clic dans la timeline (calé au temps, Maj = au 1/16) : « Couper ici ».
    const lane = el.closest('.tl-lane').getBoundingClientRect();
    const raw = (e.clientX - lane.left) / beatPx();
    const at = e.shiftKey ? Math.round(raw * 4) / 4 : Math.round(raw);
    openClipMenu(track, clip, e.clientX, e.clientY, at);
  });

  // Glisser le bloc (Alt = copie) ; glisser son bord droit = longueur (une boucle se répète).
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const resizing = e.target === grip;
    if (!resizing) { tlGroupDown(e, clip, track); return; }
    let target = clip;
    let where = track;
    if (e.altKey && !resizing) {
      target = { ...clip, id: crypto.randomUUID() };
      state.tl.tracks[track].clips.push(target);
    }
    tlSelect(where, target);
    const startX = e.clientX;
    const origStart = target.start;
    const origLen = timeline.clipBeats(target);
    let moved = target !== clip;
    const onMove = ev => {
      const dx = (ev.clientX - startX) / beatPx();
      if (resizing) {
        const len = Math.max(1, ev.shiftKey ? Math.round(origLen + dx) : Math.max(BEATS_PER_BAR, snapBeat(origLen + dx)));
        if (len === target.len) return;
        target.len = len;
      } else {
        const start = Math.max(0, snapBeat(origStart + dx, ev.shiftKey));
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-lane');
        const to = lane ? +lane.dataset.track : where;
        if (start === target.start && to === where) return;
        target.start = start;
        if (to !== where) {
          const from = state.tl.tracks[where].clips;
          from.splice(from.indexOf(target), 1);
          state.tl.tracks[to].clips.push(target);
          where = to;
          tlSelect(where, target);
        }
      }
      moved = true;
      renderTl();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) { growSong(target); save(); }
      else if (target.type === 'note' && wm.isOpen('roll') && state.roll.clip !== target.id) openRoll(target, false);
      renderTl();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  return el;
}

// Variables modifiées depuis d'autres modules.
export function setTlSel(v) { return (tlSel = v); }
