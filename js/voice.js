// Générateur de voix : un texte chanté, scandé ou dit en robot sur les notes d'un bloc (lead, nappe), par une voix
// neuronale (Piper, synthèse vocale libre qui tourne dans le navigateur). Le texte est converti en phonèmes
// (espeak-ng), découpé en syllabes ; chaque phrase est dite d'un seul tenant par la voix, chaque phonème à la durée
// voulue (modèle retouché, voir piperTimedModel), puis la hauteur est recalée note par note (js/autotune.js).
// Si le modèle ne s'y prête pas : chaque syllabe dite seule, recalée sur sa note (js/psola.js). Vocodeur : la voix
// module une porteuse qui joue les notes. Chœur : plusieurs interprètes légèrement décalés ; harmonie : une voix par
// note des accords.
// Moteur, modèle de calcul et voix sont téléchargés à la première utilisation (puis gardés dans le cache du
// navigateur) : rien n'est chargé tant que le générateur ne sert pas.
import { tuneCurve } from './autotune.js';
import { analyzePitch, medianF0, pitchMarks, pitchTrack, psola, psolaShift } from './psola.js';

const ORT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
const PHONEMIZER_JS = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/piper-DeOu3H9E.js';
const PHONEMIZER = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const VOICES_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const CACHE = 'gabberkey-voices';

