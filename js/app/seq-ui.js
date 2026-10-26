// Fenêtre du séquenceur pas à pas (js/stepseq.js) : une ligne par son de pad, 16 à 64 pas, 8 patterns. Les coups jouent
// les pads (mêmes réglages, même sidechain), s'enregistrent dans la timeline (source « Séquenceur ») et le pattern peut
// y être posé en blocs de pads.
import { PALETTE } from '../apc.js';
import { t } from '../i18n.js';
import { SEQ_LENS, SEQ_ROWS_MAX, seqPatternUsed, seqRow, setSeqLength } from '../stepseq.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { $, engine, padKey, sidechain, state, stepSeq, timeline, uiColor, wm } from './core.js';
import { buildPatternButtons, renderPatternButtons } from './drum-ui.js';
import { freeLanes } from './gen.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { openSendTo } from './send-to.js';
import { padCat } from './sidechain-ui.js';
import { loadPad, loadPads } from './sounds.js';
import { growSong, renderTl } from './tl.js';
import { REC_GRID, tlRecordPad } from './tl-record.js';

export const seqPat = () => state.seq.patterns[state.seq.pattern];
export const seqPad = row => state.banks[row.bank]?.[row.pad] ?? null;
export let seqHead = -1;
export let seqPaint = null;   // valeur posée en glissant sur la grille

// Sons des lignes : décodés avant de jouer.
export const loadSeqPads = () => loadPads(state.seq.patterns.flatMap(p => p.rows.map(seqPad)));

// Un coup du séquenceur : le pad joue à l'instant prévu (et s'enregistre si la timeline enregistre le séquenceur).
export function seqHit(row, time, vel) {
  const pad = seqPad(row);
  if (!pad) return;
  if (!pad.buffer) { loadPad(pad); return; }   // pas encore décodé : prêt pour le prochain passage
  const v = engine.playPad(padKey(row.bank, row.pad), pad, { when: time, oneShot: true, vel });
  if (padCat(pad) === 'kick') sidechain.kick(time);
  if (v) tlRecordPad(row.bank, row.pad, time, 'seq', vel);
}

export function toggleSeqPlay() {
  if (stepSeq.running) stepSeq.stop();
  else { loadSeqPads(); stepSeq.start(timeline.playing); }
  renderSeq();
}

export function onSeqStep(step) {
  seqHead = step;
  renderSeqHead();
}

// ---- Lignes ----

export function setSeqRow(r, bank, pad) {
  const row = seqPat().rows[r];
  if (!row) return;
  Object.assign(row, { bank, pad });
  loadPad(seqPad(row));
  renderSeq();
  save();
}
export function addSeqRow(bank = state.bank, pad = state.selected) {
  const p = seqPat();
  if (p.rows.length >= SEQ_ROWS_MAX) { toast(t('seq.full', { n: SEQ_ROWS_MAX }), 3000); return; }
  p.rows.push(seqRow(bank, pad, p.len));
  loadPad(seqPad(p.rows[p.rows.length - 1]));
  renderSeq();
  save();
}
export function removeSeqRow(r) {
  seqPat().rows.splice(r, 1);
  renderSeq();
  save();
}
export function setSeqStep(r, s, v) {
  const row = seqPat().rows[r];
  if (!row || row.steps[s] === v) return;
  row.steps[s] = v;
  renderSeqCells();
  save();
}
export function setSeqLen(len) {
  setSeqLength(seqPat(), len);
  state.seq.page = Math.min(state.seq.page, len / 16 - 1);
  renderSeq();
  save();
}
export function clearSeqPattern() {
  for (const row of seqPat().rows) row.steps.fill(0);
  renderSeq();
  save();
}

// Choisir le son d'une ligne : la grille des pads de « Envoyer vers… », dans n'importe quelle banque.
export function pickRowPad(r, x, y) {
  openSendTo(null, null, x, y, { name: '', head: t('seq.pickHead', { n: r + 1 }), hint: t('seq.pickHint'), pick: true,
    toPad: (b, i) => setSeqRow(r, b, i) });
}

export function auditionRow(row) {
  const pad = seqPad(row);
  if (pad) loadPad(pad).then(buf => buf && engine.playPad(padKey(row.bank, row.pad), pad, { oneShot: true }));
}

// ---- Vers la timeline : le pattern en blocs de pads, une piste par ligne ----

export function seqToTimeline(times = state.seq.times) {
  const p = seqPat();
  const rows = p.rows.filter(r => !r.mute && seqPad(r) && r.steps.some(Boolean));
  if (!rows.length) { toast(t('seq.emptyPattern'), 3000); return null; }
  const steps = p.len, stepBeats = 0.25, total = steps * stepBeats * times;
  const start = Math.floor(state.tl.playhead / BEATS_PER_BAR) * BEATS_PER_BAR;
  const lanes = freeLanes(start, total, rows.length);
  if (!lanes) return null;
  rows.forEach((row, k) => {
    const pad = seqPad(row);
    const hits = [];
    for (let n = 0; n < times; n++) row.steps.forEach((v, s) => { if (v) hits.push({ beat: (n * steps + s) * stepBeats, v }); });
    const natural = pad.buffer ? Math.max(REC_GRID, Math.ceil(pad.buffer.duration / timeline.beatDur / REC_GRID) * REC_GRID) : 1;
    hits.forEach((h, j) => {
      const next = hits[j + 1]?.beat ?? total;   // le coup suivant coupe celui-ci (même pad)
      const clip = { id: crypto.randomUUID(), type: 'pad', bank: row.bank, pad: row.pad, sampleId: pad.sampleId, name: pad.name, color: pad.color, cat: 'drums',
        start: start + h.beat, len: Math.min(natural, next - h.beat), loop: false, vel: h.v === 2 ? 1 : 1 - state.seq.globals.accent * 0.45 };
      state.tl.tracks[lanes[k]].clips.push(clip);
      growSong(clip);
    });
  });
  renderTl();
  save();
  toast(t('seq.done', { bars: total / BEATS_PER_BAR, bar: start / BEATS_PER_BAR + 1, track: lanes.map(i => i + 1).join(' + ') }), 4000);
  return lanes;
}

