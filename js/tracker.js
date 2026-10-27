// Modules de tracker (.mod ProTracker et compatibles, .xm FastTracker 2) : lecture du fichier, puis le morceau est
// rejoué tick par tick (tempo, vitesse, effets, enveloppes de volume) pour en tirer, par voie, des notes prêtes pour la
// timeline : { t, len, note, vel, s, ofs?, pan?, pv?, pp? } en temps (noires), s = numéro du sample, ofs = départ dans le
// sample (secondes), pan = -1..1, pv = volumes [[temps depuis le début de la note, 0..1]] et pp = écarts de hauteur
// [[temps, demi-tons]] quand ils changent en cours de note (glissements, vibrato, arpèges, fondus, enveloppes).
// Rien ici ne dépend du navigateur.

export const TRACKER_EXT = /\.(mod|xm)$/i;
const MAX_SECONDS = 30 * 60;
const AMIGA_CLOCK = 7093789.2;
const C4_PERIOD = 1712;   // période (×4) du do4 de FastTracker = do2 de ProTracker (428)
// Périodes ProTracker sans réglage fin, do1 à si3.
const PT_PERIODS = [856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, 428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
  214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113];
// Effets pris en compte (les autres sont comptés comme ignorés).
const DONE = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E1', 'E2', 'E4', 'E5', 'E6', 'E7', 'E9', 'EA', 'EB', 'EC', 'ED', 'EE',
  'F', 'G', 'H', 'K', 'P', 'R', 'X1', 'X2']);
const FX_NAMES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const str = (u8, at, n) => {
  let s = '';
  for (let i = 0; i < n && u8[at + i]; i++) s += String.fromCharCode(u8[at + i]);
  return s.replace(/[^\x20-\x7e]/g, ' ').trim();
};

/** Le fichier est-il un module reconnu ? (nom : un ancien .mod à 15 samples n'a pas de signature) -> 'mod' | 'xm' | null */
export function trackerKind(buf, name = '') {
  const u8 = new Uint8Array(buf);
  if (u8.length > 336 && str(u8, 0, 17) === 'Extended Module:') return 'xm';
  if (u8.length > 1084 && modChannels(str(u8, 1080, 4))) return 'mod';
  if (u8.length > 600 && /\.mod$/i.test(name)) return 'mod';
  return null;
}

function modChannels(tag) {
  if (['M.K.', 'M!K!', 'M&K!', 'FLT4', '4CHN', 'N.T.'].includes(tag)) return 4;
  if (['FLT8', 'OCTA', 'CD81', 'OKTA'].includes(tag)) return 8;
  let m = /^(\d)CHN$/.exec(tag);
  if (m) return +m[1];
  m = /^(\d\d)C[HN]$/.exec(tag);
  return m ? +m[1] : 0;
}

// ---------- Lecture des fichiers ----------

function readMod(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let nch = modChannels(str(u8, 1080, 4)), nsmp = 31, hdr = 1084;
  if (!nch) { nch = 4; nsmp = 15; hdr = 600; }   // ancien Soundtracker : 15 samples, pas de signature
  const ordAt = 20 + nsmp * 30;
  const songLen = Math.max(1, Math.min(128, u8[ordAt]));
  const orders = [...u8.subarray(ordAt + 2, ordAt + 130)];
  const npat = Math.min(128, Math.max(...orders) + 1, Math.floor((u8.length - hdr) / (nch * 256)));
  const samples = [];
  for (let i = 0; i < nsmp; i++) {
    const at = 20 + i * 30;
    const len = dv.getUint16(at + 22) * 2, fine = ((u8[at + 24] & 15) ^ 8) - 8;
    let ls = dv.getUint16(at + 26) * 2, ll = dv.getUint16(at + 28) * 2;
    if (nsmp === 15) ls >>= 1;   // le début de boucle de Soundtracker est en octets
    samples.push({ name: str(u8, at, 22), len, fine, vol: Math.min(64, u8[at + 25]), ls, ll: ll > 2 ? ll : 0, rel: 0, pan: null, bits: 8 });
  }
  const patterns = [];
  let at = hdr;
  for (let p = 0; p < npat; p++) {
    const rows = [];
    for (let r = 0; r < 64; r++) {
      const row = [];
      for (let c = 0; c < nch; c++, at += 4) {
        const b0 = u8[at] ?? 0, b1 = u8[at + 1] ?? 0, b2 = u8[at + 2] ?? 0, b3 = u8[at + 3] ?? 0;
        const period = ((b0 & 15) << 8) | b1;
        row.push({ period, ins: (b0 & 0xf0) | (b2 >> 4), vol: 0, fx: b2 & 15, param: b3 });
      }
      rows.push(row);
    }
    patterns.push(rows);
  }
  for (const s of samples) {
    const n = Math.max(0, Math.min(s.len, u8.length - at));
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = ((u8[at + i] ^ 0x80) - 0x80) / 128;
    at += s.len;
    s.data = data;
  }
  // Instruments = samples (un sample par instrument, sur tout le clavier).
  const instruments = samples.map((s, i) => ({ name: s.name, map: null, smp: [i], env: null, fadeout: 0 }));
  return { format: 'mod', title: str(u8, 0, 20), nch, orders: orders.slice(0, songLen), restart: 0, patterns, instruments, samples,
    speed: 6, tempo: 125, linear: false };
}

