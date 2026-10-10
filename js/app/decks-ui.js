// Fenêtre des platines : chargement, scratch, transition automatique.
import { DECK_IDS, DECK_KNOBS, guessBpm, secFromTurns, vinylTurns } from '../decks.js';
import { t } from '../i18n.js';
import { guessCat } from '../library.js';
import * as store from '../storage.js';
import { $, decks, engine, state, timeline, wm } from './core.js';
import { arcPath, renderKnobs } from './knobs.js';
import { libSelected, renderLibrary } from './library-ui.js';
import { toast } from './misc.js';
import { save } from './save.js';
import { bufferCache } from './sounds.js';
import { ensureBuffer } from './tl.js';

// ---------- Platines ----------

export const deckEls = {};

// Charge un son (élément de la bibliothèque) sur un deck.
export async function loadDeck(id, item) {
  const buffer = await ensureBuffer(item.sampleId);
  if (!buffer) { toast(t('lib.loadFail'), 3000); return; }
  const s = state.decks[id];
  const deck = decks.decks[id];
  if (deck.playing) deck.pause();
  Object.assign(s, { sampleId: item.sampleId, name: item.name, bpm: guessBpm(buffer.duration, item.loop ? item.bpm : 0, state.bpm), cue: 0, loop: !!item.loop || buffer.duration > 8 });
  deck.setBuffer(buffer);
  deck.update();
  drawDeckWave(id);
  renderDecks();
  save();
  toast(t('deck.loaded', { name: item.name, deck: id }));
}

// Fichier audio glissé sur un deck : gardé comme son de l'utilisateur (il rejoint aussi la bibliothèque).
export async function loadDeckFile(id, file) {
  if (!file || !file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i.test(file.name)) return;
  const data = await file.arrayBuffer();
  let buffer;
  try { buffer = await engine.ctx.decodeAudioData(data.slice(0)); } catch { alert(t('editor.unreadable', { name: file.name })); return; }
  const sampleId = `user:${crypto.randomUUID()}`;
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 32);
  await store.saveSample(sampleId, { name, data });
  bufferCache.set(sampleId, buffer);
  state.userSounds.push({ sampleId, name, cat: guessCat(name) });
  renderLibrary();
  await loadDeck(id, { sampleId, name, loop: buffer.duration > 8, bpm: 0 });
}