// ---- Fenêtre ----

export function buildSeq() {
  $('[data-win="seq"]').addEventListener('pointerdown', () => loadSeqPads(), { once: true });
  $('#seq-play').addEventListener('click', toggleSeqPlay);
  buildPatternButtons($('#seq-patterns'), k => { stepSeq.selectPattern(k); });
  $('#seq-accent').addEventListener('input', e => { state.seq.globals.accent = e.target.value / 100; save(); });
  $('#seq-shuffle').addEventListener('input', e => { state.seq.globals.shuffle = e.target.value / 100; save(); });
  for (const len of SEQ_LENS) {
    const b = document.createElement('button');
    b.dataset.len = len;
    b.textContent = len;
    b.title = t('seq.lenTitle', { n: len / 16 });
    b.addEventListener('click', () => setSeqLen(len));
    $('#seq-len').appendChild(b);
  }
  $('#seq-add').addEventListener('click', () => addSeqRow());
  $('#seq-clear').addEventListener('click', clearSeqPattern);
  $('#seq-times').addEventListener('change', e => { state.seq.times = +e.target.value; save(); });
  $('#seq-to-tl').addEventListener('click', () => seqToTimeline());
  window.addEventListener('pointerup', () => { seqPaint = null; });
  renderSeq();
}

export function renderSeq() {
  const el = $('#seq-grid');
  if (!el) return;
  const st = state.seq, p = seqPat();
  const play = $('#seq-play');
  play.textContent = stepSeq.running ? t('tr.stop') : t('tr.play');
  play.dataset.icon = stepSeq.running ? 'stop' : 'play';
  play.classList.toggle('active', stepSeq.running);
  renderPatternButtons($('#seq-patterns'), st.pattern, stepSeq.queued, k => seqPatternUsed(st.patterns[k]));
  $('#seq-accent').value = Math.round(st.globals.accent * 100);
  $('#seq-shuffle').value = Math.round(st.globals.shuffle * 100);
  $('#seq-times').value = st.times;
  for (const b of $('#seq-len').children) b.classList.toggle('active', +b.dataset.len === p.len);
  // Pages de 16 pas (patterns de 32 ou 64 pas).
  const pages = $('#seq-pages');
  pages.innerHTML = '';
  pages.hidden = p.len <= 16;
  for (let k = 0; k < p.len / 16; k++) {
    const b = document.createElement('button');
    b.textContent = t('seq.page', { n: k + 1 });
    b.classList.toggle('active', k === st.page);
    b.addEventListener('click', () => { st.page = k; renderSeq(); });
    pages.appendChild(b);
  }
  el.innerHTML = '';
  p.rows.forEach((row, r) => {
    const pad = seqPad(row);
    const name = document.createElement('button');
    name.className = 'tr-name seq-name';
    name.textContent = pad?.name ?? '—';
    name.title = t('seq.rowTitle', { bank: row.bank + 1, pad: row.pad + 1 });
    if (pad) name.style.setProperty('--c', PALETTE[uiColor(pad.color)]);
    name.classList.toggle('muted', row.mute);
    name.addEventListener('click', () => auditionRow(row));
    el.appendChild(name);
    for (let s = 0; s < 16; s++) {
      const step = st.page * 16 + s;
      const cell = document.createElement('button');
      cell.className = 'tr-cell' + (s % 4 === 0 ? ' beat' : '');
      cell.dataset.r = r;
      cell.dataset.s = step;
      cell.addEventListener('pointerdown', e => {
        e.preventDefault();
        seqPaint = (row.steps[step] + 1) % 3;   // silence -> note -> accent -> silence ; en glissant, la même valeur
        setSeqStep(r, step, seqPaint);
      });
      cell.addEventListener('pointerenter', () => { if (seqPaint !== null) setSeqStep(r, step, seqPaint); });
      el.appendChild(cell);
    }
    const tools = [
      ['pads', 'seq.pick.title', e => pickRowPad(r, e.clientX, e.clientY)],
      ['mute', 'seq.mute.title', () => { row.mute = !row.mute; renderSeq(); save(); }],
      ['trash', 'seq.remove.title', () => removeSeqRow(r)],
    ];
    for (const [icon, title, fn] of tools) {
      const b = document.createElement('button');
      b.className = 'seq-tool';
      b.dataset.icon = icon;
      b.title = t(title);
      if (icon === 'mute') b.classList.toggle('active', row.mute);
      b.addEventListener('click', fn);
      el.appendChild(b);
    }
  });
  $('#seq-empty').hidden = p.rows.length > 0;
  renderSeqCells();
}

export function renderSeqCells() {
  const p = seqPat();
  for (const cell of $('#seq-grid').querySelectorAll('.tr-cell')) {
    const v = p.rows[+cell.dataset.r]?.steps[+cell.dataset.s];
    cell.classList.toggle('on', v === 1);
    cell.classList.toggle('accent', v === 2);
  }
  renderSeqHead();
}

export function renderSeqHead() {
  if (!wm?.isOpen('seq')) return;
  for (const cell of $('#seq-grid').querySelectorAll('.tr-cell')) cell.classList.toggle('head', +cell.dataset.s === seqHead);
}
