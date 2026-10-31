#!/usr/bin/env node
// Packs extension/ into dist/verity-<version>.zip (for sharing or the Chrome Web Store). No external tools needed.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { makeZip } from './lib/zip-write.mjs';

const root = 'extension';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const walk = (dir) => readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

if (!existsSync(join(root, 'data', 'trusted.bin'))) {
  console.warn('WARNING: extension/data/trusted.bin is missing. Run `npm run build` first, or people get an extension without the popular-site list.');
}
const files = walk(root).map((p) => ({ name: relative(root, p).split(sep).join('/'), data: readFileSync(p) }));
mkdirSync('dist', { recursive: true });
const out = join('dist', `verity-${version}.zip`);
writeFileSync(out, makeZip(files));
console.log(`Packed ${files.length} files -> ${out}`);
