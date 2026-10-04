/* Nova Bastion 3D - PWA verification.
 *
 * Asserts everything the store-packaging task requires:
 *  1. manifest.json parses and has all required fields
 *  2. every icon file exists, is a PNG, and IHDR reports correct dimensions
 *  3. sw.js passes node --check and its precache list matches files on disk
 *  4. index.html has the manifest/theme-color/registration tags
 *  5. no runtime CDN references in shipped js/css/html (PeerJS cloud host
 *     config excluded; it is a websocket signaling default, not a fetch)
 *  6. node --check clean on all touched files
 *  7. no em dashes in user-facing text
 *
 * Usage: node scripts/verify-pwa.js
 * Exit code 0 = all checks pass.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function check(name, cond, detail) {
  if (cond) console.log('PASS', name);
  else { failures++; console.log('FAIL', name, detail || ''); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- 1. manifest.json ---------- */
let manifest;
try {
  manifest = JSON.parse(read('manifest.json'));
  check('manifest: parses as JSON', true);
} catch (e) {
  check('manifest: parses as JSON', false, String(e));
}
if (manifest) {
  check('manifest: name', manifest.name === 'Nova Bastion 3D', manifest.name);
  check('manifest: short_name', manifest.short_name === 'Nova Bastion', manifest.short_name);
  check('manifest: display fullscreen', manifest.display === 'fullscreen', manifest.display);
  check('manifest: orientation landscape', manifest.orientation === 'landscape', manifest.orientation);
  check('manifest: theme_color', manifest.theme_color === '#0a0c14', manifest.theme_color);
  check('manifest: background_color', manifest.background_color === '#0a0c14', manifest.background_color);
  check('manifest: description one line, no em dash',
    typeof manifest.description === 'string' && manifest.description.length > 0 &&
    !manifest.description.includes('\n') && !manifest.description.includes('—'),
    JSON.stringify(manifest.description));
  check('manifest: start_url "."', manifest.start_url === '.', manifest.start_url);
  check('manifest: categories',
    Array.isArray(manifest.categories) &&
    manifest.categories.includes('games') && manifest.categories.includes('strategy'),
    JSON.stringify(manifest.categories));

  const icons = manifest.icons || [];
  const requiredSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const s of requiredSizes) {
    const hit = icons.find((i) => i.sizes === `${s}x${s}` && i.src === `icons/icon-${s}.png`);
    check(`manifest: icon ${s}x${s}`, !!hit, JSON.stringify(icons.filter((i) => i.sizes === `${s}x${s}`)));
  }
  const maskable = icons.find((i) => i.purpose === 'any maskable' && i.sizes === '512x512');
  check('manifest: 512 maskable icon', !!maskable && maskable.src === 'icons/icon-maskable-512.png',
    JSON.stringify(maskable));
  const wide = (manifest.screenshots || []).find((i) => i.form_factor === 'wide');
  const narrow = (manifest.screenshots || []).find((i) => i.form_factor === 'narrow');
  check('manifest: wide screenshot 1280x720',
    !!wide && wide.sizes === '1280x720' && wide.src === 'screenshots/screenshot-wide.png',
    JSON.stringify(wide));
  check('manifest: narrow screenshot 720x1280',
    !!narrow && narrow.sizes === '720x1280' && narrow.src === 'screenshots/screenshot-narrow.png',
    JSON.stringify(narrow));
}

/* ---------- 2. icon + screenshot files ---------- */
function pngDims(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
const assetSpecs = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ({ rel: `icons/icon-${s}.png`, w: s, h: s })),
  { rel: 'icons/icon-maskable-512.png', w: 512, h: 512 },
  { rel: 'screenshots/screenshot-wide.png', w: 1280, h: 720 },
  { rel: 'screenshots/screenshot-narrow.png', w: 720, h: 1280 },
];
for (const { rel, w, h } of assetSpecs) {
  const exists = fs.existsSync(path.join(ROOT, rel));
  check(`asset exists: ${rel}`, exists);
  if (exists) {
    const dims = pngDims(rel);
    check(`asset ${rel} is PNG with dims ${w}x${h}`,
      !!dims && dims.w === w && dims.h === h, dims ? `${dims.w}x${dims.h}` : 'bad PNG');
  }
}

