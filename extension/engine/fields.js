// Field-type detection, one filler per Workday widget, and value reading.
// Every filler returns [status, note] where status is ✅ ⏭ ⚠️ or ❌.
(() => {
  const WD = (window.__wdA ||= {});
  const {
    sleep, norm, isVisible, has, cssEsc, waitFor, setNativeValue, focusIn, focusOut,
    commitText, typeChars, realClick, pressKey, bestMatch, labelForInput,
  } = WD;

  function detectType(c) {
    if (c.matches('input[type=checkbox]')) return 'checkbox';
    if (c.matches('input[type=radio]')) return 'radio';
    if (c.matches('textarea, input')) return 'text';
    if (c.querySelector('input[type=radio]')) return 'radio';
    if (c.querySelector('[data-automation-id^="dateSection"]')) return 'date';
    if (c.querySelector('[data-automation-id="multiSelectContainer"]')) return 'prompt';
    if (c.querySelector('button[aria-haspopup="listbox"]')) return 'dropdown';
    const cbs = c.querySelectorAll('input[type=checkbox]');
    if (cbs.length === 1) return 'checkbox';
    if (cbs.length > 1) return 'checkboxGroup';
    if (c.querySelector('input[type=file]')) return 'file';
    if (c.querySelector('textarea, input:not([type]), input[type=text], input[type=email], input[type=tel], input[type=number], input[type=url]')) return 'text';
    return 'unknown';
  }

  const textInputOf = (c) =>
    c.matches('input,textarea') ? c : c.querySelector('textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])');
  const isChecked = (el) => !!el && (el.checked || el.getAttribute('aria-checked') === 'true');

  async function fillText(c, value) {
    const el = textInputOf(c);
    if (!el) return ['❌', 'no input'];
    if (el.value === String(value)) {
      // Looks filled but may never have been committed (e.g. by an earlier run) — re-commit.
      focusIn(el); focusOut(el);
      return ['⏭', 'already set'];
    }
    await commitText(el, String(value));
    await sleep(80);
    return ['✅', String(value)];
  }

  async function fillRadio(c, value) {
    const radios = c.matches('input[type=radio]')
      ? [...document.querySelectorAll(`input[type=radio][name="${cssEsc(c.name)}"]`)]
      : [...c.querySelectorAll('input[type=radio]')];
    const v = String(value);
    let target = radios.find((r) => r.value === v) || bestMatch(radios, v, labelForInput);
    if (!target && /^(yes|no)$/i.test(v)) target = radios.find((r) => r.value === String(/^yes$/i.test(v)));
    if (!target) return ['❌', `no option "${v}"`];
    if (isChecked(target)) return ['⏭', 'already set'];
    focusIn(target);
    realClick(target);
    focusOut(target);
    await sleep(150);
    return ['✅', labelForInput(target)];
  }

  async function fillCheckbox(c, value) {
    const el = c.matches('input[type=checkbox]') ? c : c.querySelector('input[type=checkbox]');
    if (!el) return ['❌', 'no checkbox'];
    const want = value === true || /^(true|yes|1)$/i.test(String(value));
    if (isChecked(el) === want) return ['⏭', 'already set'];
    focusIn(el);
    realClick(el);
    focusOut(el);
    await sleep(200);
    return ['✅', String(want)];
  }

  async function fillCheckboxGroup(c, value) {
    const wanted = (Array.isArray(value) ? value : [value]).map(norm);
    const changed = [];
    for (const cb of c.querySelectorAll('input[type=checkbox]')) {
      const label = norm(labelForInput(cb));
      const want = wanted.some((w) => label === w || label.startsWith(w));
      if (isChecked(cb) !== want) { realClick(cb); changed.push(label); await sleep(120); }
    }
    return changed.length ? ['✅', changed.join(', ')] : ['⏭', 'already set'];
  }

  const visibleOptions = (sel) =>
    [...document.querySelectorAll(sel)].filter(isVisible).filter((o) => !o.closest('[data-automation-id="selectedItemList"]'));

  // Single-select: <button aria-haspopup="listbox"> that opens role="option" items.
  async function fillDropdown(c, text) {
    const btn = c.matches('button') ? c : c.querySelector('button[aria-haspopup="listbox"]');
    if (!btn) return ['❌', 'no dropdown'];
    if (norm(btn.textContent) === norm(text)) return ['⏭', 'already set'];
    focusIn(btn);
    realClick(btn);
    const find = () => {
      const opts = visibleOptions('[role="option"]');
      return opts.length ? bestMatch(opts, text) : null;
    };
    let opt = await waitFor(find, 2000);
    if (!opt) {
      // Long lists (e.g. Language) may only render part of the list:
      // type-ahead the first letters, then scroll through it.
      const lb = [...document.querySelectorAll('[role="listbox"]')].filter(isVisible).pop();
      if (lb) {
        for (const ch of String(text).slice(0, 3)) {
          (document.activeElement || lb).dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await sleep(60);
        }
        opt = await waitFor(find, 800);
        for (let i = 0; !opt && i < 40 && lb.scrollTop + lb.clientHeight < lb.scrollHeight; i++) {
          lb.scrollTop += Math.max(lb.clientHeight, 100);
          lb.dispatchEvent(new Event('scroll', { bubbles: true }));
          await sleep(120);
          opt = find();
        }
      }
    }
    if (!opt) { pressKey(btn, 'Escape'); return ['❌', `no option "${text}"`]; }
    realClick(opt);
    await sleep(300);
    focusOut(btn);
    return ['✅', opt.textContent.trim()];
  }

  // Prompt / multiselect. Value: "Australia (+61)", ["A", "B"], or a path "Job Board > Seek".
  async function fillPrompt(c, value) {
    const input = c.querySelector('[data-automation-id="multiSelectContainer"] input') || c.querySelector('input');
    if (!input) return ['❌', 'no input'];
    const container = input.closest('[data-automation-id="multiSelectContainer"]') || c;
    const wanted = Array.isArray(value) ? value : [value];
    const pills = () => [...container.querySelectorAll('[data-automation-id="selectedItem"]')];
    const leaf = (v) => String(v).split('>').pop().trim();

    const current = pills().map((p) => norm(p.textContent));
    if (current.length === wanted.length && wanted.every((w) => current.some((t) => t.includes(norm(leaf(w))))))
      return ['⏭', 'already set'];

    for (const p of pills()) {
      const t = norm(p.textContent);
      if (!wanted.some((w) => t.includes(norm(leaf(w))))) {
        const del = p.querySelector('[data-automation-id="DELETE_charm"]');
        if (del) { realClick(del); await sleep(200); }
      }
    }

    const picked = [];
    for (const w of wanted) {
      if (pills().some((p) => norm(p.textContent).includes(norm(leaf(w))))) continue;
      const path = String(w).split('>').map((s) => s.trim()).filter(Boolean);
      focusIn(input);
      if (path.length === 1) {
        // Type to search: "Australia (+61)" → "Australia"
        setNativeValue(input, path[0].replace(/\s*\(.*?\)\s*/g, ' ').trim() || path[0]);
        pressKey(input, 'Enter');
      } else {
        realClick(input); // open the category list
      }
      let ok = true;
      for (const step of path) {
        const opt = await waitFor(() => {
          const opts = visibleOptions('[data-automation-id="promptOption"]');
          return opts.length ? bestMatch(opts, step, (o) => o.getAttribute('data-automation-label') || o.textContent) : null;
        }, 4000);
        if (!opt) { ok = false; break; }
        realClick(opt);
        await sleep(400);
      }
      pressKey(input, 'Escape');
      focusOut(input);
      if (!ok) return ['❌', `no option "${w}"`];
      picked.push(leaf(w));
    }
    document.body.click();
    await sleep(200);
    return ['✅', picked.join(', ') || 'set'];
  }

  // Dates: "DD/MM/YYYY", "MM/YYYY" or "YYYY", mapped onto whichever spin buttons the field shows.
  const dateParts = (c) => {
    const get = (n) => c.querySelector(`[data-automation-id="dateSection${n}-input"], input[data-automation-id="dateSection${n}"]`);
    return { day: get('Day'), month: get('Month'), year: get('Year') };
  };

  async function fillDate(c, value) {
    const parts = String(value).split(/[\/\-.]/).map((s) => s.trim());
    const { day, month, year } = dateParts(c);
    let d, m, y;
    if (parts.length === 3) [d, m, y] = parts;
    else if (parts.length === 2) [m, y] = parts;
    else [y] = parts;
    const current = [day?.value, month?.value, year?.value].filter(Boolean).map(Number).join('/');
    const wanted = [d, m, y].filter(has).map(Number).join('/');
    if (current && current === wanted) return ['⏭', 'already set'];
    for (const [el, v] of [[day, d], [month, m], [year, y]]) {
      if (!el || !has(v)) continue;
      const display = el.parentElement?.querySelector('[data-automation-id$="-display"]');
      if (display) realClick(display); // click the visible "MM"/"YYYY" overlay, as a person would
      await typeChars(el, String(Number(v)));
      await sleep(120);
      focusOut(el);
    }
    return ['✅', String(value)];
  }

  async function fillField(c, value) {
    switch (detectType(c)) {
      case 'text': return fillText(c, value);
      case 'radio': return fillRadio(c, value);
      case 'checkbox': return fillCheckbox(c, value);
      case 'checkboxGroup': return fillCheckboxGroup(c, value);
      case 'dropdown': return fillDropdown(c, value);
      case 'prompt': return fillPrompt(c, value);
      case 'date': return fillDate(c, value);
      case 'file': return ['⚠️', 'file uploads must be done by hand'];
      default: return ['❌', 'unknown field type'];
    }
  }

  function readValue(c, type) {
    switch (type) {
      case 'text': return textInputOf(c)?.value ?? '';
      case 'radio': {
        const r = [...(c.matches('input') ? [c] : c.querySelectorAll('input[type=radio]'))].find(isChecked);
        return r ? labelForInput(r) : '';
      }
      case 'checkbox': return isChecked(c.matches('input') ? c : c.querySelector('input[type=checkbox]'));
      case 'checkboxGroup': return [...c.querySelectorAll('input[type=checkbox]')].filter(isChecked).map(labelForInput);
      case 'dropdown': {
        const t = c.querySelector('button[aria-haspopup="listbox"]')?.textContent.trim() || '';
        return /^select one$/i.test(t) ? '' : t;
      }
      case 'prompt': {
        const p = [...c.querySelectorAll('[data-automation-id="selectedItem"]')].map((x) => x.textContent.trim());
        return p.length > 1 ? p : p[0] || '';
      }
      case 'date': {
        const { day, month, year } = dateParts(c);
        return [day?.value, month?.value, year?.value].filter(Boolean).join('/');
      }
      default: return '';
    }
  }

  Object.assign(WD, { detectType, fillField, readValue });
})();