// Voix proposées : seulement celles dont la licence permet tout usage (y compris commercial).
// speakers : interprètes du modèle (plusieurs voix dans un seul fichier) ; names : ceux qui ont un nom.
export const VOICE_MODELS = {
  'fr-siwis': { lang: 'fr', path: 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium', mb: 63, license: 'CC BY 4.0', credit: 'SIWIS (Université d\'Édimbourg)', speakers: 1, gender: 'f' },
  'fr-gilles': { lang: 'fr', path: 'fr/fr_FR/gilles/low/fr_FR-gilles-low', mb: 63, license: 'CC0', credit: 'Gilles', speakers: 1, gender: 'm' },
  'fr-upmc': { lang: 'fr', path: 'fr/fr_FR/upmc/medium/fr_FR-upmc-medium', mb: 76, license: 'CC BY-SA 4.0', credit: 'UPMC / MaryTTS', speakers: 2, names: ['Jessica', 'Pierre'], gender: 'fm' },
  'fr-mls': { lang: 'fr', path: 'fr/fr_FR/mls/medium/fr_FR-mls-medium', mb: 76, license: 'CC BY 4.0', credit: 'Multilingual LibriSpeech', speakers: 125, gender: 'x' },
  'en-ljspeech': { lang: 'en', path: 'en/en_US/ljspeech/medium/en_US-ljspeech-medium', mb: 63, license: 'domaine public / public domain', credit: 'LJ Speech', speakers: 1, gender: 'f' },
  'en-libritts': { lang: 'en', path: 'en/en_US/libritts_r/medium/en_US-libritts_r-medium', mb: 78, license: 'CC BY 4.0', credit: 'LibriTTS-R', speakers: 904, gender: 'x' },
  'en-vctk': { lang: 'en', path: 'en/en_GB/vctk/medium/en_GB-vctk-medium', mb: 76, license: 'CC BY 4.0', credit: 'VCTK (Université d\'Édimbourg)', speakers: 109, gender: 'x' },
};
export const VOICE_MODES = ['sing', 'rap', 'robot', 'vocoder'];
export const VOICE_CHOIR = [1, 2, 4, 8];
export const MAX_VOICE_PARTS = 8;

// ---------- Phonèmes et syllabes ----------

const VOWELS = new Set([...'aeiouyɛɔəøœɑɒæʌɪʊɐɜɝɚɨʉɯɤɘɵᵻɞ']);
const MARKS = new Set(['̃', 'ː', 'ˑ', '̩', '̯']);   // nasale, longueur, syllabique, non syllabique : collés au son d'avant
const STRESS = new Set(['ˈ', 'ˌ']);
const DIPHTHONGS = new Set(['aɪ', 'eɪ', 'oʊ', 'aʊ', 'ɔɪ', 'əʊ', 'ɪə', 'eə', 'ʊə', 'ɛə', 'aɪə']);
const LIQUIDS = new Set(['l', 'ʁ', 'r', 'ɹ', 'ɾ', 'j', 'w', 'ɥ']);
const OBSTRUENTS = new Set([...'pbtdkgfvθðszʃʒ']);
const isVowel = p => VOWELS.has(p[0]);

// Phonèmes d'espeak (un caractère par élément) -> sons (diacritiques recollés), mots séparés.
// -> [[son, …], …] (un tableau par mot)
export function phonemeWords(phonemes) {
  const words = [];
  let cur = [];
  for (const p of phonemes) {
    if (p === ' ' || p === '-' || p === '‿') { if (cur.length) words.push(cur); cur = []; continue; }
    if (/^[.,!?;:…"«»()]$/.test(p)) continue;
    if (MARKS.has(p) && cur.length && !STRESS.has(cur[cur.length - 1])) { cur[cur.length - 1] += p; continue; }
    cur.push(p);
  }
  if (cur.length) words.push(cur);
  return words;
}

/**
 * Découpe un mot (sons) en syllabes : une voyelle (ou diphtongue en anglais) par syllabe ; entre deux voyelles, une
 * consonne va à la syllabe suivante, deux consonnes se partagent sauf groupe « consonne + l / r / semi-voyelle ».
 * -> [[son, …], …] (accent ˈ gardé devant sa voyelle). Un mot sans voyelle donne une syllabe sans noyau.
 */
export function syllabify(word, lang = 'fr') {
  const items = word.filter(Boolean);
  const nuclei = [];
  for (let i = 0; i < items.length; i++) {
    if (!isVowel(items[i])) continue;
    const prev = nuclei[nuclei.length - 1];
    if (lang === 'en' && prev && prev.end === i - 1 && DIPHTHONGS.has(items[prev.end] + items[i])) { prev.end = i; continue; }
    nuclei.push({ start: i, end: i });
  }
  if (!nuclei.length) return [items];
  const cuts = [0];
  for (let k = 1; k < nuclei.length; k++) {
    const a = nuclei[k - 1].end + 1, b = nuclei[k].start;   // consonnes (et accents) entre deux noyaux : [a, b)
    const cons = [];
    for (let i = a; i < b; i++) if (!STRESS.has(items[i])) cons.push(i);
    let cut;
    if (cons.length <= 1) cut = cons.length ? cons[0] : b;
    else {
      const last = items[cons[cons.length - 1]], before = items[cons[cons.length - 2]];
      cut = OBSTRUENTS.has(before[0]) && LIQUIDS.has(last[0]) ? cons[cons.length - 2] : cons[cons.length - 1];
    }
    // L'accent d'une syllabe reste avec elle (il précède sa voyelle ou son attaque).
    while (cut > a && STRESS.has(items[cut - 1])) cut--;
    cuts.push(cut);
  }
  cuts.push(items.length);
  return cuts.slice(0, -1).map((c, k) => items.slice(c, cuts[k + 1]));
}

// Libellés écrits des syllabes d'un mot (pour l'affichage) : le mot coupé en `n` morceaux, avant la dernière consonne
// qui précède chaque groupe de voyelles (« bonjour » -> bon, jour).
const V = 'aeiouyàâäéèêëîïôöùûüœæ';
export function spellSyllables(word, n) {
  if (n <= 1) return [word];
  const groups = [...word.matchAll(new RegExp(`[^${V}]*[${V}]+`, 'gi'))];
  const starts = groups.length >= n
    ? [0, ...groups.slice(1, n).map(m => m.index + Math.max(0, m[0].search(new RegExp(`[${V}]`, 'i')) - 1))]
    : Array.from({ length: n }, (_, k) => Math.round(k * word.length / n));
  return starts.map((st, k) => word.slice(st, starts[k + 1] ?? word.length) || '·');
}

// Mots du texte (« _ » seul = la syllabe d'avant tient aussi la note suivante).
export const textTokens = text => text.replace(/[’']/g, '\' ').split(/\s+/).map(w => w.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, '')).filter(Boolean);

/**
 * Syllabes du texte, dans l'ordre : [{ ph: [son, …], label, end, hold? }] ; end = dernière syllabe d'un mot ;
 * hold = « _ » (prolonge la précédente).
 * `phonemes` : sortie d'espeak pour le texte sans les « _ ». Si le nombre de mots ne correspond pas (mots collés par
 * espeak), les « _ » sont ignorés et les libellés viennent des phonèmes.
 */
export function textSyllables(text, phonemes, lang = 'fr') {
  const tokens = textTokens(text).map(w => w.replace(/'$/, ''));
  const written = tokens.filter(w => w !== '_');
  const words = phonemeWords(phonemes);
  const same = words.length === written.length;
  const out = [];
  let wi = 0;
  const push = (ph, label) => {
    const syls = syllabify(ph, lang);
    const labels = label ? spellSyllables(label, syls.length) : syls.map(s => s.join('').replace(/[ˈˌ]/g, ''));
    syls.forEach((s, k) => out.push({ ph: s, label: labels[k], end: k === syls.length - 1 }));   // end : fin du mot
  };
  if (same) {
    for (const tok of tokens) {
      if (tok === '_') { if (out.length) out.push({ hold: true, label: '_' }); continue; }
      push(words[wi], written[wi]);
      wi++;
    }
  } else for (const w of words) push(w);
  // Syllabes sans voyelle (l', d'…) : collées à la suivante.
  for (let i = out.length - 2; i >= 0; i--) {
    if (out[i].hold || out[i + 1].hold || out[i].ph.some(isVowel)) continue;
    out[i + 1] = { ph: [...out[i].ph, ...out[i + 1].ph], label: out[i].label + out[i + 1].label, end: out[i + 1].end };
    out.splice(i, 1);
  }
  if (out.length && !out[out.length - 1].hold && !out[out.length - 1].ph.some(isVowel) && out.length > 1) {
    const last = out.pop();
    out[out.length - 1] = { ph: [...out[out.length - 1].ph, ...last.ph], label: out[out.length - 1].label + last.label, end: true };
  }
  return out;
}

/**
 * Notes à chanter : un accord par départ (notes qui commencent ensemble), en temps.
 * -> [{ t, len, notes: [hauteurs, de la plus grave à la plus aiguë], vel }]
 */
export function noteSlots(events) {
  const slots = [];
  for (const e of [...events].sort((a, b) => a.t - b.t || a.note - b.note)) {
    const last = slots[slots.length - 1];
    if (last && Math.abs(last.t - e.t) < 1e-3) { last.notes.push(e.note); last.len = Math.max(last.len, e.len); last.vel = Math.max(last.vel, e.vel ?? 0.85); }
    else slots.push({ t: e.t, len: e.len, notes: [e.note], vel: e.vel ?? 0.85 });
  }
  // Une syllabe s'arrête au plus tard au départ de la suivante.
  for (let i = 0; i + 1 < slots.length; i++) slots[i].len = Math.min(slots[i].len, slots[i + 1].t - slots[i].t);
  return slots;
}

/**
 * Syllabes posées sur les notes : la syllabe k prend la note k (« _ » ajoute la note suivante à la syllabe d'avant).
 * Le motif de notes est répété (décalé de `span` temps) s'il y a plus de syllabes que de notes ; `fill` répète le
 * texte jusqu'à la fin des notes. -> [{ ph, label, notes: [slot, …], end }]
 */
export function placeSyllables(syls, slots, span, { fill = false } = {}) {
  const out = [];
  if (!syls.length || !slots.length) return out;
  const steps = fill ? Math.max(syls.length, slots.length) : syls.length;
  for (let k = 0; k < steps; k++) {
    const s = syls[k % syls.length], n = slots[k % slots.length];
    const slot = { ...n, t: n.t + Math.floor(k / slots.length) * span, notes: [...n.notes] };
    if (s.hold) { if (out.length) out[out.length - 1].notes.push(slot); continue; }
    out.push({ ph: s.ph, label: s.label, notes: [slot], end: !!s.end });
  }
  return out;
}

// ---------- Modèle Piper : durées des phonèmes ----------
// Le modèle publié ne rend que le son. Son graphe (format ONNX, protobuf) est retouché au chargement : le nœud qui
// arrondit les durées prédites (« Ceil ») est retiré et son résultat devient une entrée (durées imposées, en trames),
// et les durées prédites (avant arrondi) deviennent une sortie. Une phrase entière peut alors être dite d'un seul
// tenant (liaisons et coarticulation naturelles) avec chaque phonème calé sur le temps voulu.

function pbFields(b, s, e) {
  const out = [];
  let p = s;
  const varint = () => { let r = 0, m = 1; for (;;) { const c = b[p++]; r += (c & 0x7f) * m; if (!(c & 0x80)) break; m *= 128; } return r; };
  while (p < e) {
    const at = p, key = varint(), f = Math.floor(key / 8), w = key & 7;
    let vs = p, ve;
    if (w === 0) { varint(); ve = p; } else if (w === 2) { const l = varint(); vs = p; ve = p + l; p = ve; } else if (w === 5) { p += 4; ve = p; } else if (w === 1) { p += 8; ve = p; } else throw new Error('onnx');
    out.push({ f, w, at, vs, ve, end: p });
  }
  return out;
}
const pbVarint = n => { const o = []; do { let c = n % 128; n = Math.floor(n / 128); if (n) c |= 128; o.push(c); } while (n); return o; };
const pbBytes = (f, bytes) => [...pbVarint(f * 8 + 2), ...pbVarint(bytes.length), ...bytes];
const pbStr = s => [...new TextEncoder().encode(s)];
// ValueInfoProto : nom, tenseur float de rang 3 (dimensions libres).
const floatInfo = name => pbBytes(1, pbStr(name)).concat(pbBytes(2, pbBytes(1, [8, 1, ...pbBytes(2, [...pbBytes(1, pbBytes(2, pbStr('a'))), ...pbBytes(1, pbBytes(2, pbStr('b'))), ...pbBytes(1, pbBytes(2, pbStr('c')))])])));

/** Modèle Piper retouché (voir plus haut). -> octets du modèle, ou null si le graphe n'a pas la forme attendue. */
export function piperTimedModel(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const top = pbFields(b, 0, b.length);
  const g = top.find(x => x.f === 7 && x.w === 2);
  if (!g) return null;
  const parts = pbFields(b, g.vs, g.ve);
  const dec = new TextDecoder();
  let ceil = null;
  for (const x of parts) {
    if (x.f !== 1) continue;
    const n = pbFields(b, x.vs, x.ve), str = k => n.filter(y => y.f === k).map(y => dec.decode(b.subarray(y.vs, y.ve)));
    if (str(4)[0] === 'Ceil') { if (ceil) return null; ceil = { x, input: str(1)[0], output: str(2)[0] }; }
  }
  if (!ceil) return null;
  const extra = [...pbBytes(11, floatInfo(ceil.output)), ...pbBytes(12, floatInfo(ceil.input))];
  const kept = parts.filter(x => x !== ceil.x);
  const glen = kept.reduce((s, x) => s + x.end - x.at, 0) + extra.length;
  const head = pbVarint(7 * 8 + 2).concat(pbVarint(glen));
  const out = new Uint8Array(g.at + head.length + glen + (b.length - g.end));
  let p = 0;
  out.set(b.subarray(0, g.at), p); p += g.at;
  out.set(head, p); p += head.length;
  for (const x of kept) { out.set(b.subarray(x.at, x.end), p); p += x.end - x.at; }
  out.set(extra, p); p += extra.length;
  out.set(b.subarray(g.end), p);
  return { bytes: out, durIn: ceil.output, durOut: ceil.input };
}

// ---------- Moteur (Piper), chargé à la demande ----------

let backend = null;   // { phonemize(lines, lang), synth(model, ph, { speaker, length, noise }) -> { data, sr } } ; remplaçable (tests)
export function setVoiceBackend(b) { backend = b; synthCache.clear(); }

const sessions = new Map();   // modèle -> promesse { session, cfg }
let ortReady = null;

function loadOrt() {
  ortReady ??= new Promise((res, rej) => {
    if (window.ort) { res(window.ort); return; }
    const s = document.createElement('script');
    s.src = `${ORT_URL}ort.min.js`;
    s.onload = () => res(window.ort);
    s.onerror = () => { ortReady = null; rej(new Error('onnxruntime')); };
    document.head.appendChild(s);
  }).then(ort => { ort.env.wasm.wasmPaths = ORT_URL; ort.env.wasm.numThreads = 1; return ort; });
  return ortReady;
}

// Fichier gardé dans le cache du navigateur (téléchargé une fois). onProgress(reçu, total) pendant le téléchargement.
async function fetchCached(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return hit; } catch { /* pas de cache (fichier local) */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress?.(got, total);
  }
  const blob = new Blob(parts, { type: res.headers.get('content-type') ?? 'application/octet-stream' });
  try { await cache?.put(url, new Response(blob)); } catch { /* quota : tant pis, il sera retéléchargé */ }
  return new Response(blob);
}

// La voix est-elle déjà téléchargée ?
export async function voiceCached(model) {
  try { return !!(await (await caches.open(CACHE)).match(`${VOICES_URL}${VOICE_MODELS[model].path}.onnx`)); } catch { return false; }
}

async function piperSession(model, onProgress) {
  if (!sessions.has(model)) {
    const p = (async () => {
      const m = VOICE_MODELS[model];
      const ort = await loadOrt();
      const cfg = await (await fetchCached(`${VOICES_URL}${m.path}.onnx.json`)).json();
      const bytes = new Uint8Array(await (await fetchCached(`${VOICES_URL}${m.path}.onnx`, onProgress)).arrayBuffer());
      // Modèle retouché pour imposer les durées des phonèmes (sinon, le modèle tel quel : syllabe par syllabe).
      let timed = null;
      try { timed = piperTimedModel(bytes); } catch { timed = null; }
      const session = await ort.InferenceSession.create(timed?.bytes ?? bytes);
      return { session, cfg, ort, durIn: timed?.durIn ?? null, durOut: timed?.durOut ?? null };
    })();
    sessions.set(model, p);
    p.catch(() => sessions.delete(model));
  }
  return sessions.get(model);
}

const piper = {
  // Phonèmes d'espeak pour chaque ligne : [[caractère, …], …].
  async phonemize(lines, lang) {
    const { createPiperPhonemize } = await import(PHONEMIZER_JS);
    const out = [];
    const mod = await createPiperPhonemize({
      print: l => out.push(l),
      printErr: () => {},
      locateFile: f => (f.endsWith('.wasm') ? `${PHONEMIZER}.wasm` : f.endsWith('.data') ? `${PHONEMIZER}.data` : f),
    });
    const res = [];
    for (const line of lines) {
      out.length = 0;
      mod.callMain(['-l', lang, '--input', JSON.stringify([{ text: line }]), '--espeak_data', '/espeak-ng-data']);
      res.push(out.flatMap(l => { try { return JSON.parse(l).phonemes ?? []; } catch { return []; } }).flatMap(p => [...p]).concat(' '));
    }
    return res;
  },
  // Une syllabe seule, durées naturelles (rendu syllabe par syllabe).
  async synth(model, ph, opts, onProgress) {
    const s = await piperSession(model, onProgress);
    const map = s.cfg.phoneme_id_map, id = p => map[p]?.[0];
    const ids = [id('^'), 0];
    for (const p of ph) for (const c of [...p]) if (id(c) !== undefined) ids.push(id(c), 0);
    ids.push(id('$'));
    let frames;
    if (s.durIn) frames = [...(await s.session.run(piperFeeds(s, ids, opts)))[s.durOut].data].map(Math.ceil);
    const r = await s.session.run(piperFeeds(s, ids, opts, frames));
    return { data: r.output.data, sr: s.cfg.audio.sample_rate };
  },
  // Phrase entière aux durées imposées (null si le modèle ne s'y prête pas).
  async timed(model, onProgress) {
    const s = await piperSession(model, onProgress);
    if (!s.durIn) return null;
    const map = s.cfg.phoneme_id_map;
    let hop = 256;
    return {
      sr: s.cfg.audio.sample_rate,
      get hop() { return hop; },
      id: c => map[c]?.[0],
      // Durées naturelles prédites (trames, fractionnaires).
      async durations(ids, opts) {
        const r = await s.session.run(piperFeeds(s, ids, opts));
        hop = Math.round(r.output.data.length / ids.length) || hop;   // une trame par jeton : la taille d'une trame
        return Float32Array.from(r[s.durOut].data);
      },
      async render(ids, frames, opts) { return (await s.session.run(piperFeeds(s, ids, opts, frames))).output.data; },
    };
  },
};

// Entrées du modèle : jetons (phonèmes), réglages, interprète, durées imposées (trames) s'il les accepte.
function piperFeeds(s, ids, { speaker = 0, length = 1, noise = 1 }, frames) {
  const { ort, cfg } = s, inf = cfg.inference;
  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale * noise, inf.length_scale * length, inf.noise_w]), [3]),
  };
  if (cfg.num_speakers > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker % cfg.num_speakers)]), [1]);
  if (s.durIn) feeds[s.durIn] = new ort.Tensor('float32', Float32Array.from(frames ?? ids.map(() => 1)), [1, 1, ids.length]);
  return feeds;
}
const engineOf = () => backend ?? piper;
export const espeakLang = model => (model === 'en-vctk' ? 'en-gb-x-rp' : VOICE_MODELS[model].lang === 'en' ? 'en-us' : 'fr');

