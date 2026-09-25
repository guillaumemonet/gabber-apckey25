// Export / import de banques et de sessions complètes dans un seul fichier (.apckit, JSON).
// Chaque son est embarqué en data-URL : le fichier se suffit à lui-même.
import { encodeWav } from './recorder.js';
import { t } from './i18n.js';

export const FORMAT = 'apc-studio-kit';

const toDataUrl = bytes => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(new Blob([bytes], { type: 'application/octet-stream' }));
});

const fromDataUrl = url => fetch(url).then(r => r.arrayBuffer());

// getBytes(pad) -> ArrayBuffer du fichier audio d'origine (ou null).
async function packPad(pad, getBytes) {
  if (!pad?.buffer) return null;
  let bytes = await getBytes(pad).catch(() => null);
  if (!bytes) {
    const b = pad.buffer;
    bytes = encodeWav([...Array(b.numberOfChannels).keys()].map(c => b.getChannelData(c)), b.sampleRate);
  }
  return { name: pad.name, color: pad.color, bpm: pad.bpm || 0, p: pad.p, audio: await toDataUrl(bytes) };
}

export async function packBanks(banks, getBytes, extra = {}) {
  const out = [];
  for (const bank of banks) out.push({ pads: await Promise.all(bank.map(p => packPad(p, getBytes))) });
  return new Blob([JSON.stringify({ format: FORMAT, version: 1, ...extra, banks: out })], { type: 'application/json' });
}

// Renvoie { kind, bpm, globals, preset, banks: [[{ name, color, bpm, p, bytes } | null] x40] }.
export async function unpack(file) {
  const data = JSON.parse(await file.text());
  if (data.format !== FORMAT) throw new Error(t('kit.badFile'));
  const banks = [];
  for (const bank of data.banks) {
    banks.push(await Promise.all(bank.pads.map(async s => s && { ...s, audio: undefined, bytes: await fromDataUrl(s.audio) })));
  }
  return { ...data, banks };
}