/* ---------- 3. sw.js: syntax + precache matches disk ---------- */
try {
  execSync('node --check sw.js', { cwd: ROOT, stdio: 'pipe' });
  check('sw.js: node --check clean', true);
} catch (e) {
  check('sw.js: node --check clean', false, String(e.stderr || e.message));
}
const swSrc = read('sw.js');
const precacheMatch = swSrc.match(/const PRECACHE = (\[[\s\S]*?\]);/);
check('sw.js: precache list parseable', !!precacheMatch);
if (precacheMatch) {
  let list;
  try { list = JSON.parse(precacheMatch[1]); } catch (e) { list = null; }
  check('sw.js: precache list is valid JSON array', Array.isArray(list));
  if (Array.isArray(list)) {
    const missing = list.filter((f) => !fs.existsSync(path.join(ROOT, f)));
    check('sw.js: every precached file exists on disk (no 404s)', missing.length === 0,
      missing.length ? 'missing: ' + missing.join(', ') : '');
    check('sw.js: precache includes app shell core',
      ['index.html', 'manifest.json', 'css/style.css', 'js/main.js', 'js/vendor/three.min.js',
       'icons/icon-192.png'].every((f) => list.includes(f)));
    console.log('INFO sw.js precache file count:', list.length);
  }
}
check('sw.js: versioned cache name', /novabastion-3d-v1/.test(swSrc));
check('sw.js: skipWaiting present', swSrc.includes('skipWaiting'));
check('sw.js: clients.claim present', swSrc.includes('clients.claim'));
check('sw.js: old-cache cleanup', swSrc.includes('caches.delete'));
check('sw.js: offline navigation fallback', swSrc.includes("caches.match(INDEX_URL)"));

/* ---------- 4. index.html tags ---------- */
const html = read('index.html');
check('index.html: manifest link', html.includes('<link rel="manifest" href="manifest.json">'));
check('index.html: theme-color meta', html.includes('<meta name="theme-color" content="#0a0c14">'));
check('index.html: apple-touch-icon', html.includes('<link rel="apple-touch-icon" href="icons/icon-192.png">'));
check('index.html: mobile-web-app-capable', html.includes('<meta name="mobile-web-app-capable" content="yes">'));
check('index.html: apple-mobile-web-app-capable',
  html.includes('<meta name="apple-mobile-web-app-capable" content="yes">'));
check('index.html: black-translucent status bar',
  html.includes('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'));
check('index.html: guarded SW registration',
  html.includes("if ('serviceWorker' in navigator)") &&
  html.includes("navigator.serviceWorker.register('sw.js'") &&
  html.includes('try {'));
check('index.html: relative paths only (no absolute /tower-defense/ or http)',
  !/(src|href)="\/(?!\/)/.test(html) && !/(src|href)="https?:\/\//.test(html));

/* ---------- 5. runtime CDN reference sweep ---------- */
function stripComments(src, ext) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');       // block comments
  out = out.replace(/<!--[\s\S]*?-->/g, '');              // html comments
  if (ext === '.js') out = out.replace(/(^|[^\S:/])\/\/[^\n]*/g, '$1'); // line comments
  return out;
}
const urlAttr = /(src|href)\s*=\s*["']https?:\/\//i;
const urlCode = /\b(fetch|import|XMLHttpRequest|new\s+WebSocket|EventSource)\s*\(\s*["']https?:\/\//;
const CDN_EXCEPTIONS = ['0.peerjs.com', 'peerjs.com']; // PeerJS cloud signaling default host config
let cdnHits = [];
function walkShip(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (rel.startsWith('scripts') || rel.startsWith('screenshots') || rel.startsWith('icons')) continue;
    if (rel === 'sw.js' || rel === 'manifest.json' || rel === 'README.md') continue;
    if (entry.isDirectory()) { walkShip(full); continue; }
    if (!/\.(js|css|html)$/.test(entry.name)) continue;
    if (rel.startsWith('js' + path.sep + 'vendor')) continue; // vendored third-party libs
    if (rel.startsWith('js' + path.sep + 'tests')) continue;  // unit tests, not shipped
    const src = stripComments(fs.readFileSync(full, 'utf8'), path.extname(entry.name));
    const lines = src.split('\n');
    lines.forEach((line, idx) => {
      if (CDN_EXCEPTIONS.some((e) => line.includes(e))) return;
      if (urlAttr.test(line) || urlCode.test(line) || /https?:\/\//.test(line) &&
          /(from|import)\s+["']https?:\/\//.test(line)) {
        cdnHits.push(`${rel}:${idx + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
}
walkShip(ROOT);
check('no runtime CDN references in shipped js/css/html', cdnHits.length === 0,
  cdnHits.length ? '\n  ' + cdnHits.join('\n  ') : '');

/* ---------- 6. node --check all touched files ---------- */
for (const f of ['sw.js', 'scripts/generate-assets.js', 'scripts/build-sw.js', 'scripts/verify-pwa.js']) {
  try {
    execSync(`node --check ${f}`, { cwd: ROOT, stdio: 'pipe' });
    check(`node --check clean: ${f}`, true);
  } catch (e) {
    check(`node --check clean: ${f}`, false, String(e.stderr || e.message));
  }
}

/* ---------- 7. no em dashes in user-facing text ---------- */
const userFacing = ['README.md', 'manifest.json', 'index.html', 'sw.js'];
for (const f of userFacing) {
  check(`no em dashes in ${f}`, !read(f).includes('—'));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
