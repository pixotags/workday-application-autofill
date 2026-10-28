const $ = (id) => document.getElementById(id);
const status = (msg, ok = true) => { $('status').textContent = msg; $('status').className = ok ? 'ok' : 'err'; };

const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const send = async (cmd) => chrome.runtime.sendMessage({ cmd, tabId: (await activeTab()).id });

(async () => {
  const { profile } = await chrome.storage.local.get('profile');
  $('profile').textContent = profile
    ? `${Object.keys(profile.pages || {}).length} page(s), ${Object.keys(profile.questions || {}).length} question(s)`
    : 'none — load one';
  try {
    const pid = await send('pageId');
    $('page').textContent = typeof pid === 'string' ? pid : pid?.error ? 'not accessible' : 'not a Workday apply page';
    if (typeof pid === 'string' && profile && !profile.pages?.[pid]) $('page').textContent += ' (not in profile)';
  } catch {
    $('page').textContent = 'not accessible';
  }
})();

$('fill').onclick = async () => {
  status('Filling…');
  const r = await send('fill');
  if (r?.error) return status(r.error, false);
  status(`${r.pageId || 'page'}: ${r.filled} filled${r.failed ? `, ${r.failed} problem(s) — see page console` : ''}`, !r.failed);
};

$('capture').onclick = async () => {
  const r = await send('capture');
  if (r?.error) return status(r.error, false);
  try { await navigator.clipboard.writeText(JSON.stringify(r.captured, null, 2)); } catch {}
  status(`Saved ${r.fields} field(s)/entries and ${r.questions} question(s) for ${r.pageId} to your profile (also copied to clipboard)`);
  const { profile } = await chrome.storage.local.get('profile');
  $('profile').textContent = `${Object.keys(profile.pages || {}).length} page(s), ${Object.keys(profile.questions || {}).length} question(s)`;
};

$('template').onclick = async () => {
  const r = await send('template');
  if (r?.error) return status(r.error, false);
  const json = JSON.stringify({ pages: { [r.pageId || 'unknownPage']: { _help: r.help, sections: r.sections, fields: r.fields } }, questions: r.questions }, null, 2);
  await navigator.clipboard.writeText(json);
  status(`Copied template: ${Object.keys(r.fields).length} field(s), ${Object.keys(r.questions).length} question(s)`);
};

$('options').onclick = () => chrome.runtime.openOptionsPage();
