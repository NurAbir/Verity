// Pure data-building logic (no network, no disk) so it can be unit-tested. The CLI wrappers do the I/O.
import { normalizeHost, splitDomain } from './hostname.js';

const DOMAIN = /^[a-z0-9_]([a-z0-9_.-]*[a-z0-9_])?\.[a-z0-9-]{2,}$/;

/** Parse "rank,domain" lines (Tranco / Umbrella format). Keeps file order, drops junk and duplicates. */
export function parseRankedCsv(text) {
  const seen = new Set();
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const field = line.includes(',') ? line.split(',')[1] : line;
    const d = normalizeHost(field ?? '');
    if (!DOMAIN.test(d) || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

/**
 * @param {string[]} trustedRanked best-first list (e.g. Tranco top 1M)
 * @param {string[]} fullRanked    best-first list that may contain the trusted ones (e.g. Tranco full list); optional
 */
export function buildDatasets({ trustedRanked, fullRanked = [], trustedCount = 1_000_000, extendedTotal = 3_000_000, topLabelCount = 10_000 }) {
  const trusted = trustedRanked.slice(0, trustedCount);
  const seen = new Set(trusted);
  const extended = [];
  const room = Math.max(0, extendedTotal - trusted.length);
  for (const d of fullRanked) {
    if (extended.length >= room) break;
    if (seen.has(d)) continue;
    seen.add(d);
    extended.push(d);
  }
  const topLabels = [];
  const labels = new Set();
  for (const d of trusted.slice(0, topLabelCount)) {
    const { label } = splitDomain(d);
    if (label.length < 5 || /^\d+$/.test(label) || labels.has(label)) continue;
    labels.add(label);
    topLabels.push([label, d]);
  }
  return { trusted, extended, topLabels };
}