// Prépare la voix (moteur et modèle) : onProgress(reçu, total) pendant le téléchargement.
export async function loadVoice(model, onProgress) {
  if (backend) return;
  await piperSession(model, onProgress);
}

const synthCache = new Map();
async function synthSyllable(model, ph, opts) {
  const key = JSON.stringify([model, ph, opts.speaker, opts.length.toFixed(2), opts.noise.toFixed(2)]);
  if (!synthCache.has(key)) {
    if (synthCache.size > 600) synthCache.delete(synthCache.keys().next().value);
    synthCache.set(key, engineOf().synth(model, ph, opts).then(trimSilence));
  }
  return synthCache.get(key);
}

// Silence retiré au début et à la fin (sous −45 dB de la crête).
function trimSilence({ data, sr }) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const th = peak * 0.0056;
  let a = 0, b = data.length;
  while (a < b && Math.abs(data[a]) < th) a++;
  while (b > a && Math.abs(data[b - 1]) < th) b--;
  a = Math.max(0, a - Math.round(sr * 0.003));
  b = Math.min(data.length, b + Math.round(sr * 0.01));
  return { data: data.slice(a, b), sr };
}

// Noyau d'une syllabe (sa voyelle) : la plus longue suite de trames voisées et fortes. -> [début, fin] en échantillons
function nucleus(track, n) {
  const peak = Math.max(...track.rms, 1e-9);
  let best = null, cur = null;
  track.f0.forEach((f, k) => {
    if (f > 0 && track.rms[k] > peak * 0.2) { cur ??= [k, k]; cur[1] = k; if (!best || cur[1] - cur[0] > best[1] - best[0]) best = [...cur]; }
    else cur = null;
  });
  if (!best) {
    const k = track.rms.indexOf(peak);
    best = [Math.max(0, k - 4), Math.min(track.rms.length - 1, k + 4)];
  }
  return [Math.min(n - 1, best[0] * track.hop), Math.min(n, (best[1] + 1) * track.hop)];
}

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Graine fixe : un même réglage donne toujours le même rendu (décalages du chœur).
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/**
 * Rend une voix (une partie) : syllabes placées (temps en secondes depuis le début), réglages de la partie.
 * part : { speaker, octave (décalage en octaves), formant, detune (demi-tons), jitter(i) (s), noise, pick(notes) }
 * -> { data, sr } (mono, avec `pre` secondes avant le temps 0)
 */
