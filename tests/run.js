// Lanceur des tests de GabberKey (aucune dépendance) : `npm test` ou `node tests/run.js [filtre…]`.
// Pour chaque test (tests/specs/*.test.js) : sert l'application, ouvre Firefox sans fenêtre sur une page de test
// générée en mémoire (l'application + un accès à ses variables internes + le test), attend le résultat, ferme Firefox.
// Variables : FIREFOX = chemin de Firefox ; TEST_TIMEOUT = délai par test en secondes (180 par défaut) ; TEST_JOBS = tests en parallèle (2).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPECS = path.join(ROOT, 'tests', 'specs');
const TIMEOUT = (+process.env.TEST_TIMEOUT || 180) * 1000;
const JOBS = Math.max(1, +process.env.TEST_JOBS || 2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.flac': 'audio/flac', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml', '.gabber': 'application/json', '.apckit': 'application/json' };

function firefoxPath() {
  if (process.env.FIREFOX) return process.env.FIREFOX;
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\Mozilla Firefox\\firefox.exe', 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe']
    : process.platform === 'darwin' ? ['/Applications/Firefox.app/Contents/MacOS/firefox'] : ['/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox'];
  return candidates.find(p => fs.existsSync(p)) ?? 'firefox';
}

// Application de test : main.js + window.__app, qui lit n'importe quelle variable de main.js (eval direct, à la demande),
// de l'un des modules de js/app/ (leurs déclarations sont toutes exportées), ou un export des moteurs (js/*.js).
// `A.store` = js/storage.js ; `A.synthKick` = renderKick de js/kickdesign.js (A.renderKick = celui de la fenêtre).
const mainSource = () => {
  const list = dir => fs.readdirSync(path.join(ROOT, 'js', dir)).filter(f => f.endsWith('.js') && !f.startsWith('__') && !/-(worklet|worker).js$/.test(f)).sort();
  const mods = [...list('app').map(f => `./app/${f}`), ...list('').filter(f => f !== 'main.js').map(f => `./${f}`)];
  return fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8')
    + '\n// --- tests ---\n'
    + mods.map((f, i) => `import * as __m${i} from '${f}';\n`).join('')
    + `const __mods = [${mods.map((_, i) => `__m${i}`).join(', ')}];\n`
    + `const __alias = { store: __m${mods.indexOf('./storage.js')}, synthKick: __m${mods.indexOf('./kickdesign.js')}.renderKick };\n`
    + "window.__app = new Proxy({}, { get: (_, k) => { if (typeof k !== 'string' || !/^[A-Za-z_$][\\w$]*$/.test(k)) return undefined;"
    + ' if (k in __alias) return __alias[k]; for (const m of __mods) if (k in m) return m[k]; try { return eval(k); } catch { return undefined; } } });\n';
};
const testPage = spec => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = html.replace(/<script type="module" src="js\/main\.js\?v=\d+"><\/script>/,
    `<script type="module" src="js/__test_main.js"></script><script type="module">import run from '/tests/harness.js'; run(${JSON.stringify(spec)});</script>`);
  if (out === html) throw new Error('index.html : balise de main.js introuvable');
  return out;
};

// Serveur : fichiers du dépôt + pages générées + réception des résultats.
function serve(results) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/__result') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => { results(JSON.parse(body)); res.end('ok'); });
      return;
    }
    const send = (code, type, data) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); res.end(data); };
    if (url.pathname === '/__test.html') return send(200, 'text/html', testPage(url.searchParams.get('spec')));
    if (url.pathname === '/js/__test_main.js') return send(200, 'text/javascript', mainSource());
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'text/plain', 'not found');
    send(200, MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

function killTree(child) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch { /* déjà fermé */ }
}

async function runSpec(spec, port, waiters) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-test-'));
  fs.writeFileSync(path.join(profile, 'user.js'), [
    'user_pref("media.autoplay.default", 0);', 'user_pref("media.autoplay.blocking_policy", 0);', 'user_pref("intl.accept_languages", "fr-FR, fr");',
    'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("media.navigator.streams.fake", true);', 'user_pref("media.navigator.permission.disabled", true);',   // micro simulé (entrée audio)
  ].join('\n'));
  const started = Date.now();
  const result = new Promise(resolve => {
    waiters.set(spec, resolve);
    setTimeout(() => resolve({ spec, ok: false, checks: [], error: `délai dépassé (${TIMEOUT / 1000} s)` }), TIMEOUT);
  });
  const child = spawn(firefoxPath(), ['-headless', '-no-remote', '-profile', profile, '--width', '1600', '--height', '1000',
    `http://127.0.0.1:${port}/__test.html?spec=${encodeURIComponent(spec)}`], { stdio: 'ignore', detached: process.platform !== 'win32' });
  const r = await result;
  waiters.delete(spec);
  killTree(child);
  await new Promise(res => setTimeout(res, 500));
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Firefox garde parfois un fichier ouvert un instant */ }
  return { ...r, secs: ((Date.now() - started) / 1000).toFixed(1) };
}

async function main() {
  const filters = process.argv.slice(2);
  const specs = fs.readdirSync(SPECS).filter(f => f.endsWith('.test.js')).sort()
    .filter(f => !filters.length || filters.some(x => f.includes(x)));
  if (!specs.length) { console.log('Aucun test.'); return; }
  const waiters = new Map();
  const server = await serve(r => waiters.get(r.spec)?.(r));
  const port = server.address().port;
  console.log(`${specs.length} test(s), Firefox : ${firefoxPath()}\n`);
  const queue = [...specs];
  const results = [];
  await Promise.all(Array.from({ length: Math.min(JOBS, specs.length) }, async () => {
    while (queue.length) {
      const spec = queue.shift();
      const r = await runSpec(spec, port, waiters);
      results.push(r);
      const failed = r.checks.filter(c => !c.ok);
      console.log(`${r.ok ? '✓' : '✗'} ${spec.replace('.test.js', '')}  (${r.checks.length} vérif., ${r.secs} s)`);
      for (const c of failed) console.log(`    ✗ ${c.msg}${c.detail ? ` — ${c.detail}` : ''}`);
      if (r.error) console.log(`    ! ${r.error}`);
    }
  }));
  server.close();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} test(s) réussi(s)`);
  process.exit(bad.length ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
