// Fichiers : kits, projet, morceau, réglages de chaque outil.
import { mergeAcidState } from '../acid.js';
import { cleanCurve } from '../curves.js';
import { DECK_IDS } from '../decks.js';
import { t } from '../i18n.js';
import { mergeKickState } from '../kickdesign.js';
import { packBanks, unpack } from '../kits.js';
import { LIB_CATS } from '../library.js';
import { CHANNELS, mergeMixState } from '../mixer.js';
import { mergeOscState } from '../osc.js';
import { PAGES, defaultPositions } from '../params.js';
import { mergePatch } from '../patch.js';
import { mergePlayState } from '../performer.js';
import { PRESETS, migratePreset, presetById } from '../presets.js';
import { FILE_EXT, packFile, readFile } from '../project.js';
import { download, stamp } from '../recorder.js';
import { mergeScState } from '../sidechain.js';
import * as store from '../storage.js';
import { mergeTlState } from '../timeline.js';
import { mergeTrState } from '../tr909.js';
import { renderAcid, renderAcidKnobs } from './acid-ui.js';
import { clearBank } from './actions.js';
import { $, BANKS, acid, drum, engine, mixer, padKey, patch, performer, sidechain, state, timeline, wm } from './core.js';
import { renderCurveEditor } from './curve-ui.js';
import { renderKick, renderKickKnobs } from './kick-ui.js';
import { applyGlobals, renderKnobs } from './knobs.js';
import { renderLibrary } from './library-ui.js';
import { renderAll, toast } from './misc.js';
import { renderFx, renderMixer } from './mixer-ui.js';
import { oscChanged, oscPresetCache } from './osc-ui.js';
import { renderMixerDest, renderPatch } from './patch-ui.js';
import { renderPlayControls } from './play.js';
import { acidPresets, kickPresets, synthPresets, trPresets } from './presets-bar.js';
import { rollPresetOptions } from './roll-ui.js';
import { save, saveTimer, setProjectLoading, stateSnapshot } from './save.js';
import { mergeScenes, renderScenes, setCurrentScene, setQueuedScene } from './scenes.js';
import { renderSidechain } from './sidechain-ui.js';
import { renderPresets, setSynthFamily } from './synth-ui.js';
import { setBpm } from './tempo.js';
import { bufferCache, loadBank, loadPads } from './sounds.js';
import { loadTlBuffers, renderTl, tlRec, tlStopRec } from './tl.js';
import { tlSelect } from './tl-select.js';
import { renderTr } from './tr909-ui.js';

// ---------- Kits (export / import) ----------

// Fichier d'origine d'un pad ; null pour les sons de synthèse (réencodés en WAV).
export async function padBytes(pad) {
  if (pad.sampleId?.startsWith('user:')) return (await store.loadSample(pad.sampleId))?.data ?? null;
  if (pad.sampleId?.startsWith('lib:')) {
    const r = await fetch(`sounds/${pad.sampleId.slice(4)}`);
    return r.ok ? r.arrayBuffer() : null;
  }
  return null;
}

export async function unpackPad(s) {
  if (!s) return null;
  const id = `user:${crypto.randomUUID()}`;
  await store.saveSample(id, { name: s.name, data: s.bytes });
  const buffer = await engine.ctx.decodeAudioData(s.bytes.slice(0)).catch(() => null);
  return { name: s.name, color: s.color, sampleId: id, bpm: s.bpm || 0, p: { ...defaultPositions('pad'), ...s.p }, buffer };
}

export function replaceBank(b, pads) {
  state.banks[b].forEach((old, i) => {
    engine.stopPad(padKey(b, i));
    if (old?.sampleId?.startsWith('user:')) store.deleteSample(old.sampleId).catch(() => {});
  });
  state.banks[b] = pads;
}

