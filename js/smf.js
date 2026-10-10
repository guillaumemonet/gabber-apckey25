// Fichiers MIDI standard (SMF) : écriture (type 1) et lecture (types 0 et 1), sans dépendance.
// Les temps sont en temps (noires) ; le tempo est celui du fichier (premier changement de tempo).

const PPQ = 480;

function vlq(n) {   // longueur variable (7 bits par octet)
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = n => [(n >> 8) & 255, n & 255];
const text = s => [...new TextEncoder().encode(s)];
function chunk(id, data) { return [...text(id), ...u32(data.length), ...data]; }

/**
 * @param {{ name: string, channel?: number, notes: { t: number, len: number, note: number, vel?: number }[] }[]} tracks
 * @param {number} bpm
 * @returns {Uint8Array}
 */
export function writeMidi(tracks, bpm) {
  const tempo = Math.round(60000000 / bpm);
  const head = [...vlq(0), 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
    ...vlq(0), 0xff, 0x58, 4, 4, 2, 24, 8,   // 4/4
    ...vlq(0), 0xff, 0x2f, 0];
  const out = [...chunk('MThd', [...u16(1), ...u16(tracks.length + 1), ...u16(PPQ)]), ...chunk('MTrk', head)];
  for (const tr of tracks) {
    const ch = (tr.channel ?? 0) & 15;
    const ev = [];
    for (const n of tr.notes) {
      const on = Math.round(n.t * PPQ), off = Math.max(on + 1, Math.round((n.t + n.len) * PPQ));
      const note = Math.max(0, Math.min(127, Math.round(n.note)));
      ev.push({ tick: on, kind: 1, bytes: [0x90 | ch, note, Math.max(1, Math.min(127, Math.round((n.vel ?? 0.85) * 127)))] });
      ev.push({ tick: off, kind: 0, bytes: [0x80 | ch, note, 0] });
    }
    ev.sort((a, b) => a.tick - b.tick || a.kind - b.kind);   // à temps égal : les fins avant les débuts
    const data = [...vlq(0), 0xff, 0x03, ...vlq(text(tr.name).length), ...text(tr.name)];
    let last = 0;
    for (const e of ev) { data.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
    data.push(...vlq(0), 0xff, 0x2f, 0);
    out.push(...chunk('MTrk', data));
  }
  return new Uint8Array(out);
}

/**
 * @param {ArrayBuffer|Uint8Array} buf
 * @returns {{ bpm: number, tracks: { name: string, notes: { t, len, note, vel, ch }[] }[] }}
 */
export function readMidi(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = 0;
  const str = n => { const s = String.fromCharCode(...b.subarray(p, p + n)); p += n; return s; };
  const r32 = () => { const v = (b[p] << 24 | b[p + 1] << 16 | b[p + 2] << 8 | b[p + 3]) >>> 0; p += 4; return v; };
  const r16 = () => { const v = b[p] << 8 | b[p + 1]; p += 2; return v; };
  const rv = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80 && p < b.length); return v; };
  if (str(4) !== 'MThd') throw new Error('not a MIDI file');
  const hl = r32(); r16(); const n = r16(); const div = r16(); p += hl - 6;
  if (div & 0x8000) throw new Error('SMPTE time is not supported');
  let bpm = 120, tempoSet = false;
  const tracks = [];
  for (let k = 0; k < n && p < b.length; k++) {
    if (str(4) !== 'MTrk') break;
    const len = r32(), end = p + len;
    let tick = 0, status = 0, name = '';
    const open = new Map(), notes = [];
    while (p < end) {
      tick += rv();
      let st = b[p];
      if (st & 0x80) p++; else st = status;   // statut courant
      if (st === 0xff) {
        const type = b[p++], l = rv(), data = b.subarray(p, p + l); p += l;
        if (type === 0x03 && !name) name = new TextDecoder().decode(data);
        if (type === 0x51 && !tempoSet) { bpm = 60000000 / (data[0] << 16 | data[1] << 8 | data[2]); tempoSet = true; }
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { p += rv(); continue; }
      status = st;
      const type = st & 0xf0, ch = st & 15;
      const d1 = b[p++], d2 = type === 0xc0 || type === 0xd0 ? 0 : b[p++];
      if (type === 0x90 && d2 > 0) open.set(ch * 128 + d1, { tick, vel: d2 });
      else if (type === 0x80 || type === 0x90) {
        const o = open.get(ch * 128 + d1);
        if (o) { notes.push({ t: o.tick / div, len: Math.max(1, tick - o.tick) / div, note: d1, vel: o.vel / 127, ch }); open.delete(ch * 128 + d1); }
      }
    }
    p = end;
    for (const [key, o] of open) notes.push({ t: o.tick / div, len: Math.max(1, tick - o.tick) / div, note: key % 128, vel: o.vel / 127, ch: Math.floor(key / 128) });
    if (notes.length) tracks.push({ name, notes: notes.sort((a, c) => a.t - c.t || a.note - c.note) });
  }
  return { bpm: Math.round(bpm * 100) / 100, tracks };
}
