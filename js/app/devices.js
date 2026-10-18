// Appareils branchés (indicateur de l'en-tête) : l'APC Key 25 et les autres appareils MIDI, chacun associé à un
// instrument. Ses notes jouent cet instrument, ses potentiomètres pilotent sa page ; « Fenêtre active » (par défaut)
// suit la fenêtre active, comme avant. Un clic sur l'indicateur ouvre la liste : activité de chaque appareil,
// instrument associé, page des potentiomètres, Reconnecter, Paramètres (fenêtre MIDI).
import { t } from '../i18n.js';
import { Performer } from '../performer.js';
import { triggerPad, releasePad, setPage } from './actions.js';
import { $, UI_PAGES, apc, drum, engine, kickSynth, oscSynth, state, wm } from './core.js';
import { pageLabel } from './knobs.js';
import { renderKeysTarget } from './osc-ui.js';
import { buildPiano, pianoCount } from './piano.js';
import { midiHub } from './midi-ui.js';
import { save } from './save.js';
import { tlRecordArpNote, tlRecordNote } from './tl-record.js';

export const APC_DEVICE = 'apc';
// Instruments qu'un appareil peut jouer. Page des potentiomètres de chacun (aucune : ils ne font rien).
export const DEVICE_INSTS = ['auto', 'synth', 'osc', 'pads', 'tr', 'acid', 'decks', 'kick', 'mix', 'none'];
const INST_PAGE = { synth: 'synth', osc: 'osc', pads: 'pad', tr: 'tr', acid: 'acid', decks: 'decks', mix: 'mix_vol' };
// Notes vers les instruments de la TR-909 (plan de batterie General MIDI).
const GM_909 = { 35: 'bd', 36: 'bd', 37: 'rs', 38: 'sd', 40: 'sd', 39: 'hc', 41: 'lt', 43: 'lt', 45: 'mt', 47: 'mt', 48: 'ht', 50: 'ht', 42: 'ch', 44: 'ch', 46: 'oh', 49: 'cr', 57: 'cr', 51: 'rd', 59: 'rd' };
const PAD_NOTE0 = 36;   // do2 = pad 1 (contrôleurs à pads)

// Nombre de touches d'un clavier (clavier à l'écran du synthé).
export const KEY_COUNTS = [25, 32, 37, 49, 61, 76, 88];

/** Réglages valides d'une sauvegarde : { nom de l'appareil: { inst?, keys? } }. */
export function cleanDevices(saved) {
  const out = {};
  if (saved && typeof saved === 'object') {
    for (const [name, d] of Object.entries(saved)) {
      if (typeof name !== 'string' || name.length >= 120 || !d || typeof d !== 'object') continue;
      const e = {};
      if (DEVICE_INSTS.includes(d.inst) && d.inst !== 'auto') e.inst = d.inst;
      if (KEY_COUNTS.includes(d.keys)) e.keys = d.keys;
      if (Object.keys(e).length) out[name] = e;
    }
  }
  return out;
}

// Touches d'un appareil : réglées dans la liste, sinon devinées d'après son nom (« Keystation 49 »), sinon 25.
export function deviceKeys(id) {
  const k = state.devices?.[id]?.keys;
  if (KEY_COUNTS.includes(k)) return k;
  const m = id === APC_DEVICE ? null : String(id).match(/(?:^|\D)(25|32|37|49|61|76|88)(?!\d)/);
  return m ? +m[1] : 25;
}
export function setDeviceKeys(id, n) {
  if (!KEY_COUNTS.includes(n)) return;
  state.devices[id] = { ...state.devices[id], keys: n };
  save();
  renderDevices();
}
// L'appareil associé à un synthé ('synth' ou 'osc'), s'il y en a un de branché.
export const synthDevice = target => deviceList().find(d => deviceInst(d.id) === target)?.id ?? null;
// Touches du clavier à l'écran du synthé : celles de son appareil, 25 sans appareil.
export const pianoKeys = () => { const d = synthDevice('synth'); return d ? deviceKeys(d) : 25; };

export const deviceInst = id => state.devices?.[id]?.inst ?? 'auto';
// Page des potentiomètres d'un appareil : celle de son instrument, la page en cours s'il suit la fenêtre active,
// null s'ils ne pilotent rien.
export const devicePage = id => { const inst = deviceInst(id); return inst === 'auto' ? state.page : INST_PAGE[inst] ?? null; };

// Appareils branchés : [{ id, name, kind: 'apc' | 'midi' }] (un appareil MIDI à plusieurs ports n'apparaît qu'une fois).
export function deviceList() {
  const out = [];
  if (apc?.connected) out.push({ id: APC_DEVICE, name: `APC Key 25 ${apc.model === 'mk2' ? 'mk2' : 'mk1'}`, kind: 'apc' });
  for (const name of new Set(midiHub.inputs.map(p => p.name))) out.push({ id: name, name, kind: 'midi' });
  return out;
}

