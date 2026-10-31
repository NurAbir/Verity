#!/usr/bin/env node
// Builds extension/data/{trusted.bin, extended.bin, toplabels.json, meta.json} from public ranking lists.
//   node scripts/build-data.mjs                      # downloads Tranco (needs internet)
//   node scripts/build-data.mjs --trusted top.csv    # use a local "rank,domain" CSV (or .zip)
//   node scripts/build-data.mjs --full full.csv      # larger ranking for the 3M "known to exist" tier
import { SOURCES } from '../extension/src/config.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packDomains } from '../extension/src/core/domainset.js';
import { buildDatasets, parseRankedCsv } from '../extension/src/core/datasets.js';
import { readFirstZipEntry } from './lib/zip.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1] ?? 'true']] : acc), []));
const num = (k, d) => (args[k] ? Number(args[k]) : d);
const out = args.out ?? 'extension/data';
const UA = { 'user-agent': 'verity-build/0.1 (open-source browser extension)' };

async function readText(src) {
  let buf;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { headers: UA });
    if (!res.ok) throw new Error(`${src} -> HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    buf = readFileSync(src);
  }
  if (buf[0] === 0x50 && buf[1] === 0x4b) buf = readFirstZipEntry(buf); // zip container (pure Node, works on Windows)
  return buf.toString('utf8');
}

async function resolveFullSource() {
  if (args.full && args.full !== 'auto') return args.full;
  if (args.full === undefined && args.trusted) return null; // custom trusted list given, no tail unless asked
  const id = (await (await fetch(SOURCES.trancoId, { headers: UA })).text()).trim();
  return SOURCES.trancoFull(id); // NOTE: verify this endpoint against Tranco's API docs
}

const trustedSrc = args.trusted ?? SOURCES.trancoTop;
console.log('Reading trusted list:', trustedSrc);
const trustedRanked = parseRankedCsv(await readText(trustedSrc));

let fullRanked = [];
let fullSrc = null;
try {
  fullSrc = await resolveFullSource();
  if (fullSrc) { console.log('Reading larger list:', fullSrc); fullRanked = parseRankedCsv(await readText(fullSrc)); }
} catch (err) {
  console.warn(`WARNING: larger list unavailable (${err.message}). Building the trusted tier only.\n         Pass --full <file-or-url> to add the 3M tier.`);
}

const { trusted, extended, topLabels } = buildDatasets({
  trustedRanked, fullRanked,
  trustedCount: num('trusted-count', 1_000_000),
  extendedTotal: num('extended-total', 3_000_000),
  topLabelCount: num('top-labels', 10_000),
});

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'trusted.bin'), packDomains(trusted));
writeFileSync(join(out, 'extended.bin'), packDomains(extended));
writeFileSync(join(out, 'toplabels.json'), JSON.stringify(topLabels));
writeFileSync(join(out, 'meta.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  hashBits: 40,
  trusted: { count: trusted.length, source: trustedSrc },
  extended: { count: extended.length, source: fullSrc },
  attribution: 'Tranco list (tranco-list.eu); components: Cisco Umbrella, Majestic (CC BY 3.0), Chrome UX Report (CC BY-SA 4.0), Cloudflare Radar (CC BY-NC 4.0).',
}, null, 2));
console.log(`Done: ${trusted.length} trusted, ${extended.length} extended, ${topLabels.length} brand-like names -> ${out}`);
