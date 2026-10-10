// Rack d'effets d'insert (voies du mixeur, pistes de la timeline) : liste des effets avec leurs réglages,
// menu pour en ajouter, bouton pour en retirer.
import { t } from '../i18n.js';
import { FX_TYPES, fxParamLabel, newFx } from '../mixer.js';
import { save } from './save.js';

export const fxOptions = () => Object.keys(FX_TYPES).map(k => `<option value="${k}">${t(`fx.${k}`)}</option>`).join('');

/**
 * Affiche les effets de `list()` dans `box` (vidé avant) et relie le menu `add` (un <select>).
 * @param {HTMLElement} box
 * @param {HTMLSelectElement} add
 * @param {() => object[]} list   effets { type, p } (state.mix.channels[id].fx, state.tl.tracks[i].inserts)
 * @param {{ max: number, rebuild: () => void, update: (k: number) => void }} o
 */
export function renderInsertRack(box, add, list, o) {
  const fxs = list();
  box.innerHTML = '';
  fxs.forEach((fx, k) => {
    const item = document.createElement('div');
    item.className = 'fx';
    item.innerHTML = `<div class="fx-head"><b>${t(`fx.${fx.type}`)}</b><button class="fx-del" title="${t('mix.removeFx')}">✕</button></div>`;
    for (const [key, [min, max, step]] of Object.entries(FX_TYPES[fx.type])) {
      const row = document.createElement('label');
      row.className = 'fx-param';
      row.innerHTML = `<span>${t(`fx.p.${key}`)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${fx.p[key]}"><em></em>`;
      const inp = row.querySelector('input');
      const em = row.querySelector('em');
      em.textContent = fxParamLabel(fx.type, key, fx.p[key], fx.p);
      inp.addEventListener('input', () => {
        fx.p[key] = +inp.value;
        o.update(k);
        if (key === 'mode') { renderInsertRack(box, add, list, o); save(); } else em.textContent = fxParamLabel(fx.type, key, fx.p[key], fx.p);
      });
      inp.addEventListener('change', () => save());   // au lâcher : une seule étape d'annulation par geste
      inp.addEventListener('dblclick', () => {   // retour à la valeur par défaut
        fx.p[key] = FX_TYPES[fx.type][key][3];
        o.update(k);
        renderInsertRack(box, add, list, o);
        save();
      });
      item.appendChild(row);
    }
    item.querySelector('.fx-del').addEventListener('click', () => {
      fxs.splice(k, 1);
      o.rebuild();
      renderInsertRack(box, add, list, o);
      save();
    });
    box.appendChild(item);
  });
  add.disabled = fxs.length >= o.max;
  add.onchange = () => {
    const type = add.value;
    add.value = '';
    if (!type || list().length >= o.max) return;
    list().push(newFx(type));
    o.rebuild();
    renderInsertRack(box, add, list, o);
    save();
  };
}
