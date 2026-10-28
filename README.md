# Workday Application Autofill

Chrome extension that fills Workday job applications from a local JSON profile, including work history, education, dates and dropdowns.


[![CI](https://github.com/pixotags/workday-application-autofill/actions/workflows/ci.yml/badge.svg)](https://github.com/pixotags/workday-application-autofill/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-1A4C49)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A Chrome extension that fills Workday job applications from a profile you keep in your own browser — including the pages that change every time, like Work Experience entries and per-job application questions.

<!-- Record a short screen capture of a real application filling itself, save it as docs/demo.gif, then uncomment:
![Demo](docs/demo.gif)
-->

## Why

Hundreds of employers use Workday for job applications, and every one of them asks for the same 40-odd fields from scratch: name, address, phone, every past job with dates and descriptions, education, languages. Browser autofill doesn't help — Workday's fields are React components that ignore it, and half of them are custom dropdowns, search boxes and date spinners.

This extension fills them the way a person would, then leaves you to review and click **Save and Continue**.

## Features

- **Works across the whole application flow** — detects which step you're on (My Information, My Experience, Application Questions…) and fills only what's there.
- **Repeating sections** — clicks **Add / Add Another** until there are enough Work Experience, Education or Language entries, then fills each one.
- **Every Workday field type** — text, text areas, Yes/No radios, checkboxes, single-select dropdowns, search-and-pick prompts (incl. nested `Category > Option`), and month/year date spinners.
- **Learns new pages** — fill a page by hand once, click **Capture this page**, and it's saved to your profile.
- **Per-job questions by wording** — `"how much notice": "4 weeks"` answers any question whose label contains that text.
- **Safe to re-run** — fields already correct are skipped; entries are never duplicated.
- **Never submits** — it doesn't click Next or Submit; you review every page.

## Install

1. Download the latest `workday-application-autofill-v*.zip` from [Releases](../../releases) and unzip it (or clone this repo and use the `extension/` folder).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the folder.
3. Pin the extension from the puzzle-piece menu.

## Quick start

1. Click the extension → **Edit / load / export profile** → load [`examples/sample-profile.json`](examples/sample-profile.json), replace the placeholder values with your own, and **Save**.
2. Open a Workday application and click **Fill this page** (or press **Alt+Shift+F**).
3. On a page your profile doesn't cover yet, fill it in by hand and click **Capture this page**. Next time, it fills itself.

## Profile format

```jsonc
{
  "pages": {
    "applyFlowMyInfoPage": {                       // page id, shown in the popup
      "fields": { "legalName--firstName": "Jane", "countryRegion": "New South Wales" }
    },
    "applyFlowMyExpPage": {
      "sections": {                                // repeating entries, matched by section heading
        "Professional Experience": [
          { "Job Title": "Software Engineer", "Company": "Example Pty Ltd", "From": "7/2023", "To": "9/2026" }
        ]
      }
    }
  },
  "questions": { "how much notice": "4 weeks" }   // matched by label text on any page
}
```

| Value | Field type |
|---|---|
| `"text"` | text box, text area |
| `"Yes"` / `"No"` / `true` / `false` | radio, checkbox |
| `"Option text"` | dropdown, search prompt (exact → starts-with → contains) |
| `"Category > Option"` | nested prompt (e.g. *How did you hear about us?*) |
| `["A", "B"]` | multi-select prompt, checkbox group |
| `"MM/YYYY"`, `"DD/MM/YYYY"` | date |

## How it works

The interesting part was getting Workday to *accept* the values, not just display them.

**React ignores `input.value = x`.** React tracks the last value it rendered, so setting `value` directly is reverted on the next render. The engine calls the native `HTMLInputElement.prototype.value` setter and then dispatches `input` and `change`, which React treats as user input.

**Workday only saves a field when it loses focus.** Values typed by the extension appeared on screen but validation still said *required*. Workday commits each field in its `onBlur` handler (React listens for `focusout`). When you click the extension's popup, the Workday tab isn't focused, and Chrome silently skips native focus/blur events for an unfocused window. The engine now dispatches `focusin`/`focusout` itself around every field — there's a test that disables native focus to prove it.

**Repeating entries have generated ids.** In Work Experience, each entry's fields get ids like `workExperience-19--jobTitle`, and some fields are named by 32-character hashes. So entries are matched by **section heading + on-screen label** instead, which also makes the saved profile human-readable.

**Date fields are spin buttons, not inputs.** Month and year are separate `role="spinbutton"` elements driven by key presses, so dates are typed one digit at a time with real `keydown`/`keyup` events.

More detail in [`docs/architecture.md`](docs/architecture.md).

## Privacy & permissions

- Your profile is stored only in `chrome.storage.local` on your machine. The extension makes **no network requests** and has no analytics.
- `activeTab` + `scripting` — to run the filler on the tab you click it on.
- `storage` — to keep your profile.
- Host access to `*.myworkdayjobs.com`, `*.myworkday.com`, `*.workday.com` — so the keyboard shortcut works on Workday pages without opening the popup.

## Limitations

- **Resume upload** must be done by hand — browsers don't let extensions choose files.
- **Never clicks Next/Submit** — by design.
- **Dates** depend on Workday's spin-button implementation and are the most likely thing to break if Workday changes its UI.
- Each employer configures its own questions and dropdown options; values must match an option's text.

Found a field it misses? [Open an issue](../../issues/new?template=field-not-filled.md) with the field's HTML (with personal details removed).

## Development

```bash
npm install
npx playwright install chromium
npm run check   # syntax + JSON + version checks
npm test        # Playwright tests against saved Workday HTML
npm run build   # zip extension/ into dist/
```

Tests load sanitised snapshots of real Workday pages from [`test/fixtures/`](test/fixtures), add stand-ins for the widgets that only exist on the live site ([`test/helpers/workday-mocks.js`](test/helpers/workday-mocks.js)), and check that **capture → fill a blank page → capture** gives back exactly the same data.

Releases: bump the version in `package.json` and `extension/manifest.json`, update `CHANGELOG.md`, then `git tag v1.x.y && git push --tags`.

## Disclaimer

Not affiliated with, endorsed by, or sponsored by Workday, Inc. "Workday" is a trademark of its owner, used here only to describe compatibility. Use it on your own applications and review everything before submitting.

## License

[MIT](LICENSE)