function readXm(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  const u16 = at => dv.getUint16(at, true), u32 = at => dv.getUint32(at, true);
  const hsize = u32(60);
  const songLen = Math.max(1, Math.min(256, u16(64))), restart = u16(66), nch = Math.min(32, u16(68)), npat = u16(70), nins = u16(72);
  const flags = u16(74);
  const orders = [...u8.subarray(80, 80 + songLen)];
  let at = 60 + hsize;
  const patterns = [];
  for (let p = 0; p < npat; p++) {
    const plen = u32(at), nrows = u16(at + 5), size = u16(at + 7);
    let q = at + plen;
    const end = q + size;
    const rows = [];
    for (let r = 0; r < (nrows || 64); r++) {
      const row = [];
      for (let c = 0; c < nch; c++) {
        const cell = { note: 0, ins: 0, vol: 0, fx: 0, param: 0 };
        if (size && q < end) {
          const b = u8[q++];
          if (b & 0x80) {
            if (b & 1) cell.note = u8[q++];
            if (b & 2) cell.ins = u8[q++];
            if (b & 4) cell.vol = u8[q++];
            if (b & 8) cell.fx = u8[q++];
            if (b & 16) cell.param = u8[q++];
          } else {
            cell.note = b; cell.ins = u8[q++]; cell.vol = u8[q++]; cell.fx = u8[q++]; cell.param = u8[q++];
          }
        }
        row.push(cell);
      }
      rows.push(row);
    }
    patterns.push(rows);
    at = end;
  }
  const instruments = [], samples = [];
  for (let i = 0; i < nins && at + 29 <= u8.length; i++) {
    const isize = u32(at), name = str(u8, at + 4, 22), ns = u16(at + 27);
    const ins = { name, map: null, smp: [], env: null, fadeout: 0 };
    instruments.push(ins);
    if (!ns) { at += isize; continue; }
    const shs = u32(at + 29);
    ins.map = [...u8.subarray(at + 33, at + 129)];
    const pts = [];
    for (let k = 0; k < Math.min(12, u8[at + 225]); k++) pts.push([u16(at + 129 + k * 4), u16(at + 131 + k * 4)]);
    const vtype = u8[at + 233];
    if (vtype & 1 && pts.length) ins.env = { pts, sus: vtype & 2 ? u8[at + 227] : -1, loop: vtype & 4 ? [u8[at + 228], u8[at + 229]] : null };
    ins.fadeout = u16(at + 239);
    at += isize;
    const heads = [];
    for (let k = 0; k < ns; k++, at += shs) {
      const type = u8[at + 14];
      heads.push({ name: str(u8, at + 18, 22) || name, len: u32(at), ls: u32(at + 4), ll: u32(at + 8), vol: Math.min(64, u8[at + 12]),
        fine: (u8[at + 13] << 24 >> 24) / 16, loop: type & 3, bits: type & 16 ? 16 : 8, pan: u8[at + 15], rel: u8[at + 16] << 24 >> 24 });
    }
    for (const h of heads) {
      const n = h.bits === 16 ? h.len >> 1 : h.len, data = new Float32Array(n);
      let acc = 0;
      for (let k = 0; k < n; k++) {
        if (h.bits === 16) { acc = (acc + dv.getInt16(Math.min(at + k * 2, u8.length - 2), true)) << 16 >> 16; data[k] = acc / 32768; }
        else { acc = (acc + (u8[at + k] ?? 0)) & 255; data[k] = ((acc ^ 0x80) - 0x80) / 128; }
      }
      at += h.len;
      const div = h.bits === 16 ? 2 : 1;
      let ls = Math.floor(h.ls / div), ll = h.loop ? Math.floor(h.ll / div) : 0;
      if (ls + ll > n) ll = Math.max(0, n - ls);
      ins.smp.push(samples.length);
      samples.push({ name: h.name, data, fine: h.fine, vol: h.vol, ls, ll: ll > 1 ? ll : 0, ping: h.loop === 2, rel: h.rel, pan: h.pan });
    }
  }
  return { format: 'xm', title: str(u8, 17, 20), nch, orders, restart, patterns, instruments, samples,
    speed: u16(76) || 6, tempo: u16(78) || 125, linear: !!(flags & 1) };
}

