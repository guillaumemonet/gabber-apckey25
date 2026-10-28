// Compositeur IA : la consigne donnée au modèle de langage local (Ollama, voir ai/docker-compose.yml), la requête
// et la lecture de sa réponse. Le modèle ne fait pas de son : il remplit un plan de morceau (js/songplan.js) en
// choisissant parmi les outils de l'application ; l'application le vérifie (cleanPlan) avant de le construire.
// Ce module ne touche pas à l'état.
import { BASS_STYLES } from './bassline.js';
import { parseProgression } from './chords.js';
import { KICK_PRESETS } from './kickdesign.js';
import { LEAD_STYLES } from './melody.js';
import { PRESETS } from './presets.js';
import { BASS_OSC, PLAN_LIMITS, planSchema } from './songplan.js';
import { PLANS, STYLES } from './songstart.js';

export const AI_URL = 'http://localhost:11434';
export const AI_MODEL = 'qwen2.5:7b';
export const AI_CTX = 8192;   // mots (tokens) de contexte : la consigne, le schéma et quelques échanges
export const MUSIC_URL = 'http://127.0.0.1:8090';   // compositeur musical (ai/music) : écrit le lead et la basse

export const defaultAi = () => ({ url: AI_URL, model: AI_MODEL, prompt: '', musicUrl: MUSIC_URL, music: true });
export function mergeAi(saved) {
  const a = defaultAi();
  if (!saved || typeof saved !== 'object') return a;
  if (typeof saved.url === 'string' && /^https?:\/\/[^\s]+$/.test(saved.url.trim())) a.url = saved.url.trim().replace(/\/+$/, '');
  if (typeof saved.model === 'string' && /^[\w.:/-]{1,80}$/.test(saved.model.trim())) a.model = saved.model.trim();
  if (typeof saved.prompt === 'string') a.prompt = saved.prompt.slice(0, 2000);
  if (typeof saved.musicUrl === 'string' && /^https?:\/\/[^\s]+$/.test(saved.musicUrl.trim())) a.musicUrl = saved.musicUrl.trim().replace(/\/+$/, '');
  a.music = saved.music !== false;
  return a;
}

const BASS_HELP = {
  sub: 'held sub notes', offbeat: 'notes between the kicks (rave, early, frenchcore)', rolling: 'rolling 16ths', reverse: 'hardstyle reverse bass (2 notes after each kick)',
  octave: 'octave jumps (happy hardcore)', walk: 'root, fifth, octave walk', acid: '303-style acid line with slides',
};
const LEAD_HELP = { anthem: 'singable anthem melody, long notes', arp: 'arpeggio of the chords', riff: 'short repeated riff', call: 'call and response' };
const KICK_HELP = 'tune (pitch of the tail), pitch (how high the punch starts), sweep (speed of the pitch drop), bend (tail drop), length, zaag (raw sawtooth tail), drive (distortion), shape, tone (brightness), bite (mid boost), click, top (attack layer)';