async function renderPart(placed, model, part, mode, pre, onStep) {
  const first = await synthSyllable(model, placed[0].ph, { speaker: part.speaker, length: 1, noise: part.noise });
  const sr = first.sr;
  const end = Math.max(...placed.map(s => { const l = s.notes[s.notes.length - 1]; return l.t + l.len; }));
  const out = new Float32Array(Math.ceil((end + pre + 0.6) * sr));
  for (let i = 0; i < placed.length; i++) {
    const s = placed[i];
    const t0 = s.notes[0].t + part.jitter(i), last = s.notes[s.notes.length - 1];
    const dur = Math.max(0.05, last.t + last.len - s.notes[0].t);
    // Durée naturelle allongée pour les notes longues (voyelles plus tenues, moins de périodes répétées).
    const length = mode === 'rap' ? Math.min(1.3, Math.max(0.5, dur / 0.28)) : Math.min(2.2, Math.max(0.5, dur / 0.32));
    const { data: x } = await synthSyllable(model, s.ph, { speaker: part.speaker, length, noise: part.noise });
    onStep?.();
    if (x.length < sr * 0.02) continue;
    const track = pitchTrack(x, sr);
    const marks = pitchMarks(x, sr, track);
    const [a, b] = nucleus(track, x.length);
    const f0med = medianF0(track) || 150;
    const coda = x.length - b;
    let dn = Math.max(0.04 * sr, dur * sr - Math.min(coda, 0.4 * dur * sr));
    if (mode === 'rap') dn = Math.min(dn, b - a);
    const len = Math.round(a + dn + coda);
    const ratio = (b - a) / dn;
    const map = ts => (ts < a ? ts : ts < a + dn ? a + (ts - a) * ratio : b + (ts - a - dn));
    // Hauteur visée : la note de la syllabe (ou des notes, avec « _ »), glissé de 40 ms, vibrato sur les notes longues.
    const onsets = s.notes.map(n => (n.t - s.notes[0].t) * sr);
    const targets = s.notes.map(n => midiHz(part.pick(n.notes) + 12 * part.octave + part.detune));
    const keep = mode === 'robot' ? 0 : 0.25;
    const pitch = (ts, ta, f) => {
      if (mode === 'rap') return f * Math.pow(2, (12 * part.octave + part.detune) / 12);
      const tn = ts - a;
      let k = 0;
      while (k + 1 < onsets.length && tn >= onsets[k + 1]) k++;
      let hz = targets[k];
      const since = (tn - onsets[k]) / sr;
      if (k > 0 && since < 0.04) hz = targets[k - 1] * Math.pow(hz / targets[k - 1], Math.max(0, since) / 0.04);
      if (mode === 'sing' && dur > 0.4 && tn > 0.25 * sr) {
        const depth = 0.3 * Math.min(1, (tn / sr - 0.25) / 0.2);
        hz *= Math.pow(2, depth * Math.sin(2 * Math.PI * 5.5 * tn / sr) / 12);
      }
      return hz * Math.pow(f / f0med, keep);
    };
    const y = psola(x, sr, marks, { len, map, pitch, formant: part.formant });
    // Niveau : la voyelle au même niveau pour toutes les syllabes ; petits fondus aux bords.
    let e = 0;
    for (let j = Math.round(a); j < Math.min(len, a + dn); j++) e += y[j] * y[j];
    const g = (0.22 * (s.notes[0].vel ?? 0.85)) / Math.max(1e-4, Math.sqrt(e / Math.max(1, dn)));
    const fin = Math.round(sr * 0.004), fout = Math.round(sr * 0.02);
    const at = Math.round((t0 + pre) * sr - a);
    for (let j = 0; j < len; j++) {
      const o = at + j;
      if (o < 0 || o >= out.length) continue;
      const env = Math.min(1, (j + 1) / fin, (len - j) / fout);
      out[o] += y[j] * g * env;
    }
  }
  return { data: out, sr };
}