// ---------- Rejeu ----------

const sine = pos => Math.round(255 * Math.sin(pos * Math.PI / 32));
const wave = (type, pos) => {
  pos &= 63;
  if ((type & 3) === 1) return pos < 32 ? 255 - pos * 8 : -(255 - (pos - 32) * 8);   // dent de scie descendante
  if ((type & 3) === 2) return pos < 32 ? 255 : -255;
  return sine(pos);
};

function envAt(env, pos) {
  const p = env.pts;
  if (pos <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (pos <= p[i][0]) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i];
      return x1 === x0 ? y1 : y0 + (y1 - y0) * (pos - x0) / (x1 - x0);
    }
  }
  return p[p.length - 1][1];
}

/**
 * Lit un module (ArrayBuffer). -> { format, title, bpm, samples: [{ name, data, rate, root, loop, vol, pan }],
 * channels: [notes], beats, skipped: { effet: nombre } }. `rate` : fréquence d'échantillonnage du son tel qu'enregistré,
 * `root` : note MIDI (décimale) jouée à vitesse normale, `loop` : [début, fin[ en échantillons, ou null.
 */
export function readTracker(buf) {
  const m = trackerKind(buf) === 'xm' ? readXm(buf) : readMod(buf);
  if (!m.patterns.length || !m.nch) throw new Error('empty');
  const xm = m.format === 'xm';
  // Sons : fréquence d'enregistrement (do4 = 8363 Hz, décalé de la note relative et du réglage fin), sans dépasser ce
  // qu'un son du navigateur accepte ; `root` corrige l'écart.
  const samples = m.samples.map(s => {
    const ideal = xm ? 8363 * 2 ** ((s.rel + s.fine / 8) / 12) : AMIGA_CLOCK / (2 * 428) * 2 ** (s.fine / 96);
    const rate = Math.round(Math.min(192000, Math.max(3000, ideal)));
    let data = s.data, loop = s.ll ? [s.ls, s.ls + s.ll] : null;
    if (loop && s.ping) {   // boucle aller-retour : l'aller et le retour mis bout à bout
      const seg = data.subarray(loop[0], loop[1]), out = new Float32Array(loop[0] + seg.length * 2);
      out.set(data.subarray(0, loop[1]));
      for (let i = 0; i < seg.length; i++) out[loop[1] + i] = seg[seg.length - 1 - i];
      data = out;
      loop = [loop[0], loop[1] + seg.length];
    } else if (loop) data = data.subarray(0, loop[1]);   // rien n'est joué après la boucle
    return { name: s.name, data, rate, root: 60 - 12 * Math.log2(ideal / rate), loop, vol: s.vol / 64, pan: s.pan == null ? null : (s.pan - 128) / 128 };
  });

  // Tempo de la timeline : 4 lignes par temps à la vitesse de départ, ramené entre 40 et 240.
  let bpm = m.tempo * 6 / m.speed;
  while (bpm > 240) bpm /= 2;
  while (bpm < 40) bpm *= 2;
  bpm = Math.round(bpm * 100) / 100;
  const beatsOf = sec => sec * bpm / 60;

  const skipped = {};
  const skip = name => { skipped[name] = (skipped[name] ?? 0) + 1; };
  const channels = Array.from({ length: m.nch }, () => []);
  const ch = Array.from({ length: m.nch }, (_, c) => ({
    ins: 0, smp: -1, key: 0, per: 0, per0: 0, target: 0, vol: 0, pan: xm ? 0 : [-0.5, 0.5, 0.5, -0.5][c % 4], fine: 0,
    off: false, env: 0, fade: 65536, vibPos: 0, vibSpeed: 0, vibDepth: 0, vibType: 0, trePos: 0, treSpeed: 0, treDepth: 0, treType: 0,
    mem: {}, rec: null, loopRow: 0, loopCount: 0, retrig: 0, vibOn: false, treOn: false, arp: null, cut: -1, delay: -1, cell: null,
  }));
  let speed = m.speed, tempo = m.tempo, gvol = 64, time = 0;
  const amiga = !xm || !m.linear;
  const periodOf = (key, fine) => (amiga ? C4_PERIOD * 2 ** (-(key - 48 + fine / 8) / 12) : 7680 - key * 64 - fine * 8);
  const semisBetween = (a, b) => (amiga ? 12 * Math.log2(a / b) : (a - b) / 64);   // b plus aigu que a : positif
  const clampPer = p => (amiga ? Math.min(32000, Math.max(56, p)) : Math.min(7680, Math.max(0, p)));
  const keyOfPeriod = p => {
    let best = 0;
    PT_PERIODS.forEach((q, i) => { if (Math.abs(q - p) < Math.abs(PT_PERIODS[best] - p)) best = i; });
    return best + 36;   // do1 de ProTracker = do3 de FastTracker
  };

  const close = (c, at) => {
    const r = c.rec;
    if (!r) return;
    c.rec = null;
    r.len = Math.max(0.01, beatsOf(at) - r.t);
    const s = samples[r.s];
    if (!s.loop) r.len = Math.min(r.len, Math.max(0.01, beatsOf((s.data.length / s.rate - (r.ofs ?? 0)) / r.rate)));
    channels[c.idx].push(r);
  };
  ch.forEach((c, i) => { c.idx = i; });

  const trigger = (c, at) => {
    close(c, at);
    if (c.smp < 0 || !samples[c.smp]) return;
    const s = samples[c.smp];
    if (!s.data.length) return;
    const nominal = c.key + 12;
    c.per0 = c.per;
    c.rec = { t: beatsOf(at), len: 0, note: Math.max(0, Math.min(127, Math.round(nominal))), vel: 0, s: c.smp, pv: [], pp: [],
      rate: 2 ** ((nominal - s.root) / 12) };
    const pan = c.panSet ? c.pan : s.pan ?? c.pan;
    if (Math.abs(pan) > 0.01) c.rec.pan = Math.round(pan * 100) / 100;
    if (c.ofs) { c.rec.ofs = Math.round(c.ofs / s.rate * 1e4) / 1e4; c.ofs = 0; }
    c.lastV = null; c.lastP = null;
  };

  // Volume et hauteur du tick, notés quand ils changent.
  const sample = (c, at) => {
    const r = c.rec;
    if (!r) return;
    let v = Math.max(0, Math.min(64, c.vol + (c.treOn ? (wave(c.treType, c.trePos) * c.treDepth) >> 6 : 0))) / 64;
    const ins = m.instruments[c.ins - 1];
    if (ins?.env) v *= envAt(ins.env, c.env) / 64;
    if (xm) v *= c.fade / 65536;
    v *= gvol / 64;
    v = Math.round(v * 1000) / 1000;
    let per = c.per;
    if (c.vibOn) per += (wave(c.vibType, c.vibPos) * c.vibDepth) / 32;
    let semis = semisBetween(c.per0, clampPer(per)) + (c.arp ?? 0);
    semis = Math.round(semis * 100) / 100;
    const dt = Math.round((beatsOf(at) - r.t) * 1e4) / 1e4;
    if (c.lastV === null) { r.vel = v; c.lastV = v; } else if (v !== c.lastV) { r.pv.push([dt, v]); c.lastV = v; }
    if (c.lastP === null) { c.lastP = semis; if (semis) r.pp.push([0, semis]); } else if (semis !== c.lastP) { r.pp.push([dt, semis]); c.lastP = semis; }
    if (v === 0 && (c.cutDone || c.off)) close(c, at);   // coupée, ou relâchée et éteinte
  };

  const volSlide = (c, p) => {
    const up = p >> 4, down = p & 15;
    c.vol = Math.max(0, Math.min(64, c.vol + (up ? up : -down)));
  };
  const toneSlide = c => {
    const sp = c.mem.tone ?? 0;
    if (!c.target) return;
    if (c.per < c.target) c.per = Math.min(c.target, c.per + sp * 4);
    else if (c.per > c.target) c.per = Math.max(c.target, c.per - sp * 4);
  };
  const pitchSlide = (c, units) => { c.per = clampPer(c.per + units); };   // vers le haut : période plus petite

  // Ordre de lecture : positions, lignes déjà jouées (le morceau qui reboucle s'arrête).
  const visited = new Set();
  const sections = [];   // passages de pattern : { t, pos, pat }
  let pos = 0, row = 0;
  outer:
  while (pos < m.orders.length && time < MAX_SECONDS) {
    const pat = m.patterns[m.orders[pos]];
    if (!pat) { pos++; row = 0; continue; }
    if (row >= pat.length) { pos++; row = 0; continue; }
    if (ch.every(c => !c.loopCount)) {
      const k = pos * 256 + row;
      if (visited.has(k)) break;
      visited.add(k);
    }
    if (sections.at(-1)?.pos !== pos) sections.push({ t: Math.round(beatsOf(time) * 1e4) / 1e4, pos, pat: m.orders[pos] });
    let jump = -1, brk = -1, patDelay = 0, loopTo = -1;
    const cells = pat[row];
    // Tick 0 : notes, instruments, volumes, effets posés.
    for (let c = 0; c < m.nch; c++) {
      const st = ch[c], cell = cells[c];
      st.cell = cell;
      st.arp = null; st.vibOn = false; st.treOn = false; st.cut = -1; st.delay = -1; st.cutDone = false; st.retrig = 0;
      const fx = cell.fx, p = cell.param;
      const name = fx === 14 ? `E${(p >> 4).toString(16).toUpperCase()}` : fx === 33 ? `X${p >> 4}` : FX_NAMES[fx];
      if ((fx || p) && !DONE.has(name)) skip(name);
      if (fx === 14 && (p >> 4) === 13 && (p & 15)) { st.delay = p & 15; continue; }   // note retardée : jouée plus tard
      startCell(st, cell, time);
    }
    for (let c = 0; c < m.nch; c++) {
      const st = ch[c], cell = cells[c], fx = cell.fx, p = cell.param, hi = p >> 4, lo = p & 15;
      if (fx === 11) { jump = p; brk = brk < 0 ? 0 : brk; }
      else if (fx === 13) brk = hi * 10 + lo;
      else if (fx === 15) {
        if (p === 0 && !xm) break outer;
        if (p > 0 && p < 32) speed = p; else if (p >= 32) tempo = p;
      } else if (fx === 14 && hi === 14) patDelay = lo;
      else if (fx === 14 && hi === 6) {
        if (!lo) st.loopRow = row;
        else if (!st.loopCount) { st.loopCount = lo; loopTo = st.loopRow; }
        else if (--st.loopCount) loopTo = st.loopRow;
      }
    }
    // Ticks de la ligne (répétés par EEx).
    const tickDur = 2.5 / tempo;
    for (let rep = 0; rep <= patDelay; rep++) {
      for (let tick = 0; tick < speed; tick++) {
        const at = time;
        for (let c = 0; c < m.nch; c++) {
          const st = ch[c];
          if (st.delay === tick && tick > 0 && rep === 0) startCell(st, st.cell, at);
          if (tick > 0 || rep > 0) tickFx(st, tick, at);
          else firstTickFx(st, at);
          sample(st, at);
          if (xm && m.instruments[st.ins - 1]?.env && st.rec) envStep(st);
        }
        time += tickDur;
      }
    }
    if (loopTo >= 0) { row = loopTo; continue; }
    if (jump >= 0 || brk >= 0) {
      pos = jump >= 0 ? jump : pos + 1;
      row = Math.max(0, brk);
      if (pos >= m.orders.length) break;
      continue;
    }
    row++;
  }
  for (const c of ch) close(c, time);

  function startCell(st, cell, at) {
    const fx = cell.fx, p = cell.param;
    const porta = fx === 3 || fx === 5 || (xm && cell.vol >> 4 === 15);
    let key = -1;
    if (xm) { if (cell.note > 0 && cell.note < 97) key = cell.note - 1; } else if (cell.period) key = keyOfPeriod(cell.period);
    if (cell.ins) {
      const ins = m.instruments[cell.ins - 1];
      if (ins) {
        st.ins = cell.ins;
        const smp = ins.map ? ins.smp[ins.map[Math.max(0, key >= 0 ? key : st.key) % 96]] : ins.smp[0];
        if (smp !== undefined && (!porta || st.smp < 0)) st.smp = smp;
        const s = m.samples[smp ?? st.smp];
        if (s) { st.vol = s.vol; st.fine = s.fine; if (s.pan != null && xm) { st.pan = (s.pan - 128) / 128; st.panSet = false; } }
        st.off = false; st.env = 0; st.fade = 65536;
      }
    }
    if (xm && cell.note === 97) keyOff(st);
    if (key >= 0) {
      if (xm && st.ins) {
        const ins = m.instruments[st.ins - 1], smp = ins?.map ? ins.smp[ins.map[key]] : ins?.smp[0];
        if (smp !== undefined && !porta) st.smp = smp;
      }
      const s = m.samples[st.smp];
      const fine = fx === 14 && p >> 4 === 5 ? ((p & 15) ^ 8) - 8 : (s?.fine ?? st.fine);
      const rel = xm ? (s?.rel ?? 0) : 0;
      const per = !xm ? cell.period * 4 * 2 ** (-fine / 96) : periodOf(key + rel, fine);
      if (porta && st.rec) st.target = per;
      else {
        st.key = key; st.per = per; st.target = 0;
        if (fx === 9) { if (p) st.mem.ofs = p; st.ofs = (st.mem.ofs ?? 0) * 256; }
        if (!(st.vibType & 4)) st.vibPos = 0;
        if (!(st.treType & 4)) st.trePos = 0;
        st.off = false; st.env = 0; st.fade = 65536;
        trigger(st, at);
      }
    }
    // Colonne de volume (XM).
    const v = cell.vol;
    if (xm && v >= 0x10 && v <= 0x50) st.vol = v - 0x10;
    else if (xm && v >> 4 === 8) st.vol = Math.max(0, st.vol - (v & 15));
    else if (xm && v >> 4 === 9) st.vol = Math.min(64, st.vol + (v & 15));
    else if (xm && v >> 4 === 0xa) st.vibSpeed = v & 15;
    else if (xm && v >> 4 === 0xc) { st.pan = ((v & 15) * 17 - 128) / 128; st.panSet = true; }
    else if (xm && v >> 4 === 0xf && v & 15) st.mem.tone = (v & 15) * 16;
    if (fx === 12) st.vol = Math.min(64, p);
    if (fx === 8) { st.pan = (p - 128) / 128; st.panSet = true; if (st.rec && !st.rec.pv.length) st.rec.pan = Math.round(st.pan * 100) / 100; }
  }

  function firstTickFx(st, at) {
    const cell = st.cell, fx = cell.fx, p = cell.param, hi = p >> 4, lo = p & 15;
    if (fx === 3 && p) st.mem.tone = p;
    if (fx === 4) { if (hi) st.vibSpeed = hi; if (lo) st.vibDepth = lo; st.vibOn = true; }
    if (fx === 7) { if (hi) st.treSpeed = hi; if (lo) st.treDepth = lo; st.treOn = true; }
    if (fx === 6) st.vibOn = true;
    if (fx === 5 || fx === 6 || fx === 10) { if (p) st.mem.vs = p; }
    if (fx === 1 && p) st.mem.up = p;
    if (fx === 2 && p) st.mem.down = p;
    if (fx === 16) gvol = Math.min(64, p);
    if (fx === 17 && p) st.mem.gvs = p;
    if (fx === 25 && p) st.mem.ps = p;
    if (fx === 20 && p === 0) keyOff(st);
    if (fx === 14) {
      if (hi === 1) pitchSlide(st, -(lo || st.mem.fu || 0) * 4), lo && (st.mem.fu = lo);
      if (hi === 2) pitchSlide(st, (lo || st.mem.fd || 0) * 4), lo && (st.mem.fd = lo);
      if (hi === 10) st.vol = Math.min(64, st.vol + (lo || st.mem.fvu || 0)), lo && (st.mem.fvu = lo);
      if (hi === 11) st.vol = Math.max(0, st.vol - (lo || st.mem.fvd || 0)), lo && (st.mem.fvd = lo);
      if (hi === 12) { st.cut = lo; if (!lo) { st.vol = 0; st.cutDone = true; } }
      if (hi === 9) st.retrig = lo;
      if (hi === 4) st.vibType = lo;   // forme du vibrato : sinus, dent de scie, carré (+4 : sans retour au début)
      if (hi === 7) st.treType = lo;   // forme du trémolo
    }
    if (fx === 33) {
      if (hi === 1) pitchSlide(st, -(lo || st.mem.xu || 0)), lo && (st.mem.xu = lo);
      if (hi === 2) pitchSlide(st, (lo || st.mem.xd || 0)), lo && (st.mem.xd = lo);
    }
    if (fx === 27) { if (p) st.mem.rr = p; st.retrig = (st.mem.rr ?? 0) & 15; }
    if (fx === 0 && p) st.arp = 0;
  }

  function tickFx(st, tick, at) {
    const cell = st.cell, fx = cell.fx, p = cell.param, hi = p >> 4, lo = p & 15;
    if (fx === 0 && p) st.arp = [0, hi, lo][tick % 3];
    if (fx === 1) pitchSlide(st, -(xm ? st.mem.up ?? 0 : p) * 4);
    if (fx === 2) pitchSlide(st, (xm ? st.mem.down ?? 0 : p) * 4);
    if (fx === 3 || fx === 5) toneSlide(st);
    if (fx === 4 || fx === 6) { st.vibPos += st.vibSpeed; st.vibOn = true; }
    if (fx === 7) { st.trePos += st.treSpeed; st.treOn = true; }
    if (fx === 5 || fx === 6 || fx === 10) volSlide(st, xm ? st.mem.vs ?? 0 : p);
    if (fx === 17) { const q = st.mem.gvs ?? 0; gvol = Math.max(0, Math.min(64, gvol + ((q >> 4) || -(q & 15)))); }
    if (fx === 25) { const q = st.mem.ps ?? 0; st.pan = Math.max(-1, Math.min(1, st.pan + ((q >> 4) || -(q & 15)) / 128)); }
    if (fx === 20 && tick === p) keyOff(st);
    if (fx === 14 && hi === 12 && tick === st.cut) { st.vol = 0; st.cutDone = true; }
    // Colonne de volume, ticks suivants.
    const v = cell.vol;
    if (xm && v >> 4 === 6) st.vol = Math.max(0, st.vol - (v & 15));
    if (xm && v >> 4 === 7) st.vol = Math.min(64, st.vol + (v & 15));
    if (xm && v >> 4 === 0xb) { if (v & 15) st.vibDepth = v & 15; st.vibPos += st.vibSpeed; st.vibOn = true; }
    if (xm && v >> 4 === 0xf) toneSlide(st);
    // Note rejouée (E9x, Rxy).
    if (st.retrig && tick % st.retrig === 0 && st.rec) {
      if (fx === 27) {
        const k = (st.mem.rr ?? 0) >> 4;
        const ops = [0, -1, -2, -4, -8, -16, 0, 0, 0, 1, 2, 4, 8, 16, 0, 0];
        st.vol = k === 6 ? st.vol * 2 / 3 : k === 7 ? st.vol / 2 : k === 14 ? st.vol * 3 / 2 : k === 15 ? st.vol * 2 : st.vol + ops[k];
        st.vol = Math.max(0, Math.min(64, Math.round(st.vol)));
      }
      st.env = 0; st.fade = 65536;
      trigger(st, at);
    }
  }

  // Note relâchée : l'enveloppe passe son point de maintien et le son s'éteint peu à peu ; sans enveloppe, il se coupe.
  function keyOff(st) {
    st.off = true;
    if (!m.instruments[st.ins - 1]?.env) { st.vol = 0; st.cutDone = true; }
  }

  function envStep(st) {
    const ins = m.instruments[st.ins - 1], env = ins.env;
    if (st.off) st.fade = Math.max(0, st.fade - ins.fadeout * 2);
    if (env.sus >= 0 && !st.off && st.env === env.pts[env.sus]?.[0]) return;
    st.env++;
    if (env.loop && st.env >= env.pts[env.loop[1]]?.[0]) st.env = env.pts[env.loop[0]]?.[0] ?? 0;
  }

  for (const notes of channels) {
    for (const n of notes) {
      delete n.rate;
      if (!n.pv.length) delete n.pv;
      if (!n.pp.length) delete n.pp;
      n.t = Math.round(n.t * 1e4) / 1e4;
      n.len = Math.round(n.len * 1e4) / 1e4;
    }
  }
  const beats = Math.round(beatsOf(time) * 1e4) / 1e4;
  return { format: m.format, title: m.title, bpm, samples, channels, beats, skipped,
    sections: sections.filter((s, k) => (sections[k + 1]?.t ?? beats) > s.t + 1e-4) };
}

