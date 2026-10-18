// Clavier à l'écran, clavier de l'ordinateur, bouton SUSTAIN (page EQ).
import { acidKey } from './acid-ui.js';
import { setPage } from './actions.js';
import { $, performer, setShiftHeld, state } from './core.js';
import { pianoKeys } from './devices.js';
import { rollKey } from './roll-ui.js';

// ---------- Interface : piano ----------

export let pianoBase = 48;   // do3, comme l'APC Key 25 au démarrage
export let pianoCount = 25;  // touches affichées : celles du clavier MIDI du synthé (25 sans appareil)
// Première touche selon la taille du clavier (comme les claviers du commerce).
const FIRST_KEY = { 25: 48, 32: 41, 37: 48, 49: 36, 61: 36, 76: 28, 88: 21 };
export const heldNotes = new Set();
export const BLACK = new Set([1, 3, 6, 8, 10]);
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function buildPiano() {
  const piano = $('#piano');
  if (!piano) return;
  const count = pianoKeys();
  if (count !== pianoCount) { pianoCount = count; pianoBase = FIRST_KEY[count] ?? 48; }
  piano.innerHTML = '';
  piano.dataset.keys = count;
  const last = pianoBase + count - 1;
  const whites = [];
  for (let n = pianoBase; n <= last; n++) if (!BLACK.has(n % 12)) whites.push(n);
  const w = 100 / whites.length;
  let wi = 0;
  for (let n = pianoBase; n <= last; n++) {
    const el = document.createElement('div');
    el.dataset.note = n;
    if (BLACK.has(n % 12)) {
      el.className = 'black';
      el.style.left = `calc(${wi * w}% - ${w * 0.3}%)`;
      el.style.width = `${w * 0.6}%`;
    } else {
      el.className = 'white';
      if (n % 12 === 0) el.innerHTML = `<span>C${Math.floor(n / 12) - 1}</span>`;
      wi++;
    }
    el.classList.toggle('on', heldNotes.has(n));
    el.addEventListener('pointerdown', e => {
      try { el.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      playNote(n, 0.8, true);
    });
    el.addEventListener('pointerup', () => playNote(n, 0, false));
    piano.appendChild(el);
  }
}

export function playNote(note, velocity, on) {
  if (acidKey(note, velocity, on)) return;
  rollKey(note, velocity, on);
  if (on) performer.noteOn(note, velocity); else performer.noteOff(note);
  setPianoKey(note, on);
}

export function setPianoKey(note, on) {
  if (on) heldNotes.add(note); else heldNotes.delete(note);
  // Suit les changements d'octave du clavier (OCT-/OCT+ ne sont pas transmis en MIDI).
  if (on && (note < pianoBase || note > pianoBase + pianoCount - 1)) {
    pianoBase = note - (((note % 12) + 12) % 12) - (note > pianoBase ? 12 * Math.max(1, Math.floor((pianoCount - 1) / 12) - 1) : 0);
    pianoBase = Math.max(0, Math.min(128 - pianoCount, pianoBase));
    buildPiano();
    return;
  }
  $(`#piano [data-note="${note}"]`)?.classList.toggle('on', on);
}

export const KEYMAP = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon'];
export let kbOctave = 60;

export function bindComputerKeyboard() {
  const down = new Map();
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.repeat || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Shift') setShiftHeld(true);
    if (e.code === 'KeyZ') { kbOctave = Math.max(24, kbOctave - 12); return; }
    if (e.code === 'KeyX') { kbOctave = Math.min(96, kbOctave + 12); return; }
    const idx = KEYMAP.indexOf(e.code);
    if (idx < 0) return;
    const note = kbOctave + idx;
    down.set(e.code, note);
    playNote(note, 0.8, true);
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') setShiftHeld(false);
    const note = down.get(e.code);
    if (note === undefined) return;
    down.delete(e.code);
    playNote(note, 0, false);
  });
}

// Bouton SUSTAIN = accès à la page EQ. Clic court : bascule ; maintien : EQ le temps de l'appui.
// Marche aussi si le bouton est à bascule (il envoie alors 127 puis 0 à l'appui suivant).
export let pageBeforeEq = 'synth', eqPressedAt = 0, eqOpenedByPress = false;
export function onSustainButton(on) {
  if (on) {
    eqPressedAt = performance.now();
    if (state.page === 'eq') { eqOpenedByPress = false; setPage(pageBeforeEq); }
    else { pageBeforeEq = state.page; eqOpenedByPress = true; setPage('eq'); }
  } else if (eqOpenedByPress && performance.now() - eqPressedAt > 400) {
    eqOpenedByPress = false;
    setPage(pageBeforeEq);
  }
}
