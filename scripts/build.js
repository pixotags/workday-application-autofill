// Zips extension/ into dist/workday-application-autofill-v<version>.zip
// (the file attached to GitHub releases). Requires the `zip` command (macOS/Linux).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { version } = require('../extension/manifest.json');
const out = path.join(ROOT, 'dist', `workday-application-autofill-v${version}.zip`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
execFileSync('zip', ['-r', '-q', out, '.', '-x', '.*'], { cwd: path.join(ROOT, 'extension'), stdio: 'inherit' });
console.log(`✓ ${path.relative(ROOT, out)}`);
