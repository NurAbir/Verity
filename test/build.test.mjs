import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatasets, parseRankedCsv } from '../extension/src/core/datasets.js';
import { buildFeed, makeBrandResolver } from '../extension/src/core/feed.js';
import { DomainSet, packDomains } from '../extension/src/core/domainset.js';
import { buildBrandIndex } from '../extension/src/core/lookalike.js';
import { evaluate } from '../extension/src/core/verdict.js';
import { brands, NOW, state } from './helpers.mjs';

test('parseRankedCsv keeps order, drops junk, headers and duplicates', () => {
  const csv = 'rank,domain\n1,Google.com\n2,facebook.com\r\n3,google.com\n4,not a domain\n5,bbc.co.uk\n\n6,localhost\n';
  assert.deepEqual(parseRankedCsv(csv), ['google.com', 'facebook.com', 'bbc.co.uk']);
});

test('buildDatasets: tiers do not overlap and respect size limits', () => {
  const top = ['a-site.com', 'b-site.com', 'c-site.com'];
  const full = ['a-site.com', 'b-site.com', 'c-site.com', 'd-site.com', 'e-site.com', 'f-site.com'];
  const r = buildDatasets({ trustedRanked: top, fullRanked: full, trustedCount: 2, extendedTotal: 4 });
  assert.deepEqual(r.trusted, ['a-site.com', 'b-site.com']);
  assert.deepEqual(r.extended, ['c-site.com', 'd-site.com']); // 4 total = 2 trusted + 2 extended
  assert.equal(r.trusted.filter((d) => r.extended.includes(d)).length, 0);
});

test('buildDatasets: brand-like names skip short, numeric and duplicate labels', () => {
  const r = buildDatasets({ trustedRanked: ['wikipedia.org', 'wikipedia.de', 'x.com', '12345.com', 'bbc.co.uk', 'mozilla.org'], topLabelCount: 100 });
  assert.deepEqual(r.topLabels.map((p) => p[0]), ['wikipedia', 'mozilla']);
});

test('feed: brand names are resolved through ids, names and aliases', () => {
  const resolve = makeBrandResolver(brands);
  assert.equal(resolve('PayPal'), 'paypal');
  assert.equal(resolve('Bank of America'), 'bankofamerica');
  assert.equal(resolve('gmail'), 'google');
  assert.equal(resolve('some unknown co'), '');
});

test('feed: skips popular domains and IPs, keeps recent history, drops old', () => {
  const day = Math.floor(NOW / 86_400_000);
  const previous = { hosts: { 'old.scam.xyz': { b: 'paypal', t: day - 5 }, 'ancient.scam.xyz': { b: 'paypal', t: day - 400 } }, domains: { 'scam.xyz': { b: 'paypal', t: day - 5 } } };
  const feed = buildFeed([
    { domain: 'amazon-login.evil.top', company: 'amazon' },
    { domain: 'forms.popular.com', company: 'microsoft' },
    { domain: '10.0.0.1', company: 'x' },
    { url: 'https://paypal-help.shop/x', company: 'paypal' },
  ], { brands, isTrusted: (d) => d === 'popular.com', previous, now: NOW });
  assert.equal(feed.hosts['amazon-login.evil.top'].b, 'amazon');
  assert.equal(feed.domains['evil.top'].b, 'amazon');
  assert.equal(feed.hosts['paypal-help.shop'].b, 'paypal');
  assert.ok(!('forms.popular.com' in feed.hosts));
  assert.ok('old.scam.xyz' in feed.hosts && !('ancient.scam.xyz' in feed.hosts));
  assert.equal(feed.skipped, 2);
});

test('end to end: built data drives the verdict', () => {
  const { trusted, extended, topLabels } = buildDatasets({
    trustedRanked: ['wikipedia.org', 'stackoverflow.com'], fullRanked: ['wikipedia.org', 'stackoverflow.com', 'tiny-shop.site'],
    trustedCount: 2, extendedTotal: 3,
  });
  const feed = buildFeed([{ domain: 'secure.evil-pay.top', company: 'PayPal' }], { brands, now: NOW });
  const data = {
    trusted: new DomainSet(packDomains(trusted)), extended: new DomainSet(packDomains(extended)),
    brandIndex: buildBrandIndex(brands, topLabels), feed, brands, meta: { builtAt: new Date(NOW).toISOString() },
  };
  const run = (u) => evaluate(u, { state: state(), data, now: NOW });
  assert.equal(run('https://en.wikipedia.org/').action, 'none');
  assert.equal(run('https://tiny-shop.site/').action, 'none');
  // A typo of a name that is only on the popularity list (not hand-curated) is low confidence: badge, not block.
  assert.equal(run('https://stackoverflov.com/').level, 'caution');
  assert.equal(run('https://stackoverflov.com/').action, 'badge');
  assert.equal(evaluate('https://stackoverflov.com/', { state: state({ settings: { enabled: true, blockCaution: true, disclaimerAccepted: true } }), data, now: NOW }).action, 'block');
  assert.deepEqual(run('https://secure.evil-pay.top/').real, [{ domain: 'paypal.com', brand: 'PayPal' }]);
});
