// Fenêtre Nouveau morceau : un style (tempo, suite d'accords, kick, batterie, basse, accords, mélodie), un plan de
// morceau (parties et longueurs, modifiables) et ce qui est rempli. « Créer le morceau » remplace la timeline : un
// bloc par partie sur des pistes nommées (kick, batterie, basse, accords, lead), les montées du designer de montée
// avant chaque drop, un repère par partie ; le générateur et le designer de kick prennent les réglages du style.
import { BU_BARS } from '../buildup.js';
import { parseProgression } from '../chords.js';
import { t } from '../i18n.js';
import { KICK_PRESETS, kickDefaults, kickTailNote } from '../kickdesign.js';
import { prepareKickClips } from '../kicksynth.js';
import { catColor } from '../library.js';
import { DRUM_KITS, MAX_SECTIONS, PLANS, PLAN_IDS, SECTION_BARS, SECTION_TYPES, START_PARTS, STYLES, STYLE_IDS, drumHits, kickLine, layoutSections, plays, styleBass } from '../songstart.js';
import { BEATS_PER_BAR, newTrack } from '../timeline.js';
import { breizhDraft, breizhParts, refreshBreizh, renderBreizh } from './breizh-ui.js';
import { generateBuildup } from './buildup-ui.js';
import { $, engine, newPad, state, timeline, tlHistory, wm } from './core.js';
import { bassSeq, chordsSeq, leadSeq, refreshDraft, renderGen, soundFields } from './gen.js';
import { renderKick } from './kick-ui.js';
import { libManifest, renderLibrary } from './library-ui.js';
import { renderMarkers } from './markers.js';
import { renderAll, toast } from './misc.js';
import { save } from './save.js';
import { applyPreset } from './synth-ui.js';
import { setBpm } from './tempo.js';
import { TL_HEAD, ensureBuffer, loadTlBuffers, renderTl } from './tl.js';

const BUILDUP_TRACKS = 6;   // pistes laissées libres pour les éléments des montées
const BASS_GAIN = 0.7;      // la basse reste sous le kick, qui tient le grave

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

// ---- Batterie : pads des banques de la bibliothèque ----

// Pad qui joue un son de la bibliothèque (banque `bankName`, son `name`) : celui des banques s'il y est, sinon posé sur
// le premier pad libre. -> { bank, pad } | null
async function libraryPad(bankName, name) {
  const lb = libManifest?.banks.find(b => b.name === bankName);
  const p = lb?.pads.find(x => x?.name === name);
  if (!p) return null;
  const sampleId = `lib:${p.file}`;
  for (let b = 0; b < state.banks.length; b++) {
    const i = state.banks[b].findIndex(x => x?.sampleId === sampleId);
    if (i >= 0) return { bank: b, pad: i };
  }
  const buffer = await ensureBuffer(sampleId);
  if (!buffer) return null;
  for (let b = 0; b < state.banks.length; b++) {
    const i = state.banks[b].findIndex(x => !x);
    if (i < 0) continue;
    state.banks[b][i] = newPad(name, catColor(p.cat ?? 'drums'), sampleId, buffer, p.bpm || 0);
    return { bank: b, pad: i };
  }
  return null;
}

// ---- Créer le morceau ----

/** Remplace la timeline par le morceau du style et du plan choisis (une seule étape d'annulation). -> résumé, ou null. */
export async function createSong() {
  const st = state.start;
  if (state.tl.tracks.some(tr => tr.clips.length) && !confirm(t('start.confirm'))) return null;
  if (!parseProgression(st.prog).chords.length) { toast(t('gen.none'), 3000); return null; }
  tlHistory.commit();
  tlHistory.paused = true;
  try { return await fillSong(); } finally {
    tlHistory.paused = false;
    save();
  }
}

