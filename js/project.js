// Fichiers GabberKey (.gabber, JSON) : le projet entier, le morceau de la timeline, ou les réglages d'un outil.
// { format, version, kind, app, saved, data, samples: { id: { name, audio (data-URL) } } }
// Les sons de la bibliothèque et du kit de départ sont désignés par leur nom (ils sont dans l'application) ;
// les sons importés et les enregistrements (« user: », « rec: ») sont embarqués : le fichier se suffit à lui-même.
import { t } from './i18n.js';

export const FILE_FORMAT = 'gabberkey-file';
export const FILE_EXT = '.gabber';
// Contenus possibles : projet, morceau, et un par outil.
export const FILE_KINDS = ['project', 'song', 'tr', 'acid', 'osc', 'piano', 'kick', 'mix', 'patch', 'scenes'];

const toDataUrl = bytes => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(new Blob([bytes], { type: 'application/octet-stream' }));
});
const fromDataUrl = url => fetch(url).then(r => r.arrayBuffer());

// Sons à embarquer : ceux qui ne viennent pas de l'application.
export const embeddable = id => typeof id === 'string' && /^(user|rec):/.test(id);

// loadSample(id) -> { name, data } | null
export async function packFile(kind, data, sampleIds, loadSample) {
  const samples = {};
  for (const id of new Set([...sampleIds].filter(embeddable))) {
    const s = await loadSample(id).catch(() => null);
    if (s?.data) samples[id] = { name: s.name ?? '', audio: await toDataUrl(s.data) };
  }
  const file = { format: FILE_FORMAT, version: 1, app: 'GabberKey', kind, saved: new Date().toISOString(), data, samples };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function readFile(file) {
  let json;
  try { json = JSON.parse(await file.text()); } catch { throw new Error(t('file.bad')); }
  if (json?.format !== FILE_FORMAT || !FILE_KINDS.includes(json.kind) || typeof json.data !== 'object') throw new Error(t('file.bad'));
  const samples = {};
  for (const [id, s] of Object.entries(json.samples ?? {})) {
    if (!embeddable(id) || typeof s?.audio !== 'string') continue;
    samples[id] = { name: String(s.name ?? ''), data: await fromDataUrl(s.audio) };
  }
  return { kind: json.kind, data: json.data, samples };
}
