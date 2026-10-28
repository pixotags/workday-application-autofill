// Workday Application Autofill — background service worker
importScripts('engine/files.js'); // defines self.ENGINE_FILES

const getProfile = async () => (await chrome.storage.local.get('profile')).profile || null;
const setProfile = (profile) => chrome.storage.local.set({ profile });

async function runInTab(tabId, method, arg) {
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!window.__wdAutofill,
  });
  if (!loaded) await chrome.scripting.executeScript({ target: { tabId }, files: self.ENGINE_FILES });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m, a) => window.__wdAutofill[m](a),
    args: [method, arg ?? null],
  });
  return res?.result;
}

async function fill(tabId) {
  const profile = await getProfile();
  if (!profile) {
    await runInTab(tabId, 'toast', 'No profile loaded — open the extension options');
    return { error: 'No profile loaded' };
  }
  return runInTab(tabId, 'fill', profile);
}

// Merge the page's current values into the stored profile.
async function capture(tabId) {
  const snap = await runInTab(tabId, 'capture', { includeEmpty: false });
  if (!snap?.pageId) return { error: 'Not on a recognised Workday application page' };
  const profile = (await getProfile()) || { pages: {}, common: {}, questions: {} };
  profile.pages ||= {};
  profile.questions ||= {};
  const page = (profile.pages[snap.pageId] ||= { fields: {} });
  page.fields = { ...(page.fields || {}), ...snap.fields };
  // A captured section replaces the saved list for that section (keeps entry order).
  if (Object.keys(snap.sections || {}).length) page.sections = { ...(page.sections || {}), ...snap.sections };
  Object.assign(profile.questions, snap.questions);
  await setProfile(profile);
  const entries = Object.values(snap.sections || {}).reduce((n, l) => n + l.length, 0);
  return {
    pageId: snap.pageId,
    fields: Object.keys(snap.fields).length + entries,
    questions: Object.keys(snap.questions).length,
    captured: { pages: { [snap.pageId]: { sections: snap.sections, fields: snap.fields } }, questions: snap.questions },
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.cmd === 'fill') return sendResponse(await fill(msg.tabId));
      if (msg.cmd === 'capture') return sendResponse(await capture(msg.tabId));
      if (msg.cmd === 'template') return sendResponse(await runInTab(msg.tabId, 'capture', { includeEmpty: true }));
      if (msg.cmd === 'pageId') return sendResponse(await runInTab(msg.tabId, 'pageId'));
      sendResponse({ error: 'unknown command' });
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true; // async response
});

// Keyboard shortcut (Alt+Shift+F by default) fills without opening the popup,
// which also keeps focus on the Workday tab.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'fill-page' && tab?.id) {
    try { await fill(tab.id); } catch (e) { console.error('[Workday Autofill]', e); }
  }
});
