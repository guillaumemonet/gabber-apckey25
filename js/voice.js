// Générateur de voix : un texte chanté, scandé ou dit en robot sur les notes d'un bloc (lead, nappe), par une voix
// neuronale (Piper, synthèse vocale libre qui tourne dans le navigateur). Le texte est converti en phonèmes
// (espeak-ng), découpé en syllabes ; chaque syllabe est dite seule par la voix, puis recalée sur sa note
// (js/psola.js : hauteur et durée, timbre gardé). Chœur : plusieurs interprètes légèrement décalés ; harmonie : une
// voix par note des accords.
// Moteur, modèle de calcul et voix sont téléchargés à la première utilisation (puis gardés dans le cache du
// navigateur) : rien n'est chargé tant que le générateur ne sert pas.
import { medianF0, pitchMarks, pitchTrack, psola } from './psola.js';

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
export const VOICE_MODES = ['sing', 'rap', 'robot'];
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
 * Syllabes du texte, dans l'ordre : [{ ph: [son, …], label, hold? }] ; hold = « _ » (prolonge la précédente).
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
    syls.forEach((s, k) => out.push({ ph: s, label: labels[k] }));
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
    out[i + 1] = { ph: [...out[i].ph, ...out[i + 1].ph], label: out[i].label + out[i + 1].label };
    out.splice(i, 1);
  }
  if (out.length && !out[out.length - 1].hold && !out[out.length - 1].ph.some(isVowel) && out.length > 1) {
    const last = out.pop();
    out[out.length - 1] = { ph: [...out[out.length - 1].ph, ...last.ph], label: out[out.length - 1].label + last.label };
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
 * texte jusqu'à la fin des notes. -> [{ ph, label, notes: [slot, …] }]
 */
export function placeSyllables(syls, slots, span, { fill = false } = {}) {
  const out = [];
  if (!syls.length || !slots.length) return out;
  const steps = fill ? Math.max(syls.length, slots.length) : syls.length;
  for (let k = 0; k < steps; k++) {
    const s = syls[k % syls.length], n = slots[k % slots.length];
    const slot = { ...n, t: n.t + Math.floor(k / slots.length) * span, notes: [...n.notes] };
    if (s.hold) { if (out.length) out[out.length - 1].notes.push(slot); continue; }
    out.push({ ph: s.ph, label: s.label, notes: [slot] });
  }
  return out;
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
      const bytes = await (await fetchCached(`${VOICES_URL}${m.path}.onnx`, onProgress)).arrayBuffer();
      const session = await ort.InferenceSession.create(bytes);
      return { session, cfg, ort };
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
  async synth(model, ph, { speaker = 0, length = 1, noise = 1 }, onProgress) {
    const { session, cfg, ort } = await piperSession(model, onProgress);
    const map = cfg.phoneme_id_map, id = p => map[p]?.[0];
    const ids = [id('^'), 0];
    for (const p of ph) for (const c of [...p]) if (id(c) !== undefined) ids.push(id(c), 0);
    ids.push(id('$'));
    const inf = cfg.inference;
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale * noise, inf.length_scale * length, inf.noise_w]), [3]),
    };
    if (cfg.num_speakers > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker % cfg.num_speakers)]), [1]);
    const r = await session.run(feeds);
    return { data: r.output.data, sr: cfg.audio.sample_rate };
  },
};
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
      });
    }
  }
  // Octave : auto = au plus près de la voix (sa hauteur naturelle), sinon le décalage choisi.
  const steps = placed.length * parts.length;
  let done = 0;
  const step = () => onProgress?.(++done / steps);
  const probe = await synthSyllable(opts.model, placed[0].ph, { speaker: parts[0].speaker, length: 1, noise: 1 });
  const natural = 69 + 12 * Math.log2((medianF0(pitchTrack(probe.data, probe.sr)) || 160) / 440);
  const sung = placed.flatMap(s => s.notes.map(n => n.notes[n.notes.length - 1]));
  const mid = sung.sort((p, q) => p - q)[sung.length >> 1];
  const auto = opts.octave === 'auto' || opts.octave === undefined;
  // (on chante un peu plus haut qu'on ne parle : +4 demi-tons)
  const oct = auto ? Math.round((natural + 4 - mid) / 12) : opts.octave;
  for (const p of parts) p.octave = opts.mode === 'rap' ? (auto ? 0 : opts.octave) : oct;
  const pre = 0.25;
  const rendered = [];
  for (const p of parts) rendered.push(await renderPart(placed, opts.model, p, opts.mode, pre, step));
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
  return { left, right, sr, pre, syllables: placed, parts: parts.length, octave: oct };
}
