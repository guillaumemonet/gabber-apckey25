// Barre de presets des instruments.
import { ACID_CATS, ACID_SOUNDS, soundParams } from '../acid.js';
import { t } from '../i18n.js';
import { KICK_CATS, KICK_PRESETS, KICK_PRESET_CAT, kickDefaults } from '../kickdesign.js';
import { OSC_CATS, OSC_PRESETS, OSC_PRESET_CAT } from '../osc.js';
import { PAGES, toValue } from '../params.js';
import { FAMILIES, PRESETS } from '../presets.js';
import { TR_CATS, TR_KITS, kitParams } from '../tr909.js';
import { renderAcid, renderAcidKnobs } from './acid-ui.js';
import { $, acid, engine, state } from './core.js';
import { kickChanged, renderKick } from './kick-ui.js';
import { renderKnobs } from './knobs.js';
import { toast } from './misc.js';
import { loadOscPreset, renderOsc } from './osc-ui.js';
import { rollPresetOptions } from './roll-ui.js';
import { save } from './save.js';
import { applyPreset, renderSynthKnobs } from './synth-ui.js';
import { renderTr } from './tr909-ui.js';

// ---------- Barre de presets (instruments) ----------


// Un menu par catégories (presets fournis, puis « Mes presets »), Enregistrer sous un nom et une catégorie, Supprimer.
// cfg : { cats, catLabel(cat), builtins: [{ id, cat, name }], user(): [{ id, cat, name }], current(): id | null,
//         apply(id), save(name, cat) -> id, remove(id) }
export function presetBar(wrap, cfg) {
  wrap.classList.add('preset-bar');
  wrap.innerHTML = `<select class="pb-sel" title="${t('pb.title')}"></select>
    <input class="pb-name" maxlength="24" spellcheck="false" placeholder="${t('pb.namePh')}">
    <select class="pb-cat" title="${t('pb.cat')}"></select>
    <button class="pb-save" data-icon="save" title="${t('pb.save.title')}">${t('pb.save')}</button>
    <button class="pb-del icon-only" data-icon="trash" title="${t('pb.del')}" aria-label="${t('pb.del')}"></button>`;
  const sel = wrap.querySelector('.pb-sel'), name = wrap.querySelector('.pb-name'), cat = wrap.querySelector('.pb-cat');
  for (const c of cfg.cats) cat.add(new Option(cfg.catLabel(c), c));
  name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') wrap.querySelector('.pb-save').click(); });
  const render = () => {
    sel.innerHTML = '';
    sel.add(new Option(t('pb.custom'), ''));
    for (const c of cfg.cats) {
      const g = document.createElement('optgroup');
      g.label = cfg.catLabel(c);
      for (const p of cfg.builtins.filter(p => p.cat === c)) g.appendChild(new Option(p.name, p.id));
      for (const p of cfg.user().filter(p => p.cat === c)) g.appendChild(new Option(`★ ${p.name}`, p.id));
      sel.appendChild(g);
    }
    sel.value = cfg.current() ?? '';
    sel.options[0].hidden = cfg.current() != null;
    const mine = cfg.user().find(u => u.id === cfg.current());
    wrap.querySelector('.pb-del').disabled = !mine;
    if (mine) cat.value = mine.cat;
    else { const b = cfg.builtins.find(p => p.id === cfg.current()); if (b) cat.value = b.cat; }
  };
  sel.addEventListener('change', () => { if (sel.value) cfg.apply(sel.value); render(); });
  wrap.querySelector('.pb-save').addEventListener('click', () => {
    const n = (name.value.trim() || t('pb.defaultName', { n: cfg.user().length + 1 })).slice(0, 24);
    cfg.save(n, cat.value);
    name.value = '';
    render();
    toast(t('pb.saved', { name: n }));
  });
  wrap.querySelector('.pb-del').addEventListener('click', () => {
    const id = cfg.current();
    if (!cfg.user().some(u => u.id === id)) return;
    cfg.remove(id);
    render();
  });
  render();
  return { render };
}

// Kits de son de la TR-909.
export let trPresets = null;
export function buildTrPresets() {
  trPresets = presetBar($('#tr-pbar'), {
    cats: TR_CATS,
    catLabel: c => t(`tr.cat.${c}`),
    builtins: TR_KITS.map(k => ({ id: k.id, cat: k.cat, name: t(`tr.kit.${k.id}`) })),
    user: () => state.tr.userKits,
    current: () => state.tr.kit,
    apply: id => {
      const u = state.tr.userKits.find(x => x.id === id), b = TR_KITS.find(x => x.id === id);
      if (!u && !b) return;
      state.tr.params = u ? kitParams(u.params) : kitParams(b.v);
      state.tr.kit = id;
      renderTr();
      renderKnobs();
      save();
    },
    save: (name, cat) => {
      let u = state.tr.userKits.find(x => x.name === name);
      if (!u) { u = { id: `u:${crypto.randomUUID()}`, name }; state.tr.userKits.push(u); }
      Object.assign(u, { cat, params: structuredClone(state.tr.params) });
      state.tr.kit = u.id;
      save();
      return u.id;
    },
    remove: id => { state.tr.userKits = state.tr.userKits.filter(x => x.id !== id); state.tr.kit = null; save(); },
  });
}