/**
 * Notes d'une voie découpées par passage de pattern : [{ t, end, pos, pat, notes }], temps des notes depuis le début du
 * passage. Une note tenue d'un passage au suivant y continue là où le son en était (départ dans le sample, volume et
 * hauteur du moment), sans nouvelle attaque.
 */
export function splitSections(mod, notes) {
  const bd = 60 / mod.bpm;
  const out = mod.sections.map((s, k) => ({ ...s, end: mod.sections[k + 1]?.t ?? mod.beats, notes: [] }));
  if (!out.length) return out;
  const r4 = x => Math.round(x * 1e4) / 1e4;
  for (let n of notes) {
    let k = out.findLastIndex(s => s.t <= n.t + 1e-6);
    if (k < 0) k = 0;
    while (n && k < out.length - 1 && n.t + n.len > out[k].end + 1e-4) {
      const cut = out[k].end - n.t;
      out[k].notes.push(notePart(n, cut));
      n = noteRest(mod, n, cut, bd);
      k++;
    }
    if (n) out[k].notes.push(n);
  }
  for (const s of out) for (const n of s.notes) n.t = r4(n.t - s.t);
  return out;

  // Début d'une note jusqu'à `cut` (temps depuis son départ).
  function notePart(n, cut) {
    const e = { ...n, len: r4(cut) };
    for (const k of ['pv', 'pp']) { if (n[k]) e[k] = n[k].filter(([d]) => d < cut - 1e-6); if (!e[k]?.length) delete e[k]; }
    return e;
  }
}