export const PAD_QUANTS = [0, 1, 2, 3, 4, 8, 16];
export function bindKits() {
  $('#bank-clear').addEventListener('click', clearBank);
  const pq = $('#pad-quant');
  for (const q of PAD_QUANTS) pq.add(new Option(q === 0 ? t('pq.free') : q === 1 ? t('pq.beat1') : q < 4 ? t('pq.beats', { n: q }) : q === 4 ? t('pq.bar') : t('pq.bars', { n: q / 4 }), q));
  pq.value = state.padQuant;
  engine.padQuant = state.padQuant;
  pq.addEventListener('change', () => { state.padQuant = engine.padQuant = +pq.value; save(); });
  $('#kit-export-bank').addEventListener('click', async () => {
    toast(t('kit.exportingBank'));
    await loadBank(state.bank);
    const blob = await packBanks([state.banks[state.bank]], padBytes, { kind: 'bank', bpm: state.bpm });
    download(blob, `${t('kit.file.bank', { n: state.bank + 1 })}-${stamp()}.apckit`);
    toast(t('kit.exportedBank'));
  });
  $('#kit-export-all').addEventListener('click', async () => {
    toast(t('kit.exportingAll'));
    await loadPads(state.banks.flat());
    const blob = await packBanks(state.banks, padBytes, { kind: 'session', bpm: state.bpm, globals: state.globals, preset: state.preset, tr: state.tr, mix: state.mix, scenes: state.scenes });
    download(blob, `gabberkey-session-${stamp()}.apckit`);
    toast(t('kit.exportedAll'));
  });
  $('#kit-import').addEventListener('click', () => $('#kit-file').click());
  $('#kit-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast(t('kit.importing'));
      const kitData = await unpack(file);
      if (kitData.kind === 'session') {
        if (!confirm(t('kit.confirmSession'))) return;
        for (let b = 0; b < BANKS; b++) replaceBank(b, await Promise.all((kitData.banks[b] ?? new Array(40).fill(null)).map(unpackPad)));
        Object.assign(state.globals, kitData.globals);
        applyGlobals();
        state.preset = migratePreset(kitData.preset);
        setSynthFamily(presetById(state.preset).family);
        engine.setVoice(presetById(state.preset).voice);
        if (kitData.bpm) setBpm(kitData.bpm);
        if (kitData.scenes) { state.scenes = mergeScenes(kitData.scenes); setCurrentScene(null); renderScenes(); }
        if (kitData.mix) { state.mix = mergeMixState(kitData.mix); mixer.reload(); CHANNELS.forEach(renderFx); renderMixer(); }
        if (kitData.tr) { drum.stop(); state.tr = mergeTrState(kitData.tr); drum.setVolume(state.tr.globals.volume); renderTr(); }
      } else {
        if (state.banks[state.bank].some(Boolean) && !confirm(t('kit.confirmBank', { n: state.bank + 1 }))) return;
        replaceBank(state.bank, await Promise.all(kitData.banks[0].map(unpackPad)));
      }
      renderAll();
      renderPresets();
      save();
      toast(t('kit.imported'));
    } catch (err) {
      alert(t('kit.failed', { msg: err.message }));
    }
  });
}

// ---------- Fichiers : projet, morceau, réglages de chaque outil ----------

// Réglages de chaque outil : ce qu'on enregistre, et comment on le recharge.
export const pickIds = (obj, page) => Object.fromEntries(PAGES[page].params.filter(d => Number.isFinite(obj[d.id])).map(d => [d.id, obj[d.id]]));
export const TOOL_IO = {
  tr: {
    get: () => ({ tr: state.tr }),
    set: d => { drum.stop(); state.tr = mergeTrState(d.tr); drum.setVolume(state.tr.globals.volume); renderTr(); trPresets?.render(); },
  },
  acid: {
    get: () => ({ acid: state.acid }),
    set: d => { acid.stop(); state.acid = mergeAcidState(d.acid); acid.update(); renderAcid(); renderAcidKnobs(); acidPresets?.render(); },
  },
  osc: {
    get: () => ({ osc: state.osc }),
    set: d => { state.osc = mergeOscState(d.osc); oscPresetCache.clear(); oscChanged(false); rollPresetOptions(); },
  },
  piano: {
    get: () => ({ preset: state.preset, synth: pickIds(state.globals, 'synth'), play: state.play, user: state.synthUser, pick: state.synthPick, dirty: state.synthDirty }),
    set: d => {
      const preset = presetById(migratePreset(d.preset));
      state.preset = preset.id;
      setSynthFamily(preset.family);
      engine.setVoice(preset.voice);
      Object.assign(state.globals, d.synth && typeof d.synth === 'object' ? pickIds(d.synth, 'synth') : {});
      applyGlobals();
      state.play = mergePlayState(d.play);
      if (Array.isArray(d.user)) state.synthUser = d.user.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && PRESETS.some(p => p.id === u.base));
      state.synthPick = state.synthUser.some(u => u.id === d.pick) ? d.pick : null;
      state.synthDirty = !!d.dirty;
      synthPresets?.render();
      performer.refresh();
      renderPresets();
      renderPlayControls();
    },
  },
  kick: {
    get: () => ({ kick: state.kick }),
    set: d => { state.kick = mergeKickState(d.kick); renderKick(); renderKickKnobs(); kickPresets?.render(); },
  },
  mix: {
    get: () => ({ mix: state.mix, sc: state.sc, fx: pickIds(state.globals, 'fx'), eq: pickIds(state.globals, 'eq') }),
    set: d => {
      state.mix = mergeMixState(d.mix);
      mixer.reload();
      CHANNELS.forEach(renderFx);
      state.sc = mergeScState(d.sc);
      sidechain.apply();
      renderSidechain();
      for (const page of ['fx', 'eq']) if (d[page] && typeof d[page] === 'object') Object.assign(state.globals, pickIds(d[page], page));
      applyGlobals();
      renderMixer();
    },
  },
  patch: {
    get: () => ({ patch: state.patch }),
    set: d => { state.patch = mergePatch(d.patch); patch.rebuild(); renderPatch(); renderMixerDest(); },
  },
  scenes: {
    get: () => ({ scenes: state.scenes }),
    set: d => { state.scenes = mergeScenes(d.scenes); setCurrentScene(null); setQueuedScene(null); renderScenes(); },
  },
};
export const FILE_TOOLS = Object.keys(TOOL_IO);

