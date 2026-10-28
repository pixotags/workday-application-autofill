const $ = (id) => document.getElementById(id);
const status = (msg, ok = true) => { $('status').textContent = msg; $('status').className = ok ? 'ok' : 'err'; };

async function load() {
  const { profile } = await chrome.storage.local.get('profile');
  $('json').value = profile ? JSON.stringify(profile, null, 2) : '';
  if (!profile) status('No profile yet — load examples/sample-profile.json from the repo, or paste one', false);
}

function parse() {
  try { return JSON.parse($('json').value); }
  catch (e) { status(`Invalid JSON: ${e.message}`, false); return null; }
}

$('save').onclick = async () => {
  const p = parse(); if (!p) return;
  await chrome.storage.local.set({ profile: p });
  status('Saved ✓');
};

$('format').onclick = () => { const p = parse(); if (p) { $('json').value = JSON.stringify(p, null, 2); status('Formatted'); } };

$('file').onchange = async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  $('json').value = await f.text();
  const p = parse(); if (!p) return;
  $('json').value = JSON.stringify(p, null, 2);
  await chrome.storage.local.set({ profile: p });
  status(`Loaded and saved ${f.name} ✓`);
  e.target.value = '';
};

$('export').onclick = () => {
  const p = parse(); if (!p) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'workday-profile.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

chrome.storage.onChanged.addListener((c) => { if (c.profile) load(); });
load();