/** Consigne du modèle : son rôle, les outils et leurs valeurs, les règles du genre, la forme de la réponse. */
export function systemPrompt({ extraSounds = [] } = {}) {
  const fam = {};
  for (const p of PRESETS) if (p.id !== 'init') (fam[p.family] ??= []).push(p.id);
  const styles = Object.entries(STYLES).map(([id, s]) => {
    const b = s.bass ? `${s.bass.style} bass (${s.bass.preset}) in ${s.bass.in.join('/')}` : 'no bass: the kick tail is the bass';
    const lead = s.lead.breizh ? 'Breton folk tune (bombarde) from the Breizh generator' : `${s.lead.style} lead (${s.lead.preset}, ${s.lead.density} density)`;
    const form = s.plan ? `, form ${PLANS[s.plan].map(([type, bars]) => `${type} ${bars}`).join(', ')}` : '';
    return `- ${id}: ${s.bpm} BPM, chords "${s.prog}" (${s.chords.preset}, ${s.chords.rhythm}), kick ${s.kick}, ${b}, ${lead}${form}`;
  }).join('\n');
  const lines = [
    'You are the composer and producer inside GabberKey, a hardcore / gabber music studio.',
    'You do not make sound. You write a song plan in JSON that the studio builds with its own instruments: a kick designer, drum samples, a bass generator, a chord generator, a melody generator and a build-up designer.',
    'Answer with the JSON only, following the schema. Write "title" and section "name" in the language of the request.',
    'Start from the style that fits the request best. The studio fills every field you leave out with the values of that style, so only write the fields you want to change (and always "sections"). Keep the tempo, chords, kick and sounds of the style unless the request asks for something else; when you change them, stay within what the style allows (happy hardcore is in a major key, the others mostly minor).',
    '',
    'STYLES (starting points: tempo, chords, kick and sounds):',
    styles,
    '',
    'SOUNDS for chords and lead, by family:',
    ...Object.entries(fam).map(([f, ids]) => `- ${f}: ${ids.join(', ')}`),
    ...(extraSounds.length ? [`- user presets: ${extraSounds.join(', ')}`] : []),
    `Bass sounds: bass, reese, sub_bass, or the oscillator synth basses ${BASS_OSC.join(', ')}.`,
    '',
    `KICK presets: ${Object.keys(KICK_PRESETS).join(', ')}. Optional kick.params (0 to 1) fine-tune it: ${KICK_HELP}.`,
    'When the request describes the kick, write kick.params: distorted / saturated / hard = drive 0.85 to 1 and bite up; raw / zaag = zaag 0.5 to 1; long / rumbling tail = length up; short / tight = length down; punchy = pitch and click up; dark = tone down; bright = tone and top up; deeper / higher = tune down / up (0.5 = F).',
    `BASS styles: ${BASS_STYLES.map(s => `${s} = ${BASS_HELP[s]}`).join('; ')}.`,
    `LEAD styles: ${LEAD_STYLES.map(s => `${s} = ${LEAD_HELP[s]}`).join('; ')}. density low / mid / high; register mid or high.`,
    'CHORDS: rhythm hold (long chords), beats, offbeat (rave stabs), eighths; register low / mid / high.',
    'DRUMS: kit anthem (clean, modern) or early (raw, 90s); hat off (open hat on the offbeat), 8, 16 or none; clap 24 (beats 2 and 4), 4 (beat 4) or none; ride true/false. A crash plays at the start of each drop.',
    '',
    'CHORD PROGRESSION ("prog"): 2 to 8 chord symbols separated by spaces, each chord lasts 2 bars. Symbols: root A-G with # or b, then nothing (major), m, 5, dim, aug, sus2, sus4, 7, m7, maj7, add9, madd9. Example: "Fm Db Ab Eb". Hardcore is mostly in minor keys; happy hardcore in major. A section may have its own "prog" (a break with other chords, for example).',
    '',
    `SECTIONS: types intro, build (build-up), drop, break, cut (1 or 2 bars where the kick, drums and bass stop to relaunch the next drop), outro; bars from ${PLAN_LIMITS.bars[0]} to ${PLAN_LIMITS.bars[1]} (use 8, 16 or 32). "play" lists what plays in the section among kick, drums, bass, chords, lead. "lead": full or calm (calm = sparser, for breaks).`,
    'Usual hardcore form: intro (kick and drums, 16 bars), build (chords, 8 or 16 bars), drop (everything, 32 bars), break (no kick: chords and a calm lead, 16 or 32 bars), build, drop, outro (kick and drums). A build placed right before a drop gets a riser, a snare roll and a silence before the drop when "buildups" is true. The kick never plays in a break or a build. A whole song is usually 96 to 160 bars.',
    'Choose what fits the request: style, tempo, key and chords, sounds, kick settings, which elements play where. Vary the structure when it serves the music.',
  ];
  return lines.join('\n');
}

/** Requête /api/chat d'Ollama : messages, réponse au format du plan, lue au fil de l'eau. */
export function chatBody(messages, { model = AI_MODEL, extraSounds = [], temperature = 0.5 } = {}) {
  return { model, messages, format: planSchema(extraSounds, { notes: false, required: ['style', 'sections'] }), stream: true, options: { temperature, num_ctx: AI_CTX } };
}