export function buildDecks() {
  decks.busy = () => timeline.playing;
  decks.onChange = () => renderDecks();
  for (const id of DECK_IDS) {
    const el = document.querySelector(`.deck[data-deck="${id}"]`);
    el.innerHTML = `
      <div class="deck-head"><b class="deck-id">${id}</b><span class="deck-name"></span><span class="deck-bpm hint"></span></div>
      <canvas class="deck-zoom" title="${t('deck.zoomTitle')}"></canvas>
      <canvas class="deck-wave" title="${t('deck.waveTitle')}"></canvas>
      <div class="deck-body">
        <canvas class="deck-vinyl" title="${t('deck.vinylTitle')}"></canvas>
        <div class="deck-side">
          <div class="deck-buttons">
            <button class="deck-play primary"></button>
            <button class="deck-cue" title="${t('deck.cueTitle')}">Cue</button>
            <button class="deck-sync" title="${t('deck.syncTitle')}">Sync</button>
            <button class="deck-loop">${t('deck.loop')}</button>
            <button class="deck-load" title="${t('deck.load.title')}">${t('deck.load')}</button>
          </div>
          <label class="deck-pitch"><span>${t('deck.pitch')}</span><input type="range" min="-0.08" max="0.08" step="0.001"><em></em></label>
          <div class="mini-knobs deck-knobs"></div>
        </div>
      </div>`;
    const els = deckEls[id] = {
      el, name: el.querySelector('.deck-name'), bpm: el.querySelector('.deck-bpm'), wave: el.querySelector('.deck-wave'), zoom: el.querySelector('.deck-zoom'), vinyl: el.querySelector('.deck-vinyl'),
      play: el.querySelector('.deck-play'), cue: el.querySelector('.deck-cue'), sync: el.querySelector('.deck-sync'), loop: el.querySelector('.deck-loop'),
      load: el.querySelector('.deck-load'), pitch: el.querySelector('.deck-pitch input'), pitchLabel: el.querySelector('.deck-pitch em'), knobs: [], angle: 0,
    };
    const deck = decks.decks[id];
    const s = () => state.decks[id];
    els.play.addEventListener('click', () => { cancelAuto(true); if (deck.playing) deck.pause(); else deck.play(); });
    els.cue.addEventListener('click', () => { cancelAuto(true); deck.cue(); save(); });
    els.sync.addEventListener('click', () => { s().sync = !s().sync; deck.update(); renderDecks(); save(); });
    els.loop.addEventListener('click', () => { s().loop = !s().loop; deck.update(); renderDecks(); save(); });
    els.load.addEventListener('click', () => { if (libSelected) loadDeck(id, libSelected); else toast(t('deck.pickFirst'), 3000); });
    els.pitch.addEventListener('input', () => { s().pitch = +els.pitch.value; deck.update(); renderDecks(); save(); });
    els.pitch.addEventListener('dblclick', () => { s().pitch = 0; deck.update(); renderDecks(); save(); });
    // Forme d'onde : un clic place la lecture (ou le cue à l'arrêt).
    els.wave.addEventListener('pointerdown', e => {
      if (!deck.buffer) return;
      const r = els.wave.getBoundingClientRect();
      deck.seek((e.clientX - r.left) / r.width * deck.duration);
      if (!deck.playing) s().cue = deck.pos;
      renderDecks();
    });
    // Vinyle : la souris tient le disque et le fait tourner ; le son suit la position du disque (à l'envers aussi).
    let last = null;
    const angleAt = e => { const r = els.vinyl.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
    els.vinyl.addEventListener('pointerdown', e => {
      if (!deck.buffer) return;
      cancelAuto(true);
      try { els.vinyl.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      last = { a: angleAt(e) };
      els.held = true;
      deck.scratchStart();
    });
    els.vinyl.addEventListener('pointermove', e => {
      if (!last) return;
      // Tous les points du geste (la souris en donne plus que d'images) : un scratch fin et régulier.
      let da = 0;
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const a = angleAt(ev);
        let d = a - last.a;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        da += d;
        last.a = a;
      }
      if (da) deck.scratchMove(secFromTurns(da / (2 * Math.PI)));
    });
    const release = () => { if (!last) return; last = null; els.held = false; deck.scratchEnd(); };
    els.vinyl.addEventListener('pointerup', release);
    els.vinyl.addEventListener('pointercancel', release);
    // Glisser un fichier audio sur le deck.
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('dragover'); loadDeckFile(id, e.dataTransfer.files[0]); });
    // Potentiomètres : volume, basses, médiums, aigus, filtre.
    DECK_KNOBS.forEach(k => {
      const knob = document.createElement('div');
      knob.className = 'knob';
      knob.innerHTML = `
        <svg viewBox="0 0 80 80">
          <path class="track" d="${arcPath(1)}" fill="none" stroke-width="8" stroke-linecap="round"/>
          <path class="arc" fill="none" stroke-width="8" stroke-linecap="round"/>
        </svg>
        <div class="value"></div><div class="label">${t(`deck.k.${k}`)}</div>`;
      const turn = pos => { cancelAuto(true); s()[k] = Math.min(1, Math.max(0, pos)); deck.update(); renderDecks(); if (state.page === 'decks') renderKnobs(); save(); };
      let y = null;
      knob.addEventListener('pointerdown', e => { y = e.clientY; try { knob.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ } });
      knob.addEventListener('pointermove', e => { if (y === null || Math.abs(y - e.clientY) < 2) return; turn(s()[k] + (y - e.clientY) * 0.005 * (e.shiftKey ? 0.25 : 1)); y = e.clientY; });
      knob.addEventListener('pointerup', () => { y = null; });
      knob.addEventListener('wheel', e => { e.preventDefault(); turn(s()[k] + (e.deltaY < 0 ? 0.02 : -0.02)); }, { passive: false });
      knob.addEventListener('dblclick', () => turn(k === 'vol' ? 0.8 : 0.5));
      el.querySelector('.deck-knobs').appendChild(knob);
      els.knobs.push([k, knob]);
    });
  }
  const xf = $('#deck-xfade');
  $('#deck-auto').addEventListener('click', autoTransition);
  xf.addEventListener('input', () => { cancelAuto(true); state.decks.xfade = +xf.value; decks.update(); if (state.page === 'decks') renderKnobs(); save(); });
  xf.addEventListener('dblclick', () => { state.decks.xfade = 0.5; decks.update(); renderDecks(); save(); });
  // Sons déjà chargés (sauvegarde) : remis sur les decks, à l'arrêt.
  for (const id of DECK_IDS) {
    const sid = state.decks[id].sampleId;
    if (sid) ensureBuffer(sid).then(buf => { if (buf) { decks.decks[id].setBuffer(buf); decks.decks[id].update(); drawDeckWave(id); renderDecks(); } });
  }
  renderDecks();
  (function frame() {
    if (wm?.isOpen('decks')) for (const id of DECK_IDS) drawDeck(id);
    requestAnimationFrame(frame);
  })();
  // Fenêtre redimensionnée : les formes d'onde sont redessinées à la bonne largeur.
  let resizeTimer;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => DECK_IDS.forEach(drawDeckWave), 120); }).observe($('.decks'));
}

