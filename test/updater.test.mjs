import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainSet } from '../extension/src/core/domainset.js';
import { BLOCKLISTS, SOURCES } from '../extension/src/config.js';
import { fetchRankedDomains, runUpdate } from '../extension/src/updater/updater.js';
import { makeZip } from '../scripts/lib/zip-write.mjs';
import { brands, NOW } from './helpers.mjs';

const names = (n, p = 's') => Array.from({ length: n }, (_, i) => `${p}${i}.com`);
const csv = (list) => list.map((d, i) => `${i + 1},${d}`).join('\n');
const LIMITS = { trustedCount: 100, extendedTotal: 150, topLabels: 50, minTrusted: 50 };

function memoryStore(initial = {}) {
  const data = { ...initial };
  return { data, putMany: async (o) => { Object.assign(data, o); } };
}

function fakeFetch(routes, log = []) {
  return async (url, init) => {
    log.push({ url, init });
    const route = routes[url];
    return route ? route() : new Response('not found', { status: 404 });
  };
}

const listText = (id, n = 600) => Array.from({ length: n }, (_, i) => `||bad${i}-${id}.net^$doc`).join('\n');

function routes({ top = 200, full = 400, feed = [{ domain: 'login.evil-pay.top', company: 'PayPal' }] } = {}) {
  const lists = Object.fromEntries(BLOCKLISTS.map((b) => [b.urls[0], () => new Response(listText(b.id, b.optional ? 10_500 : 600))]));
  return {
    ...lists,
    [SOURCES.trancoTop]: () => new Response(makeZip([{ name: 'top-1m.csv', data: csv(names(top)) }])),
    [SOURCES.trancoId]: () => new Response('ABCDE\n'),
    [SOURCES.trancoFull('ABCDE')]: () => new Response(csv(names(full))),
    [SOURCES.phishFeed]: () => new Response(JSON.stringify(feed)),
  };
}

test('update: downloads, builds and stores every list in one write', async () => {
  const store = memoryStore();
  const report = await runUpdate({ fetchFn: fakeFetch(routes()), store, brands, now: NOW, limits: LIMITS });
  assert.equal(report.ok, true);
  assert.deepEqual(report.wrote.sort(), ['bl-phishing-filter', 'bl-ubo-badware', 'extended', 'feed', 'meta', 'toplabels', 'trusted']);
  assert.deepEqual(store.data.feed.blocklists.map((l) => [l.id, l.count]), [['ubo-badware', 600], ['phishing-filter', 600]]);
  assert.ok(new DomainSet(store.data['bl-ubo-badware']).has('bad5-ubo-badware.net'));
  const trusted = new DomainSet(store.data.trusted);
  const extended = new DomainSet(store.data.extended);
  assert.equal(trusted.size, 100);
  assert.equal(extended.size, 50); // 150 total - 100 trusted
  assert.ok(trusted.has('s0.com') && !trusted.has('s100.com') && extended.has('s100.com') && !extended.has('s0.com'));
  assert.equal(store.data.feed.hosts['login.evil-pay.top'].b, 'paypal');
  assert.equal(store.data.meta.builtAt, new Date(NOW).toISOString());
  assert.equal(store.data.meta.trusted.count, 100);
});

test('update: requests carry no cookies and no referrer, and go only to the configured sources', async () => {
  const log = [];
  await runUpdate({ fetchFn: fakeFetch(routes(), log), store: memoryStore(), brands, now: NOW, limits: LIMITS });
  const allowed = new Set([SOURCES.trancoTop, SOURCES.trancoId, SOURCES.trancoFull('ABCDE'), SOURCES.phishFeed, ...BLOCKLISTS.flatMap((b) => b.urls)]);
  assert.ok(log.length >= 4);
  for (const { url, init } of log) {
    assert.ok(allowed.has(url), url);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
  }
});

test('update: if the larger list fails, the rest is still saved and the old larger list is kept', async () => {
  const r = routes();
  delete r[SOURCES.trancoFull('ABCDE')];
  const store = memoryStore({ extended: 'OLD-EXTENDED' });
  const report = await runUpdate({ fetchFn: fakeFetch(r), store, brands, now: NOW, limits: LIMITS });
  assert.equal(report.ok, false);
  assert.equal(report.partial, true);
  assert.ok(report.wrote.includes('trusted') && report.wrote.includes('feed') && !report.wrote.includes('extended'));
  assert.equal(store.data.extended, 'OLD-EXTENDED');
  assert.match(report.steps.find((s) => !s.ok).error, /404/);
});

test('update: a suspiciously small download never replaces the lists', async () => {
  const store = memoryStore({ trusted: 'OLD' });
  const report = await runUpdate({ fetchFn: fakeFetch(routes({ top: 10 })), store, brands, now: NOW, limits: LIMITS });
  assert.equal(store.data.trusted, 'OLD');
  assert.ok(!report.wrote.includes('trusted'));
  assert.match(report.steps[0].error, /only 10 sites/);
});