// ---------- Rendu par phrases (modèle aux durées imposées) ----------
// Toute une phrase (jusqu'à un silence) est dite d'un seul tenant : chaque phonème reçoit sa durée pour que la voyelle
// de chaque syllabe commence sur sa note (les consonnes d'attaque juste avant, comme un chanteur), la voyelle tient la
// note, les consonnes finales viennent avant la syllabe suivante. Puis la hauteur est recalée note par note
// (js/autotune.js : glissé, vibrato) sur la phrase entière : transitions naturelles, pas de collage.

export const PHRASE_REST = 0.25;   // silence (s) entre deux notes au-delà duquel une nouvelle phrase commence

/**
 * Jetons d'une phrase pour le modèle : [{ id, syl (indice dans la phrase, −1 = début), role, vowel }]. role : 'lead'
 * (début), 'on' (consonnes d'attaque, accent), 'nuc' (voyelle et liants), 'coda' (consonnes finales, espace entre deux
 * mots), 'tail' (fin). Chaque phonème est suivi d'un jeton de liaison (« _ »), comme pour Piper.
 */
export function phraseTokens(syls, id) {
  const pad = id('_') ?? 0, toks = [];
  const push = (c, syl, role, vowel = false) => { const i = id(c); if (i === undefined) return; toks.push({ id: i, syl, role, vowel }, { id: pad, syl, role, vowel }); };
  push('^', -1, 'lead');
  syls.forEach((s, k) => {
    const first = s.ph.findIndex(isVowel), last = s.ph.length - 1 - [...s.ph].reverse().findIndex(isVowel);
    s.ph.forEach((u, j) => {
      const role = first < 0 || j < first ? 'on' : j <= last ? 'nuc' : 'coda';
      for (const c of u) push(c, k, role, role === 'nuc' && isVowel(u));
    });
    if (s.end && k < syls.length - 1) push(' ', k, 'coda');
  });
  const end = toks.length;
  push('$', syls.length - 1, 'tail');
  if (toks.length > end) toks.length = end + 1;   // pas de liaison après la fin
  return toks;
}

