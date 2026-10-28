# Architecture

```
popup / keyboard shortcut
        │  chrome.runtime.sendMessage({ cmd: 'fill' | 'capture' | ... })
        ▼
background.js (service worker)
        │  1. is the engine already in this tab?   (window.__wdAutofill)
        │  2. if not, inject ENGINE_FILES in order
        │  3. call window.__wdAutofill.fill(profile) / capture()
        ▼
Workday tab (isolated world)
  engine/dom.js       focus/value/keyboard helpers, toast
  engine/page.js      which step am I on? what fields exist? resolve profile keys
  engine/fields.js    detect each field's type, fill it, read it back
  engine/sections.js  repeating entries: Add / Add Another, match by label
  engine/index.js     fill() and capture(): the public API
```

Modules share one namespace (`window.__wdA`) and are injected as plain scripts in the order listed in `engine/files.js`, so there is no build step — `extension/` is exactly what Chrome loads.

## Fill order

1. `actions` for the page (optional clicks).
2. `sections` — add entries if needed, then fill each entry by label.
3. `fields` for the current page.
4. `common` fields and fields saved under **other** pages — only if present here (covers renamed page ids).
5. `questions` — any remaining field whose label contains the question text.

Each field is filled at most once per run.

## Finding a field from a profile key

| Key | Resolves to |
|---|---|
| `legalName--firstName` | `[data-automation-id="formField-legalName--firstName"]` |
| `jobTitle#2` | the 2nd such field |
| `[data-automation-id="phone-sms-opt-in"]` | raw CSS selector |
| `name--legalName--firstName` | element id → nearest `formField-*` |
| inside a section entry: `Comprehension` | field whose label is / starts with / contains the key |

## Field types

`detectType()` looks at what is inside each `formField-*` wrapper:

| Contains | Type | How it's filled |
|---|---|---|
| `input[type=radio]` | radio | click the matching value or label |
| `[data-automation-id^="dateSection"]` | date | type digits into each spin button |
| `multiSelectContainer` | prompt | type search text, Enter, click result; supports `A > B` paths |
| `button[aria-haspopup=listbox]` | dropdown | open, find option (type-ahead + scroll for long lists), click |
| one / many checkboxes | checkbox / group | click to reach the wanted state |
| `input` / `textarea` | text | native setter + input/change + focus events |
| `input[type=file]` | file | skipped — must be done by hand |

## Why focus events are dispatched manually

Workday stores a field's value in its `onBlur` handler. React 17+ implements `onBlur` with a delegated `focusout` listener. When the extension popup is open, the Workday window is not focused, and Chrome does not fire native `focus`/`blur`/`focusout` for elements in an unfocused window — so values appeared on screen but were never stored. Every filler therefore wraps its change in `focusIn()` / `focusOut()`, which dispatch the events directly. `test/my-information.test.js` disables native `focus()`/`blur()` to cover this.
