import test from 'node:test';
import assert from 'node:assert/strict';
import { hash40 } from '../extension/src/core/hash.js';
import { DomainSet, packDomains } from '../extension/src/core/domainset.js';
import { splitDomain, normalizeUserDomain, isSameOrSubdomain } from '../extension/src/core/hostname.js';
import { diffSegments } from '../extension/src/core/diff.js';
import { editDistance, skeleton } from '../extension/src/core/lookalike.js';
import { activeBlocklists, originsFor, BLOCKLISTS } from '../extension/src/config.js';
import { addUserEntry, addAllow, isAllowed, migrate, pruneAllowlist, removeUserEntry, updateSettings, defaultState } from '../extension/src/core/state.js';

test('hash40 is stable and within 40 bits', () => {
  assert.equal(hash40('paypal.com'), hash40('paypal.com'));
  assert.notEqual(hash40('paypal.com'), hash40('paypal.co'));
  for (const s of ['a', 'example.org', 'xn--e1afmkfd.xn--p1ai']) assert.ok(hash40(s) >= 0 && hash40(s) < 2 ** 40);
});

test('DomainSet: pack, load, lookup, dedupe', () => {
  const bytes = packDomains(['b.com', 'a.com', 'a.com', 'c.org']);
  const set = new DomainSet(bytes);
  assert.equal(set.size, 3);
  assert.ok(set.has('a.com') && set.has('b.com') && set.has('c.org'));
  assert.ok(!set.has('d.com') && !set.has('a.co'));
});

test('DomainSet scales and has no false negatives', () => {
  const domains = Array.from({ length: 50_000 }, (_, i) => `site-${i}.example`);
  const set = new DomainSet(packDomains(domains));
  assert.ok(domains.every((d) => set.has(d)));
  let falsePositives = 0;
  for (let i = 0; i < 50_000; i++) if (set.has(`other-${i}.test`)) falsePositives++;
  assert.equal(falsePositives, 0);
});

test('DomainSet rejects garbage and truncated files', () => {
  assert.throws(() => new DomainSet(new Uint8Array([1, 2, 3])));
  const bytes = packDomains(['a.com', 'b.com']);
  assert.throws(() => new DomainSet(bytes.slice(0, bytes.length - 2)));
});

test('splitDomain handles country suffixes and shared hosts', () => {
  assert.equal(splitDomain('www.paypal.com').registrable, 'paypal.com');
  assert.equal(splitDomain('a.b.bbc.co.uk').registrable, 'bbc.co.uk');
  assert.equal(splitDomain('shop.bkash.com.bd').label, 'bkash');
  assert.equal(splitDomain('evil.github.io').registrable, 'evil.github.io');
  assert.equal(splitDomain('paypal.com.secure-check.xyz').subLabels.join('.'), 'paypal.com');
  assert.equal(splitDomain('localhost').label, '');
});

test('normalizeUserDomain cleans input and rejects bad input', () => {
  assert.equal(normalizeUserDomain('https://www.Something.SITE/login?x=1'), 'something.site');
  assert.equal(normalizeUserDomain('  paypal.com  '), 'paypal.com');
  for (const bad of ['', 'localhost', '192.168.0.1', 'javascript:alert(1)', 'a b.com', 'bad..com', '-x.com']) {
    assert.equal(normalizeUserDomain(bad), null, bad);
  }
  assert.ok(isSameOrSubdomain('a.b.com', 'b.com') && !isSameOrSubdomain('ab.com', 'b.com'));
});

test('editDistance and skeleton', () => {
  assert.equal(editDistance('paypal', 'paypall', 2), 1);
  assert.equal(editDistance('paypal', 'paypla', 2), 1); // transposition
  assert.equal(editDistance('paypal', 'google', 2), 3);
  assert.equal(skeleton('paypa1'), skeleton('paypal'));
  assert.equal(skeleton('pay-pal'), skeleton('paypal'));
  assert.equal(skeleton('rnicrosoft'), skeleton('microsoft'));
});

test('diffSegments marks the characters that differ', () => {
  const segs = diffSegments('paypa1.com', 'paypal.com');
  assert.deepEqual(segs.filter((s) => s.changed).map((s) => s.text), ['1']);
  assert.equal(segs.map((s) => s.text).join(''), 'paypa1.com');
  assert.equal(diffSegments('same.com', 'same.com').some((s) => s.changed), false);
});

test('state: add/remove user entries with validation', () => {
  let s = defaultState();
  assert.equal(addUserEntry(s, 'not a domain', 'x.com').ok, false);
  assert.equal(addUserEntry(s, 'a.com', 'a.com').ok, false);
  const r = addUserEntry(s, 'https://Something.site/', 'something.com');
  assert.ok(r.ok);
  s = r.state;
  assert.deepEqual(s.userList.map((e) => [e.fake, e.real]), [['something.site', 'something.com']]);
  assert.equal(addUserEntry(s, 'something.site', 'other.com').state.userList.length, 1); // replaces, no duplicate
  assert.equal(removeUserEntry(s, 'something.site').userList.length, 0);
  assert.equal(addUserEntry(defaultState(), 'x.site', '').state.userList[0].real, null); // real is optional
});

test('state: allowlist expires and prunes', () => {
  const t = 1_000_000;
  let s = addAllow(defaultState(), 'https://www.shop.example.com/a', 5000, t);
  assert.ok(isAllowed(s, 'login.example.com', t + 1000));
  assert.ok(!isAllowed(s, 'login.example.com', t + 6000));
  assert.equal(pruneAllowlist(s, t + 6000).allowlist.length, 0);
  s = addAllow(defaultState(), 'example.com', null, t);
  assert.ok(isAllowed(s, 'example.com', t + 1e12));
});

test('state: migrate repairs corrupt data; settings patch is sanitized', () => {
  assert.deepEqual(migrate(null), defaultState());
  const m = migrate({ settings: { enabled: false, blockCaution: 'yes' }, userList: [{ fake: 1 }, { fake: 'a.com', real: null }], allowlist: 'x' });
  assert.equal(m.settings.enabled, false);
  assert.equal(m.settings.blockCaution, false);
  assert.equal(m.userList.length, 1);
  assert.deepEqual(m.allowlist, []);
  assert.equal(updateSettings(defaultState(), { blockCaution: true }).settings.blockCaution, true);
});

test('permissions asked for match what is switched on', () => {
  const base = originsFor({ extendedCoverage: false });
  const extra = originsFor({ extendedCoverage: true });
  assert.ok(!base.includes('https://raw.githubusercontent.com/*'));
  assert.ok(extra.includes('https://raw.githubusercontent.com/*'));
  assert.equal(activeBlocklists({ extendedCoverage: false }).length, BLOCKLISTS.filter((b) => !b.optional).length);
  assert.equal(activeBlocklists({ extendedCoverage: true }).length, BLOCKLISTS.length);
});
