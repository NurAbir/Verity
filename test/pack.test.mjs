import test from 'node:test';
import assert from 'node:assert/strict';
import { readFirstZipEntry } from '../scripts/lib/zip.mjs';
import { crc32, makeZip } from '../scripts/lib/zip-write.mjs';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('zip writer output is readable by the zip reader (deflate and stored)', () => {
  const big = 'hello world\n'.repeat(500);
  assert.equal(readFirstZipEntry(makeZip([{ name: 'a.txt', data: big }])).toString(), big);
  assert.equal(readFirstZipEntry(makeZip([{ name: 'b.bin', data: 'x' }])).toString(), 'x'); // too small to compress -> stored
});

test('packing is reproducible', () => {
  const files = [{ name: 'a/b.txt', data: 'one' }, { name: 'c.txt', data: 'two' }];
  assert.ok(makeZip(files).equals(makeZip(files)));
});
