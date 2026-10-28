// Node-side test harness: loads a sanitised Workday HTML fixture into Chromium,
// injects the extension's engine files in the same order background.js does,
// and optionally installs the widget mocks.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'extension');

// Read the injection order from extension/engine/files.js (single source of truth).
const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(EXT, 'engine', 'files.js'), 'utf8'), sandbox);
const ENGINE = sandbox.self.ENGINE_FILES.map((f) => fs.readFileSync(path.join(EXT, f), 'utf8'));
const MOCKS = fs.readFileSync(path.join(__dirname, 'workday-mocks.js'), 'utf8');

const fixture = (name) => fs.readFileSync(path.join(ROOT, 'test', 'fixtures', name), 'utf8');

async function launch() {
  return chromium.launch();
}

/**
 * Open a fixture as a Workday apply page.
 * @param {import('playwright').Browser} browser
 * @param {string} name             fixture file name
 * @param {object} [opts]
 * @param {boolean} [opts.mocks]    install widget mocks (dropdowns, prompts, Add buttons)
 * @param {boolean} [opts.noNativeFocus]  simulate an unfocused window (popup open)
 * @param {Record<string,string>} [opts.templates]  section name → fixture to take an empty entry from
 */
async function openFixture(browser, name, opts = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  let html = fixture(name);
  if (!html.includes('data-automation-id="applyFlowPage"')) {
    html = `<div data-automation-id="applyFlowPage">${html}</div>`;
  }
  await page.setContent(`<!doctype html><html><body>${html}</body></html>`);

  if (opts.noNativeFocus) {
    await page.evaluate(() => {
      HTMLElement.prototype.focus = function () {};
      HTMLElement.prototype.blur = function () {};
    });
  }
  if (opts.mocks) {
    await page.addScriptTag({ content: MOCKS });
    await page.evaluate(() => {
      window.installWorkdayMocks();
      // Default templates: the first existing entry of each section on this page.
      for (const sec of document.querySelectorAll('[role="group"][aria-labelledby$="-section"]')) {
        const panel = sec.querySelector('[role="group"][aria-labelledby$="-panel"]');
        if (panel) window.registerPanelTemplate(sec.getAttribute('aria-labelledby').replace(/-section$/, ''), panel.outerHTML);
      }
    });
    for (const [section, file] of Object.entries(opts.templates || {})) {
      const ok = await page.evaluate(([s, html]) => {
        const t = document.createElement('template');
        t.innerHTML = html;
        const panel = t.content.querySelector('[role="group"][aria-labelledby$="-panel"]');
        if (panel) window.registerPanelTemplate(s, panel.outerHTML);
        return !!panel;
      }, [section, fixture(file)]);
      if (!ok) throw new Error(`no entry template in ${file}`);
    }
  }
  for (const src of ENGINE) await page.addScriptTag({ content: src });
  page.errors = errors;
  return page;
}

const capture = (page, opts) => page.evaluate((o) => window.__wdAutofill.capture(o), opts || {});
const fill = (page, profile) => page.evaluate((p) => window.__wdAutofill.fill(p), profile);

// Build a profile from what Capture reads on a page.
const profileFrom = (snap) => ({
  pages: { [snap.pageId]: { sections: snap.sections, fields: snap.fields } },
  questions: snap.questions,
});

module.exports = { launch, openFixture, capture, fill, profileFrom };
