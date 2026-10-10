// Mode accords et arpégiateur.
import { t } from '../i18n.js';
import { ARP_MODES, ARP_RATES, CHORD_MODES } from '../performer.js';
import { $, performer, state } from './core.js';
import { toast } from './misc.js';
import { save } from './save.js';

// ---------- Mode accords et arpégiateur ----------

export function setPlay(changes, announce = false) {
  Object.assign(state.play, changes);
  performer.refresh();
  renderPlayControls();
  if (announce) {
    const p = state.play;
    toast(p.arp ? t('play.toastArp', { chord: t(`chord.${p.chord}`), rate: `1/${p.rate}`, mode: t(`arp.${p.mode}`) }) : t('play.toastChord', { chord: t(`chord.${p.chord}`) }));
  }
  save();
}

export function buildPlayControls() {
  const box = $('#synth-play');
  const select = (field, values, label, cast = v => v) => {
    const el = document.createElement('select');
    el.dataset.field = field;
    el.title = t(`play.${field}`);
    for (const v of values) el.add(new Option(label(v), v));
    el.addEventListener('change', () => setPlay({ [field]: cast(el.value) }));
    return el;
  };
  const toggle = field => {
    const el = document.createElement('button');
    el.dataset.field = field;
    el.textContent = t(`play.${field}`);
    el.title = t(`play.${field}Title`);
    el.addEventListener('click', () => setPlay({ [field]: !state.play[field] }));
    return el;
  };
  const group = (title, ...els) => {
    const g = document.createElement('div');
    g.className = 'play-group';
    const h = document.createElement('span');
    h.textContent = title;
    g.append(h, ...els);
    return g;
  };
  const gate = document.createElement('input');
  gate.type = 'range'; gate.min = 0.1; gate.max = 1; gate.step = 0.05;
  gate.dataset.field = 'gate';
  gate.title = t('play.gate');
  gate.addEventListener('input', () => setPlay({ gate: +gate.value }));
  box.append(
    group(t('play.chords'), select('chord', CHORD_MODES, v => t(`chord.${v}`))),
    group(t('play.arpeggio'), toggle('arp'),
      select('rate', ARP_RATES, v => `1/${v}`, Number),
      select('mode', ARP_MODES, v => t(`arp.${v}`)),
      select('octaves', [1, 2, 3], v => t('play.oct', { n: v }), Number),
      gate, toggle('latch')),
  );
  renderPlayControls();
}

export function renderPlayControls() {
  const p = state.play;
  for (const el of document.querySelectorAll('#synth-play [data-field]')) {
    const f = el.dataset.field;
    if (el.tagName === 'BUTTON') el.classList.toggle('active', !!p[f]);
    else el.value = p[f];
    if (!['arp', 'chord'].includes(f)) el.disabled = !p.arp;
  }
}