// Analyse d'un son pour l'affichage et les transitions : crêtes, basses et énergie par tranche de 1/150 s.
export const DECK_BINS = 150;
export function deckAnalyse(buffer) {
  const sr = buffer.sampleRate;
  const L = buffer.getChannelData(0), R = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
  const per = Math.max(1, Math.round(sr / DECK_BINS));
  const n = Math.ceil(L.length / per);
  const peak = new Float32Array(n), low = new Float32Array(n), rms = new Float32Array(n);
  const a = 1 - Math.exp(-2 * Math.PI * 160 / sr);   // passe-bas ~160 Hz : la grosse caisse et la basse
  let lp = 0;
  for (let b = 0; b < n; b++) {
    let p = 0, q = 0, s = 0;
    const end = Math.min(L.length, (b + 1) * per);
    for (let i = b * per; i < end; i++) {
      const x = (L[i] + R[i]) * 0.5;
      lp += (x - lp) * a;
      const ax = Math.abs(x);
      if (ax > p) p = ax;
      const al = Math.abs(lp);
      if (al > q) q = al;
      s += x * x;
    }
    peak[b] = p; low[b] = Math.min(1, q * 1.6); rms[b] = Math.sqrt(s / Math.max(1, end - b * per));
  }
  return { peak, low, rms, bins: DECK_BINS };
}

export const deckInfo = {};   // id -> analyse du son chargé
export const DECK_COLORS = { A: ['#2ec4ff', '#0b5f86'], B: ['#ff4fd8', '#86106f'] };

export function drawDeckWave(id) {
  const deck = decks.decks[id];
  // Analyse faite une fois par son (un redimensionnement ne fait que redessiner).
  deckInfo[id] = !deck.buffer ? null : deckInfo[id]?.src === deck.buffer ? deckInfo[id] : { ...deckAnalyse(deck.buffer), src: deck.buffer };
  // Fenêtre fermée : rien à dessiner (elle sera redessinée à son ouverture).
  if (!deckEls[id].wave.clientHeight) { deckEls[id].waveImg = null; return; }
  for (const cv of [deckEls[id].wave, deckEls[id].zoom]) {
    cv.width = Math.max(200, Math.round(cv.clientWidth * devicePixelRatio));
    cv.height = Math.max(1, Math.round(cv.clientHeight * devicePixelRatio));
  }
  // Vue d'ensemble : dessinée une fois, la tête de lecture passe par-dessus.
  const cv = deckEls[id].wave;
  const off = document.createElement('canvas');
  off.width = cv.width; off.height = cv.height;
  const g = off.getContext('2d');
  const info = deckInfo[id];
  if (info) {
    const [hi, lo] = DECK_COLORS[id];
    const w = off.width, h = off.height, n = info.peak.length;
    for (let x = 0; x < w; x++) {
      let p = 0, q = 0;
      for (let b = Math.floor(x * n / w); b < Math.floor((x + 1) * n / w); b++) { p = Math.max(p, info.peak[b]); q = Math.max(q, info.low[b]); }
      g.fillStyle = hi; g.fillRect(x, (1 - p) * h / 2, 1, Math.max(1, p * h));
      g.fillStyle = lo; g.fillRect(x, (1 - q * p) * h / 2, 1, Math.max(1, q * p * h));
    }
  }
  deckEls[id].waveImg = off;
}

