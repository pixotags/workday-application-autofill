# Changelog

All notable changes to this project. Versions follow [Semantic Versioning](https://semver.org/).

## [1.5.0] — 2026-10-28
### Changed
- Engine split into modules (`dom`, `page`, `fields`, `sections`, `index`), injected in order — no bundler needed.
- Engine is injected once per tab; later clicks reuse it.

### Added
- Automated tests: sanitised Workday HTML fixtures + Playwright, run in CI on every push.
- Release workflow: pushing a `v*` tag attaches the zipped extension to a GitHub release.
- Extension icons.

## [1.4.0] — 2026-10-27
### Added
- Date fields (`MM/YYYY`, `DD/MM/YYYY`) filled with real digit key presses, which Workday's spin buttons require.
- Field of Study and other search-and-pick fields inside repeating entries.

## [1.3.0] — 2026-10-27
### Added
- Repeating sections (Work Experience, Education, Languages…): clicks **Add / Add Another** until there are enough entries, then fills each entry by field label.
- Capture saves sections as `{ "Section": [ { "Label": value } ] }`.

## [1.2.0] — 2026-10-27
### Fixed
- Workday validation saw filled fields as empty. Workday commits values on `focusout`, which Chrome doesn't fire while the extension popup has focus; the engine now dispatches focus events itself.

## [1.1.0] — 2026-10-27
### Fixed
- Page detection picked the outer `applyFlowPage` wrapper instead of the step (`applyFlowMyInfoPage`), so nothing filled.

### Added
- Fill also tries fields saved under other pages, so mis-named pages still fill.
- Capture shows what it saved and copies it to the clipboard.

## [1.0.0] — 2026-10-27
### Added
- Popup with Fill / Capture / Copy page as JSON; options page to load, edit and export the profile.
- Fills text, radio, checkbox, dropdown and prompt fields on Workday's "My Information" page.
- `questions` matched by label text for per-job application questions.
- Keyboard shortcut Alt+Shift+F.
