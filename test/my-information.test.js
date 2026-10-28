// Page 1 — "My Information": text inputs, radio, dropdowns, prompt, checkboxes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openFixture, capture, fill, profileFrom } = require('./helpers/harness');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('detects the inner step page, not the outer applyFlowPage wrapper', async () => {
  const page = await openFixture(browser, 'my-info.filled.html');
  assert.equal(await page.evaluate(() => window.__wdAutofill.pageId()), 'applyFlowMyInfoPage');
});

test('capture reads every filled value', async () => {
  const page = await openFixture(browser, 'my-info.filled.html');
  const { fields } = await capture(page);
  assert.deepEqual(fields, {
    candidateIsPreviousWorker: 'No',
    country: 'Australia',
    'legalName--firstName': 'Jane',
    'legalName--lastName': 'Citizen',
    preferredCheck: false,
    addressLine1: '12 Example Street',
    city: 'Parramatta',
    countryRegion: 'New South Wales',
    postalCode: '2150',
    phoneType: 'Mobile',
    countryPhoneCode: 'Australia (+61)',
    phoneNumber: '0400000000',
    '[data-automation-id="phone-sms-opt-in"]': false,
    '[data-automation-id="phone-whatsapp-opt-in"]': false,
  });
});

test('round trip: capture a filled page, fill a blank one, get the same values', async () => {
  const expected = await capture(await openFixture(browser, 'my-info.filled.html'));
  const page = await openFixture(browser, 'my-info.blank.html', { mocks: true });
  const result = await fill(page, profileFrom(expected));
  assert.equal(result.failed, 0, JSON.stringify(result.results, null, 2));
  assert.deepEqual((await capture(page)).fields, expected.fields);
  assert.deepEqual(page.errors, []);
});

test('fill is idempotent: a second run changes nothing', async () => {
  const expected = await capture(await openFixture(browser, 'my-info.filled.html'));
  const page = await openFixture(browser, 'my-info.blank.html', { mocks: true });
  await fill(page, profileFrom(expected));
  const second = await fill(page, profileFrom(expected));
  assert.equal(second.filled, 0);
});

test('values are committed via focusout even when the window has no focus', async () => {
  // Workday stores a value when the field fires focusout (React onBlur). With the
  // extension popup open, Chrome skips native focus events, so the engine must
  // dispatch them itself. Simulate that by disabling native focus()/blur().
  const page = await openFixture(browser, 'my-info.blank.html', { noNativeFocus: true });
  await page.evaluate(() => {
    window.committed = {};
    document.addEventListener('focusout', (e) => { if (e.target.id) window.committed[e.target.id] = e.target.value; });
  });
  await fill(page, { pages: { applyFlowMyInfoPage: { fields: { 'legalName--firstName': 'Jane', city: 'Parramatta' } } } });
  const committed = await page.evaluate(() => window.committed);
  assert.equal(committed['name--legalName--firstName'], 'Jane');
  assert.equal(committed['address--city'], 'Parramatta');
});

test('prompt field replaces an existing selection', async () => {
  const page = await openFixture(browser, 'my-info.blank.html', { mocks: true });
  const r = await fill(page, { pages: { applyFlowMyInfoPage: { fields: { countryPhoneCode: 'New Zealand (+64)' } } } });
  assert.equal(r.failed, 0);
  assert.equal((await capture(page)).fields.countryPhoneCode, 'New Zealand (+64)');
});

test('profile saved under an old page name still fills (fallback across pages)', async () => {
  const expected = await capture(await openFixture(browser, 'my-info.filled.html'));
  const page = await openFixture(browser, 'my-info.blank.html', { mocks: true });
  const r = await fill(page, { pages: { applyFlowPage: { fields: expected.fields } } });
  assert.equal(r.failed, 0);
  assert.deepEqual((await capture(page)).fields, expected.fields);
});
