// Loads reference data: lists the person downloaded (IndexedDB) win; files bundled in the package are the fallback.
// Every part is optional: a missing or corrupt part degrades the result (and is reported) instead of crashing.
import { DomainSet, EMPTY_SET } from '../core/domainset.js';
import { buildBrandIndex } from '../core/lookalike.js';
import { idbStore } from './listdb.js';

const KEYS = ['trusted', 'extended', 'toplabels', 'feed', 'meta'];
let pending = null;

export function loadData() {
  pending ??= load().catch((err) => { pending = null; throw err; });
  return pending;
}

/** Forget the cached lists so the next check re-reads them (called after an update or reset). */
export function resetData() { pending = null; }

async function readFile(path, kind) {
  try {
    const res = await fetch(chrome.runtime.getURL(path));
    if (!res.ok) return null;
    return kind === 'json' ? await res.json() : new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function toSet(bytes) {
  if (!bytes) return null;
  try { return new DomainSet(bytes); } catch { return null; }
}

async function load() {
  let stored = {};
  try { stored = await idbStore.getAll(KEYS); } catch { /* IndexedDB unavailable: bundled files only */ }
  const fromStore = toSet(stored.trusted);
  const trusted = fromStore ?? toSet(await readFile('data/trusted.bin', 'bin'));
  const extended = toSet(stored.extended) ?? toSet(await readFile('data/extended.bin', 'bin'));
  const [brands, topLabels, feed, meta] = await Promise.all([
    readFile('data/brands.json', 'json'),
    stored.toplabels ?? readFile('data/toplabels.json', 'json'),
    stored.feed ?? readFile('data/feed.json', 'json'),
    stored.meta ?? readFile('data/meta.json', 'json'),
  ]);
  const brandList = Array.isArray(brands) ? brands : [];
  return {
    trusted: trusted ?? EMPTY_SET,
    extended: extended ?? EMPTY_SET,
    brands: brandList,
    brandIndex: buildBrandIndex(brandList, Array.isArray(topLabels) ? topLabels : []),
    feed: { hosts: feed?.hosts ?? {}, domains: feed?.domains ?? {}, generatedAt: feed?.generatedAt ?? null },
    meta: meta ?? null,
    source: fromStore ? 'updated' : 'bundled',
    degraded: !trusted, // the popular-site list is what keeps false alarms down; say so when it is missing
  };
}