/**
 * Durées (s) des jetons d'une phrase. dur : durées naturelles (s) ; on[k] / end[k] : début de la voyelle et fin de la
 * dernière note de la syllabe k (s, depuis le début du morceau).
 * -> { start (s : début du son de la phrase), secs: [durée de chaque jeton], at: [{ s0 (début de l'attaque), v (voyelle), e (fin) }] }
 */
export function phrasePlan(toks, dur, on, end) {
  const n = on.length, sum = (k, role) => toks.reduce((s, t, i) => s + (t.syl === k && t.role === role ? dur[i] : 0), 0);
  const O = [], C = [], scaleOn = [], scaleCoda = [], nuc = [];
  for (let k = 0; k < n; k++) {
    O.push(sum(k, 'on'));
    C.push(sum(k, 'coda'));
    // Attaque raccourcie si les notes se suivent vite (au plus 35 % de la note d'avant, 250 ms) : la voyelle garde
    // au moins un tiers de la note.
    const o = Math.min(O[k], 0.25, k ? 0.35 * Math.max(0.02, on[k] - on[k - 1]) : Infinity);
    scaleOn.push(O[k] > 0 ? o / O[k] : 1);
    O[k] = o;
  }
  const at = [];
  for (let k = 0; k < n; k++) {
    const next = k + 1 < n ? on[k + 1] - O[k + 1] : end[k];
    const avail = Math.max(0.04, next - on[k]);
    const c = Math.min(C[k], (k + 1 < n ? 0.3 : 0.4) * avail);
    scaleCoda.push(C[k] > 0 ? c / C[k] : 1);
    nuc.push(Math.max(0.03, avail - c));
    at.push({ s0: on[k] - O[k], v: on[k], e: on[k] + nuc[k] + c });
  }
  const secs = toks.map((t, i) => {
    if (t.role === 'on') return dur[i] * scaleOn[t.syl];
    if (t.role === 'coda') return dur[i] * scaleCoda[t.syl];
    return dur[i];
  });
  // Noyau : le temps qui reste va aux voyelles (au prorata de leur durée naturelle), les accents gardent la leur.
  for (let k = 0; k < n; k++) {
    const idx = toks.map((t, i) => i).filter(i => toks[i].syl === k && toks[i].role === 'nuc');
    const fixed = idx.filter(i => !toks[i].vowel).reduce((s, i) => s + secs[i], 0);
    const vow = idx.filter(i => toks[i].vowel), vsum = vow.reduce((s, i) => s + dur[i], 0);
    const left = Math.max(0.02, nuc[k] - fixed);
    for (const i of vow) secs[i] = vsum > 0 ? left * dur[i] / vsum : left / vow.length;
    if (!vow.length && idx.length) for (const i of idx) secs[i] = nuc[k] / idx.length;
  }
  const lead = toks.reduce((s, t, i) => s + (t.role === 'lead' ? secs[i] : 0), 0);
  return { start: at[0].s0 - lead, secs, at };
}

/**
 * Rend une partie phrase par phrase avec le modèle aux durées imposées. Mêmes réglages que renderPart.
 * -> { data, sr } (mono, avec `pre` secondes avant le temps 0)
 */
