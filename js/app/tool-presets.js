// Presets des générateurs (Générateur, Breizh generator, Designer de montée, Générateur de voix, Correction de
// justesse) : vos réglages favoris, dans la même barre de presets que les instruments. Un preset garde tous les
// réglages de la fenêtre (ce qu'enregistre son fichier de réglages, voir TOOL_IO dans js/app/files.js).
import { t } from '../i18n.js';
import { $, state } from './core.js';
import { TOOL_IO } from './files.js';
import { presetBar } from './presets-bar.js';
import { save } from './save.js';

export const TOOL_PRESET_KINDS = ['gen', 'breizh', 'buildup', 'voice', 'tune'];

/** Presets valides d'une sauvegarde : { outil: [{ id, name, cat, data }] }. */
export function cleanToolPresets(saved) {
  return Object.fromEntries(TOOL_PRESET_KINDS.map(k => [k, (Array.isArray(saved?.[k]) ? saved[k] : [])
    .filter(p => typeof p?.id === 'string' && p.id.startsWith('u:') && typeof p.name === 'string' && p.data && typeof p.data === 'object')
    .map(p => ({ id: p.id, name: p.name.slice(0, 24), cat: 'mine', data: p.data }))]));
}

const current = {};   // outil -> preset appliqué en dernier
export const toolPresetBars = {};

export function buildToolPresets() {
  for (const kind of TOOL_PRESET_KINDS) {
    const wrap = $(`#${kind}-pbar`);
    if (!wrap) continue;
    const list = () => state.toolPresets[kind];
    toolPresetBars[kind] = presetBar(wrap, {
      cats: ['mine'],
      catLabel: () => t('pb.mine'),
      builtins: [],
      user: list,
      current: () => current[kind] ?? null,
      apply: async id => {
        const p = list().find(x => x.id === id);
        if (!p) return;
        await TOOL_IO[kind].set(JSON.parse(JSON.stringify(p.data)));
        current[kind] = id;
        save();
      },
      save: name => {
        let p = list().find(x => x.name === name);
        if (!p) { p = { id: `u:${crypto.randomUUID()}`, name, cat: 'mine' }; list().push(p); }
        p.data = JSON.parse(JSON.stringify(TOOL_IO[kind].get()));
        current[kind] = p.id;
        save();
        return p.id;
      },
      remove: id => {
        state.toolPresets[kind] = list().filter(x => x.id !== id);
        if (current[kind] === id) current[kind] = null;
        save();
      },
    });
  }
}
// Après le chargement d'un projet : les listes affichées.
export function renderToolPresets() { for (const b of Object.values(toolPresetBars)) b.render(); }
