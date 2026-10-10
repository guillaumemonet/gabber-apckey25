// Claviers et contrôleurs MIDI autres que l'APC, et MIDI learn (fenêtre MIDI) :
// - les notes jouent le synthé de la fenêtre active (et s'enregistrent), comme le clavier de l'APC ; la pédale tient les notes ;
// - le MIDI learn assigne un potentiomètre, un fader ou un bouton de l'appareil à une cible : K1-K8 de la page active,
//   faders du mixeur et du master, volumes des bus, lecture / arrêt, enregistrement, boucle.
import { t } from '../i18n.js';
import { CHANNELS } from '../mixer.js';
import { MidiHub } from '../midi.js';
import { ClockFollower, ClockSender } from '../midiclock.js';
import { toValue } from '../params.js';
import { BUS_COUNT } from '../timeline.js';
import { turnKnob } from './actions.js';
import { busName, renderBus } from './buses-ui.js';
import { monitorLog, setStatus } from './controller.js';
import { $, apc, engine, mixer, oscSynth, state, timeline } from './core.js';
import { masterDef, renderMixer, renderStrip } from './mixer-ui.js';
import { save } from './save.js';
import { setBpm } from './tempo.js';
import { renderTl, tlRecToggle, tlToggle } from './tl.js';

export const midiHub = new MidiHub();
let learnTarget = null;   // cible en cours d'apprentissage
let saveTimer = 0;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };   // un fader balayé : un seul enregistrement

// Cibles du MIDI learn. `button` : déclenchée à l'appui (valeur ≥ 64 ou note jouée).
export const LEARN_TARGETS = [
  ...Array.from({ length: 8 }, (_, k) => ({ id: `knob:${k}`, label: () => t('learn.knob', { n: k + 1 }) })),
  ...CHANNELS.map(ch => ({ id: `mix:${ch}`, label: () => t('learn.fader', { ch: t(`mix.ch.${ch}`) }) })),
  { id: 'master', label: () => t('learn.master') },
  ...Array.from({ length: BUS_COUNT }, (_, b) => ({ id: `bus:${b}`, label: () => t('learn.bus', { bus: busName(b) }) })),
  ...['play', 'stop', 'rec', 'loop'].map(id => ({ id, button: true, label: () => t(`learn.${id}`) })),
];
const targetOf = id => LEARN_TARGETS.find(x => x.id === id);

/** Assignations valides d'une sauvegarde : [{ port, ch, kind: 'cc' | 'note', n, target }]. */
export function cleanMidiMap(list) {
  return (Array.isArray(list) ? list : []).filter(m => typeof m?.port === 'string' && Number.isInteger(m.ch) && ['cc', 'note'].includes(m.kind)
    && Number.isInteger(m.n) && targetOf(m.target)).map(m => ({ port: m.port, ch: m.ch, kind: m.kind, n: m.n, target: m.target }));
}
const same = (m, s) => m.port === s.port && m.ch === s.ch && m.kind === s.kind && m.n === s.n;
const srcLabel = m => `${m.port} · ${m.kind === 'cc' ? `CC ${m.n}` : `${t('learn.note')} ${m.n}`}${m.ch ? ` · ${t('learn.ch')} ${m.ch + 1}` : ''}`;

// Une commande de l'appareil a bougé (valeur 0..127).
function apply(target, v) {
  const x = v / 127;
  if (target.startsWith('knob:')) { turnKnob(+target.slice(5), { value: x }); return; }
  if (target.startsWith('mix:')) {
    const ch = target.slice(4);
    state.mix.channels[ch].vol = x;
    mixer.update();
    renderStrip(ch);
    saveSoon();
    return;
  }
  if (target === 'master') {
    state.globals.master = x;
    engine.set('master', toValue(masterDef(), x));
    renderMixer();
    saveSoon();
    return;
  }
  if (target.startsWith('bus:')) {
    const b = +target.slice(4);
    state.tl.buses[b].vol = +(x * 1.5).toFixed(3);
    timeline.updateBus(b);
    renderBus(b);
    saveSoon();
  }
}
const press = target => {
  if (target === 'play') tlToggle();
  else if (target === 'stop') { if (timeline.playing) tlToggle(); }
  else if (target === 'rec') tlRecToggle();
  else if (target === 'loop') { state.tl.loop = !state.tl.loop; renderTl(); save(); }
};
const down = new Set();   // boutons (CC) déjà enfoncés : un appui = une action

function onControl(src, value, on) {
  if (learnTarget) {
    if (!on && src.kind === 'note') return;
    state.midiMap = state.midiMap.filter(m => !same(m, src) && m.target !== learnTarget);
    state.midiMap.push({ ...src, target: learnTarget });
    stopLearn();
    save();
    return;
  }
  for (const m of state.midiMap) {
    if (!same(m, src)) continue;
    const tg = targetOf(m.target);
    if (tg.button) {
      const key = `${m.port}|${m.ch}|${m.kind}|${m.n}`;
      if (on && !down.has(key)) { down.add(key); press(m.target); }
      if (!on) down.delete(key);
    } else apply(m.target, src.kind === 'note' ? (on ? 127 : 0) : value);
  }
}

export function startLearn(id) {
  learnTarget = learnTarget === id ? null : id;
  midiHub.learning = !!learnTarget;
  renderMidi();
}
export function stopLearn() {
  learnTarget = null;
  midiHub.learning = false;
  renderMidi();
}

