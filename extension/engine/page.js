// Page detection and field discovery.
(() => {
  const WD = (window.__wdA ||= {});
  const { isVisible, cssEsc, norm, labelForInput } = WD;

  // Workday wraps the whole flow in data-automation-id="applyFlowPage" and each
  // step inside it in e.g. "applyFlowMyInfoPage". Use the innermost step wrapper;
  // if there isn't one, fall back to the progress-bar label ("step:My Experience").
  function pageEl() {
    const els = [...document.querySelectorAll('[data-automation-id]')].filter((e) => {
      const id = e.getAttribute('data-automation-id');
      return /^applyFlow.*Page$/i.test(id) && id !== 'applyFlowPage' && isVisible(e);
    });
    return els.find((e) => !els.some((o) => o !== e && e.contains(o))) || null;
  }

  function pageId() {
    const el = pageEl();
    if (el) return el.getAttribute('data-automation-id');
    const labels = [...document.querySelectorAll('[data-automation-id="progressBarActiveStep"] label')]
      .map((l) => l.textContent.trim())
      .filter((t) => t && !/step \d+ of \d+/i.test(t));
    if (labels.length) return `step:${labels[labels.length - 1]}`;
    return document.querySelector('[data-automation-id="applyFlowPage"]') ? 'applyFlowPage' : null;
  }

  const pageRoot = () =>
    pageEl() || document.querySelector('[data-automation-id="applyFlowPage"]') || document.body;

  // Every fillable "field": Workday formField-* wrappers, plus standalone controls
  // that carry their own data-automation-id (e.g. the SMS opt-in checkbox).
  function listFields(root) {
    const out = [];
    for (const c of root.querySelectorAll('[data-automation-id^="formField-"]')) {
      if (!isVisible(c)) continue;
      if (c.parentElement?.closest('[data-automation-id^="formField-"]')) continue; // nested
      out.push({ el: c, base: c.getAttribute('data-automation-id').replace(/^formField-/, '') });
    }
    for (const c of root.querySelectorAll('input[data-automation-id], textarea[data-automation-id]')) {
      if (!isVisible(c) && c.type !== 'checkbox' && c.type !== 'radio') continue;
      if (c.closest('[data-automation-id^="formField-"]')) continue;
      out.push({ el: c, base: `[data-automation-id="${c.getAttribute('data-automation-id')}"]`, selector: true });
    }
    // Disambiguate repeats: key, key#2, key#3 ...
    const seen = {};
    for (const f of out) {
      seen[f.base] = (seen[f.base] || 0) + 1;
      f.key = seen[f.base] > 1 ? `${f.base}#${seen[f.base]}` : f.base;
    }
    return out;
  }

  function labelOf(el) {
    const ids = el.getAttribute('aria-labelledby');
    const parts = [];
    const l = el.querySelector?.('legend, label');
    if (l) parts.push(l.textContent);
    if (!parts.length && ids) ids.split(/\s+/).forEach((id) => parts.push(document.getElementById(id)?.textContent || ''));
    if (!parts.length && el.matches('input,textarea')) parts.push(labelForInput(el));
    return String(parts.join(' ')).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  }

  // Resolve a profile key to a field on the current page:
  //   "legalName--firstName"        → [data-automation-id="formField-legalName--firstName"]
  //   "jobTitle#2"                  → 2nd match of that field
  //   "#some-id" / "[...]"          → raw CSS selector
  //   "name--legalName--firstName"  → element id (falls back to closest formField)
  function resolve(key, root) {
    if (/^[#.\[]/.test(key)) {
      const el = root.querySelector(key) || document.querySelector(key);
      return el ? el.closest('[data-automation-id^="formField-"]') || el : null;
    }
    const m = key.match(/^(.*?)(?:#(\d+))?$/);
    const base = m[1];
    const n = Number(m[2] || 1);
    const byAuto = [...root.querySelectorAll(`[data-automation-id="formField-${cssEsc(base)}"]`)].filter(isVisible);
    if (byAuto[n - 1]) return byAuto[n - 1];
    const byId = document.getElementById(base);
    if (byId) return byId.closest('[data-automation-id^="formField-"]') || byId;
    const bySuffix = [...root.querySelectorAll(`[id$="--${cssEsc(base)}"]`)].filter(isVisible);
    if (bySuffix[n - 1]) return bySuffix[n - 1].closest('[data-automation-id^="formField-"]') || bySuffix[n - 1];
    return null;
  }

  function resolveByLabel(question, root, taken) {
    const q = norm(question);
    return listFields(root).find((f) => !taken.has(f.el) && norm(labelOf(f.el)).includes(q))?.el || null;
  }

  Object.assign(WD, { pageEl, pageId, pageRoot, listFields, labelOf, resolve, resolveByLabel });
})();