// Une image : forme d'onde zoomée (qui défile, grille des temps), vue d'ensemble, platine.
export function drawDeck(id) {
  const deck = decks.decks[id];
  const els = deckEls[id];
  const info = deckInfo[id];
  const s = state.decks[id];
  const pos = deck.posAt();
  const [hi, lo] = DECK_COLORS[id];
  // Vue d'ensemble.
  {
    const cv = els.wave, g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if (els.waveImg) {
      g.globalAlpha = 0.45; g.drawImage(els.waveImg, 0, 0); g.globalAlpha = 1;
      if (deck.duration) {
        const x = pos / deck.duration * cv.width;
        g.save(); g.beginPath(); g.rect(0, 0, x, cv.height); g.clip(); g.drawImage(els.waveImg, 0, 0); g.restore();
        g.fillStyle = '#ffd23f'; g.fillRect(s.cue / deck.duration * cv.width - 1, 0, 2, cv.height);
        g.fillStyle = '#fff'; g.fillRect(x - 1, 0, 2, cv.height);
      }
    }
  }
  // Forme d'onde zoomée : 4 mesures autour de la tête de lecture.
  {
    const cv = els.zoom, g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    g.fillStyle = '#0b0c10'; g.fillRect(0, 0, w, h);
    if (info && deck.duration) {
      const span = s.bpm ? (16 * 60) / s.bpm : 8;   // secondes de son visibles
      const t0 = pos - span / 2;
      const bins = info.peak.length;
      const n = (span * info.bins) / w;
      for (let x = 0; x < w; x++) {
        let b0 = (t0 * info.bins) + x * n;
        if (s.loop) b0 = ((b0 % bins) + bins) % bins;
        const b = Math.floor(b0);
        if (b < 0 || b >= bins) continue;
        let p = 0, q = 0;
        for (let k = b; k < Math.min(bins, b + Math.max(1, Math.ceil(n))); k++) { p = Math.max(p, info.peak[k]); q = Math.max(q, info.low[k]); }
        const past = t0 + (x / w) * span < pos;
        g.fillStyle = past ? hi + '88' : hi;
        g.fillRect(x, (1 - p) * h / 2, 1, Math.max(1, p * h));
        g.fillStyle = past ? '#ff8a3d88' : '#ff8a3d';
        g.fillRect(x, (1 - q * p) * h / 2, 1, Math.max(1, q * p * h));
      }
      // Grille : temps, mesures (plus marquées), et numéro de mesure.
      if (s.bpm) {
        const beat = 60 / s.bpm;
        g.font = `${Math.round(9 * devicePixelRatio)}px system-ui, sans-serif`;
        for (let k = Math.ceil(t0 / beat); k * beat < t0 + span; k++) {
          const x = Math.round(((k * beat - t0) / span) * w) + 0.5;
          const bar = k % 4 === 0;
          g.fillStyle = bar ? '#ffffff55' : '#ffffff1c';
          g.fillRect(x, 0, bar ? 2 : 1, h);
          if (bar) { g.fillStyle = '#ffffff88'; g.fillText(String(Math.floor(((k % (deck.duration / beat)) + deck.duration / beat) % (deck.duration / beat) / 4) + 1), x + 3, 10 * devicePixelRatio); }
        }
      }
      g.fillStyle = '#fff';
      g.fillRect(Math.round(w / 2) - 1, 0, 2, h);
    }
  }
  drawPlatter(id, pos);
}