async function fillSong() {
  const st = state.start, sty = style();
  const { chords } = parseProgression(st.prog);
  if (timeline.playing) timeline.stop();
  toast(t('start.creating'), 30000);
  setBpm(st.bpm);

  // Le générateur, le designer de kick et le synthé prennent les réglages du style.
  const g = state.gen;
  Object.assign(g, { prog: st.prog, bars: 2, preset: sty.chords.preset, rhythm: sty.chords.rhythm, register: 'mid' });
  if (!sty.lead.breizh) Object.assign(g.lead, { preset: sty.lead.preset, style: sty.lead.style, density: sty.lead.density });
  const bass = styleBass(sty);
  Object.assign(g.bassline, { style: bass.style, preset: bass.preset });
  for (const tab of ['chords', 'lead', 'bass']) refreshDraft(tab, true);
  state.kick.params = { ...kickDefaults(), ...KICK_PRESETS[sty.kick] };
  state.kick.preset = sty.kick;
  if (sty.lead.breizh) {
    Object.assign(state.breizh, { tonic: chords[0].root, mode: chords[0].intervals.includes(3) ? 'minor' : 'major', dance: 'andro' });
    refreshBreizh(true);
  }

  // Timeline neuve : pistes des parties cochées, puis pistes libres pour les montées.
  const parts = START_PARTS.filter(p => st.parts[p] && p !== 'buildups');
  state.tl.tracks = Array.from({ length: parts.length + BUILDUP_TRACKS }, () => newTrack());
  parts.forEach((p, i) => { state.tl.tracks[i].name = t(`start.track.${p}`); });
  state.tl.tracks[0].arm = true;
  const secs = layoutSections(st.sections, BEATS_PER_BAR);
  const total = secs.reduce((s, x) => s + x.len, 0);
  state.tl.bars = Math.max(4, Math.ceil(total / BEATS_PER_BAR));
  state.tl.playhead = 0;
  const multi = type => secs.filter(s => s.type === type).length > 1;
  const secName = s => (multi(s.type) ? `${t(`start.sec.${s.type}`)} ${s.n}` : t(`start.sec.${s.type}`));
  state.tl.markers = secs.map(s => ({ id: crypto.randomUUID(), beat: s.start, name: secName(s).slice(0, 32) }));

  // Passage de la suite : 2 mesures par accord.
  const phrase = chords.length * 2 * BEATS_PER_BAR;
  const kickSeq = kickLine(chords, 2 * BEATS_PER_BAR, kickTailNote(state.kick.params));
  const chordNotes = chordsSeq(chords), bassNotes = st.parts.bass ? bassSeq(chords) : [];
  const leadOf = density => {
    if (sty.lead.breizh) {
      const d = breizhDraft(), p = breizhParts()[0];
      return { seq: p.seq, pat: d.pat, preset: p.preset, ...(p.tune ? { tune: p.tune } : {}), name: t('start.track.lead') };
    }
    const keep = g.lead.density;
    g.lead.density = density;
    const seq = leadSeq(chords);
    g.lead.density = keep;
    return { seq, pat: phrase, preset: g.lead.preset, name: t(`gen.style.${g.lead.style}`) };
  };
  const leads = { drop: leadOf(sty.lead.density), break: leadOf('low') };
  const kit = DRUM_KITS[sty.drums.kit];
  const drumPads = {};
  if (st.parts.drums) for (const s of ['clap', 'hat', 'off', 'ride', 'crash']) drumPads[s] = await libraryPad(kit.bank, kit[s]);

  let blocks = 0;
  const note = (track, sec, fields) => {
    state.tl.tracks[track].clips.push({ id: crypto.randomUUID(), type: 'note', start: sec.start, len: sec.len, loop: false, ...fields });
    blocks++;
  };
  for (const sec of secs) {
    parts.forEach((p, track) => {
      if (!plays(p, sec.type, sty)) return;
      if (p === 'kick') note(track, sec, { seq: kickSeq.map(n => ({ ...n })), pat: phrase, kick: { ...state.kick.params }, kickSrc: `p:${sty.kick}`, name: t('kick.melodyName'), cat: 'kick', color: catColor('kick') });
      else if (p === 'chords') note(track, sec, { seq: chordNotes.map(n => ({ ...n })), pat: phrase, preset: sty.chords.preset, name: st.prog.slice(0, 32), cat: 'pad', color: catColor('pad') });
      else if (p === 'bass') note(track, sec, { seq: bassNotes.map(n => ({ ...n })), pat: phrase, ...soundFields(bass.preset), gain: BASS_GAIN, name: t(`gen.bstyle.${bass.style}`), cat: 'bass', color: catColor('bass') });
      else if (p === 'lead') {
        const l = leads[sec.type === 'break' ? 'break' : 'drop'];
        note(track, sec, { seq: l.seq.map(n => ({ ...n })), pat: l.pat, preset: l.preset, ...(l.tune ? { tune: l.tune } : {}), name: l.name, cat: 'lead', color: catColor('lead') });
      } else if (p === 'drums') {
        for (const h of drumHits(sty.drums, sec.len, sec.type === 'drop')) {
          const ref = drumPads[h.sound], pad = ref && state.banks[ref.bank][ref.pad];
          if (!pad) continue;
          state.tl.tracks[track].clips.push({ id: crypto.randomUUID(), type: 'pad', bank: ref.bank, pad: ref.pad, sampleId: pad.sampleId, name: pad.name, color: pad.color,
            cat: 'drums', start: sec.start + h.t, len: 0.5, loop: false });
          blocks++;
        }
      }
    });
  }

  // Montées : le designer de montée avant chaque drop (ses éléments sur les pistes libres, après celles des parties).
  if (st.parts.buildups) {
    state.tl.tracks[0].arm = false;
    state.tl.tracks[parts.length].arm = true;
    const keep = state.buildup.bars;
    for (const [k, sec] of secs.entries()) {
      if (sec.type !== 'build' || secs[k + 1]?.type !== 'drop') continue;
      state.buildup.bars = [...BU_BARS].reverse().find(b => b <= sec.bars) ?? BU_BARS[0];
      state.tl.playhead = sec.start + sec.len;
      const made = await generateBuildup();
      if (made) blocks += made.tracks.length;
    }
    state.buildup.bars = keep;
    state.tl.playhead = 0;
    state.tl.tracks[parts.length].arm = false;
    state.tl.tracks[0].arm = true;
  }

  applyPreset(sty.lead.breizh ? breizhParts()[0].preset : sty.lead.preset);   // le clavier joue le son du lead
  await prepareKickClips(state.tl.tracks, engine.ctx.sampleRate);
  await loadTlBuffers();
  timeline.updateAllTracks();
  renderAll();
  renderGen();
  renderKick();
  if (sty.lead.breizh) renderBreizh();
  // Zoom : le plus de morceau possible dans la timeline, depuis le début.
  const scroll = $('#tl-scroll');
  if (scroll?.clientWidth) { state.tl.zoom = Math.max(16, Math.min(64, (scroll.clientWidth - TL_HEAD - 24) / state.tl.bars)); scroll.scrollLeft = 0; }
  renderMarkers();
  renderTl();
  renderLibrary();
  save();
  const sec = Math.round(total * 60 / st.bpm);
  const summary = { bars: total / BEATS_PER_BAR, blocks, markers: secs.length };
  toast(t('start.done', { style: t(`start.style.${st.style}`), bars: summary.bars, bpm: st.bpm, min: Math.floor(sec / 60), sec: String(sec % 60).padStart(2, '0'), n: blocks }), 6000);
  return summary;
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
