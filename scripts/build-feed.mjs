#!/usr/bin/env node
// Builds the "known bad" data in extension/data/:
//   feed.json       reported scam sites mapped to a brand (phishunt) + the list of filter lists
//   bl-<id>.bin     one packed domain set per public filter list (uBlock Origin "Badware risks", Phishing URL Blocklist)
//
//   node scripts/build-feed.mjs                       # download everything
//   node scripts/build-feed.mjs --from feed.json      # phishunt rows from a local file
//   node scripts/build-feed.mjs --lists-dir ./lists   # filter lists from ./lists/<id>.txt instead of downloading
//   node scripts/build-feed.mjs --extended true       # also include the large optional lists (Phishing.Database)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BLOCKLISTS, SOURCES } from '../extension/src/config.js';
import { parseBlocklist } from '../extension/src/core/blocklist.js';
import { DomainSet, packDomains } from '../extension/src/core/domainset.js';
import { buildFeed } from '../extension/src/core/feed.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const dir = args.out ?? 'extension/data';
const UA = { 'user-agent': 'verity-build/0.1 (open-source browser extension)' };
const readJson = (f) => (existsSync(`${dir}/${f}`) ? JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) : null);

async function download(urls) {
  let failure;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return await res.text();
    } catch (err) { failure = err; }
  }
  throw failure;
}

const previous = readJson('feed.json');

// 1) reported scam sites (brand known)
let rows = null;
try {
  rows = args.from ? JSON.parse(readFileSync(args.from, 'utf8')) : JSON.parse(await download([SOURCES.phishFeed]));
  if (!Array.isArray(rows)) throw new Error('Unexpected feed shape: expected a JSON array');
} catch (err) {
  console.warn(`WARNING: phishunt feed not updated (${err.message}).`);
}
const trustedPath = `${dir}/trusted.bin`;
const trusted = existsSync(trustedPath) ? new DomainSet(new Uint8Array(readFileSync(trustedPath))) : { has: () => false };
const brands = JSON.parse(readFileSync(`${dir}/brands.json`, 'utf8'));
const base = rows ? buildFeed(rows, { brands, isTrusted: (d) => trusted.has(d), previous }) : (previous ?? { hosts: {}, domains: {}, generatedAt: null });

// 2) public filter lists (one packed set each); a failed list keeps its previous copy
const lists = [];
for (const src of BLOCKLISTS.filter((b) => !b.optional || args.extended)) {
  try {
    const text = args['lists-dir'] ? readFileSync(`${args['lists-dir']}/${src.id}.txt`, 'utf8') : await download(src.urls);
    const { hosts } = parseBlocklist(text);
    if (hosts.length < (src.minEntries ?? 1)) throw new Error(`only ${hosts.length} usable entries`);
    writeFileSync(`${dir}/bl-${src.id}.bin`, packDomains(hosts));
    lists.push({ id: src.id, title: src.title, license: src.license, count: hosts.length });
    console.log(`${src.title}: ${hosts.length} addresses`);
  } catch (err) {
    console.warn(`WARNING: ${src.title} not updated (${err.message}).`);
    const old = previous?.blocklists?.find((l) => l.id === src.id);
    if (old && existsSync(`${dir}/bl-${src.id}.bin`)) lists.push(old);
  }
}

const feed = { ...base, blocklists: lists };
writeFileSync(`${dir}/feed.json`, JSON.stringify(feed));
console.log(`Feed: ${Object.keys(feed.hosts).length} hosts, ${Object.keys(feed.domains).length} domains, ${lists.length} filter lists -> ${dir}/feed.json`);
