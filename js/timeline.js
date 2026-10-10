// Timeline façon eJay : des pistes découpées en mesures, sur lesquelles on pose des blocs
// (un son de la bibliothèque, ou l'enregistrement d'un outil). Lecture calée sur le tempo global.
// Un bloc : { id, start, len (en temps), sampleId, name, cat, color, bpm, loop }.
// - bpm : tempo d'origine du son ; il est lu plus vite / plus lentement pour suivre le tempo global.
// - loop : le son se répète pour remplir toute la longueur du bloc.
// Blocs enregistrés en jouant : { type: 'pad', bank, pad } rejoue le pad avec ses réglages,
// { type: 'note', note, vel } rejoue une note du synthé (preset en cours) pendant `len` temps ;
// avec `notes` (accord) et `preset`, le bloc joue plusieurs notes avec son propre preset (générateur d'accords) ;
// avec `seq` et `pat`, c'est un motif du piano roll (voir js/notes.js).

import { TrackChain, cleanFx } from './trackfx.js';
import { clipEvents, monoLine } from './notes.js';
import { buildInsert, cleanInsert } from './mixer.js';

export const TL_TRACKS = 16;        // pistes au départ
export const MIN_TRACKS = 4;
export const MAX_TRACKS = 64;
export const BEATS_PER_BAR = 4;
// Les notes et les sons ne sont créés qu'un peu avant de jouer (secondes) : tout créer d'avance
// (des milliers de nœuds audio pour un morceau entier) écroulerait le moteur audio.
const LOOKAHEAD = 1.5;
// Réglages d'une piste (ses potentiomètres) : volume, panoramique, filtres passe-bas / passe-haut, envois delay et reverb.
export const TRACK_DEFAULTS = { vol: 1, pan: 0, lp: 20000, hp: 20, dly: 0, rev: 0 };
const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
// Instruments qu'une piste peut enregistrer (null = « Auto » : le choix « Enregistrer » de la barre de la timeline).
export const REC_SOURCES = ['pads', 'synth', 'osc', 'tr', 'acid', 'decks'];
export const MAX_INSERTS = 4;
// Une piste neuve = une piste nettoyée sans réglages : mêmes champs, dans le même ordre (l'historique compare des instantanés JSON).
export const newTrack = () => cleanTrack(null);
// Bus : des pistes regroupées pour être traitées ensemble (effets d'insert, volume, pano, muet / solo).
// Le son d'un bus continue vers la même destination que celui de ses pistes (synthé, pads, sidechain…).
export const BUS_COUNT = 4;
export const BUS_DEFAULTS = { vol: 1, pan: 0 };
export const newBus = () => ({ name: '', ...BUS_DEFAULTS, mute: false, solo: false, inserts: [] });
export function cleanBus(b) {
  return {
    name: typeof b?.name === 'string' ? b.name.slice(0, 24) : '',
    vol: num(b?.vol, 0, 1.5, 1), pan: num(b?.pan, -1, 1, 0),
    mute: !!b?.mute, solo: !!b?.solo,
    inserts: Array.isArray(b?.inserts) ? b.inserts.map(cleanInsert).filter(Boolean).slice(0, MAX_INSERTS) : [],
  };
}
const cleanBuses = list => Array.from({ length: BUS_COUNT }, (_, i) => cleanBus(Array.isArray(list) ? list[i] : null));
// Piste qu'on entend : ni elle ni son bus ne sont muets ; s'il y a des solos (pistes ou bus), elle ou son bus en fait partie.
export function trackAudible(tracks, i, buses = []) {
  const tr = tracks[i];
  if (!tr) return false;
  const bus = tr.bus !== null && tr.bus !== undefined ? buses[tr.bus] : null;
  if (tr.mute || bus?.mute) return false;
  const anySolo = tracks.some(t => t.solo) || buses.some(b => b?.solo);
  return !anySolo || !!tr.solo || !!bus?.solo;
}
export function cleanTrack(tr) {
  return {
    mute: !!tr?.mute,
    solo: !!tr?.solo,
    inserts: Array.isArray(tr?.inserts) ? tr.inserts.map(cleanInsert).filter(Boolean).slice(0, MAX_INSERTS) : [],
    clips: Array.isArray(tr?.clips) ? tr.clips : [],
    fx: Array.isArray(tr?.fx) ? tr.fx.map(cleanFx).filter(Boolean) : [],
    vol: num(tr?.vol, 0, 1.5, 1), pan: num(tr?.pan, -1, 1, 0), lp: num(tr?.lp, 200, 20000, 20000), hp: num(tr?.hp, 20, 2000, 20),
    dly: num(tr?.dly, 0, 1, 0), rev: num(tr?.rev, 0, 1, 0),
    name: typeof tr?.name === 'string' ? tr.name.slice(0, 24) : '',
    color: typeof tr?.color === 'string' && /^#[0-9a-f]{6}$/i.test(tr.color) ? tr.color : null,
    arm: !!tr?.arm,
    src: REC_SOURCES.includes(tr?.src) ? tr.src : null,
    bus: Number.isInteger(tr?.bus) && tr.bus >= 0 && tr.bus < BUS_COUNT ? tr.bus : null,
  };
}

