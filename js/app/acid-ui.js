// Fenêtre de la TB-303.
import { ACID_BASE, ACID_PARAMS, ACID_PATTERNS, ACID_ROWS, acidFmt, acidSteps, defaultAcidState, randomPattern } from '../acid.js';
import { t } from '../i18n.js';
import { $, acid, drum, state, timeline, wm } from './core.js';
import { arcPath } from './knobs.js';
import { acidSoundChanged, buildAcidPresets } from './presets-bar.js';
import { save } from './save.js';
import { renderTr } from './tr909-ui.js';

// ---------- TB-303 ----------

export const acidCells = [];        // acidCells[ligne][pas] ; lignes : notes de fa aigu à fa, puis Oct +, Oct −, Accent, Slide
export const acidHeads = [];
export const ACID_FLAGS = ['up', 'down', 'acc', 'slide'];
export let acidStepRec = false;     // saisie pas à pas au clavier
export let acidCursor = 0;
export const acidPattern = () => state.acid.patterns[state.acid.pattern];

export function buildAcid() {
  acid.onStep = renderAcidHead;
  acid.onPattern = () => { renderAcid(); save(); };
  // La 303 peut suivre l'horloge de la 909 (et s'arrêter avec elle).
  drum.listeners.push((step, time, dur) => acid.onClock(step, time, dur));
  const prevStop = drum.onStop;
  drum.onStop = () => { prevStop(); acid.clockStopped(); renderAcid(); };
  $('#acid-play').addEventListener('click', toggleAcid);
  $('#acid-wave').addEventListener('click', () => { state.acid.wave = state.acid.wave === 'sawtooth' ? 'square' : 'sawtooth'; acidSoundChanged(); });
  $('#acid-link').addEventListener('click', () => { state.acid.link = !state.acid.link; if (!state.acid.link) acid.clockStopped(); renderAcid(); save(); });
  $('#acid-rec').addEventListener('click', () => { acidStepRec = !acidStepRec; acidCursor = 0; renderAcid(); });
  $('#acid-rest').addEventListener('click', () => acidWrite(null));
  $('#acid-random').addEventListener('click', () => { state.acid.patterns[state.acid.pattern] = randomPattern(); renderAcid(); save(); });
  $('#acid-clear').addEventListener('click', () => {
    state.acid.patterns[state.acid.pattern] = acidPattern().map(() => ({ note: 0, gate: false, acc: false, slide: false, oct: 0 }));
    renderAcid();
    save();
  });
  for (let k = 0; k < ACID_PATTERNS; k++) {
    const btn = document.createElement('button');
    btn.textContent = k + 1;
    btn.title = t('acid.pattern', { n: k + 1 });
    btn.addEventListener('click', () => acid.selectPattern(k));
    $('#acid-patterns').appendChild(btn);
  }
  buildAcidKnobs();
  buildAcidPresets();
  const grid = $('#acid-grid');
  // En-tête : numéros des pas (tête de lecture, curseur de saisie).
  grid.appendChild(document.createElement('span'));
  for (let s = 0; s < 16; s++) {
    const h = document.createElement('button');
    h.className = 'acid-head';
    h.textContent = s + 1;
    h.title = t('acid.cursor');
    h.addEventListener('click', () => { acidCursor = s; renderAcid(); });
    grid.appendChild(h);
    acidHeads[s] = h;
  }
  const names = t('notes');
  for (let r = 0; r < ACID_ROWS + ACID_FLAGS.length; r++) {
    const note = ACID_ROWS - 1 - r;   // fa aigu en haut
    const isNote = r < ACID_ROWS;
    const label = document.createElement('span');
    label.className = 'acid-label' + (isNote ? '' : ' flag');
    label.textContent = isNote ? names[(ACID_BASE + note) % 12] + (note === ACID_ROWS - 1 ? '′' : '') : t(`acid.f.${ACID_FLAGS[r - ACID_ROWS]}`);
    grid.appendChild(label);
    acidCells[r] = [];
    for (let s = 0; s < 16; s++) {
      const cell = document.createElement('button');
      const sharp = isNote && [1, 3, 6, 8, 10].includes((ACID_BASE + note) % 12);
      cell.className = 'acid-cell' + (s % 4 === 0 ? ' beat' : '') + (sharp ? ' sharp' : '') + (isNote ? '' : ` flag ${ACID_FLAGS[r - ACID_ROWS]}`);
      cell.addEventListener('click', () => (isNote ? acidToggleNote(s, note) : acidToggleFlag(s, ACID_FLAGS[r - ACID_ROWS])));
      grid.appendChild(cell);
      acidCells[r][s] = cell;
    }
  }
  renderAcid();
}

export function acidToggleNote(s, note) {
  const st = acidPattern()[s];
  if (st.gate && st.note === note) st.gate = false;
  else { st.gate = true; st.note = note; acid.preview(st); }
  renderAcid();
  save();
}

export function acidToggleFlag(s, flag) {
  const st = acidPattern()[s];
  if (flag === 'up') st.oct = st.oct === 1 ? 0 : 1;
  else if (flag === 'down') st.oct = st.oct === -1 ? 0 : -1;
  else st[flag] = !st[flag];
  renderAcid();
  save();
}

