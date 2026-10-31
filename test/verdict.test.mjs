import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../extension/src/core/verdict.js';
import { addAllow } from '../extension/src/core/state.js';
import { makeData, NOW, state } from './helpers.mjs';

const check = (url, st = state(), data = makeData()) => evaluate(url, { state: st, data, now: NOW });

test('official and popular sites pass quietly', () => {
  for (const u of ['https://www.paypal.com/signin', 'https://mail.google.com/', 'https://google.de/', 'https://news.bbc.co.uk/', 'https://en.wikipedia.org/wiki/X']) {
    const v = check(u);
    assert.equal(v.level, 'none', u);
    assert.equal(v.action, 'none', u);
  }
});

test('the example from the brief: same name, different ending', () => {
  const v = check('https://paypal.site/');
  assert.equal(v.level, 'warning');
  assert.equal(v.action, 'block');
  assert.equal(v.findings[0].rule, 'same-name');
  assert.deepEqual(v.real, [{ domain: 'paypal.com', brand: 'PayPal' }]);
});

test('look-alike characters, typos, brand words, tricky subdomains', () => {
  const cases = {
    'https://paypa1.com/': 'lookalike-characters',
    'https://faceb00k.com/': 'lookalike-characters',
    'https://paypall.com/': 'typo',
    'https://paypal-login.com/': 'brand-in-name',
    'https://paypal.com.secure-check.xyz/': 'brand-in-subdomain',
    'https://bkash.site/': 'same-name',
    'https://paypal-login.github.io/': 'brand-in-name',
  };
  for (const [u, rule] of Object.entries(cases)) {
    const v = check(u);
    assert.equal(v.action, 'block', u);
    assert.ok(v.findings.some((f) => f.rule === rule), `${u} -> ${v.findings.map((f) => f.rule)}`);
    assert.ok(v.real.length >= 1, u);
  }
});

test('ordinary unknown sites are left alone', () => {
  for (const u of ['https://my-cooking-blog.xyz/', 'https://paypalm-trees.com/', 'https://localhost:3000/', 'http://192.168.1.5/', 'chrome://settings', 'https://intranet.local/']) {
    assert.equal(check(u).action, 'none', u);
  }
});

test('brand word without a risk word is only a caution (apple-pie-recipes)', () => {
  const v = check('https://apple-pie-recipes.com/');
  assert.equal(v.level, 'caution');
  assert.equal(v.action, 'badge');
});

test('domain present in the larger list lowers confidence one step', () => {
  const v = check('https://paypal.shop/');
  assert.equal(v.tier, 'extended');
  assert.equal(v.level, 'caution');
  assert.equal(v.action, 'badge');
});

test('strict mode blocks cautions too', () => {
  const st = state({ settings: { enabled: true, blockCaution: true, disclaimerAccepted: true } });
  assert.equal(check('https://paypal.shop/', st).action, 'block');
});

test('international characters alone are a caution', () => {
  const v = check('https://xn--pypal-4ve.com/');
  assert.equal(v.findings[0].rule, 'international-characters');
  assert.equal(v.action, 'badge');
});

test('person\'s own list wins and supplies the real site', () => {
  const st = state({ userList: [{ fake: 'something.site', real: 'something.com', addedAt: 0 }] });
  const v = check('https://www.something.site/offer', st);
  assert.equal(v.level, 'danger');
  assert.equal(v.findings[0].rule, 'user-list');
  assert.deepEqual(v.real, [{ domain: 'something.com', brand: '' }]);
});

test('known phishing feed: matches and maps to the brand', () => {
  const v = check('https://login.evil-bank.xyz/');
  assert.equal(v.level, 'danger');
  assert.deepEqual(v.real, [{ domain: 'paypal.com', brand: 'PayPal' }]);
  assert.equal(check('https://evil-bank.xyz/').level, 'danger'); // registrable-level match for non-popular domains
});

test('feed never overrides popular or official domains', () => {
  const data = makeData({ feed: { hosts: { 'forms.google.com': 'google', 'sites.github.com': 'github' }, domains: { 'google.com': 'google', 'github.com': 'github' } } });
  assert.equal(check('https://forms.google.com/x', state(), data).level, 'none');
  assert.equal(check('https://sites.github.com/x', state(), data).level, 'none');
});

test('trusting a site (once or always) silences it; disabled switch silences everything', () => {
  let st = addAllow(state(), 'https://paypa1.com/', 3_600_000, NOW);
  assert.equal(check('https://paypa1.com/', st).reason, 'allowed-by-user');
  assert.equal(evaluate('https://paypa1.com/', { state: st, data: makeData(), now: NOW + 7_200_000 }).action, 'block');
  st = state({ settings: { enabled: false, blockCaution: false, disclaimerAccepted: true } });
  assert.equal(check('https://paypa1.com/', st).action, 'none');
});

test('data age and degraded mode are reported', () => {
  assert.equal(check('https://paypa1.com/').dataAgeDays, 30);
  assert.equal(check('https://paypa1.com/', state(), makeData({ degraded: true })).degraded, true);
  assert.equal(check('https://paypa1.com/', state(), makeData({ meta: null })).dataAgeDays, null);
});