export function defaultTlState() {
  return {
    bars: 32,
    zoom: 64,           // largeur d'une mesure (px)
    loop: true,
    playhead: 0,        // en temps (noires)
    source: 'pads',     // outil enregistré : pads, synth (blocs posés en jouant), tr (audio)
    armed: 0,           // piste qui reçoit l'enregistrement
    tracks: Array.from({ length: TL_TRACKS }, (_, i) => ({ ...newTrack(), arm: i === 0 })),
    buses: cleanBuses(null),   // bus A à D
    markers: [],               // repères nommés : { id, beat, name } (js/app/markers.js)   // fx : blocs d'effet (js/trackfx.js), potentiomètres, nom, couleur, armement, instrument
  };
}

export function mergeTlState(saved) {
  const base = defaultTlState();
  if (!saved) return base;
  for (const k of ['bars', 'zoom', 'loop', 'playhead', 'source', 'armed']) if (saved[k] !== undefined) base[k] = saved[k];
  base.bars = Math.max(base.bars, 16);
  if (!REC_SOURCES.includes(base.source)) base.source = 'pads';
  if (Array.isArray(saved.tracks)) {
    // Autant de pistes que dans la sauvegarde (de 4 à 64 ; les anciennes en avaient 16).
    const n = Math.min(MAX_TRACKS, Math.max(MIN_TRACKS, saved.tracks.length));
    base.tracks = Array.from({ length: n }, (_, i) => cleanTrack(saved.tracks[i]));
  }
  base.buses = cleanBuses(saved.buses);
  base.markers = (Array.isArray(saved.markers) ? saved.markers : []).filter(m => Number.isFinite(m?.beat) && m.beat >= 0).slice(0, 64)
    .map(m => ({ id: typeof m.id === 'string' ? m.id : crypto.randomUUID(), beat: +m.beat, name: String(m.name ?? '').slice(0, 32) })).sort((a, b) => a.beat - b.beat);
  base.armed = Math.min(base.tracks.length - 1, Math.max(0, base.armed | 0));
  // Anciennes sauvegardes : une seule piste armée (armed) ; maintenant chaque piste a son bouton.
  if (!base.tracks.some(tr => tr.arm)) base.tracks[base.armed].arm = true;
  return base;
}

