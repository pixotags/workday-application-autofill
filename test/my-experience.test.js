// Page 2 — "My Experience": repeating sections (Add / Add Another), dates, textarea, prompt.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openFixture, capture, fill, profileFrom } = require('./helpers/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('capture groups repeating entries by section heading and field label', async () => {
  const snap = await capture(await openFixture(browser, 'my-experience.filled.html'));
  assert.equal(snap.pageId, 'applyFlowMyExpPage');
  assert.equal(snap.sections['Professional Experience'].length, 4);
  assert.equal(snap.sections.Education.length, 2);
  assert.deepEqual(snap.sections['Professional Experience'][0], {
    'Job Title': 'Software Engineer',
    Company: 'Example Health Co',
    Location: 'Sydney, NSW',
    'I currently work here': false,
    From: '7/2023',
    To: '9/2026',
    'Role Description': '- Built example features for an example product.\n- Improved an example metric by an example amount.',
  });
  assert.deepEqual(snap.sections.Education[0], {
    'School or University': 'Example University of Technology',
    Degree: 'Master of Science (M.S)',
    'Field of Study': 'Information Technology',
  });
  assert.deepEqual(snap.fields, { linkedInAccount: 'https://www.linkedin.com/in/example-candidate' });
});

test('round trip: fills a blank page, clicking "Add Another" for the 4th job', async () => {
  const expected = await capture(await openFixture(browser, 'my-experience.filled.html'));
  const page = await openFixture(browser, 'my-experience.blank.html', { mocks: true });
  const result = await fill(page, profileFrom(expected));
  assert.equal(result.failed, 0, JSON.stringify(result.results.filter((r) => r.status !== '✅'), null, 2));
  const after = await capture(page);
  assert.deepEqual(after.sections, expected.sections);
  assert.deepEqual(after.fields, expected.fields);
  assert.deepEqual(page.errors, []);
});

test('date spin buttons receive real digit key presses', async () => {
  const page = await openFixture(browser, 'my-experience.blank.html', { mocks: true });
  await page.evaluate(() => {
    window.digits = 0;
    document.addEventListener('keydown', (e) => { if (/^\d$/.test(e.key)) window.digits++; }, true);
  });
  await fill(page, { pages: { applyFlowMyExpPage: { sections: { 'Professional Experience': [{ From: '7/2023', To: '12/2024' }] } } } });
  // "7" + "2023" + "12" + "2024" = 11 digits
  assert.equal(await page.evaluate(() => window.digits), 11);
});

test('second run neither adds entries nor changes values', async () => {
  const expected = await capture(await openFixture(browser, 'my-experience.filled.html'));
  const page = await openFixture(browser, 'my-experience.blank.html', { mocks: true });
  await fill(page, profileFrom(expected));
  const second = await fill(page, profileFrom(expected));
  assert.equal(second.filled, 0);
  const count = await page.evaluate(() =>
    document.querySelectorAll('[aria-labelledby^="Professional-Experience-"][aria-labelledby$="-panel"]').length);
  assert.equal(count, 4);
});

test('languages: adds entries from an empty section and fills them by label', async () => {
  const lvl = (c, o, r, s, w) => ({ Comprehension: c, Overall: o, Reading: r, Speaking: s, Writing: w });
  const languages = [
    { Language: 'German', 'I am fluent in this language.': false, ...lvl('3 - Intermediate', '3 - Intermediate', '3 - Intermediate', '3 - Intermediate', '2 - Classroom Study') },
    { Language: 'English', 'I am fluent in this language.': true, ...lvl('5 - Fluent', '5 - Fluent', '5 - Fluent', '5 - Fluent', '5 - Fluent') },
  ];
  const page = await openFixture(browser, 'my-experience.blank.html', { mocks: true, templates: { Languages: 'languages.blank.html' } });
  const r = await fill(page, { pages: { applyFlowMyExpPage: { sections: { Languages: languages } } } });
  assert.equal(r.failed, 0, JSON.stringify(r.results, null, 2));
  assert.deepEqual((await capture(page)).sections.Languages, languages);
});

test('capture of a filled language entry uses on-screen labels as keys', async () => {
  const page = await openFixture(browser, 'languages.filled.html');
  const { sections } = await capture(page);
  assert.deepEqual(Object.keys(sections.Languages[0]), [
    'Language', 'I am fluent in this language.', 'Comprehension', 'Overall', 'Reading', 'Speaking', 'Writing',
  ]);
});