async function renderTimedPart(placed, eng, part, mode, pre, onStep) {
  const sr = eng.sr;
  const end = Math.max(...placed.map(s => { const l = s.notes[s.notes.length - 1]; return l.t + l.len; }));
  const out = new Float32Array(Math.ceil((end + pre + 1) * sr));
  // Phrases : coupées aux silences.
  const phrases = [];
  placed.forEach((s, i) => {
    const prev = placed[i - 1], gap = prev ? s.notes[0].t - (prev.notes[prev.notes.length - 1].t + prev.notes[prev.notes.length - 1].len) : Infinity;
    if (gap > PHRASE_REST || phrases[phrases.length - 1].length >= 32) phrases.push([]);
    phrases[phrases.length - 1].push(i);
  });
  const opts = { speaker: part.speaker, noise: part.noise, length: 1 };
  for (const idx of phrases) {
    const syls = idx.map(i => placed[i]);
    const toks = phraseTokens(syls, eng.id);
    const ids = toks.map(t => t.id);
    const nat = await eng.durations(ids, opts);
    const fs = eng.hop / sr;
    const on = idx.map(i => placed[i].notes[0].t + part.jitter(i));
    const ends = syls.map((s, k) => { const l = s.notes[s.notes.length - 1]; return Math.max(on[k] + 0.05, l.t + l.len + part.jitter(idx[k])); });
    const plan = phrasePlan(toks, [...nat].map(d => d * fs), on, ends);
    // Durées en trames : bornes arrondies sur le cumul (l'erreur ne s'accumule pas).
    const frames = [];
    let acc = 0, prevF = 0;
    for (const s of plan.secs) { acc += s; const f = Math.round(acc / fs); frames.push(Math.max(0, f - prevF)); prevF = f; }
    const y = Float32Array.from(await eng.render(ids, frames, opts));
    part.plans?.push({ start: plan.start, at: plan.at, labels: syls.map(x => x.label), frames, toks: toks.map(x => `${x.role}:${x.syl}`), nat: [...nat] });
    onStep?.(idx.length);
    // Hauteur : chaque syllabe sur sa note (ses notes, avec « _ »), de son attaque à l'attaque suivante.
    const t0 = plan.start, shift = 12 * part.octave + part.detune;
    let ratio;
    const track = analyzePitch(y, sr);
    if (mode === 'rap') ratio = () => Math.pow(2, shift / 12);
    else {
      const notes = [];
      syls.forEach((s, k) => {
        const a = plan.at[k], b = k + 1 < syls.length ? plan.at[k + 1].s0 : a.e + 0.3;
        s.notes.forEach((n, j) => {
          const from = j ? a.v + (n.t - s.notes[0].t) : (k ? a.s0 : t0);
          const to = j + 1 < s.notes.length ? a.v + (s.notes[j + 1].t - s.notes[0].t) : b;
          notes.push({ t0: from - t0, t1: to - t0, note: part.pick(n.notes) + shift });
        });
      });
      const curve = tuneCurve(track, { mode: 'notes', notes, exact: true, speed: mode === 'robot' ? 0 : 35, humanize: mode === 'robot' ? 0 : 0.1, vibrato: mode === 'sing' ? 0.3 : 0 });
      const N = curve.corr.length;
      ratio = i => { const p = (i - track.start) / track.hop, k = Math.max(0, Math.min(N - 1, Math.round(p))); return Math.pow(2, curve.corr[k] / 12); };
    }
    const [z] = psolaShift([y], sr, track, ratio, { formant: part.formant });
    // Niveau : la phrase à un niveau voisé constant ; petits fondus aux bords.
    let e = 0, nv = 0;
    track.f0.forEach((f, k) => { if (f) { const c = k * track.hop; for (let j = c; j < Math.min(z.length, c + track.hop); j++) { e += z[j] * z[j]; nv++; } } });
    const g = 0.2 / Math.max(1e-4, Math.sqrt(e / Math.max(1, nv)));
    const at = Math.round((t0 + pre) * sr), fin = Math.round(sr * 0.005), fout = Math.round(sr * 0.03);
    for (let j = 0; j < z.length; j++) {
      const o = at + j;
      if (o < 0 || o >= out.length) continue;
      out[o] += z[j] * g * Math.min(1, (j + 1) / fin, (z.length - j) / fout);
    }
  }
  return { data: out, sr };
}

// ---------- Vocodeur ----------

// Filtre passe-bande (biquad, gain 1 au centre) : -> fonction qui filtre un échantillon.
function bandpass(sr, fc, q) {
  const w = 2 * Math.PI * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

/**
 * Vocodeur à bandes : la voix (modulateur) donne, bande par bande, son enveloppe à une porteuse de dents de scie qui
 * jouent les notes (deux par note, légèrement désaccordées). 24 bandes de 100 Hz à 8 kHz, deux filtres par bande.
 * Les consonnes sourdes (au-dessus de 4 kHz) sont ajoutées telles quelles, pour que le texte reste compris.
 * notes : [{ t0, t1 (s), notes: [hauteurs MIDI] }]. -> nouveau signal (même longueur)
 */
export function vocode(voice, sr, notes, { bands = 24 } = {}) {
  const n = voice.length, car = new Float32Array(n);
  const fade = Math.round(sr * 0.004);
  for (const nt of notes) {
    const a = Math.max(0, Math.round(nt.t0 * sr)), b = Math.min(n, Math.round(nt.t1 * sr));
    for (const m of nt.notes) for (const dt of [-0.06, 0.06]) {
      const f = 440 * Math.pow(2, (m + dt - 69) / 12) / sr;
      let ph = (m * 0.37 + dt) % 1;
      for (let i = a; i < b; i++) {
        // Dent de scie à bande limitée (polyBLEP).
        ph += f; if (ph >= 1) ph -= 1;
        let v = 2 * ph - 1;
        if (ph < f) { const u = ph / f; v -= u + u - u * u - 1; } else if (ph > 1 - f) { const u = (ph - 1) / f; v -= u * u + u + u + 1; }
        car[i] += v * Math.min(1, (i - a + 1) / fade, (b - i) / fade) / nt.notes.length;
      }
    }
  }
  const out = new Float32Array(n);
  const lo = 100, hi = Math.min(8000, sr * 0.45), q = 0.9 * bands / Math.log2(hi / lo) * 1.2;
  const att = 1 - Math.exp(-1 / (sr * 0.003)), rel = 1 - Math.exp(-1 / (sr * 0.02));
  for (let k = 0; k < bands; k++) {
    const fc = lo * Math.pow(hi / lo, (k + 0.5) / bands);
    const m1 = bandpass(sr, fc, q), m2 = bandpass(sr, fc, q), c1 = bandpass(sr, fc, q), c2 = bandpass(sr, fc, q);
    let env = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(m2(m1(voice[i])));
      env += (v > env ? att : rel) * (v - env);
      out[i] += c2(c1(car[i])) * env;
    }
  }
  // Même niveau que la voix ; consonnes sourdes : la voix au-dessus de 4 kHz (deux pôles).
  let ev = 0, eo = 0;
  for (let i = 0; i < n; i++) { ev += voice[i] * voice[i]; eo += out[i] * out[i]; }
  const g = eo > 0 ? Math.sqrt(ev / eo) : 0;
  const hp = 1 - Math.exp(-2 * Math.PI * 4000 / sr);
  let l1 = 0, l2 = 0;
  for (let i = 0; i < n; i++) { l1 += hp * (voice[i] - l1); l2 += hp * (l1 - l2); out[i] = out[i] * g + (voice[i] - l2) * 0.5; }
  return out;
}

/**
 * Rend la voix complète : texte, notes (évènements du bloc, temps en temps), tempo, réglages.
 * opts : { model, speaker, mode, octave ('auto' ou décalage), formant, choir, harmony, fill, seed }
 * -> { left, right, sr, pre, syllables } (pre : secondes avant le début du bloc ; syllables : placées)
 */
