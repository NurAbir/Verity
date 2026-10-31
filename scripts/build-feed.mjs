#!/usr/bin/env node
// Builds extension/data/feed.json from the phishunt JSON feed (CC0). Run it as often as you ship (e.g. daily CI).
//   node scripts/build-feed.mjs                  # downloads https://phishunt.io/feed.json
//   node scripts/build-feed.mjs --from feed.json # use a local file
import { SOURCES } from '../extension/src/config.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DomainSet } from '../extension/src/core/domainset.js';
import { buildFeed } from '../extension/src/core/feed.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const dir = args.out ?? 'extension/data';

let rows;
if (args.from) {
  rows = JSON.parse(readFileSync(args.from, 'utf8'));
} else {
  const res = await fetch(SOURCES.phishFeed, { headers: { 'user-agent': 'verity-build/0.1 (open-source browser extension)' } });
  if (!res.ok) throw new Error(`phishunt feed -> HTTP ${res.status}`);
  rows = await res.json();
}
if (!Array.isArray(rows)) throw new Error('Unexpected feed shape: expected a JSON array');

const read = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`) : null);
const trustedBytes = read('trusted.bin');
const trusted = trustedBytes ? new DomainSet(new Uint8Array(trustedBytes)) : { has: () => false };
const brands = JSON.parse(readFileSync(`${dir}/brands.json`, 'utf8'));
const previous = read('feed.json') ? JSON.parse(read('feed.json')) : null;

const feed = buildFeed(rows, { brands, isTrusted: (d) => trusted.has(d), previous });
writeFileSync(`${dir}/feed.json`, JSON.stringify(feed));
console.log(`Feed: ${Object.keys(feed.hosts).length} hosts, ${Object.keys(feed.domains).length} domains (${feed.skipped} skipped) -> ${dir}/feed.json`);