// Platine : plateau et ses points stroboscopiques, vinyle (sillons, reflets fixes), étiquette, bras de lecture.
export function drawPlatter(id, pos) {
  const deck = decks.decks[id];
  const els = deckEls[id];
  const v = els.vinyl;
  const dpr = devicePixelRatio || 1;
  const W = Math.round(v.clientWidth * dpr), H = Math.round(v.clientHeight * dpr);
  if (v.width !== W || v.height !== H) { v.width = W; v.height = H; }
  const g = v.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const R = Math.min(W * 0.86, H) / 2 - 2 * dpr;   // rayon du plateau
  const cx = R + 2 * dpr, cy = H / 2;
  const a = vinylTurns(pos) * 2 * Math.PI;
  const [hi, lo] = DECK_COLORS[id];
  const playing = deck.playing;
  // Halo quand le deck joue.
  if (playing) { g.shadowColor = hi; g.shadowBlur = 14 * dpr; }
  // Plateau métal.
  const metal = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  metal.addColorStop(0, '#5a5e66'); metal.addColorStop(0.7, '#2c2f35'); metal.addColorStop(1, '#17181c');
  g.fillStyle = metal;
  g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.fill();
  g.shadowBlur = 0;
  // Points stroboscopiques sur le bord (tournent avec le plateau).
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.fillStyle = '#c9ccd3';
  for (let k = 0; k < 48; k++) { const t = (k / 48) * 2 * Math.PI; g.fillRect(Math.cos(t) * (R - 4 * dpr) - dpr, Math.sin(t) * (R - 4 * dpr) - dpr, 2 * dpr, 2 * dpr); }
  g.restore();
  // Vinyle : noir, sillons fins.
  const rv = R - 9 * dpr;
  g.fillStyle = '#08080a';
  g.beginPath(); g.arc(cx, cy, rv, 0, 2 * Math.PI); g.fill();
  for (let k = rv * 0.36; k < rv - 2 * dpr; k += 2.2 * dpr) {
    g.strokeStyle = (Math.round(k) % 3) ? '#16161b' : '#1f1f26';
    g.lineWidth = dpr * 0.8;
    g.beginPath(); g.arc(cx, cy, k, 0, 2 * Math.PI); g.stroke();
  }
  // Reflets : la lumière ne tourne pas avec le disque.
  if (g.createConicGradient) {
    const sheen = g.createConicGradient(-Math.PI / 4, cx, cy);
    for (const [p, c] of [[0, '#ffffff00'], [0.07, '#ffffff22'], [0.14, '#ffffff00'], [0.5, '#ffffff00'], [0.57, '#ffffff18'], [0.64, '#ffffff00'], [1, '#ffffff00']]) sheen.addColorStop(p, c);
    g.fillStyle = sheen;
    g.beginPath(); g.arc(cx, cy, rv, 0, 2 * Math.PI); g.arc(cx, cy, rv * 0.36, 0, 2 * Math.PI, true); g.fill();
  }
  // Étiquette (tourne), repère et nom du son.
  g.save(); g.translate(cx, cy); g.rotate(a);
  const rl = rv * 0.34;
  const label = g.createRadialGradient(0, 0, rl * 0.1, 0, 0, rl);
  label.addColorStop(0, hi); label.addColorStop(1, lo);
  g.fillStyle = label;
  g.beginPath(); g.arc(0, 0, rl, 0, 2 * Math.PI); g.fill();
  g.fillStyle = '#ffffffcc';
  g.font = `700 ${Math.round(rl * 0.42)}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(id, 0, -rl * 0.45);
  g.font = `600 ${Math.round(rl * 0.17)}px system-ui, sans-serif`;
  const name = (state.decks[id].name || '').slice(0, 14);
  if (name) g.fillText(name, 0, rl * 0.42);
  g.fillStyle = '#ffffffee';
  g.fillRect(-1.5 * dpr, -rv + 3 * dpr, 3 * dpr, rv * 0.5);   // repère (autocollant) sur le disque
  g.restore();
  // Axe.
  g.fillStyle = '#d7d9de';
  g.beginPath(); g.arc(cx, cy, 3.5 * dpr, 0, 2 * Math.PI); g.fill();
  // Bras : du bord vers le centre à mesure que le son avance (un vrai disque se lit de l'extérieur vers l'intérieur).
  const px = cx + R * 1.02, py = cy - R * 0.86;   // pivot
  // Une boucle n'a ni début ni fin : le bras reste posé au même endroit.
  const prog = !deck.duration ? 0 : state.decks[id].loop ? 0.3 : Math.min(1, pos / deck.duration);
  // Pointe : sur le disque, du côté du pivot ; sans son, le bras est sur son repose-bras, hors du disque.
  const thp = Math.atan2(py - cy, px - cx);
  const stylus = deck.buffer ? rv * (0.93 - 0.52 * prog) : rv * 1.18;
  const ths = thp + (deck.buffer ? 0.62 : 0.95);
  const sx = cx + Math.cos(ths) * stylus, sy = cy + Math.sin(ths) * stylus;
  const ta = Math.atan2(sy - py, sx - px);
  g.strokeStyle = '#000000aa'; g.lineWidth = 6 * dpr; g.lineCap = 'round';
  g.beginPath(); g.moveTo(px + 3 * dpr, py + 4 * dpr); g.lineTo(sx + 3 * dpr, sy + 4 * dpr); g.stroke();   // ombre
  const arm = g.createLinearGradient(px, py, sx, sy);
  arm.addColorStop(0, '#e9ebef'); arm.addColorStop(1, '#9aa0a8');
  g.strokeStyle = arm; g.lineWidth = 3.5 * dpr;
  g.beginPath(); g.moveTo(px, py); g.lineTo(sx, sy); g.stroke();
  g.fillStyle = '#c0c4cb';
  g.save(); g.translate(sx, sy); g.rotate(ta); g.fillRect(-3 * dpr, -5 * dpr, 12 * dpr, 10 * dpr); g.restore();   // tête de lecture
  g.fillStyle = '#3a3d44'; g.beginPath(); g.arc(px, py, 9 * dpr, 0, 2 * Math.PI); g.fill();
  g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(px, py, 4 * dpr, 0, 2 * Math.PI); g.fill();
  // Main posée : anneau lumineux.
  if (els.held) { g.strokeStyle = '#ffffffaa'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(cx, cy, rv + 1 * dpr, 0, 2 * Math.PI); g.stroke(); }
}

// ---- Transition automatique ----
// Elle part du deck qui joue vers l'autre et choisit :
// - le moment : la prochaine phrase du morceau qui joue (8 mesures si elle arrive vite, sinon 4), l'autre part pile dessus ;
// - la longueur : 16 mesures si l'arrivant commence calme (une intro), 8 sinon, moins si le morceau qui part se termine avant ;
// - le mix : l'arrivant entre sans basses et un peu filtré, le crossfader va au milieu, les basses s'échangent net
//   sur une mesure à mi-parcours, puis le partant s'éloigne (filtre passe-haut, aigus) et s'arrête.
// Sans tempo connu (synchro impossible) : fondu de 8 secondes, basses échangées en douceur.
export let autoX = null;
export const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;

// L'arrivant commence-t-il calme ? Énergie de ses 8 premières mesures (depuis le cue) comparée à celle du morceau entier.
export function introCalm(id) {
  const info = deckInfo[id], s = state.decks[id];
  if (!info || !s.bpm) return false;
  const from = Math.floor(s.cue * info.bins), to = Math.min(info.rms.length, from + Math.round(((8 * 4 * 60) / s.bpm) * info.bins));
  const mean = (a, b) => { let x = 0; for (let k = a; k < b; k++) x += info.rms[k]; return x / Math.max(1, b - a); };
  return to - from > info.bins && mean(from, to) < 0.65 * mean(0, info.rms.length);
}

export function planTransition(from, to) {
  const F = decks.decks[from], T = decks.decks[to], sf = state.decks[from], st = state.decks[to];
  const now = engine.ctx.currentTime;
  const synced = sf.bpm && st.bpm && sf.sync && st.sync;
  if (!synced) return { from, to, synced: false, startAt: now + 0.1, dur: 8, bars: 0, wait: 0.1 };
  const bd = 60 / engine.bpm;   // les deux decks suivent le tempo global
  const beats = (F.posAt(now + 0.06) * sf.bpm) / 60;   // position du partant, en temps de son morceau
  let next = Math.ceil((beats + 0.5) / 32) * 32;
  if ((next - beats) * bd > 8) next = Math.ceil((beats + 0.5) / 16) * 16;
  const wait = 0.06 + (next - beats) * bd;
  let bars = introCalm(to) ? 16 : 8;
  if (!sf.loop) { const left = (F.duration * sf.bpm) / 60 - next; while (bars > 4 && bars * 4 > left) bars /= 2; }
  if (!st.loop) { const len = (T.duration * st.bpm) / 60 - (st.cue * st.bpm) / 60; while (bars > 4 && bars * 4 > len) bars /= 2; }
  return { from, to, synced: true, startAt: now + wait, dur: bars * 4 * bd, bars, wait };
}

export function autoTransition() {
  if (autoX) { cancelAuto(true); return; }
  const A = decks.decks.A, B = decks.decks.B;
  const from = A.playing && !B.playing ? 'A' : B.playing && !A.playing ? 'B' : A.playing && B.playing ? (state.decks.xfade <= 0.5 ? 'A' : 'B') : null;
  if (!from) { toast(t('deck.autoNone'), 3500); return; }
  const to = from === 'A' ? 'B' : 'A';
  const T = decks.decks[to], st = state.decks[to];
  if (!T.buffer) { toast(t('deck.autoLoad', { id: to }), 3500); return; }
  const plan = planTransition(from, to);
  // L'arrivant part de son cue, ramené sur une mesure (pour tomber en phase).
  if (st.bpm) { const bar = 240 / st.bpm; st.cue = Math.round(st.cue / bar) * bar; }
  if (T.playing) T.pause();
  T.seek(st.cue);
  Object.assign(st, { low: 0, mid: 0.5, high: 0.3, filter: 0.66 });
  T.updateTone();
  T.play(plan.startAt);
  autoX = { ...plan, x0: from === 'A' ? 0 : 1, x1: to === 'A' ? 0 : 1, swapped: false, swapAt: 0, timer: setInterval(autoStep, 25) };
  $('#deck-auto').classList.add('active');
  autoStep();
  toast(plan.synced ? t('deck.autoPlan', { from, to, bars: plan.bars, wait: plan.wait.toFixed(1) }) : t('deck.autoPlanFree', { from, to }), 5000);
}

export function autoStep() {
  const x = autoX;
  if (!x) return;
  const now = engine.ctx.currentTime;
  const u = (now - x.startAt) / x.dur;
  const sf = state.decks[x.from], st = state.decks[x.to];
  const F = decks.decks[x.from], T = decks.decks[x.to];
  if (u >= 1) { finishAuto(); return; }
  if (u >= 0) {
    state.decks.xfade = u < 0.4 ? lerp(x.x0, 0.5, smooth(u / 0.4)) : u < 0.7 ? 0.5 : lerp(0.5, x.x1, smooth((u - 0.7) / 0.25));
    st.high = lerp(0.3, 0.5, smooth(u / 0.5));
    st.filter = lerp(0.66, 0.5, smooth(u / 0.45));
    sf.filter = u < 0.65 ? 0.5 : lerp(0.5, 0.8, smooth((u - 0.65) / 0.35));
    sf.high = u < 0.7 ? 0.5 : lerp(0.5, 0.3, smooth((u - 0.7) / 0.3));
    if (!x.synced) { st.low = lerp(0, 0.5, smooth((u - 0.3) / 0.3)); sf.low = lerp(0.5, 0, smooth((u - 0.4) / 0.3)); }
  }
  // Échange des basses, net, sur la mesure du milieu : programmé à l'échantillon près.
  if (x.synced && !x.swapped) {
    const at = x.startAt + x.dur / 2;
    if (at - now < 0.1) {
      x.swapped = true;
      F.low.gain.setValueAtTime(-40, at);
      T.low.gain.setValueAtTime(0, at);
      x.swapAt = at;
    }
  }
  if (x.swapAt && now >= x.swapAt) { sf.low = 0; st.low = 0.5; }
  decks.updateXfade();
  F.updateTone();
  T.updateTone();
  renderDecks();
  const btn = $('#deck-auto');
  btn.style.setProperty('--p', `${Math.round(Math.max(0, u) * 100)}%`);
  $('#deck-auto-info').textContent = u < 0 ? t('deck.autoIn', { s: (-u * x.dur).toFixed(1) }) : `${x.from} → ${x.to} · ${Math.round(u * 100)}%`;
}

// Fin : le partant s'arrête, ses réglages reviennent au neutre ; l'arrivant reste seul, crossfader de son côté.
export function finishAuto() {
  const x = autoX;
  cancelAuto(false);
  const F = decks.decks[x.from];
  F.pause();
  Object.assign(state.decks[x.from], { low: 0.5, mid: 0.5, high: 0.5, filter: 0.5 });
  Object.assign(state.decks[x.to], { low: 0.5, mid: 0.5, high: 0.5, filter: 0.5 });
  state.decks.xfade = x.x1;
  decks.update();
  renderDecks();
  save();
  toast(t('deck.autoDone', { to: x.to }), 2500);
}

// Un geste de l'utilisateur sur les platines reprend la main : la transition s'arrête là où elle en est.
export function cancelAuto(manual) {
  if (!autoX) return;
  clearInterval(autoX.timer);
  if (manual && autoX.swapAt > engine.ctx.currentTime) {   // échange des basses programmé : annulé
    for (const id of DECK_IDS) decks.decks[id].low.gain.cancelScheduledValues(engine.ctx.currentTime);
  }
  autoX = null;
  $('#deck-auto').style.removeProperty('--p');
  $('#deck-auto').classList.remove('active');
  $('#deck-auto-info').textContent = '';
  if (manual) { decks.update(); save(); }
}

export function renderDecks() {
  if (!deckEls.A) return;
  for (const id of DECK_IDS) {
    const s = state.decks[id];
    const deck = decks.decks[id];
    const els = deckEls[id];
    els.name.textContent = s.name || t('deck.empty');
    els.name.classList.toggle('hint', !s.name);
    const rate = deck.baseRate();
    els.bpm.textContent = s.bpm ? `${Math.round(s.bpm * rate * 10) / 10} BPM` : t('deck.bpmUnknown');
    els.play.textContent = '';
    els.play.dataset.icon = deck.playing ? 'pause' : 'play';
    els.play.classList.add('icon-only');
    els.play.classList.toggle('active', deck.playing);
    els.sync.classList.toggle('active', s.sync);
    els.sync.disabled = !s.bpm;
    els.loop.classList.toggle('active', s.loop);
    els.pitch.value = s.pitch;
    els.pitch.disabled = s.sync && !!s.bpm;
    els.pitchLabel.textContent = s.sync && s.bpm ? `${rate >= 1 ? '+' : ''}${((rate - 1) * 100).toFixed(1)}%` : `${s.pitch >= 0 ? '+' : ''}${(s.pitch * 100).toFixed(1)}%`;
    for (const [k, knob] of els.knobs) {
      const p = s[k];
      knob.querySelector('.arc').setAttribute('d', p > 0.001 ? arcPath(p) : '');
      knob.querySelector('.value').textContent = k === 'vol' ? `${Math.round(p * 100)}%` : k === 'filter' ? (Math.abs(p - 0.5) < 0.02 ? '—' : p < 0.5 ? 'LP' : 'HP') : p < 0.02 ? 'kill' : `${p > 0.5 ? '+' : ''}${Math.round((p - 0.5) * 24)}`;
    }
  }
  $('#deck-xfade').value = state.decks.xfade;
}
