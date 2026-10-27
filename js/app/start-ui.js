// Fenêtre Nouveau morceau : un style (tempo, suite d'accords, kick, batterie, basse, accords, mélodie), un plan de
// morceau (parties et longueurs, modifiables) et ce qui est rempli. « Créer le morceau » en fait un plan de morceau
// (js/songplan.js), construit par js/app/compose.js.
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { cleanPlan, planFromStart } from '../songplan.js';
import { MAX_SECTIONS, PLANS, PLAN_IDS, SECTION_BARS, SECTION_TYPES, START_PARTS, STYLES, STYLE_IDS } from '../songstart.js';
import { BEATS_PER_BAR } from '../timeline.js';
import { composeSong } from './compose.js';
import { $, state, wm } from './core.js';
import { isBassSound, isSynthSound } from './gen.js';
import { toast } from './misc.js';
import { save } from './save.js';

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const field = (label, input) => el('label', {}, el('span', { textContent: label }), input);
const style = () => STYLES[state.start.style];

// Le style choisi remet son tempo et sa suite d'accords.
export function setStartStyle(id) {
  if (!(id in STYLES)) return;
  Object.assign(state.start, { style: id, bpm: STYLES[id].bpm, prog: STYLES[id].prog });
  state.start.parts.bass = !!STYLES[id].bass;   // décochée quand le kick fait la basse
  save();
  renderStart();
}
export function setStartPlan(id) {
  if (!(id in PLANS)) return;
  state.start.plan = id;
  state.start.sections = PLANS[id].map(([type, bars]) => ({ type, bars }));
  save();
  renderStart();
}

// ---- Créer le morceau ----

/** Remplace la timeline par le morceau du style et du plan choisis (une seule étape d'annulation). -> résumé, ou null. */
export async function createSong() {
  if (!parseProgression(state.start.prog).chords.length) { toast(t('gen.none'), 3000); return null; }
  const { plan } = cleanPlan(planFromStart(state.start), { isSound: isSynthSound, isBassSound });
  return plan ? composeSong(plan) : null;
}

// ---- Fenêtre ----

export function buildStart() {
  const box = $('#newsong');
  $('#file-new').addEventListener('click', () => { wm.toggle('start', true); renderStart(); });
  const styleSel = el('select', { id: 'start-style' });
  for (const id of STYLE_IDS) styleSel.add(new Option(t(`start.style.${id}`), id));
  styleSel.addEventListener('change', () => setStartStyle(styleSel.value));
  const bpm = el('input', { id: 'start-bpm', type: 'number', min: 40, max: 240, step: 1 });
  bpm.addEventListener('change', () => { state.start.bpm = Math.min(240, Math.max(40, Math.round(+bpm.value || STYLES[state.start.style].bpm))); save(); renderStart(); });
  const prog = el('input', { id: 'start-prog', type: 'text', spellcheck: false, title: t('gen.progHint') });
  prog.addEventListener('input', () => { state.start.prog = prog.value; save(); renderStartInfo(); });
  const planSel = el('select', { id: 'start-plan' });
  for (const id of PLAN_IDS) planSel.add(new Option(t(`start.plan.${id}`), id));
  planSel.addEventListener('change', () => setStartPlan(planSel.value));
  const parts = el('div', { className: 'gen-row start-parts' });
  for (const p of START_PARTS) {
    const c = el('input', { type: 'checkbox' });
    c.dataset.part = p;
    c.addEventListener('change', () => { state.start.parts[p] = c.checked; save(); });
    parts.append(el('label', { className: 'start-part' }, c, el('span', { textContent: t(`start.part.${p}`) })));
  }
  const add = el('button', { id: 'start-add', textContent: t('start.addSection') });
  add.dataset.icon = 'plus';
  add.addEventListener('click', () => {
    if (state.start.sections.length >= MAX_SECTIONS) return;
    state.start.sections.push({ type: 'drop', bars: 16 });
    save();
    renderStart();
  });
  const create = el('button', { id: 'start-create', className: 'primary', textContent: t('start.create') });
  create.dataset.icon = 'plus';
  create.addEventListener('click', async () => { create.disabled = true; try { await createSong(); } finally { create.disabled = false; } });
  box.append(
    el('div', { className: 'gen-row' }, field(t('start.style'), styleSel), field(t('start.bpm'), bpm), field(t('gen.prog'), prog)),
    el('div', { className: 'hint start-style-info' }),
    el('div', { className: 'gen-row' }, field(t('start.plan'), planSel), el('span', { className: 'hint start-total' })),
    el('div', { className: 'start-sections' }),
    el('div', { className: 'gen-row' }, add),
    el('div', { className: 'start-parts-title', textContent: t('start.parts') }),
    parts,
    el('div', { className: 'gen-row gen-actions' }, el('span', { className: 'hint', textContent: t('start.replaceHint') }), create),
  );
  renderStart();
}