// Sons utilisés par le morceau, par le projet.
export const songSampleIds = () => state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)).filter(Boolean);
export const projectSampleIds = () => [
  ...songSampleIds(), ...state.banks.flat().map(p => p?.sampleId), ...state.userSounds.map(s => s.sampleId),
  ...DECK_IDS.map(id => state.decks[id]?.sampleId),
].filter(Boolean);

export async function saveFile(kind) {
  let data, ids = [];
  if (kind === 'project') { data = stateSnapshot(); ids = projectSampleIds(); }
  else if (kind === 'song') {
    ids = songSampleIds();
    // Les sons importés qu'il utilise voyagent avec lui (ils reviennent dans « Mes sons » à l'ouverture).
    const used = new Set(state.tl.tracks.flatMap(tr => tr.fx.filter(b => b.fx === 'curve').map(b => b.p.curve)));
    data = { bpm: state.bpm, tl: { bars: state.tl.bars, loop: state.tl.loop, zoom: state.tl.zoom, tracks: state.tl.tracks }, userSounds: state.userSounds.filter(u => ids.includes(u.sampleId)),
      curves: state.curves.filter(c => used.has(c.id)) };
  } else data = TOOL_IO[kind].get();
  toast(t('file.saving'));
  const blob = await packFile(kind, JSON.parse(JSON.stringify(data)), ids, id => store.loadSample(id));
  download(blob, `gabberkey-${t(`file.slug.${kind}`)}-${stamp()}${FILE_EXT}`);
  toast(t('file.saved', { what: t(`file.kind.${kind}`) }), 3000);
}

export function openFile() {
  $('#file-input').click();
}

export async function loadFile(file, demo = false) {
  let f;
  try { f = await readFile(file); } catch (err) { alert(t('file.failed', { msg: err.message })); return; }
  const what = t(`file.kind.${f.kind}`);
  if (f.kind === 'project' && !confirm(t('file.confirmProject'))) return;
  if (f.kind === 'song' && !demo && state.tl.tracks.some(tr => tr.clips.length || tr.fx.length) && !confirm(t('file.confirmSong'))) return;
  // Sons embarqués : rangés comme les sons importés (mêmes identifiants).
  for (const [id, s] of Object.entries(f.samples)) {
    await store.saveSample(id, { name: s.name, data: s.data });
    bufferCache.delete(id);
  }
  if (f.kind === 'project') {
    // Tout l'état est remplacé : on l'écrit tel quel, puis l'application redémarre dessus.
    setProjectLoading(true);
    clearTimeout(saveTimer);
    await store.saveState(f.data);
    location.reload();
    return;
  }
  if (f.kind === 'song') {
    if (tlRec) await tlStopRec();
    timeline.stop(true);
    if (Number.isFinite(f.data.bpm)) setBpm(f.data.bpm);
    const tl = mergeTlState({ ...f.data.tl, armed: state.tl.armed, source: state.tl.source, playhead: 0 });
    state.tl.bars = tl.bars;
    state.tl.loop = tl.loop;
    state.tl.zoom = tl.zoom;
    state.tl.playhead = 0;
    state.tl.tracks = tl.tracks;
    for (const u of Array.isArray(f.data.userSounds) ? f.data.userSounds : []) {
      if (typeof u?.sampleId !== 'string' || !u.sampleId.startsWith('user:') || state.userSounds.some(x => x.sampleId === u.sampleId)) continue;
      const num = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : 0);
      state.userSounds.push({ sampleId: u.sampleId, name: String(u.name ?? '').slice(0, 40), cat: LIB_CATS.some(c => c.id === u.cat) ? u.cat : 'mine',
        bpm: num(u.bpm, 40, 300), bars: num(u.bars, 0, 256), loop: !!u.loop });
    }
    // Courbes du designer d'effet : celles qu'on n'a pas encore rejoignent les tiennes.
    for (const c of (Array.isArray(f.data.curves) ? f.data.curves : []).map(cleanCurve)) {
      if (c?.id?.startsWith('u:') && !state.curves.some(x => x.id === c.id)) state.curves.push(c);
    }
    renderCurveEditor();
    tlSelect(null, null);
    await loadTlBuffers();
    renderTl();
    renderLibrary();
  } else {
    TOOL_IO[f.kind].set(f.data);
    if (!wm.isOpen(f.kind)) wm.toggle(f.kind, true);
    renderKnobs();
  }
  save();
  toast(demo ? t('tl.demoLoaded', { bpm: state.bpm }) : t('file.loaded', { what }), demo ? 5000 : 3000);
}

export function bindFiles() {
  $('#file-save').addEventListener('click', () => saveFile('project'));
  $('#file-open').addEventListener('click', openFile);
  $('#tl-save').addEventListener('click', () => saveFile('song'));
  $('#tl-open').addEventListener('click', openFile);
  $('#file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) loadFile(file);
  });
}