export function setDeviceInst(id, inst) {
  if (!DEVICE_INSTS.includes(inst)) return;
  releaseDevice(id);
  const e = { ...state.devices[id] };
  if (inst === 'auto') delete e.inst; else e.inst = inst;
  if (Object.keys(e).length) state.devices[id] = e; else delete state.devices[id];
  // L'APC sur un instrument fixe : ses potentiomètres passent sur sa page (et ne suivent plus la fenêtre active).
  if (id === APC_DEVICE && INST_PAGE[inst]) setPage(INST_PAGE[inst]);
  save();
  renderDevices();
}

// ---------- Notes des appareils associés à un instrument ----------

const performers = new Map();   // appareil -> Performer (mode accords et arpégiateur, propre à l'appareil)
const held = new Map();          // appareil -> Map(note -> instrument qui la joue)
function performerFor(id, inst) {
  let p = performers.get(id);
  if (!p) {
    p = new Performer(engine, () => state.play);
    p.onNote = (note, vel, on) => tlRecordNote(note, on, vel);
    p.onNoteAt = tlRecordArpNote;
    performers.set(id, p);
  }
  p.synth = () => (inst === 'osc' ? oscSynth : engine);
  return p;
}
function releaseDevice(id) {
  const notes = held.get(id);
  if (!notes) return;
  for (const [note, inst] of notes) keyOff(id, note, inst);
  held.delete(id);
}
function keyOff(id, note, inst) {
  if (inst === 'synth' || inst === 'osc') performers.get(id)?.noteOff(note);
  else if (inst === 'pads' && note - PAD_NOTE0 >= 0 && note - PAD_NOTE0 < 40) releasePad(note - PAD_NOTE0);
  else if (inst === 'kick') kickSynth.noteOff(note, false, undefined, `dev:${id}:${note}`);
}

/**
 * Note reçue d'un appareil. -> true si l'appareil joue un instrument fixe (la note est jouée ici), false s'il suit la
 * fenêtre active (la note suit le chemin habituel du clavier).
 */
export function deviceKey(id, { note, velocity, on }) {
  const inst = deviceInst(id);
  if (inst === 'auto') return false;
  let notes = held.get(id);
  if (!notes) held.set(id, (notes = new Map()));
  if (!on) {
    // La note s'arrête sur l'instrument qui l'a jouée (même si l'association a changé entre-temps).
    if (notes.has(note)) { keyOff(id, note, notes.get(note)); notes.delete(note); }
    return true;
  }
  if (inst === 'synth' || inst === 'osc') performerFor(id, inst).noteOn(note, velocity);
  else if (inst === 'pads') { const i = note - PAD_NOTE0; if (i >= 0 && i < 40) triggerPad(i); }
  else if (inst === 'tr') { const v = GM_909[note]; if (v) drum.trigger(v, undefined, Math.max(0.2, velocity)); }
  else if (inst === 'kick') kickSynth.noteOn(note, velocity, undefined, `dev:${id}:${note}`, state.kick.params);
  notes.set(note, inst);
  return true;
}

// ---------- Activité (une LED par appareil) ----------

const activity = new Map();   // appareil -> dernier message (ms)
export function deviceActivity(id) {
  activity.set(id, performance.now());
  const led = panel?.querySelector(`.dev-row[data-id="${CSS.escape(id)}"] .dev-led`);
  if (led) { led.classList.add('on'); clearTimeout(led._t); led._t = setTimeout(() => led.classList.remove('on'), 120); }
}

// ---------- Indicateur de l'en-tête ----------

let problem = null;   // { on, text } : dernier message d'état (APC introuvable, port occupé, accès refusé…)
export function setDeviceProblem(on, text) { problem = { on, text }; renderDevices(); }

export function renderDevices() {
  const box = $('#status');
  if (!box) return;
  const list = deviceList();
  const n = list.length;
  let text = n ? t(n > 1 ? 'dev.many' : 'dev.one', { n }) : problem?.text ?? t('status.none');
  // La page des potentiomètres de l'APC, quand il suit la fenêtre active (le repère du live).
  if (apc?.connected && deviceInst(APC_DEVICE) === 'auto') text += ` · ${pageLabel(state.page)}`;
  $('#status-text').textContent = text;
  box.classList.toggle('on', n > 0);
  box.classList.toggle('off', n === 0);
  box.classList.toggle('warn', !!problem && !problem.on);
  box.title = [t('dev.title'), problem && !problem.on ? problem.text : ''].filter(Boolean).join('\n');
  if (panel) fillPanel();
  renderKeysTarget();   // choix du clavier MIDI dans les fenêtres des synthés
  if (pianoKeys() !== pianoCount) buildPiano();
}

// ---------- Liste des appareils ----------

let panel = null;
export function closeDevices() {
  panel?.remove();
  panel = null;
  window.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('keydown', onKey, true);
}
const outside = e => { if (panel && !panel.contains(e.target) && !e.target.closest('#status')) closeDevices(); };
const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeDevices(); } };