/** Texte de la réponse -> objet du plan (JSON, éventuellement entouré de texte ou de ```). Erreur si illisible. */
export function parseReply(text) {
  const s = String(text ?? '').trim();
  try { return JSON.parse(s); } catch { /* texte autour du JSON */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new SyntaxError('no JSON object in the reply');
}

// Exemple donné au modèle avant la demande : une demande et le plan attendu (seuls les champs changés).
const EXAMPLE = {
  request: 'A 90s rave track with a very distorted kick, a dark break and only one drop.',
  plan: {
    title: 'Warehouse', style: 'rave', kick: { params: { drive: 0.95, bite: 0.7 } },
    sections: [
      { type: 'intro', bars: 16, play: ['kick', 'drums'] },
      { type: 'build', bars: 8, play: ['chords'] },
      { type: 'drop', bars: 32, play: ['kick', 'drums', 'bass', 'chords', 'lead'] },
      { type: 'break', bars: 16, play: ['chords', 'lead'], lead: 'calm', name: 'Dark break' },
      { type: 'outro', bars: 16, play: ['kick', 'drums'] },
    ],
  },
};

/** Messages d'une nouvelle demande : la consigne, l'exemple, puis la demande. */
export function startChat(request, opts = {}) {
  return [
    { role: 'system', content: systemPrompt(opts) },
    { role: 'user', content: EXAMPLE.request },
    { role: 'assistant', content: JSON.stringify(EXAMPLE.plan) },
    { role: 'user', content: request },
  ];
}

/**
 * Corrections du plan reçu avant nettoyage : un drop s'il n'y en a aucun (après la première montée, sinon après
 * l'intro) ; dans un style où la queue du kick fait la basse, la basse ne joue que si le modèle l'a réglée (objet
 * bass) ; une graine neuve pour la mélodie et la basse à chaque plan.
 */
export function adjustReply(raw, seed = () => 1 + Math.floor(Math.random() * 1e6)) {
  if (!raw || typeof raw !== 'object') return raw;
  const sty = STYLES[raw.style];
  if (Array.isArray(raw.sections) && raw.sections.length && !raw.sections.some(s => s?.type === 'drop')) {
    const k = raw.sections.findIndex(s => s?.type === 'build'), i = k >= 0 ? k : raw.sections.findIndex(s => s?.type === 'intro');
    raw.sections.splice(i + 1, 0, { type: 'drop', bars: 32, play: ['kick', 'drums', 'bass', 'chords', 'lead'] });
  }
  if (sty && !sty.bass && !(raw.bass && typeof raw.bass === 'object' && raw.bass.style) && Array.isArray(raw.sections))
    for (const s of raw.sections) if (Array.isArray(s?.play)) s.play = s.play.filter(p => p !== 'bass');
  for (const k of ['lead', 'bass']) raw[k] = { ...(raw[k] && typeof raw[k] === 'object' ? raw[k] : {}), seed: seed() };
  return raw;
}

/** Demande de modification d'un plan déjà proposé : le modèle renvoie le plan complet, modifié. */
export const refineMessage = request => `Change the plan as follows, and answer with the complete new plan: ${request}`;

// ---- Compositeur musical (ai/music) : les notes du lead et de la basse ----

const MUSIC_MAX_BEATS = 64;
const CHORD_BEATS = 8;   // 2 mesures par accord, comme la construction du morceau
// Instrument de référence du lead selon son style (le modèle écrit comme cet instrument) : riff dense en doubles
// croches (violon), mélodie d'hymne (onde carrée), arpège (harpe), appel et réponse (dent de scie).
const LEAD_PROGRAMS = { riff: 40, anthem: 80, arp: 46, call: 81 };

/**
 * Ce que le compositeur musical doit écrire pour un plan : une demande par élément (lead, basse) et par suite
 * d'accords où il joue. -> [{ prog, part, body }] (body : la requête /generate)
 */
export function musicJobs(plan) {
  const jobs = [];
  const wants = { lead: !plan.lead.breizh, bass: true };
  for (const part of ['lead', 'bass']) {
    if (!wants[part]) continue;
    const progs = new Set(plan.sections.filter(s => s.play.includes(part)).map(s => s.prog ?? plan.prog));
    for (const prog of progs) {
      const body = musicBody(plan, prog, part);
      if (body) jobs.push({ prog, part, body });
    }
  }
  return jobs;
}

/** Requête /generate : tempo, longueur du passage, accords (posés autour du do médium), un kick par temps. */
export function musicBody(plan, prog, part) {
  const chords = parseProgression(prog).chords;
  const beats = chords.length * CHORD_BEATS;
  if (!chords.length || beats > MUSIC_MAX_BEATS) return null;
  return {
    bpm: plan.bpm, beats, part,
    density: part === 'lead' ? plan.lead.density ?? 'mid' : 'mid',
    ...(part === 'lead' && LEAD_PROGRAMS[plan.lead.style] !== undefined ? { program: LEAD_PROGRAMS[plan.lead.style] } : {}),
    candidates: part === 'lead' && plan.lead.style === 'riff' ? 2 : 3,
    chords: chords.map((c, i) => {
      const root = 48 + c.root + (c.root < 5 ? 12 : 0);   // fondamentale entre fa2 et mi3
      return { t: i * CHORD_BEATS, len: CHORD_BEATS, notes: c.intervals.map(iv => root + iv) };
    }),
    kick: Array.from({ length: beats }, (_, b) => b),
    seed: 1 + Math.floor(Math.random() * 1e6),
  };
}
