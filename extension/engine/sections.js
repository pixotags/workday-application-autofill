// Repeating sections on "My Experience": Work Experience, Education, Languages, Websites…
//   section = role="group" labelled "<Name>-section", with an <h4> heading
//   entry   = role="group" labelled "<Name>-<n>-panel"
//   "Add" / "Add Another" = data-automation-id="add-button" outside the entries
// Field ids inside entries are generated per entry, so entries are filled by label.
(() => {
  const WD = (window.__wdA ||= {});
  const { sleep, norm, isVisible, has, cssEsc, waitFor, realClick, listFields, labelOf } = WD;

  const PANEL_SEL = '[role="group"][aria-labelledby$="-panel"]';

  const sectionName = (g) =>
    (g.querySelector('h4')?.textContent || g.getAttribute('aria-labelledby').replace(/-section$/, '').replace(/-/g, ' ')).trim();

  const allSections = (root) => [...root.querySelectorAll('[role="group"][aria-labelledby$="-section"]')].filter(isVisible);

  function findSection(root, name) {
    const n = norm(name);
    const secs = allSections(root);
    return secs.find((g) => norm(sectionName(g)) === n) || secs.find((g) => norm(sectionName(g)).startsWith(n)) || null;
  }

  const panelsOf = (section) => [...section.querySelectorAll(PANEL_SEL)].filter(isVisible);
  const addButtonOf = (section) =>
    [...section.querySelectorAll('[data-automation-id="add-button"]')].filter((b) => !b.closest(PANEL_SEL) && isVisible(b)).pop() || null;

  // Inside one entry, a key is Workday's field name ("language") or its label ("Comprehension").
  function resolveInPanel(panel, key) {
    const byAuto = panel.querySelector(`[data-automation-id="formField-${cssEsc(key)}"]`);
    if (byAuto) return byAuto;
    const k = norm(key);
    const fields = listFields(panel);
    const lab = (f) => norm(labelOf(f.el));
    return (fields.find((f) => lab(f) === k) || fields.find((f) => lab(f).startsWith(k)) || fields.find((f) => lab(f).includes(k)))?.el || null;
  }

  async function fillSection(root, name, entries, results, run) {
    const section = findSection(root, name);
    if (!section) { results.push({ field: `[${name}]`, status: '⚠️', note: 'section not on this page', source: 'section' }); return; }
    const list = Array.isArray(entries) ? entries : [entries];

    // Click Add / Add Another until there are enough entries (existing ones are reused).
    let guard = 0;
    while (panelsOf(section).length < list.length && guard++ < list.length + 2) {
      const btn = addButtonOf(section);
      if (!btn) break;
      const before = panelsOf(section).length;
      realClick(btn);
      await waitFor(() => panelsOf(section).length > before, 4000);
      await sleep(300);
    }
    const panels = panelsOf(section);

    for (let i = 0; i < list.length; i++) {
      const panel = panels[i];
      if (!panel) { results.push({ field: `[${name} ${i + 1}]`, status: '❌', note: 'could not add entry', source: 'section' }); continue; }
      for (const [key, value] of Object.entries(list[i] || {})) {
        if (key.startsWith('_') || (!has(value) && value !== false)) continue;
        const el = resolveInPanel(panel, key);
        if (!el) { results.push({ field: `[${name} ${i + 1}] ${key}`, status: '⚠️', note: 'field not in entry', source: 'section' }); continue; }
        await run(`[${name} ${i + 1}] ${key}`, value, el, 'section');
      }
    }
  }

  Object.assign(WD, { PANEL_SEL, sectionName, allSections, panelsOf, fillSection });
})();
