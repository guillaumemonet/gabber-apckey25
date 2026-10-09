// Vérifications statiques (sans navigateur, quelques secondes) : `npm run check`.
// - syntaxe de tous les modules JavaScript ;
// - traductions : mêmes clés en anglais et en français, aucune clé utilisée (HTML ou code) qui n'existe pas ;
// - aide : une page par fenêtre dans les deux langues ;
// - bibliothèque : chaque son de sounds/banks.json existe sur le disque ; démos présentes.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = msg => problems.push(msg);
const js = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !f.startsWith('__'));

// 1. Syntaxe.
for (const f of [...js.map(f => path.join('js', f)), 'tests/run.js', 'tests/harness.js', 'tests/check.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); }
  catch (e) { fail(`syntaxe : ${f}\n${String(e.stderr).split('\n').slice(0, 5).join('\n')}`); }
}

// 2. Traductions (le module est chargé avec un environnement de navigateur minimal).
globalThis.location = { search: '' };
globalThis.document = { documentElement: {}, querySelectorAll: () => [] };
if (!globalThis.navigator) globalThis.navigator = { language: 'en', languages: ['en'] };
const { STRINGS } = await import(pathToFileURL(path.join(ROOT, 'js', 'i18n.js')));
const en = new Set(Object.keys(STRINGS.en)), fr = new Set(Object.keys(STRINGS.fr));
for (const k of en) if (!fr.has(k)) fail(`traduction française manquante : ${k}`);
for (const k of fr) if (!en.has(k)) fail(`traduction anglaise manquante : ${k}`);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const [, k] of html.matchAll(/data-i18n(?:-title|-aria|-placeholder)?="([^"]+)"/g)) if (!en.has(k)) fail(`index.html utilise une clé inconnue : ${k}`);
for (const f of js) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  for (const [, k] of src.matchAll(/\bt\('([a-zA-Z0-9_.-]+)'/g)) if (!en.has(k)) fail(`${f} utilise une clé inconnue : ${k}`);
}

// 3. Aide.
const { HELP } = await import(pathToFileURL(path.join(ROOT, 'js', 'help.js')));
for (const k of Object.keys(HELP.en)) if (!HELP.fr[k]) fail(`aide française manquante : ${k}`);
for (const k of Object.keys(HELP.fr)) if (!HELP.en[k]) fail(`aide anglaise manquante : ${k}`);

// 4. Bibliothèque et démos.
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'sounds', 'banks.json'), 'utf8'));
let sounds = 0;
for (const b of man.banks) for (const p of b.pads) {
  if (!p) continue;
  sounds++;
  if (!fs.existsSync(path.join(ROOT, 'sounds', p.file))) fail(`son manquant : ${p.file} (${b.name})`);
}
for (const f of ['demo/demo.json', ...[2, 3, 4, 5].map(n => `demo/gabberkey-demo-${n}.gabber`)]) if (!fs.existsSync(path.join(ROOT, f))) fail(`démo manquante : ${f}`);

console.log(`${js.length} modules, ${en.size} traductions, ${Object.keys(HELP.en).length} pages d'aide, ${sounds} sons vérifiés`);
if (problems.length) {
  console.log(`\n${problems.length} problème(s) :`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('✓ tout est en ordre');