export function toggleDevices() {
  if (panel) { closeDevices(); return; }
  panel = document.createElement('div');
  panel.className = 'clip-menu dev-panel';
  document.body.appendChild(panel);
  fillPanel();
  const r = $('#status').getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - panel.offsetWidth - 8))}px`;
  panel.style.top = `${r.bottom + 6}px`;
  setTimeout(() => {
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
  });
}

const instLabel = inst => t(`dev.inst.${inst}`);
function fillPanel() {
  const list = deviceList();
  panel.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'cm-head';
  head.textContent = list.length ? t(list.length > 1 ? 'dev.many' : 'dev.one', { n: list.length }) : t('dev.noneHead');
  panel.appendChild(head);
  if (!list.length) {
    const p = document.createElement('div');
    p.className = 'hint dev-empty';
    p.textContent = problem && !problem.on ? problem.text : t('dev.empty');
    panel.appendChild(p);
  }
  for (const d of list) {
    const row = document.createElement('div');
    row.className = 'dev-row';
    row.dataset.id = d.id;
    const top = document.createElement('div');
    top.className = 'dev-top';
    const led = document.createElement('i');
    led.className = 'dev-led';
    led.title = t('dev.ledTitle');
    const name = document.createElement('b');
    name.textContent = d.name;
    const kind = document.createElement('span');
    kind.className = 'hint';
    const maps = state.midiMap.filter(m => m.port === d.id).length;
    kind.textContent = d.kind === 'apc' ? t('dev.apcKind') : maps ? t('dev.maps', { n: maps }) : t('dev.midiKind');
    top.append(led, name, kind);
    const inst = document.createElement('select');
    inst.className = 'dev-inst';
    for (const k of DEVICE_INSTS) inst.add(new Option(instLabel(k), k));
    inst.value = deviceInst(d.id);
    inst.addEventListener('change', () => setDeviceInst(d.id, inst.value));
    const line = document.createElement('label');
    line.className = 'cm-row';
    line.append(Object.assign(document.createElement('span'), { textContent: t('dev.inst') }), inst);
    row.append(top, line);
    // Clavier MIDI : son nombre de touches (le clavier à l'écran du synthé en a autant).
    if (d.kind === 'midi') {
      const keys = document.createElement('select');
      keys.className = 'dev-keys';
      for (const n of KEY_COUNTS) keys.add(new Option(t('dev.keysN', { n }), n));
      keys.value = deviceKeys(d.id);
      keys.addEventListener('change', () => setDeviceKeys(d.id, +keys.value));
      const kl = document.createElement('label');
      kl.className = 'cm-row';
      kl.append(Object.assign(document.createElement('span'), { textContent: t('dev.keys') }), keys);
      row.appendChild(kl);
    }
    // APC qui suit la fenêtre active : la page de ses potentiomètres (l'ancien sélecteur de l'en-tête).
    if (d.kind === 'apc' && deviceInst(d.id) === 'auto') {
      const sel = document.createElement('select');
      sel.id = 'apc-page';
      for (const page of UI_PAGES) sel.add(new Option(pageLabel(page), page));
      sel.value = state.page;
      sel.title = t('apc.page.title');
      sel.addEventListener('change', () => setPage(sel.value));
      const pl = document.createElement('label');
      pl.className = 'cm-row';
      pl.append(Object.assign(document.createElement('span'), { textContent: t('dev.page') }), sel);
      row.appendChild(pl);
    }
    panel.appendChild(row);
  }
  const foot = document.createElement('div');
  foot.className = 'dev-foot';
  const again = document.createElement('button');
  again.dataset.icon = 'reset';
  again.textContent = t('dev.reconnect');
  again.title = t('dev.reconnectTitle');
  again.addEventListener('click', reconnectDevices);
  const settings = document.createElement('button');
  settings.dataset.icon = 'dial';
  settings.textContent = t('dev.settings');
  settings.title = t('dev.settingsTitle');
  settings.addEventListener('click', () => { closeDevices(); wm.toggle('monitor', true); wm.bring?.('monitor'); });
  foot.append(again, settings);
  panel.appendChild(foot);
  const hint = document.createElement('div');
  hint.className = 'hint dev-hint';
  hint.textContent = t('dev.hint');
  panel.appendChild(hint);
}

// Reconnecter : les ports MIDI sont fermés puis rouverts (sans débrancher le câble).
export async function reconnectDevices() {
  for (const id of [...held.keys()]) releaseDevice(id);
  await Promise.all([apc?.reconnect?.(), midiHub.reconnect()].map(p => Promise.resolve(p).catch(() => {})));
  renderDevices();
}

export function buildDevices() {
  const box = $('#status');
  box.setAttribute('role', 'button');
  box.tabIndex = 0;
  box.addEventListener('click', toggleDevices);
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDevices(); } });
  midiHub.addEventListener('raw', e => deviceActivity(e.detail.port));
  midiHub.addEventListener('connection', renderDevices);
  renderDevices();
}
