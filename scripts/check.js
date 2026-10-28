// Static checks: every JS file parses, every JSON file is valid,
// and the manifest version matches package.json.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    SKIP.has(e.name) ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

let failed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  try {
    if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    failed++;
    console.error(`✗ ${rel}\n${String(e.stderr || e.message).trim()}\n`);
  }
}

const manifest = require('../extension/manifest.json');
const pkg = require('../package.json');
if (manifest.version !== pkg.version) {
  failed++;
  console.error(`✗ manifest.json version ${manifest.version} ≠ package.json version ${pkg.version}`);
}

if (failed) process.exit(1);
console.log('✓ all files parse; versions match');
