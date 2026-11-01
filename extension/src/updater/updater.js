// In-browser equivalent of `npm run build:data` + `npm run build:feed`.
// Pure with respect to the browser: fetch and storage are injected, so it is unit-tested in Node.
// Design rules: never write anything unless a step succeeded; a failed step leaves the old data in place.
import { BLOCKLISTS, CONFIG, SOURCES } from '../config.js';
import { parseBlocklist } from '../core/blocklist.js';
import { buildDatasets, parseRankedCsv } from '../core/datasets.js';
import { DomainSet, packDomains } from '../core/domainset.js';
import { buildFeed } from '../core/feed.js';
import { firstZipEntry } from '../core/zip.js';

const fmt = (n) => n.toLocaleString('en-US');
const isZip = (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
const REQUEST = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }; // no cookies, no referrer

export async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzipFirst(bytes) {
  const entry = firstZipEntry(bytes);
  if (entry.method === 0) return entry.data;
  if (entry.method === 8) return inflateRaw(entry.data);
  throw new Error(`Unsupported zip compression method ${entry.method}`);
}

async function get(fetchFn, url) {
  const res = await fetchFn(url, REQUEST);
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res;
}

/** Download a "rank,domain" list (zip or plain CSV). Plain CSV is streamed and cancelled once `limit` is reached. */
export async function fetchRankedDomains(fetchFn, url, limit = Infinity) {
  const res = await get(fetchFn, url);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const seen = new Set();
  const domains = [];
  const take = (text) => { for (const d of parseRankedCsv(text)) if (!seen.has(d)) { seen.add(d); domains.push(d); } };
  let carry = '';
  let zipChunks = null;
  let first = true;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (first) { first = false; if (isZip(value)) zipChunks = []; }
    if (zipChunks) { zipChunks.push(value); continue; }
    const lines = (carry + decoder.decode(value, { stream: true })).split('\n');
    carry = lines.pop();
    take(lines.join('\n'));
    if (domains.length >= limit) { await reader.cancel(); return domains.slice(0, limit); }
  }
  if (zipChunks) {
    const all = new Uint8Array(zipChunks.reduce((n, c) => n + c.length, 0));
    zipChunks.reduce((at, c) => (all.set(c, at), at + c.length), 0);
    take(decoder.decode(await unzipFirst(all)));
  } else {
    take(carry);
  }
  return domains.slice(0, limit);
}

/**
 * @returns {Promise<{at:number, ok:boolean, partial:boolean, wrote:string[], steps:{name:string, ok:boolean, detail?:string, error?:string}[]}>}
 */
export async function runUpdate({ fetchFn = fetch, store, brands = [], current = {}, now = Date.now(), onProgress = () => {}, limits = {}, lists = BLOCKLISTS.filter((b) => !b.optional) }) {
  const L = { trustedCount: CONFIG.TRUSTED_COUNT, extendedTotal: CONFIG.EXTENDED_TOTAL, topLabels: CONFIG.TOP_LABELS, minTrusted: CONFIG.MIN_TRUSTED_SITES, ...limits };
  const steps = [];
  const writes = {};
  const step = async (name, fn) => {
    onProgress(name);
    try { steps.push({ name, ok: true, detail: await fn() }); return true; }
    catch (err) { steps.push({ name, ok: false, error: err?.message ?? String(err) }); return false; }
  };

  let trustedRanked = null;
  let fullRanked = [];
  let trustedSet = current.trusted ?? null;
  const built = {};

  await step('Popular sites', async () => {
    const list = await fetchRankedDomains(fetchFn, SOURCES.trancoTop, L.trustedCount);
    if (list.length < L.minTrusted) throw new Error(`The download has only ${list.length} sites, so it was ignored`);
    trustedRanked = list;
    return `${fmt(list.length)} sites`;
  });

  if (trustedRanked) {
    await step('More known sites', async () => {
      const id = (await (await get(fetchFn, SOURCES.trancoId)).text()).trim();
      if (!/^[A-Za-z0-9]{3,12}$/.test(id)) throw new Error('Unexpected list ID from tranco-list.eu');
      fullRanked = await fetchRankedDomains(fetchFn, SOURCES.trancoFull(id), L.extendedTotal + 100_000);
      return `${fmt(fullRanked.length)} sites`;
    });
    const sets = buildDatasets({ trustedRanked, fullRanked, trustedCount: L.trustedCount, extendedTotal: L.extendedTotal, topLabelCount: L.topLabels });
    writes.trusted = packDomains(sets.trusted);
    writes.toplabels = sets.topLabels;
    built.trusted = sets.trusted.length;
    if (fullRanked.length) { writes.extended = packDomains(sets.extended); built.extended = sets.extended.length; }
    trustedSet = new DomainSet(writes.trusted);
  }

  await step('Reported scam sites', async () => {
    const rows = await (await get(fetchFn, SOURCES.phishFeed)).json();
    if (!Array.isArray(rows)) throw new Error('Unexpected feed format');
    writes.feed = buildFeed(rows, { brands, isTrusted: (d) => trustedSet?.has(d) ?? false, previous: current.feed, now });
    return `${fmt(Object.keys(writes.feed.hosts).length)} addresses`;
  });

  // Filter lists: each is independent; a failed one keeps its previous copy.
  const built_lists = {};
  for (const src of lists) {
    await step(src.title, async () => {
      let text;
      let failure;
      for (const url of src.urls) {
        try { text = await (await get(fetchFn, url)).text(); break; } catch (err) { failure = err; }
      }
      if (text === undefined) throw failure;
      const { hosts } = parseBlocklist(text);
      if (hosts.length < (src.minEntries ?? 1)) throw new Error(`Only ${hosts.length} usable entries, so it was ignored`);
      writes[`bl-${src.id}`] = packDomains(hosts);
      built_lists[src.id] = { id: src.id, title: src.title, license: src.license, count: hosts.length };
      return `${fmt(hosts.length)} addresses`;
    });
  }
  if (writes.feed || Object.keys(built_lists).length) {
    const active = new Set(lists.map((l) => l.id));
    const kept = (current.feed?.blocklists ?? []).filter((l) => !(l.id in built_lists) && active.has(l.id)); // switched-off lists are dropped
    writes.feed = { ...(writes.feed ?? current.feed ?? { hosts: {}, domains: {} }), blocklists: [...kept, ...Object.values(built_lists)] };
  }

  if (Object.keys(writes).length) {
    const iso = new Date(now).toISOString();
    writes.meta = {
      ...(current.meta ?? {}), hashBits: 40, source: 'in-browser update',
      ...(writes.trusted ? { builtAt: iso, trusted: { count: built.trusted, source: SOURCES.trancoTop } } : {}),
      ...(writes.extended ? { extended: { count: built.extended, source: 'Tranco full list' } } : {}),
      ...(writes.feed ? { feedBuiltAt: iso } : {}),
    };
    await store.putMany(writes); // one transaction: all or nothing
  }
  const wrote = Object.keys(writes); // includes "meta" when anything was saved
  const ok = steps.every((s) => s.ok);
  return { at: now, ok, partial: wrote.length > 0 && !ok, wrote, steps };
}
