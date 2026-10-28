// DOM helpers shared by the engine modules.
// Every engine file adds to the same namespace (window.__wdA) and is injected
// in order by background.js: dom → page → fields → sections → index.
(() => {
  const WD = (window.__wdA ||= {});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isVisible = (el) => !!el && el.getClientRects().length > 0;
  const has = (v) => v !== undefined && v !== null && v !== '';
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));

  const waitFor = async (fn, timeout = 3000, step = 100) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const r = fn();
      if (r) return r;
      await sleep(step);
    }
    return null;
  };

  // React-controlled inputs ignore `el.value = x` (React tracks the last value it
  // set), so call the native prototype setter and then fire input/change.
  const setNativeValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Workday commits a field to its form state on blur (React's onBlur listens for
  // `focusout`). While the extension popup has focus the page window doesn't, and
  // Chrome then skips native focus/blur events — so dispatch them explicitly.
  const focusIn = (el) => {
    try { el.focus({ preventScroll: true }); } catch {}
    el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  };
  const focusOut = (el) => {
    el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    try { el.blur(); } catch {}
  };

  // Type-like sequence: focus → set value (input/change) → key events → blur.
  const commitText = async (el, value) => {
    focusIn(el);
    setNativeValue(el, value);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Unidentified', bubbles: true }));
    await sleep(30);
    focusOut(el);
  };

  // Character-by-character typing (Workday's date spin buttons react to key presses).
  const typeChars = async (el, text) => {
    focusIn(el);
    setNativeValue(el, '');
    for (const ch of String(text)) {
      const o = { key: ch, code: /\d/.test(ch) ? `Digit${ch}` : undefined, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', o));
      el.dispatchEvent(new KeyboardEvent('keypress', o));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, el.value + ch);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
      el.dispatchEvent(new KeyboardEvent('keyup', o));
      await sleep(25);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const realClick = (el) => {
    const o = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.click();
  };

  const pressKey = (el, key) => {
    const o = { key, code: key, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  };

  // Exact text match, then starts-with, then contains.
  const bestMatch = (els, text, getText = (e) => e.textContent) => {
    const t = norm(text);
    return (
      els.find((e) => norm(getText(e)) === t) ||
      els.find((e) => norm(getText(e)).startsWith(t)) ||
      els.find((e) => norm(getText(e)).includes(t)) ||
      null
    );
  };

  const labelForInput = (input) => {
    const l = input.id && document.querySelector(`label[for="${cssEsc(input.id)}"]`);
    return (l || input.closest('label'))?.textContent?.trim() || input.value;
  };

  function toast(msg, ok = true) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 2147483647, maxWidth: '360px',
      padding: '10px 14px', borderRadius: '8px', font: '14px system-ui, sans-serif',
      color: '#fff', background: ok ? '#1e7d32' : '#b3261e', boxShadow: '0 4px 12px rgba(0,0,0,.25)',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  Object.assign(WD, {
    sleep, norm, isVisible, has, cssEsc, waitFor, setNativeValue, focusIn, focusOut,
    commitText, typeChars, realClick, pressKey, bestMatch, labelForInput, toast,
  });
})();
