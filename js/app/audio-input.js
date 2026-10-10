// Entrée audio (micro, carte son) : fenêtre « Entrée audio » (appareil, niveau, vumètre, écoute de retour, latence)
// et source « Entrée audio » de l'enregistrement de la timeline.
// L'écoute de retour est coupée par défaut (pas de larsen avec un micro près des haut-parleurs).
// Latence : en jouant par-dessus la lecture, on entend le morceau un peu en retard et le micro arrive lui aussi en retard ;
// la prise est recalée d'autant (estimation automatique, ou valeur réglée à la main).
import { t } from '../i18n.js';
import { $, engine, mixer, state, wm } from './core.js';
import { toast } from './misc.js';
import { save } from './save.js';

export const input = { stream: null, src: null, gain: null, monitor: null, meter: null, data: null, device: null };
export const defaultInputState = () => ({ device: '', level: 1, monitor: false, latency: null });   // latency : ms, null = automatique
export function cleanInputState(s) {
  const d = defaultInputState();
  if (typeof s?.device === 'string') d.device = s.device;
  if (Number.isFinite(s?.level)) d.level = Math.min(2, Math.max(0, s.level));
  d.monitor = !!s?.monitor;
  if (Number.isFinite(s?.latency)) d.latency = Math.min(500, Math.max(0, s.latency));
  return d;
}

// Latence à compenser (s) : réglée, sinon celle annoncée par le navigateur (sortie) plus une marge pour l'entrée.
export function inputLatency() {
  if (state.input.latency !== null) return state.input.latency / 1000;
  const ctx = engine.ctx;
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + 0.01;
}

// Nœud que l'enregistrement de la timeline écoute (créé à la première ouverture de l'entrée).
export function inputNode() {
  if (!input.gain) {
    const ctx = engine.ctx;
    input.gain = ctx.createGain();
    input.monitor = ctx.createGain();
    input.meter = ctx.createAnalyser();
    input.meter.fftSize = 1024;
    input.data = new Float32Array(input.meter.fftSize);
    input.gain.connect(input.meter);
    input.gain.connect(input.monitor).connect(mixer.input('tl'));
    applyInput();
  }
  return input.gain;
}

export function applyInput() {
  if (!input.gain) return;
  const now = engine.ctx.currentTime;
  input.gain.gain.setTargetAtTime(state.input.level, now, 0.02);
  input.monitor.gain.setTargetAtTime(state.input.monitor ? 1 : 0, now, 0.02);
}

/** Ouvre l'entrée choisie (demande l'autorisation la première fois) ; true si elle est prête. */
export async function openInput() {
  inputNode();
  if (input.stream && input.device === state.input.device) return true;
  closeInput();
  try {
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
    if (state.input.device) audio.deviceId = { exact: state.input.device };
    input.stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (err) {
    toast(t('input.denied', { msg: err.message }), 5000);
    renderInput();
    return false;
  }
  input.device = state.input.device;
  input.src = engine.ctx.createMediaStreamSource(input.stream);
  input.src.connect(input.gain);
  renderInput();
  listDevices();
  return true;
}

export function closeInput() {
  input.src?.disconnect();
  input.stream?.getTracks().forEach(tr => tr.stop());
  input.stream = input.src = null;
  input.device = null;
}

export function inputLevel() {
  if (!input.meter || !input.stream) return 0;
  input.meter.getFloatTimeDomainData(input.data);
  let p = 0;
  for (const v of input.data) p = Math.max(p, Math.abs(v));
  return p;
}

async function listDevices() {
  const sel = $('#input-device');
  if (!sel || !navigator.mediaDevices?.enumerateDevices) return;
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
  sel.innerHTML = '';
  sel.add(new Option(t('input.default'), ''));
  devs.forEach((d, i) => { if (d.deviceId && d.deviceId !== 'default') sel.add(new Option(d.label || t('input.device', { n: i + 1 }), d.deviceId)); });
  sel.value = [...sel.options].some(o => o.value === state.input.device) ? state.input.device : '';
}

export function buildInput() {
  $('#input-open').addEventListener('click', () => (input.stream ? (closeInput(), renderInput()) : openInput()));
  $('#input-device').addEventListener('change', e => { state.input.device = e.target.value; save(); if (input.stream) openInput(); });
  $('#input-level').addEventListener('input', e => { state.input.level = +e.target.value; applyInput(); renderInput(); });
  $('#input-level').addEventListener('change', () => save());
  $('#input-monitor').addEventListener('change', e => { state.input.monitor = e.target.checked; applyInput(); save(); });
  $('#input-latency-auto').addEventListener('change', e => { state.input.latency = e.target.checked ? null : Math.round(inputLatency() * 1000); renderInput(); save(); });
  $('#input-latency').addEventListener('input', e => { state.input.latency = +e.target.value; renderInput(); });
  $('#input-latency').addEventListener('change', () => save());
  // Vumètre (fenêtre ouverte, entrée active).
  let lvl = 0;
  (function frame() {
    if (wm?.isOpen('input')) {
      lvl = Math.max(inputLevel(), lvl * 0.9);
      const cv = $('#input-meter'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = lvl > 0.95 ? '#ff5a36' : lvl > 0.7 ? '#ffd23f' : '#3dd68c';
      g.fillRect(0, 0, cv.width * Math.min(1, lvl), cv.height);
    }
    requestAnimationFrame(frame);
  })();
  renderInput();
}

export function renderInput() {
  if (!$('#input-open')) return;
  const on = !!input.stream;
  $('#input-open').textContent = on ? t('input.close') : t('input.open');
  $('#input-open').classList.toggle('active', on);
  $('#input-status').textContent = on ? t('input.on', { name: input.stream.getAudioTracks()[0]?.label || t('input.default') }) : t('input.off');
  $('#input-level').value = state.input.level;
  $('#input-level-v').textContent = `${Math.round(state.input.level * 100)} %`;
  $('#input-monitor').checked = state.input.monitor;
  const auto = state.input.latency === null;
  $('#input-latency-auto').checked = auto;
  $('#input-latency').disabled = auto;
  $('#input-latency').value = Math.round(inputLatency() * 1000);
  $('#input-latency-v').textContent = `${Math.round(inputLatency() * 1000)} ms`;
}

export const inputWinOpened = () => listDevices();