// Suite d'une note après `cut` temps : départ dans le son là où il en était (lecture intégrée sur les écarts de
// hauteur, boucle comprise), volume et hauteur du moment. null si le son est déjà fini.
function noteRest(mod, n, cut, bd) {
  const s = mod.samples[n.s], r4 = x => Math.round(x * 1e4) / 1e4;
  const at = (pts, first) => { let v = first; for (const [d, x] of pts ?? []) if (d <= cut + 1e-6) v = x; return v; };
  let pos = n.ofs ?? 0, prev = 0, semis = 0;
  const speed = () => 2 ** ((n.note - s.root + semis) / 12);
  for (const [d, x] of n.pp ?? []) { if (d > cut) break; pos += (d - prev) * bd * speed(); prev = d; semis = x; }
  pos += (cut - prev) * bd * speed();
  const dur = s.data.length / s.rate;
  if (s.loop) {
    const [a, b] = [s.loop[0] / s.rate, s.loop[1] / s.rate];
    if (pos >= b) pos = a + (pos - a) % (b - a);
  } else if (pos >= dur - 1e-4) return null;
  const e = { ...n, t: r4(n.t + cut), len: r4(n.len - cut), vel: at(n.pv, n.vel), ofs: r4(pos) };
  delete e.pv; delete e.pp;
  const pv = (n.pv ?? []).filter(([d]) => d > cut + 1e-6).map(([d, v]) => [r4(d - cut), v]);
  const p0 = at(n.pp, 0), pp = [...(p0 ? [[0, p0]] : []), ...(n.pp ?? []).filter(([d]) => d > cut + 1e-6).map(([d, v]) => [r4(d - cut), v])];
  if (pv.length) e.pv = pv;
  if (pp.length) e.pp = pp;
  return e.len > 1e-4 ? e : null;
}