export class Timeline {
  // bufferOf(sampleId) -> AudioBuffer | null ; output : nœud de sortie (voie « Timeline » du mixeur).
  constructor(engine, getState, bufferOf, output) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.bufferOf = bufferOf;
    this.output = output;
    this.playing = false;
    this.recording = false;   // pendant un enregistrement : lecture linéaire, sans boucle
    this.sources = [];
    this.cycles = [];         // débuts de lecture programmés : { time, beat }
    this.timer = null;
    this.onStop = () => {};
    this.getPad = () => null;   // (banque, pad) -> pad ; branché par l'application
    this.loadPad = () => {};    // décode le son d'un pad (chargement à la demande) ; branché par l'application
    this.padKey = null;
    // Sidechain (branché par l'application) : kicks d'un bloc en temps depuis son début (null si aucun),
    // pad qui est un kick, instant d'un kick, sortie des sons mélodiques baissés par le sidechain.
    this.kicksOf = () => null;
    this.isKickPad = () => false;
    this.onKick = () => {};
    this.onHalt = () => {};
    this.duckOutput = null;
    this.isDucked = () => false;
    this.getPatch = () => undefined;   // preset d'un bloc -> { cfg, values } ; branché par l'application
    this.getOsc = () => null;          // bloc du synthé à oscillateurs -> { synth, values } ; branché par l'application
    this.offs = [];             // fins de notes programmées : { note, key, time }
    this.ons = [];              // départs à créer, au fil de la lecture : { time, run }
    this.synths = new Set();    // synthés qui ont reçu des notes (coupés net à l'arrêt)
    this.keyPrefix = 'tl:';     // préfixe des voix de synthé (une écoute de bloc a le sien : elle ne coupe pas le morceau)
    this.padHits = new Set();   // voix de pads programmées (toutes coupées à l'arrêt)
    this.chains = new Map();    // piste -> Map(destination -> TrackChain) : effets de piste
    this.strips = new Map();    // piste -> Map(destination -> tranche : filtres, volume, pano, envois)
    this.busChains = new Map(); // bus -> Map(destination -> chaîne du bus : inserts, volume, pano)
    this.cycleChains = new Set();
    this.cycle = null;          // cycle en cours de programmation : { time, beat, len, bd }
  }

  get st() { return this.getState(); }
  get beatDur() { return 60 / this.engine.bpm; }
  get length() { return this.st.bars * BEATS_PER_BAR; }
  // Durée naturelle du son, en temps (au tempo d'origine du son s'il en a un).
  naturalBeats(clip) {
    const buf = this.bufferOf(clip.sampleId);
    if (!buf) return BEATS_PER_BAR;
    return clip.bpm ? buf.duration * clip.bpm / 60 : buf.duration / this.beatDur;
  }
  clipBeats(clip) { return clip.len ?? Math.max(1, Math.ceil(this.naturalBeats(clip))); }

  // Démarre la lecture au temps `beat` ; renvoie l'instant (horloge audio) où ce temps sonne.
  play(beat = this.st.playhead) {
    this.stop(true);
    this.updateAllTracks();
    const start = this.ctx.currentTime + 0.08;
    // Boucles des pads et 909 calées sur les mesures de la timeline.
    this.engine.origin = start - beat * this.beatDur;
    this.playing = true;
    this.cycles = [];
    this.scheduleCycle(start, beat);
    this.ticker = setInterval(() => this.flush(this.ctx.currentTime + 0.1), 30);
    return start;
  }

  scheduleCycle(time, beat) {
    const st = this.st;
    const len = this.length;
    this.cycles.push({ time, beat });
    if (this.cycles.length > 3) this.cycles.shift();
    const bd = this.beatDur;
    const endTime = time + (len - beat) * bd;
    this.cycle = { time, beat, len, bd, until: st.loop && !this.recording ? len : Infinity };
    this.cycleChains.clear();
    // Les coups de pad déjà joués (d'un cycle précédent) sont oubliés.
    for (const h of this.padHits) if (h.v.startAt < this.ctx.currentTime - 10) this.padHits.delete(h);
    const jobs = [];
    st.tracks.forEach((track, ti) => {
      // Une piste muette est programmée quand même (son volume est à zéro) : on peut la rallumer en pleine lecture.
      // Ses kicks ne déclenchent pas le sidechain.
      const live = this.audible(ti);
      for (const clip of track.clips) {
        if (clip.type === 'note') {
          // Chaque note du bloc (motif répété) ; une note à moitié passée n'est pas rejouée.
          // Synthé à oscillateurs (clip.osc) ou synthé du clavier (preset du bloc, sinon celui en cours).
          const osc = clip.osc ? this.getOsc(clip) : null;
          const syn = osc?.synth ?? this.engine;
          const patch = osc ? osc.values : clip.preset ? this.getPatch(clip.preset) : undefined;
          const dest = osc ? osc.synth.out : this.engine.synthIn;
          const events = osc && osc.synth.isMono(osc.values) ? monoLine(clipEvents(clip)) : clipEvents(clip);
          for (const n of events) {
            const at = clip.start + n.t;
            if (at < beat - 1e-6 || at >= len) continue;
            const when = time + (at - beat) * bd;
            const key = `${this.keyPrefix}${clip.id}:${n.i}`;
            const out = this.trackIn(ti, dest);
            jobs.push({ time: when, run: () => {
              this.synths.add(syn);
              syn.noteOn(n.note, Math.min(1, n.vel * (clip.gain ?? 1)), when, key, patch, out, n.from);
              this.offs.push({ note: n.note, key, time: when + n.len * bd - 0.005, syn });
              this.offsDirty = true;
            } });
          }
          continue;
        }
        if (clip.type === 'pad') {
          // Un coup à moitié passé n'est pas rejoué.
          if (clip.start < beat - 1e-6 || clip.start >= len) continue;
          const when = time + (clip.start - beat) * bd;
          const pad = this.getPad(clip.bank, clip.pad);
          const key = this.padKey(clip.bank, clip.pad);
          if (pad?.buffer) {
            const out = this.trackIn(ti, this.engine.padOut(pad) ?? this.engine.padBus);
            jobs.push({ time: when, run: () => {
              const v = this.engine.playPad(key, pad, { when, oneShot: true, vel: (clip.vel ?? 1) * (clip.gain ?? 1), out });
              if (v) this.padHits.add({ key, v });
            } });
            if (live && this.isKickPad(pad)) this.onKick(when);
          } else if (pad) this.loadPad(pad);   // pas encore décodé : prêt pour le prochain passage
          continue;
        }
        const buf = this.bufferOf(clip.sampleId);
        if (!buf) continue;
        const end = clip.start + this.clipBeats(clip);
        if (end <= beat || clip.start >= len) continue;
        const rate = clip.bpm ? this.engine.bpm / clip.bpm : 1;
        // Secondes déjà écoulées dans le son (un bloc coupé commence `offset` temps plus loin dans son son).
        const into = (Math.max(0, beat - clip.start) + (clip.offset ?? 0)) * bd * rate;
        if (!clip.loop && into >= buf.duration) continue;
        const when = time + Math.max(0, clip.start - beat) * bd;
        let stopAt = time + (end - beat) * bd;
        if (st.loop && !this.recording) stopAt = Math.min(stopAt, endTime);
        const out = this.trackIn(ti, this.duckOutput && this.isDucked(clip) ? this.duckOutput : this.output);
        if (live) this.scheduleKicks(clip, time, beat, Math.min(end, st.loop && !this.recording ? len : Infinity));
        // Début et fin du bloc sur l'horloge audio (fondus d'entrée et de sortie).
        const span = { t0: time + (clip.start - beat) * bd, t1: time + (end - beat) * bd, bd };
        jobs.push({ time: when, run: () => this.startClip(clip, buf, rate, into, when, stopAt, out, span) });
      }
    });
    this.ons = this.ons.concat(jobs).sort((a, b) => a.time - b.time);
    this.flush(this.ctx.currentTime + 0.1);
    clearTimeout(this.timer);
    if (this.recording) return;   // l'enregistrement continue au-delà de la fin
    const lead = (endTime - this.ctx.currentTime - 0.25) * 1000;
    if (st.loop) this.timer = setTimeout(() => { if (this.playing) this.scheduleCycle(endTime, 0); }, Math.max(0, lead));
    else this.timer = setTimeout(() => this.stop(), Math.max(0, (endTime - this.ctx.currentTime) * 1000));
  }

  // Crée la source d'un bloc audio (juste avant qu'il joue).
  startClip(clip, buf, rate, into, when, stopAt, out, span = null) {
    const src = this.ctx.createBufferSource();
    src.buffer = clip.reverse ? this.reversed(buf) : buf;
    src.playbackRate.value = rate;
    if (clip.loop) { src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration; }
    const gain = this.ctx.createGain();
    const level = clip.gain ?? 1;
    src.connect(gain);
    // Un son mono est centré ici (même loi que le panoramique du mixeur) : son niveau ne change pas
    // quand un effet de piste stéréo (3D, auto-pan…) fait passer la chaîne de la piste en stéréo.
    let node = gain;
    if (buf.numberOfChannels === 1) { node = this.ctx.createStereoPanner(); gain.connect(node); }
    node.connect(out);
    // Fondus du bloc (en temps) : g(t) = niveau × montée depuis le début du bloc × descente vers sa fin.
    const fi = span && clip.fadeIn > 0 ? clip.fadeIn * span.bd : 0;
    const fo = span && clip.fadeOut > 0 ? clip.fadeOut * span.bd : 0;
    const g = t => level * (fi ? Math.min(1, Math.max(0, (t - span.t0) / fi)) : 1) * (fo ? Math.min(1, Math.max(0, (span.t1 - t) / fo)) : 1);
    gain.gain.setValueAtTime(g(when), when);
    if (fi && span.t0 + fi > when) gain.gain.linearRampToValueAtTime(g(span.t0 + fi), span.t0 + fi);
    if (fo) {
      const from = Math.max(when, span.t1 - fo);
      if (from < stopAt) { gain.gain.setValueAtTime(g(from), from); gain.gain.linearRampToValueAtTime(g(Math.min(stopAt, span.t1)), Math.min(stopAt, span.t1)); }
    }
    const end = Math.max(when, stopAt - 0.006);
    gain.gain.setValueAtTime(g(end), end);
    gain.gain.linearRampToValueAtTime(0, stopAt);   // fin du bloc sans clic
    src.start(when, clip.loop ? into % buf.duration : into);
    src.stop(stopAt + 0.01);
    src.onended = () => { this.sources = this.sources.filter(s => s.src !== src); };
    this.sources.push({ src, gain });
  }

  // Son à l'envers (bloc inversé), calculé une fois par son.
  reversed(buf) {
    this.revCache ??= new WeakMap();
    let r = this.revCache.get(buf);
    if (!r) {
      r = this.ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
      this.revCache.set(buf, r);
    }
    return r;
  }

  // Entrée de la piste `ti` vers la destination `dest` : sa chaîne d'effets si elle en a, sinon la destination.
  // Une chaîne vue pour la première fois dans le cycle reçoit la programmation de ses blocs d'effet.
  trackIn(ti, dest) {
    if (!dest) return dest;
    dest = this.strip(ti, dest);
    const blocks = this.st.tracks[ti]?.fx;
    if (!blocks?.length) return dest;
    if (!this.chains.has(ti)) this.chains.set(ti, new Map());
    const m = this.chains.get(ti);
    let chain = m.get(dest);
    if (!chain) { chain = new TrackChain(this.ctx, this.engine, dest); m.set(dest, chain); }
    if (!this.cycleChains.has(chain)) {
      this.cycleChains.add(chain);
      chain.sync(blocks);
      const { time, beat, bd, until } = this.cycle;
      for (const b of blocks) {
        const s = Math.max(b.start, beat);
        const e = Math.min(b.start + b.len, until);
        if (e <= s) continue;
        chain.play(b, time + (s - beat) * bd, time + (e - beat) * bd, bd, s - b.start);
      }
    }
    return chain.input;
  }

  // Blocs d'effet retouchés pendant la lecture (une courbe du designer) : reprogrammés à partir de maintenant.
  refreshFx(match) {
    if (!this.playing) return;
    const now = this.ctx.currentTime + 0.05;
    const c = [...this.cycles].reverse().find(x => x.time <= now) ?? this.cycles[0];
    if (!c) return;
    const bd = this.beatDur;
    const until = this.st.loop && !this.recording ? this.length : Infinity;
    const pos = c.beat + (now - c.time) / bd;
    for (const [ti, m] of this.chains) {
      const all = this.st.tracks[ti]?.fx ?? [];
      const blocks = all.filter(match);
      if (!blocks.length) continue;
      for (const chain of m.values()) {
        chain.sync(all);
        for (const b of blocks) {
          const s = Math.max(b.start, pos), e = Math.min(b.start + b.len, until);
          if (e > s) chain.play(b, c.time + (s - c.beat) * bd, c.time + (e - c.beat) * bd, bd, s - b.start);
        }
      }
    }
  }

  audible(ti) { return trackAudible(this.st.tracks, ti, this.st.buses ?? []); }
  get buses() { return this.st.buses ?? []; }

  // Tranche de la piste `ti` vers `dest` : effets d'insert -> passe-haut -> passe-bas -> volume -> muet -> pano -> dest,
  // avec envois delay / reverb (après le muet, avant le pano).
  strip(ti, dest) {
    if (!this.strips.has(ti)) this.strips.set(ti, new Map());
    const m = this.strips.get(ti);
    let s = m.get(dest);
    if (!s) {
      const c = this.ctx;
      s = { input: c.createGain(), hp: c.createBiquadFilter(), lp: c.createBiquadFilter(), gain: c.createGain(), mute: c.createGain(),
        pan: c.createStereoPanner(), dly: c.createGain(), rev: c.createGain(), inserts: [] };
      s.hp.type = 'highpass';
      s.lp.type = 'lowpass';
      s.hp.Q.value = s.lp.Q.value = 0.707;
      s.hp.connect(s.lp).connect(s.gain).connect(s.mute).connect(s.pan);
      s.dest = dest;
      s.pan.connect(this.trackOut(ti, dest));
      // Envois pris avant le panoramique : la reverb et le delay restent larges même pour une piste calée d'un côté.
      s.mute.connect(s.dly).connect(this.engine.delayIn);
      s.mute.connect(s.rev).connect(this.engine.reverbIn);
      m.set(dest, s);
      this.wireInserts(s, this.st.tracks[ti]);
      this.applyStrip(s, this.st.tracks[ti], true);
      s.mute.gain.value = this.audible(ti) ? 1 : 0;
    }
    return s.input;
  }

  // Effets d'insert (d'une piste ou d'un bus), en série entre l'entrée de la chaîne et `s.after`.
  wireInserts(s, owner) {
    s.input.disconnect();
    for (const f of s.inserts) f.output.disconnect();
    s.inserts = (owner?.inserts ?? []).map(fx => { const node = buildInsert(this.ctx, fx); node.update(fx.p); return node; });
    s.insSig = (owner?.inserts ?? []).map(f => f.type).join();
    let prev = s.input;
    for (const f of s.inserts) { prev.connect(f.input); prev = f.output; }
    prev.connect(s.after ?? s.hp);
  }

  // Sortie d'une piste vers `dest` : directement, ou par son bus.
  trackOut(ti, dest) {
    const b = this.st.tracks[ti]?.bus;
    return b !== null && b !== undefined && this.buses[b] ? this.busIn(b, dest) : dest;
  }
  // Piste changée de bus : ses tranches sont rebranchées.
  routeTrack(ti) {
    for (const s of this.strips.get(ti)?.values() ?? []) { s.pan.disconnect(); s.pan.connect(this.trackOut(ti, s.dest)); }
  }
  // Chaîne du bus `b` vers `dest` : inserts -> volume -> pano -> dest (un vumètre écoute la sortie).
  busIn(b, dest) {
    if (!this.busChains.has(b)) this.busChains.set(b, new Map());
    const m = this.busChains.get(b);
    let c = m.get(dest);
    if (!c) {
      const x = this.ctx;
      c = { input: x.createGain(), gain: x.createGain(), pan: x.createStereoPanner(), meter: x.createAnalyser(), inserts: [] };
      c.after = c.gain;
      c.meter.fftSize = 256;
      c.gain.connect(c.pan).connect(dest);
      c.pan.connect(c.meter);
      m.set(dest, c);
      this.wireInserts(c, this.buses[b]);
      this.applyBus(c, this.buses[b], true);
    }
    return c.input;
  }
  applyBus(c, bus, now = false) {
    if (!bus) return;
    const t = this.ctx.currentTime;
    const set = (p, v) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.02));
    set(c.gain.gain, bus.vol);
    set(c.pan.pan, bus.pan);
  }
  // Réglages d'un bus (volume, pano), inserts ajoutés / retirés / réglés.
  updateBus(b) { for (const c of this.busChains.get(b)?.values() ?? []) this.applyBus(c, this.buses[b]); }
  rebuildBusInserts(b) {
    const list = this.buses[b]?.inserts ?? [];
    const sig = list.map(f => f.type).join();
    for (const c of this.busChains.get(b)?.values() ?? []) {
      if (c.insSig === sig) c.inserts.forEach((n, k) => n.update(list[k].p));
      else this.wireInserts(c, this.buses[b]);
    }
  }
  updateBusInsert(b, k) {
    const fx = this.buses[b]?.inserts[k];
    if (fx) for (const c of this.busChains.get(b)?.values() ?? []) c.inserts[k]?.update(fx.p);
  }
  // Niveau crête d'un bus (toutes ses destinations).
  busLevel(b) {
    let peak = 0;
    for (const c of this.busChains.get(b)?.values() ?? []) {
      const d = c.data ??= new Float32Array(c.meter.fftSize);
      c.meter.getFloatTimeDomainData(d);
      for (const v of d) peak = Math.max(peak, Math.abs(v));
    }
    return peak;
  }
  // Insert ajouté ou retiré : la chaîne de la piste est refaite ; réglage d'un insert : il suit tout de suite.
  // (mêmes types d'effets qu'avant : seuls les réglages sont repris, sans reconstruire la chaîne).
  rebuildInserts(ti) {
    const list = this.st.tracks[ti]?.inserts ?? [];
    const sig = list.map(f => f.type).join();
    for (const s of this.strips.get(ti)?.values() ?? []) {
      if (s.insSig === sig) s.inserts.forEach((n, k) => n.update(list[k].p));
      else this.wireInserts(s, this.st.tracks[ti]);
    }
  }
  updateInsert(ti, k) {
    const fx = this.st.tracks[ti]?.inserts[k];
    if (fx) for (const s of this.strips.get(ti)?.values() ?? []) s.inserts[k]?.update(fx.p);
  }
  // Muet / solo : toutes les pistes suivent tout de suite (le solo d'une piste coupe les autres).
  updateMutes() {
    const t = this.ctx.currentTime;
    for (const [ti, m] of this.strips) for (const s of m.values()) s.mute.gain.setTargetAtTime(this.audible(ti) ? 1 : 0, t, 0.008);
  }

  applyStrip(s, tr, now = false) {
    if (!tr) return;
    const t = this.ctx.currentTime;
    const set = (p, v) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.02));
    set(s.hp.frequency, tr.hp ?? 20);
    set(s.lp.frequency, tr.lp ?? 20000);
    set(s.gain.gain, tr.vol ?? 1);
    set(s.pan.pan, tr.pan ?? 0);
    set(s.dly.gain, tr.dly ?? 0);
    set(s.rev.gain, tr.rev ?? 0);
  }

  // Potentiomètres d'une piste tournés (ou « Annuler ») : le son suit tout de suite.
  updateTrack(ti) {
    for (const s of this.strips.get(ti)?.values() ?? []) this.applyStrip(s, this.st.tracks[ti]);
  }
  // Tout l'état des pistes réappliqué (« Annuler », morceau chargé, début de lecture) : réglages, inserts, muet / solo.
  updateAllTracks() {
    for (const ti of this.strips.keys()) { this.updateTrack(ti); this.rebuildInserts(ti); this.routeTrack(ti); }
    for (let b = 0; b < BUS_COUNT; b++) { this.updateBus(b); this.rebuildBusInserts(b); }
    this.updateMutes();
  }

  // Kicks d'un bloc audio entre le temps `beat` (joué à l'instant `time`) et `until` (en temps de la timeline).
  scheduleKicks(clip, time, beat, until) {
    const kicks = this.kicksOf(clip);
    if (!kicks?.length) return;
    const bd = this.beatDur;
    const period = clip.loop ? this.naturalBeats(clip) : Infinity;   // une boucle recommence après sa durée naturelle
    if (!(period > 0.25)) return;
    const last = clip.start + this.clipBeats(clip);
    // Bloc coupé : le son commence `offset` temps plus loin (ses kicks arrivent d'autant plus tôt).
    const off = clip.offset ?? 0;
    const first = clip.start - (period === Infinity ? off : off % period);
    for (let rep = first; rep < Math.min(until, last); rep += period) {
      for (const k of kicks) {
        const b = rep + k;
        if (b >= clip.start - 1e-6 && b >= beat - 1e-6 && b < until && b < last) this.onKick(time + (b - beat) * bd);
      }
      if (period === Infinity) break;
    }
  }

  // Crée les départs jusqu'à `horizon` + LOOKAHEAD et envoie les fins de notes jusqu'à `horizon`, dans l'ordre du temps
  // (une note finie libère sa voix avant qu'une suivante n'en demande une).
  flush(horizon) {
    const until = horizon + LOOKAHEAD;
    for (;;) {
      if (this.offsDirty) { this.offs.sort((a, b) => a.time - b.time); this.offsDirty = false; }
      const on = this.ons[0]?.time < until ? this.ons[0] : null;
      const off = this.offs[0]?.time < horizon ? this.offs[0] : null;
      if (off && (!on || off.time <= on.time)) {
        this.offs.shift();
        (off.syn ?? this.engine).noteOff(off.note, false, off.time, off.key);
      } else if (on) {
        this.ons.shift();
        try { on.run(); } catch (err) { console.warn('Timeline', err); }
      } else break;
    }
  }

  // Position actuelle (en temps) de la tête de lecture.
  position() {
    if (!this.playing) return this.st.playhead;
    const now = this.ctx.currentTime;
    const cycle = [...this.cycles].reverse().find(c => c.time <= now) ?? this.cycles[0];
    if (!cycle) return this.st.playhead;
    return cycle.beat + Math.max(0, now - cycle.time) / this.beatDur;
  }

  // L'arrêt passe d'abord la timeline à l'arrêt, puis coupe chaque son à part : une erreur pendant le nettoyage
  // (un effet qui refuse sa remise à zéro…) ne doit jamais laisser la lecture « en cours » à l'écran.
  stop(silent = false) {
    const was = this.playing;
    this.playing = false;
    clearTimeout(this.timer);
    clearInterval(this.ticker);
    this.ons = [];
    const safe = fn => { try { fn(); } catch (err) { console.warn('Timeline stop', err); } };
    for (const o of this.offs) safe(() => (o.syn ?? this.engine).noteOff(o.note, true, undefined, o.key));
    this.offs = [];
    for (const syn of this.synths) safe(() => syn.cut?.(this.keyPrefix));
    this.synths.clear();
    for (const { key, v } of this.padHits) {
      safe(() => {
        this.engine.stopVoice(v);
        if (this.engine.padVoices.get(key) === v) this.engine.stopPad(key, 0.01);   // voyant du pad
      });
    }
    this.padHits.clear();
    const t = this.ctx.currentTime;
    for (const { src, gain } of this.sources) safe(() => { gain.gain.setTargetAtTime(0, t, 0.01); src.stop(t + 0.05); });
    this.sources = [];
    for (const m of this.chains.values()) for (const c of m.values()) safe(() => c.reset());
    safe(() => this.onHalt());
    if (was && !silent) this.onStop();
  }
}
