// GabberKey : point d'entrée. Crée les moteurs audio au clic sur « Démarrer » et construit l'interface ;
// le reste de l'application est dans js/app/ (un module par domaine).
import { Acid303 } from './acid.js';
import { APC } from './apc.js';
import { Engine } from './audio.js';
import { Decks } from './decks.js';
import { t } from './i18n.js';
import { renderDefaultKit } from './kit.js';
import { Mixer } from './mixer.js';
import { OscSynth, oscValues } from './osc.js';
import { Patch } from './patch.js';
import { Performer } from './performer.js';
import { presetById } from './presets.js';
import { Recorder } from './recorder.js';
import { Sidechain } from './sidechain.js';
import { Timeline } from './timeline.js';
import { TR909 } from './tr909.js';
import { WindowManager } from './windows.js';
import { buildAcid } from './app/acid-ui.js';
import { onPadState, setPage } from './app/actions.js';
import { bindController, renderLeds, setStatus } from './app/controller.js';
import {
  $, acid, apc, decks, drum, engine, libAdded, mixer, oscSynth, padKey, performer, provide, sidechain, state, timeline,
  viz, wm
} from './app/core.js';
import { buildCurve } from './app/curve-ui.js';
import { buildDecks } from './app/decks-ui.js';
import { FILE_TOOLS, bindFiles, bindKits, openFile, saveFile } from './app/files.js';
import { buildGen, presetPatch } from './app/gen.js';
import { buildKick } from './app/kick-ui.js';
import { applyGlobals, buildApcPage, buildKnobRow, pageForWindow, renderPages } from './app/knobs.js';
import { buildLibrary } from './app/library-ui.js';
import { buildCpu, buildMetro } from './app/metro-ui.js';
import { drawMeter, renderAll, toast } from './app/misc.js';
import { buildMixer } from './app/mixer-ui.js';
import { buildOsc, oscFor, setKeys } from './app/osc-ui.js';
import { buildBanks, buildEditor, buildPads } from './app/pads.js';
import { buildPatch } from './app/patch-ui.js';
import { buildPerf } from './app/perf-fx.js';
import { bindComputerKeyboard, buildPiano } from './app/piano.js';
import { buildPluginBar, onWindowToggle } from './app/plugins.js';
import { buildKickPresets, buildTrPresets } from './app/presets-bar.js';
import { buildRoll } from './app/roll-ui.js';
import { restore, save } from './app/save.js';
import { buildScenes } from './app/scenes.js';
import { loadPad } from './app/sounds.js';
import { buildSidechain, clipKicks, isDuckedSound, padCat, padLoopKicks, soundKicks } from './app/sidechain-ui.js';
import { buildPresets } from './app/synth-ui.js';
import { bindTempo } from './app/tempo.js';
import { buildTl, clipBuffer, loadTlBuffers, tlRec } from './app/tl.js';
import { tlRecordArpNote, tlRecordNote } from './app/tl-record.js';
import { buildTr, onTrStep, renderTr } from './app/tr909-ui.js';
import { cleanRecordings, initHistory } from './app/undo.js';
import { buildViz } from './app/viz-ui.js';

// ---------- Démarrage ----------

$('#start-btn').addEventListener('click', () => start().catch(err => {
  console.error(err);
  $('#start-msg').textContent = t('start.error', { msg: err.message });
}));

