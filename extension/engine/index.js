// Public API: window.__wdAutofill = { fill(profile), capture({ includeEmpty }), pageId(), toast() }
//
// Profile shape:
// {
//   "pages": {
//     "<pageId>": {
//       "actions":  [{ "click": "<css>", "wait": 600 }],
//       "sections": { "<Section heading>": [ { "<Field label>": value, ... }, ... ] },
//       "fields":   { "<field key>": value }
//     }
//   },
//   "common":    { "<field key>": value },   // tried on every page, skipped if absent
//   "questions": { "<label text>": value }   // matched by label text on any page
// }
(() => {
  const WD = (window.__wdA ||= {});
  const {
    sleep, has, realClick, toast, pageId, pageRoot, listFields, labelOf, resolve, resolveByLabel,
    detectType, fillField, readValue, PANEL_SEL, sectionName, allSections, panelsOf, fillSection,
  } = WD;

  const skip = (k) => k.startsWith('_');
  const filled = (v) => has(v) || v === false;
  const isEmpty = (v) => v === '' || (Array.isArray(v) && !v.length);

  async function fill(profile = {}) {
    const results = [];
    const pid = pageId();
    const root = pageRoot();
    const cfg = (pid && profile.pages?.[pid]) || {};
    const taken = new Set();

    const run = async (key, value, el, source) => {
      if (!filled(value)) return;
      taken.add(el);
      try {
        const [status, note] = await fillField(el, value);
        results.push({ field: key, status, note, source });
      } catch (e) {
        results.push({ field: key, status: '❌', note: e.message, source });
      }
    };

    for (const a of cfg.actions || []) {
      const el = a.click && document.querySelector(a.click);
      if (el) { realClick(el); await sleep(a.wait ?? 600); results.push({ field: `action ${a.click}`, status: '✅' }); }
    }

    for (const [name, entries] of Object.entries(cfg.sections || {})) {
      if (!skip(name)) await fillSection(root, name, entries, results, run);
    }

    for (const [key, value] of Object.entries(cfg.fields || {})) {
      if (skip(key) || !filled(value)) continue;
      const el = resolve(key, root);
      if (!el) { results.push({ field: key, status: '⚠️', note: 'not on this page', source: 'page' }); continue; }
      await run(key, value, el, 'page');
    }

    // Fields saved under other pages (or an old page name): filled only if present here.
    const others = Object.entries(profile.pages || {})
      .filter(([name, p]) => name !== pid && p?.fields)
      .map(([name, p]) => [name, p.fields]);
    for (const [name, fields] of [['common', profile.common || {}], ...others]) {
      for (const [key, value] of Object.entries(fields)) {
        if (skip(key) || !filled(value)) continue;
        const el = resolve(key, root);
        if (el && !taken.has(el)) await run(key, value, el, name);
      }
    }

    for (const [q, value] of Object.entries(profile.questions || {})) {
      if (skip(q)) continue;
      const el = resolveByLabel(q, root, taken);
      if (el) await run(q, value, el, 'question');
    }

    console.groupCollapsed(`[Workday Autofill] page: ${pid || '(unknown)'}`);
    console.table(results);
    console.groupEnd();

    const failed = results.filter((r) => r.status === '❌').length;
    const done = results.filter((r) => r.status === '✅').length;
    const msg = !results.length
      ? `Nothing to fill on ${pid || 'this page'} — try Capture`
      : failed ? `Filled ${done}, ${failed} problem(s) — see console` : `Filled ${done} field(s)`;
    toast(msg, results.length > 0 && !failed);
    return { pageId: pid, filled: done, failed, results };
  }

  // Field ids that look generated per job (long hex / uuid) are saved by label under "questions".
  const looksGenerated = (k) => /[0-9a-f]{16,}|[0-9a-f]{8}-[0-9a-f]{4}-/i.test(k);

  function capture({ includeEmpty = false } = {}) {
    const pid = pageId();
    const root = pageRoot();
    const fields = {}, questions = {}, help = {}, sections = {};

    for (const sec of allSections(root)) {
      const panels = panelsOf(sec);
      if (!panels.length) continue;
      sections[sectionName(sec)] = panels.map((panel) => {
        const entry = {};
        for (const f of listFields(panel)) {
          const type = detectType(f.el);
          if (type === 'file' || type === 'unknown') continue;
          const value = readValue(f.el, type);
          if (isEmpty(value) && !includeEmpty) continue;
          const label = labelOf(f.el);
          entry[label && !(label in entry) ? label : f.key] = value;
        }
        return entry;
      });
    }

    for (const f of listFields(root)) {
      if (f.el.closest(PANEL_SEL)) continue; // belongs to a section entry
      const type = detectType(f.el);
      if (type === 'file' || type === 'unknown') continue;
      const value = readValue(f.el, type);
      if (isEmpty(value) && !includeEmpty) continue;
      const label = labelOf(f.el);
      if (looksGenerated(f.key) && label) questions[label.slice(0, 120)] = value;
      else { fields[f.key] = value; help[f.key] = `${label || '?'} (${type})`; }
    }
    return { pageId: pid, sections, fields, questions, help };
  }

  window.__wdAutofill = { fill, capture, pageId, toast };
})();