// Presets du designer de kick (les boutons restent pour les presets fournis).
export let kickPresets = null;
export function buildKickPresets() {
  kickPresets = presetBar($('#kick-pbar'), {
    cats: KICK_CATS,
    catLabel: c => t(`kick.cat.${c}`),
    builtins: Object.keys(KICK_PRESETS).map(id => ({ id, cat: KICK_PRESET_CAT[id], name: t(`kick.preset.${id}`) })),
    user: () => state.kick.user,
    current: () => state.kick.preset,
    apply: id => {
      const u = state.kick.user.find(x => x.id === id);
      if (!u && !KICK_PRESETS[id]) return;
      state.kick.params = { ...kickDefaults(), ...(u ? u.params : KICK_PRESETS[id]) };
      state.kick.preset = id;
      kickChanged(true);
    },
    save: (name, cat) => {
      let u = state.kick.user.find(x => x.name === name);
      if (!u) { u = { id: `u:${crypto.randomUUID()}`, name }; state.kick.user.push(u); }
      Object.assign(u, { cat, params: { ...state.kick.params } });
      state.kick.preset = u.id;
      renderKick();
      save();
      return u.id;
    },
    remove: id => { state.kick.user = state.kick.user.filter(x => x.id !== id); state.kick.preset = null; renderKick(); save(); },
  });
}

// Presets du synthé en couches : ceux fournis (par famille) et les tiens (un preset de départ + tes potentiomètres).
export let synthPresets = null;
export const synthCurrent = () => (state.synthDirty ? null : state.synthPick ?? state.preset);
export function buildSynthPresets() {
  synthPresets = presetBar($('#synth-pbar'), {
    cats: FAMILIES,
    catLabel: f => t(`family.${f}`),
    builtins: PRESETS.map(p => ({ id: p.id, cat: p.family, name: p.name })),
    user: () => state.synthUser,
    current: synthCurrent,
    apply: id => {
      const u = state.synthUser.find(x => x.id === id);
      if (!u) { applyPreset(id); return; }
      applyPreset(u.base);
      for (const def of PAGES.synth.params) {
        if (!Number.isFinite(u.values[def.id])) continue;
        state.globals[def.id] = u.values[def.id];
        engine.set(def.id, toValue(def, u.values[def.id]));
      }
      state.synthPick = id;
      state.synthDirty = false;
      renderSynthKnobs();
      renderKnobs();
      synthPresets.render();
      save();
    },
    save: (name, cat) => {
      let u = state.synthUser.find(x => x.name === name);
      if (!u) { u = { id: `u:${crypto.randomUUID()}`, name }; state.synthUser.push(u); }
      Object.assign(u, { cat, base: state.preset, values: Object.fromEntries(PAGES.synth.params.map(d => [d.id, state.globals[d.id]])) });
      state.synthPick = u.id;
      state.synthDirty = false;
      save();
      return u.id;
    },
    remove: id => { state.synthUser = state.synthUser.filter(x => x.id !== id); state.synthPick = null; state.synthDirty = true; save(); },
  });
}
// Un potentiomètre du synthé tourné : le preset devient « perso ».
export function synthTouched() {
  if (state.synthDirty) return;
  state.synthDirty = true;
  synthPresets?.render();
}

// Presets du synthé à oscillateurs : catégories, et les tiens.
export let oscPresets = null;
export function buildOscPresets() {
  oscPresets = presetBar($('#osc-pbar'), {
    cats: OSC_CATS,
    catLabel: c => t(`osc.cat.${c}`),
    builtins: OSC_PRESETS.map(p => ({ id: p.id, cat: OSC_PRESET_CAT[p.id] ?? 'lead', name: t(`osc.preset.${p.id}`) })),
    user: () => state.osc.user,
    current: () => state.osc.preset,
    apply: id => loadOscPreset(id),
    save: (name, cat) => {
      let u = state.osc.user.find(x => x.name === name);
      if (!u) { u = { id: `u:${crypto.randomUUID()}`, name }; state.osc.user.push(u); }
      Object.assign(u, { cat, params: { ...state.osc.params } });
      state.osc.preset = u.id;
      renderOsc();
      rollPresetOptions();
      save();
      return u.id;
    },
    remove: id => { state.osc.user = state.osc.user.filter(x => x.id !== id); state.osc.preset = null; renderOsc(); rollPresetOptions(); save(); },
  });
}

// Presets de son de la TB-303.
export let acidPresets = null;
export function buildAcidPresets() {
  acidPresets = presetBar($('#acid-presets'), {
    cats: ACID_CATS,
    catLabel: c => t(`acid.cat.${c}`),
    builtins: ACID_SOUNDS.map(s => ({ id: s.id, cat: s.cat, name: t(`acid.snd.${s.id}`) })),
    user: () => state.acid.user,
    current: () => state.acid.sound,
    apply: id => {
      const u = state.acid.user.find(x => x.id === id), b = ACID_SOUNDS.find(x => x.id === id);
      if (!u && !b) return;
      state.acid.params = u ? { ...u.params } : soundParams(b.v);
      state.acid.wave = (u ?? b).wave;
      state.acid.sound = id;
      acidSoundChanged(false);
    },
    save: (name, cat) => {
      const list = state.acid.user;
      let u = list.find(x => x.name === name);
      if (!u) { u = { id: `u:${crypto.randomUUID()}`, name, cat }; list.push(u); }
      Object.assign(u, { cat, wave: state.acid.wave, params: { ...state.acid.params } });
      state.acid.sound = u.id;
      save();
      return u.id;
    },
    remove: id => { state.acid.user = state.acid.user.filter(x => x.id !== id); state.acid.sound = null; save(); },
  });
}

// Un réglage de la TB-303 a changé : le son suit ; s'il vient des potentiomètres, le preset devient « perso ».
export function acidSoundChanged(custom = true) {
  if (custom) state.acid.sound = null;
  acid.update();
  renderAcid();
  renderAcidKnobs();
  if (state.page === 'acid') renderKnobs();
  acidPresets?.render();
  save();
}