export async function renderVoice(text, events, span, bpm, opts, onProgress) {
  const m = VOICE_MODELS[opts.model];
  const written = textTokens(text).filter(w => w !== '_');
  let [phon] = await engineOf().phonemize([written.join(' ')], espeakLang(opts.model));
  // espeak colle ou coupe parfois des mots (« the air », « hardcore ») : chaque mot est alors converti à part, pour que
  // les syllabes gardent leur mot écrit (et les « _ » leur place). Les liaisons entre mots sont alors perdues.
  if (phonemeWords(phon).length !== written.length) {
    const per = await engineOf().phonemize(written, espeakLang(opts.model));
    phon = per.flatMap(p => [...phonemeWords(p).flat().join(''), ' ']);
  }
  const syls = textSyllables(text, phon, m.lang);
  const slots = noteSlots(events);
  const bd = 60 / bpm;
  const placed = placeSyllables(syls, slots, span, { fill: opts.fill }).map(s => ({ ...s, notes: s.notes.map(n => ({ ...n, t: n.t * bd, len: n.len * bd })) }));
  if (!placed.length) return null;
  // Parties : une par voix de l'harmonie (de l'aiguë à la grave), multipliées par le chœur.
  const voices = opts.harmony ? Math.min(4, Math.max(...slots.map(s => s.notes.length))) : 1;
  const choir = Math.max(1, Math.min(MAX_VOICE_PARTS, opts.choir | 0));
  const rand = rng(opts.seed ?? 1);
  const parts = [];
  for (let h = 0; h < voices && parts.length < MAX_VOICE_PARTS; h++) {
    for (let c = 0; c < choir && parts.length < MAX_VOICE_PARTS; c++) {
      const n = m.speakers, j = parts.length;
      const jit = Array.from({ length: placed.length }, () => (j ? (rand() - 0.5) * 0.03 : 0));
      parts.push({
        speaker: n > 1 ? (opts.speaker + j * 37) % n : 0,
        noise: j && n === 1 ? 0.8 + 0.4 * rand() : 1,
        formant: (opts.formant ?? 1) * (j && n === 1 ? 1 + (j % 2 ? 1 : -1) * 0.035 * Math.ceil(j / 2) : 1),
        detune: j ? (rand() - 0.5) * 0.16 : 0,
        jitter: i => jit[i],
        pick: notes => notes[Math.max(0, notes.length - 1 - h)],
        pan: parts.length ? ((j % 2 ? 1 : -1) * Math.min(0.8, 0.25 * Math.ceil(j / 2))) : 0,
        octave: 0,
        plans: [],   // phrases rendues (début, attaques, voyelles, fins) : affichage, vérifications
      });
    }
  }
  // Octave : auto = au plus près de la voix (sa hauteur naturelle), sinon le décalage choisi.
  const steps = placed.length * parts.length;
  let done = 0;
  const step = (n = 1) => onProgress?.((done += n) / steps);
  const probe = await synthSyllable(opts.model, placed[0].ph, { speaker: parts[0].speaker, length: 1, noise: 1 });
  const natural = 69 + 12 * Math.log2((medianF0(pitchTrack(probe.data, probe.sr)) || 160) / 440);
  const sung = placed.flatMap(s => s.notes.map(n => n.notes[n.notes.length - 1]));
  const mid = sung.sort((p, q) => p - q)[sung.length >> 1];
  const auto = opts.octave === 'auto' || opts.octave === undefined;
  // (on chante un peu plus haut qu'on ne parle : +4 demi-tons)
  const oct = auto ? Math.round((natural + 4 - mid) / 12) : opts.octave;
  // Scandé et vocodeur : la voix garde sa hauteur parlée (le vocodeur joue les notes avec sa porteuse).
  const speech = opts.mode === 'rap' || opts.mode === 'vocoder';
  for (const p of parts) p.octave = speech ? (auto || opts.mode === 'vocoder' ? 0 : opts.octave) : oct;
  const vMode = opts.mode === 'vocoder' ? 'rap' : opts.mode;
  const pre = 0.25;
  const rendered = [];
  // Phrases d'un seul tenant si le modèle accepte des durées imposées ; sinon syllabe par syllabe.
  const eng = opts.phrase === false ? null : await engineOf().timed?.(opts.model);
  for (const p of parts) rendered.push(eng ? await renderTimedPart(placed, eng, p, vMode, pre, step) : await renderPart(placed, opts.model, p, vMode, pre, step));
  if (opts.mode === 'vocoder') {
    // Porteuse : les notes de chaque syllabe (toutes celles de l'accord avec l'harmonie), de sa note à la suivante.
    const cOct = auto ? 0 : opts.octave;
    rendered.forEach((r, k) => {
      const notes = placed.flatMap((s, i) => s.notes.map((n, j) => {
        const next = s.notes[j + 1]?.t ?? placed[i + 1]?.notes[0].t ?? n.t + n.len;
        const t1 = next - (n.t + n.len) > PHRASE_REST ? n.t + n.len : next;
        return { t0: n.t + pre, t1: t1 + pre, notes: (opts.harmony ? n.notes : [parts[k].pick(n.notes)]).map(x => x + 12 * cOct + parts[k].detune) };
      }));
      r.data = vocode(r.data, r.sr, notes);
    });
  }
  const sr = rendered[0].sr, len = Math.max(...rendered.map(r => r.data.length));
  const left = new Float32Array(len), right = new Float32Array(len);
  const gain = 1 / Math.sqrt(parts.length);
  rendered.forEach((r, k) => {
    const pan = parts[k].pan, gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2 * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2 * gain;
    for (let i = 0; i < r.data.length; i++) { left[i] += r.data[i] * gl; right[i] += r.data[i] * gr; }
  });
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak > 0.89) for (let i = 0; i < len; i++) { left[i] *= 0.89 / peak; right[i] *= 0.89 / peak; }
  return { left, right, sr, pre, syllables: placed, parts: parts.length, octave: oct, phrase: !!eng, plans: parts[0].plans };
}