// Saisie au clavier : la note jouée va dans le pas du curseur, qui avance (silence : bouton « Silence »).
export function acidWrite(midi, velocity = 0.8) {
  const st = acidPattern()[acidCursor];
  if (midi === null) {
    st.gate = false;
  } else {
    const i = midi - ACID_BASE;
    const oct = Math.max(-1, Math.min(1, Math.floor(i / 12)));
    Object.assign(st, { gate: true, note: ((i % 12) + 12) % 12, oct, acc: velocity > 0.85, slide: false });
    acid.preview(st);
  }
  acidCursor = (acidCursor + 1) % 16;
  renderAcid();
  save();
}

// Touche du clavier (APC ou ordinateur) : true si la saisie de la 303 l'a prise.
export function acidKey(note, velocity, on) {
  if (!acidStepRec || !wm.isOpen('acid')) return false;
  if (on) acidWrite(note, velocity);
  return true;
}

export function toggleAcid() {
  if (acid.playing) {
    if (acid.linked) drum.stop(); else acid.stop();
  } else if (state.acid.link) {
    drum.start(timeline.playing);   // suit la 909 : les deux démarrent ensemble
  } else {
    acid.start(timeline.playing);
  }
  renderAcid();
  renderTr();
}

export const acidKnobEls = [];
export function buildAcidKnobs() {
  const wrap = $('#acid-knobs');
  ACID_PARAMS.forEach((id, k) => {
    const el = document.createElement('div');
    el.className = 'knob';
    el.innerHTML = `
      <svg viewBox="0 0 80 80">
        <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
        <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="value"></div><div class="label">${t(`acid.p.${id}`)}</div>`;
    const turn = pos => {
      const steps = acidSteps(id);
      state.acid.params[id] = Math.min(1, Math.max(0, steps ? Math.round(pos * (steps - 1)) / (steps - 1) : pos));
      acidSoundChanged();
    };
    let lastY = null;
    el.addEventListener('pointerdown', e => { lastY = e.clientY; try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
    el.addEventListener('pointermove', e => {
      if (lastY === null || Math.abs(lastY - e.clientY) < 2) return;
      const step = acidSteps(id) ? 1 / (acidSteps(id) - 1) / 3 : 0.005;
      turn(state.acid.params[id] + (lastY - e.clientY) * step * (e.shiftKey ? 0.25 : 1));
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { lastY = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); turn(state.acid.params[id] + (e.deltaY < 0 ? 0.02 : -0.02)); }, { passive: false });
    el.addEventListener('dblclick', () => turn(defaultAcidState().params[id]));
    acidKnobEls[k] = el;
    wrap.appendChild(el);
  });
}

export function renderAcidKnobs() {
  ACID_PARAMS.forEach((id, k) => {
    const el = acidKnobEls[k];
    if (!el) return;
    const p = state.acid.params[id];
    el.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
    el.querySelector('.value').textContent = acidFmt(id, p);
  });
}

export function renderAcid() {
  if (!acidCells.length) return;
  const play = $('#acid-play');
  play.textContent = acid.playing ? t('tr.stop') : t('tr.play');
  play.dataset.icon = acid.playing ? 'stop' : 'play';
  play.classList.toggle('active', acid.playing);
  $('#acid-wave').textContent = state.acid.wave === 'sawtooth' ? t('acid.saw') : t('acid.square');
  $('#acid-wave').dataset.icon = state.acid.wave === 'sawtooth' ? 'w-saw' : 'w-square';
  $('#acid-link').classList.toggle('active', state.acid.link);
  $('#acid-rec').classList.toggle('active', acidStepRec);
  $('#acid-rest').disabled = !acidStepRec;
  [...$('#acid-patterns').children].forEach((btn, k) => {
    btn.classList.toggle('active', k === state.acid.pattern);
    btn.classList.toggle('queued', k === acid.queued);
    btn.classList.toggle('used', state.acid.patterns[k].some(s => s.gate));
  });
  const pat = acidPattern();
  for (let s = 0; s < 16; s++) {
    const st = pat[s];
    for (let r = 0; r < ACID_ROWS; r++) {
      const cell = acidCells[r][s];
      const on = st.gate && st.note === ACID_ROWS - 1 - r;
      cell.classList.toggle('on', on);
      cell.classList.toggle('accent', on && st.acc);
      cell.textContent = on && st.oct ? (st.oct > 0 ? '↑' : '↓') : '';
    }
    const flags = { up: st.oct === 1, down: st.oct === -1, acc: st.acc, slide: st.slide };
    ACID_FLAGS.forEach((f, k) => acidCells[ACID_ROWS + k][s].classList.toggle('on', flags[f]));
    acidHeads[s].classList.toggle('cursor', acidStepRec && s === acidCursor);
  }
  renderAcidKnobs();
}

export let acidHead = -1;
export function renderAcidHead(step) {
  if (acidHead >= 0) for (const row of acidCells) row[acidHead]?.classList.remove('head');
  acidHeads[acidHead]?.classList.remove('playing');
  acidHead = step;
  if (step >= 0) {
    for (const row of acidCells) row[step].classList.add('head');
    acidHeads[step].classList.add('playing');
  } else {
    renderAcid();
  }
}
