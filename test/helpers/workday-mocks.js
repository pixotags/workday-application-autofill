// Browser-side stand-ins for Workday widgets that only exist on the live site.
// The saved HTML fixtures contain the *closed* state of each widget; these mocks
// add the behaviour (open a listbox, search a prompt, add a section entry) that
// Workday's own JavaScript would provide.
window.installWorkdayMocks = function installWorkdayMocks() {
  const LEVELS = ['1 - Beginner', '2 - Classroom Study', '3 - Intermediate', '4 - Advanced', '5 - Fluent'];
  const DROPDOWNS = {
    country: ['Australia', 'New Zealand', 'United Kingdom'],
    countryRegion: ['New South Wales', 'Queensland', 'Victoria'],
    phoneType: ['Landline', 'Mobile'],
    degree: ['Bachelor of Science (B.S)', 'Master of Science (M.S)', 'Doctorate (PhD)'],
    language: ['English', 'French', 'German', 'Spanish'],
  };
  const PROMPTS = {
    countryPhoneCode: ['Australia (+61)', 'Austria (+43)', 'New Zealand (+64)'],
    fieldOfStudy: ['Computer and Information Science', 'Information Systems', 'Information Technology'],
  };

  // Single-select dropdowns: click the button → render role="option" items.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button[aria-haspopup="listbox"]');
    if (!btn) return;
    document.querySelectorAll('.mock-listbox').forEach((x) => x.remove());
    const ul = document.createElement('ul');
    ul.className = 'mock-listbox';
    ul.setAttribute('role', 'listbox');
    for (const text of DROPDOWNS[btn.getAttribute('name')] || LEVELS) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = text;
      li.addEventListener('click', () => { btn.textContent = text; ul.remove(); });
      ul.appendChild(li);
    }
    document.body.appendChild(ul);
  });

  // Prompt / multiselect: Enter in the search box → results; clicking one adds a pill.
  const pillHtml = (text) =>
    `<li><div data-automation-id="selectedItem" aria-label="${text}"><div data-automation-id="DELETE_charm"></div>` +
    `<p data-automation-id="promptOption" data-automation-label="${text}">${text}</p></div></li>`;
  document.addEventListener('keydown', (e) => {
    const input = e.target;
    const container = input.closest?.('[data-automation-id="multiSelectContainer"]');
    if (e.key !== 'Enter' || !container) return;
    const kind = Object.keys(PROMPTS).find((k) => input.id.endsWith(`--${k}`));
    const q = input.value.toLowerCase().split(' ')[0];
    const box = document.createElement('div');
    box.className = 'mock-prompt';
    for (const text of (PROMPTS[kind] || []).filter((t) => t.toLowerCase().includes(q))) {
      const opt = document.createElement('div');
      opt.setAttribute('data-automation-id', 'promptOption');
      opt.setAttribute('data-automation-label', text);
      opt.textContent = text;
      opt.addEventListener('click', () => {
        let ul = container.querySelector('[data-automation-id="selectedItemList"]');
        if (!ul) {
          ul = document.createElement('ul');
          ul.setAttribute('data-automation-id', 'selectedItemList');
          container.appendChild(ul);
        }
        ul.insertAdjacentHTML('beforeend', pillHtml(text));
        box.remove();
      });
      box.appendChild(opt);
    }
    document.body.appendChild(box);
  }, true);
  document.addEventListener('click', (e) => {
    const del = e.target.closest?.('[data-automation-id="DELETE_charm"]');
    if (del) del.closest('li')?.remove();
  });

  // Add / Add Another: clone a template entry with fresh ids, like Workday does.
  let uid = 500;
  document.addEventListener('click', (e) => {
    const add = e.target.closest?.('[data-automation-id="add-button"]');
    if (!add) return;
    const section = add.closest('[role="group"][aria-labelledby$="-section"]');
    const name = section.getAttribute('aria-labelledby').replace(/-section$/, '');
    const tpl = (window.__panelTemplates || {})[name];
    if (!tpl) return;
    const n = section.querySelectorAll('[aria-labelledby$="-panel"]').length + 1;
    const id = ++uid;
    const html = tpl
      .replace(/([A-Za-z]+)-\d+--/g, (_, p) => `${p}-${id}--`)
      .replace(new RegExp(`${name}-\\d+-panel`, 'g'), `${name}-${n}-panel`)
      .replace(/(<h5[^>]*>)([^<]*?)\s\d+(<\/h5>)/, `$1$2 ${n}$3`);
    setTimeout(() => {
      add.closest('.css-1ebprri').insertAdjacentHTML('beforebegin', html);
      add.textContent = 'Add Another';
    }, 120);
  });
};

// Remember one empty entry per section so "Add" can clone it later.
window.registerPanelTemplate = function registerPanelTemplate(sectionName, panelHtml) {
  (window.__panelTemplates ||= {})[sectionName] = panelHtml;
};