// Horloge MIDI : envoi vers une sortie, ou tempo et lecture suivis depuis une entrée (state.midiClock = { out, in }).
export let clockSender = null;
export const clockFollower = new ClockFollower({
  onTempo: bpm => setBpm(bpm),
  onStart: () => { state.tl.playhead = 0; if (!timeline.playing) tlToggle(); },
  onContinue: () => { if (!timeline.playing) tlToggle(); },
  onStop: () => { if (timeline.playing) tlToggle(); },
});
function linkClockOut() {
  clockSender.port = midiHub.outputs.find(p => p.name === state.midiClock.out) ?? null;
  if (clockSender.port) clockSender.port.open?.().catch(() => {});
}

export async function initMidi() {
  clockSender = new ClockSender(engine.ctx, () => engine.bpm);
  timeline.onTransport = (on, beat, at) => { if (on) clockSender.start(beat, at); else clockSender.stop(); };
  midiHub.addEventListener('realtime', ({ detail: d }) => { if (d.port === state.midiClock.in) clockFollower.message(d.byte, d.ms); });
  buildMidi();
  midiHub.isCommand = (port, ch, n) => state.midiMap.some(m => m.kind === 'note' && same(m, { port, ch, kind: 'note', n }));
  midiHub.addEventListener('key', e => apc.dispatchEvent(new CustomEvent('key', { detail: e.detail })));   // même chemin que le clavier de l'APC
  midiHub.addEventListener('pedal', e => { engine.setSustain(e.detail.on); oscSynth?.setSustain?.(e.detail.on); });
  midiHub.addEventListener('cc', ({ detail: d }) => onControl({ port: d.port, ch: d.ch, kind: 'cc', n: d.cc }, d.value, d.value >= 64));
  midiHub.addEventListener('button', ({ detail: d }) => onControl({ port: d.port, ch: d.ch, kind: 'note', n: d.note }, d.on ? 127 : 0, d.on));
  midiHub.addEventListener('raw', e => monitorLog(e.detail));
  midiHub.addEventListener('connection', ({ detail }) => {
    linkClockOut();
    renderMidi();
    if (!apc?.connected && detail.inputs.length) setStatus(true, t('status.midi', { name: detail.inputs[0] }));
  });
  window.addEventListener('keydown', e => { if (learnTarget && e.key === 'Escape') stopLearn(); });
  try { await midiHub.init(); } catch { /* accès MIDI refusé : l'APC l'a déjà signalé */ }
}

function buildMidi() {
  const box = $('#midi-learn');
  box.innerHTML = `<div class="midi-devices hint"></div>
    <div class="midi-clock"><b>${t('clock.title')}</b><label>${t('clock.out')}<select class="clock-out"></select></label><label>${t('clock.in')}<select class="clock-in"></select></label></div>
    <div class="learn-head"><b>${t('learn.title')}</b><span class="hint">${t('learn.hint')}</span></div><div class="learn-list"></div>`;
  box.querySelector('.clock-out').addEventListener('change', e => { state.midiClock.out = e.target.value; linkClockOut(); save(); });
  box.querySelector('.clock-in').addEventListener('change', e => { state.midiClock.in = e.target.value; save(); });
  renderMidi();
}

export function renderMidi() {
  const box = $('#midi-learn');
  if (!box) return;
  const ins = midiHub.inputs.map(p => p.name);
  box.querySelector('.midi-devices').textContent = ins.length ? t('learn.devices', { list: ins.join(', ') }) : t('learn.noDevice');
  // Choix de l'horloge (un appareil absent reste affiché tant qu'il est choisi).
  const fill = (sel, names, cur) => {
    sel.innerHTML = '';
    sel.add(new Option(t('clock.none'), ''));
    for (const n of new Set([...names, ...(cur ? [cur] : [])])) sel.add(new Option(n, n));
    sel.value = cur;
  };
  fill(box.querySelector('.clock-out'), midiHub.outputs.map(p => p.name), state.midiClock.out);
  fill(box.querySelector('.clock-in'), ins, state.midiClock.in);
  const list = box.querySelector('.learn-list');
  list.innerHTML = '';
  for (const tg of LEARN_TARGETS) {
    const row = document.createElement('div');
    row.className = 'learn-row' + (learnTarget === tg.id ? ' learning' : '');
    row.dataset.target = tg.id;
    const maps = state.midiMap.filter(m => m.target === tg.id);
    const name = document.createElement('span');
    name.textContent = tg.label();
    const src = document.createElement('em');
    src.textContent = learnTarget === tg.id ? t('learn.waiting') : maps.length ? maps.map(srcLabel).join(' ; ') : '—';
    const learn = document.createElement('button');
    learn.className = 'learn-btn' + (learnTarget === tg.id ? ' active' : '');
    learn.textContent = learnTarget === tg.id ? t('learn.cancel') : t('learn.learn');
    learn.addEventListener('click', () => startLearn(tg.id));
    const del = document.createElement('button');
    del.className = 'icon-only';
    del.dataset.icon = 'trash';
    del.title = t('learn.remove');
    del.disabled = !maps.length;
    del.addEventListener('click', () => { state.midiMap = state.midiMap.filter(m => m.target !== tg.id); renderMidi(); save(); });
    row.append(name, src, learn, del);
    list.appendChild(row);
  }
}

