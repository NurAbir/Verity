// Turns the phishunt JSON feed into the compact lookup the extension ships.
// The feed only lists *currently active* sites, so we keep what we saw recently (keepDays) instead of
// forgetting a scam site the moment it drops off the feed.
import { SOURCES } from '../config.js';
import { isIpHost, normalizeHost, splitDomain } from './hostname.js';

const compact = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function makeBrandResolver(brands) {
  const map = new Map();
  for (const b of brands) for (const key of [b.id, b.name, ...(b.aliases ?? [])]) map.set(compact(key), b.id);
  return (company) => map.get(compact(company)) ?? '';
}

export function buildFeed(rows, { brands = [], isTrusted = () => false, previous = null, now = Date.now(), keepDays = 60 } = {}) {
  const day = Math.floor(now / 86_400_000);
  const resolve = makeBrandResolver(brands);
  const alive = (e) => e && typeof e.t === 'number' && day - e.t <= keepDays;
  const hosts = {};
  const domains = {};
  for (const [k, v] of Object.entries(previous?.hosts ?? {})) if (alive(v)) hosts[k] = v;
  for (const [k, v] of Object.entries(previous?.domains ?? {})) if (alive(v)) domains[k] = v;

  let skipped = 0;
  for (const row of rows) {
    let host = '';
    try { host = normalizeHost(row.domain || new URL(row.url).hostname); } catch { /* skip below */ }
    if (!host || !host.includes('.') || isIpHost(host)) { skipped++; continue; }
    const parts = splitDomain(host);
    if (isTrusted(parts.registrable)) { skipped++; continue; } // a popular site can host one bad page; never block the whole site
    const entry = { b: resolve(row.company), t: day };
    hosts[host] = entry;
    domains[parts.registrable] = entry;
  }
  return {
    generatedAt: new Date(now).toISOString(),
    source: SOURCES.phishFeed,
    license: 'CC0-1.0',
    keepDays,
    skipped,
    hosts,
    domains,
  };
}