async function start() {
  $('#start-btn').disabled = true;
  $('#start-msg').textContent = t('start.generating');
  provide({ engine: new Engine() });
  await engine.resume();
  provide({ kit: await renderDefaultKit() });
  await restore();
  applyGlobals();
  engine.setBpm(state.bpm);
  engine.setVoice(presetById(state.preset).voice);
  engine.onPadState = onPadState;
  provide({ recorder: new Recorder(engine.ctx, engine.output) });
  provide({ drum: new TR909(engine, () => state.tr) });
  drum.setVolume(state.tr.globals.volume);
  drum.onStep = onTrStep;
  drum.onPattern = () => { renderTr(); renderLeds(); save(); };
  // Toutes les sources passent par la table de mixage avant le master.
  provide({ mixer: new Mixer(engine, () => state.mix) });
  engine.padBus.disconnect();
  engine.padBus.connect(mixer.input('pads'));
  // Sidechain : le synthé et les sons mélodiques passent par des bus que les kicks font baisser.
  provide({ sidechain: new Sidechain(engine, () => state.sc) });
  engine.pumpGain.disconnect();
  engine.pumpGain.connect(sidechain.synth).connect(mixer.input('synth'));
  sidechain.pads.connect(engine.padBus);
  engine.padOut = pad => (isDuckedSound(pad.sampleId, padCat(pad)) ? sidechain.pads : engine.padBus);
  sidechain.onKick = time => viz?.kick(time);   // flash du visualiseur sur chaque kick
  drum.onKick = time => { sidechain.kick(time); tlRec?.audio.find(r => r.source === 'tr')?.kicks.push(time); };
  sidechain.isRunning = () => timeline?.playing || drum.running || [...engine.padVoices.values()].some(v => v.mode === 'loop');
  sidechain.loopKicks = padLoopKicks;
  provide({ acid: new Acid303(engine, () => state.acid) });
  acid.out.connect(sidechain.acid).connect(mixer.input('acid'));
  provide({ oscSynth: new OscSynth(engine.ctx, () => state.bpm) });
  oscSynth.setValues(oscValues(state.osc.params));
  oscSynth.out.connect(sidechain.osc).connect(mixer.input('osc'));
  await Decks.load(engine.ctx);
  provide({ decks: new Decks(engine, () => state.decks) });
  decks.out.connect(mixer.input('decks'));
  provide({ patch: new Patch(engine, mixer, () => state.patch) });   // sorties des voies -> master ou boîtes à effets
  drum.setDestinations(Object.fromEntries(['bd', 'snare', 'toms', 'hats', 'cym'].map(g => [g, mixer.input('tr')])));
  provide({ timeline: new Timeline(engine, () => state.tl, clipBuffer, mixer.input('tl')) });
  engine.gridBusy = () => timeline.playing;
  timeline.getPad = (b, i) => state.banks[b]?.[i];
  timeline.loadPad = loadPad;
  timeline.padKey = padKey;
  timeline.getPatch = presetPatch;
  timeline.getOsc = clip => oscFor(clip, oscSynth);
  sidechain.tl.connect(mixer.input('tl'));
  timeline.duckOutput = sidechain.tl;
  timeline.isDucked = clip => isDuckedSound(clip.sampleId, clip.cat) && !clip.kickBeats;
  timeline.isKickPad = pad => padCat(pad) === 'kick' && !soundKicks(pad.sampleId);
  timeline.kicksOf = clipKicks;
  timeline.onKick = time => sidechain.kick(time);
  timeline.onHalt = () => sidechain.clear();
  // Le clavier passe par le mode accords / l'arpégiateur ; les notes produites s'enregistrent dans la timeline.
  provide({ performer: new Performer(engine, () => state.play) });
  performer.synth = () => (state.keys === 'osc' ? oscSynth : engine);
  performer.onNote = (note, vel, on) => tlRecordNote(note, on, vel);
  performer.onNoteAt = tlRecordArpNote;
  await loadTlBuffers();
  cleanRecordings();
  bindTempo();

  buildPads();
  buildBanks();
  buildEditor();
  buildApcPage();
  buildKnobRow($('#pad-knobs'), 'pad');
  buildKnobRow($('#tr-knobs'), 'tr');
  buildKnobRow($('#master-eq'), 'eq');
  buildKnobRow($('#master-fx'), 'fx');
  buildPiano();
  buildPresets();
  buildPerf();
  buildTr();
  buildTrPresets();
  buildAcid();
  buildKick();
  buildKickPresets();
  buildCurve();
  buildDecks();
  buildOsc();
  buildViz();
  buildMetro();
  buildCpu();
  buildPatch();
  buildMixer();
  buildSidechain();
  buildTl();
  buildRoll();
  initHistory();
  buildGen();
  buildScenes();
  bindKits();
  bindFiles();
  bindComputerKeyboard();
  drawMeter();
  renderAll();
  // Fenêtres des outils : boutons enregistrer / ouvrir leurs réglages dans la barre de titre.
  provide({ wm: new WindowManager(() => state.windows, save, onWindowToggle, { ids: new Set(FILE_TOOLS), save: saveFile, open: openFile }) });
  wm.onActive = id => {
    const page = pageForWindow(id);
    if (page && page !== state.page) setPage(page);
    if (id === 'piano' || id === 'osc') setKeys(id === 'osc' ? 'osc' : 'synth');   // le clavier joue le synthé de la fenêtre active
  };
  renderPages();
  $('#layout-reset').addEventListener('click', () => wm.reset());
  buildPluginBar();
  buildLibrary();
  if (wm.isOpen('viz')) viz.addOutput($('#viz-canvas'));
  $('#start').classList.add('hidden');
  if (libAdded.length) toast(libAdded.map(a => t('lib.added', { name: a.name, n: a.bank })).join(' · '), 6000);

  provide({ apc: new APC() });
  bindController();
  try {
    await apc.init();
  } catch (err) {
    setStatus(false, /permission|denied|not allowed/i.test(err.message) ? t('status.denied') : err.message);
  }
}