test('update: when everything fails nothing is written', async () => {
  const store = memoryStore({ trusted: 'OLD', feed: 'OLD' });
  const report = await runUpdate({ fetchFn: fakeFetch({}), store, brands, now: NOW, limits: LIMITS });
  assert.equal(report.ok, false);
  assert.equal(report.partial, false);
  assert.deepEqual(report.wrote, []);
  assert.deepEqual(store.data, { trusted: 'OLD', feed: 'OLD' });
});

test('update: feed skips popular sites and keeps recent history', async () => {
  const store = memoryStore();
  const feed = [{ domain: 's5.com', company: 'x' }, { domain: 'bad.example-scam.top', company: 'amazon' }];
  await runUpdate({ fetchFn: fakeFetch(routes({ feed })), store, brands, now: NOW, limits: LIMITS });
  assert.ok(!('s5.com' in store.data.feed.hosts));
  assert.ok('bad.example-scam.top' in store.data.feed.hosts);
  const again = memoryStore({});
  await runUpdate({ fetchFn: fakeFetch(routes({ feed: [] })), store: again, brands, now: NOW + 86_400_000, limits: LIMITS,
    current: { feed: store.data.feed } });
  assert.ok('bad.example-scam.top' in again.data.feed.hosts); // not forgotten when it drops off the live feed
});

test('plain CSV downloads are streamed and cancelled once the limit is reached', async () => {
  let pulled = 0;
  const encoder = new TextEncoder();
  const fetchFn = async () => new Response(new ReadableStream({
    pull(controller) {
      if (pulled >= 100) return controller.close();
      controller.enqueue(encoder.encode(csv(names(10, `c${pulled}-`)) + '\n'));
      pulled++;
    },
  }));
  const list = await fetchRankedDomains(fetchFn, SOURCES.trancoFull('X'), 25);
  assert.equal(list.length, 25);
  assert.ok(pulled < 10, `read ${pulled} of 100 chunks`);
});

test('zip and plain downloads give the same list', async () => {
  const list = names(300);
  const zip = await fetchRankedDomains(async () => new Response(makeZip([{ name: 'a.csv', data: csv(list) }])), 'https://x.test/a');
  const plain = await fetchRankedDomains(async () => new Response(csv(list)), 'https://x.test/b');
  assert.deepEqual(zip, list);
  assert.deepEqual(plain, list);
});

test('filter lists: a mirror is used when the main address fails', async () => {
  const r = routes();
  const b = BLOCKLISTS[0];
  delete r[b.urls[0]];
  r[b.urls[1]] = () => new Response(listText(b.id));
  const store = memoryStore();
  const report = await runUpdate({ fetchFn: fakeFetch(r), store, brands, now: NOW, limits: LIMITS });
  assert.equal(report.ok, true);
  assert.ok(store.data[`bl-${b.id}`]);
});

test('filter lists: a failed or too-small list keeps its previous copy and entry', async () => {
  const r = routes();
  const [a, b] = BLOCKLISTS.filter((x) => !x.optional);
  delete r[a.urls[0]];                                   // list A unreachable
  r[b.urls[0]] = () => new Response(listText(b.id, 10)); // list B suspiciously small
  const old = { id: a.id, title: a.title, license: a.license, count: 999 };
  const store = memoryStore({ [`bl-${a.id}`]: 'OLD-A' });
  const report = await runUpdate({ fetchFn: fakeFetch(r), store, brands, now: NOW, limits: LIMITS, current: { feed: { hosts: {}, domains: {}, blocklists: [old] } } });
  assert.equal(report.ok, false);
  assert.equal(store.data[`bl-${a.id}`], 'OLD-A');
  assert.equal(store.data[`bl-${b.id}`], undefined);
  assert.deepEqual(store.data.feed.blocklists, [old]);
});

test('optional lists are downloaded only when switched on, and dropped when switched off', async () => {
  const optional = BLOCKLISTS.find((b) => b.optional);
  const log = [];
  const off = memoryStore();
  await runUpdate({ fetchFn: fakeFetch(routes(), log), store: off, brands, now: NOW, limits: LIMITS });
  assert.ok(!log.some((l) => optional.urls.includes(l.url)), 'not requested while off');
  assert.ok(!(`bl-${optional.id}` in off.data));

  const on = memoryStore();
  const report = await runUpdate({ fetchFn: fakeFetch(routes()), store: on, brands, now: NOW, limits: LIMITS, lists: BLOCKLISTS });
  assert.equal(report.ok, true);
  assert.equal(on.data.feed.blocklists.length, BLOCKLISTS.length);
  assert.ok(new DomainSet(on.data[`bl-${optional.id}`]).size >= 10_000);

  const later = memoryStore();
  await runUpdate({ fetchFn: fakeFetch(routes()), store: later, brands, now: NOW, limits: LIMITS, current: { feed: on.data.feed } });
  assert.ok(!later.data.feed.blocklists.some((l) => l.id === optional.id), 'switched-off list removed from the feed');
});
