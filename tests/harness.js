// Côté navigateur : exécute un test (tests/specs/NOM.test.js) dans l'application et renvoie ses vérifications au lanceur.
// Un test : export default async function (t, A) { … } ; A donne accès à toutes les variables internes de main.js
// (A.state, A.timeline, A.engine, A.renderTl…). Optionnel : export async function seed(t) (avant le démarrage,
// par exemple une ancienne sauvegarde à écrire dans IndexedDB) ; export const start = false (ne pas cliquer « Démarrer »).
const fmt = v => (typeof v === 'string' ? v : JSON.stringify(v))?.slice(0, 400);

export default async function run(spec) {
  const checks = [];
  const errors = [];
  window.addEventListener('error', e => errors.push(`${e.message} @${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', e => errors.push(String(e.reason?.stack || e.reason)));
  window.confirm = () => true;
  window.alert = () => {};
  const t = {
    errors,
    ok(cond, msg, detail) { checks.push({ ok: !!cond, msg, detail: cond ? undefined : fmt(detail) }); return !!cond; },
    eq(a, b, msg) { const same = Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b); return t.ok(same, msg, `obtenu ${fmt(a)}, attendu ${fmt(b)}`); },
    near(a, b, tol, msg) { return t.ok(Math.abs(a - b) <= tol, msg, `obtenu ${a}, attendu ${b} ± ${tol}`); },
    wait: ms => new Promise(r => setTimeout(r, ms)),
    // Attend que fn() renvoie une valeur vraie (ou null après `ms`).
    async until(fn, ms = 10000, step = 50) {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        try { const v = await fn(); if (v) return v; } catch { /* pas encore prêt */ }
        await t.wait(step);
      }
      return null;
    },
    $: sel => document.querySelector(sel),
    $$: sel => [...document.querySelectorAll(sel)],
    // Clic « réel » (pointerdown + pointerup) au centre d'un élément, ou à (dx, dy) de son coin.
    press(el, dx, dy) {
      const r = el.getBoundingClientRect();
      const o = { clientX: r.left + (dx ?? r.width / 2), clientY: r.top + (dy ?? r.height / 2), bubbles: true, button: 0, pointerId: 1 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      window.dispatchEvent(new PointerEvent('pointerup', o));
    },
    // Niveau crête d'un nœud audio sur la dernière fenêtre d'analyse.
    meter(node) {
      const ctx = node.context;
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      node.connect(an);
      const buf = new Float32Array(2048);
      return () => { an.getFloatTimeDomainData(buf); let p = 0; for (const x of buf) p = Math.max(p, Math.abs(x)); return p; };
    },
  };
  try {
    const mod = await import(`/tests/specs/${spec}`);
    if (mod.seed) await mod.seed(t);
    if (mod.start !== false) {
      const btn = await t.until(() => document.querySelector('#start-btn'), 10000);
      await t.wait(300);
      btn.click();
      const ready = await t.until(() => window.__app?.apc && window.__app?.libManifest && window.__app?.wm, 90000, 100);
      if (!ready) throw new Error("l'application n'a pas démarré");
      await t.wait(400);
    }
    await mod.default(t, window.__app);
    t.ok(!errors.length, 'aucune erreur JavaScript', errors.slice(0, 3).join(' | '));
  } catch (e) {
    checks.push({ ok: false, msg: 'exception', detail: String(e?.stack || e).slice(0, 800) });
  }
  await fetch('/__result', { method: 'POST', body: JSON.stringify({ spec, ok: checks.length > 0 && checks.every(c => c.ok), checks }) });
}