function sectionRow(s, k) {
  const secs = state.start.sections;
  const type = el('select');
  for (const id of SECTION_TYPES) type.add(new Option(t(`start.sec.${id}`), id));
  type.value = s.type;
  type.addEventListener('change', () => { s.type = type.value; save(); renderStart(); });
  const bars = el('select');
  for (const n of SECTION_BARS) bars.add(new Option(t('tl.bars', { n }), n));
  bars.value = s.bars;
  bars.addEventListener('change', () => { s.bars = +bars.value; save(); renderStart(); });
  const move = (d, label, icon) => {
    const b = el('button', { title: label, textContent: icon, disabled: k + d < 0 || k + d >= secs.length });
    b.addEventListener('click', () => { [secs[k], secs[k + d]] = [secs[k + d], secs[k]]; save(); renderStart(); });
    return b;
  };
  const del = el('button', { title: t('start.remove'), textContent: '✕', disabled: secs.length <= 1 });
  del.addEventListener('click', () => { secs.splice(k, 1); save(); renderStart(); });
  const row = el('div', { className: `start-sec start-sec-${s.type}` }, el('span', { className: 'start-sec-n', textContent: String(k + 1) }), type, bars,
    move(-1, t('start.up'), '↑'), move(1, t('start.down'), '↓'), del);
  return row;
}

export function renderStart() {
  const box = $('#newsong');
  if (!box?.childElementCount) return;
  const st = state.start;
  box.querySelector('#start-style').value = st.style;
  box.querySelector('#start-bpm').value = st.bpm;
  if (document.activeElement !== box.querySelector('#start-prog')) box.querySelector('#start-prog').value = st.prog;
  box.querySelector('#start-plan').value = st.plan;
  box.querySelector('.start-sections').replaceChildren(...st.sections.map(sectionRow));
  box.querySelector('#start-add').disabled = st.sections.length >= MAX_SECTIONS;
  for (const c of box.querySelectorAll('.start-parts input')) {
    c.checked = st.parts[c.dataset.part];
    c.parentElement.title = c.dataset.part === 'bass' && !style().bass ? t('start.addBass') : '';
  }
  renderStartInfo();
}

function renderStartInfo() {
  const box = $('#newsong');
  if (!box) return;
  const st = state.start, sty = style();
  const { chords, bad } = parseProgression(st.prog);
  box.querySelector('.start-style-info').textContent = t('start.styleInfo', {
    kick: t(`kick.preset.${sty.kick}`), chords: chords.map(c => c.name).join(' – ') || '—',
    bass: sty.bass ? t(`gen.bstyle.${sty.bass.style}`) : t('start.noBass'),
    lead: sty.lead.breizh ? t('win.breizh') : t(`gen.style.${sty.lead.style}`),
  }) + (bad.length ? ` · ${t('gen.bad', { list: bad.join(' ') })}` : '');
  const bars = st.sections.reduce((s, x) => s + x.bars, 0), sec = Math.round(bars * BEATS_PER_BAR * 60 / st.bpm);
  box.querySelector('.start-total').textContent = t('start.total', { bars, min: Math.floor(sec / 60), sec: String(sec % 60).padStart(2, '0') });
}
