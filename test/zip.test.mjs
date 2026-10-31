import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readFirstZipEntry } from '../scripts/lib/zip.mjs';

// Hand-assembled zip (local header + data + central directory + end record) for each method.
function makeZip(name, content, method) {
  const raw = Buffer.from(content);
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const nm = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nm.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nm.length, 28);
  const cdOffset = 30 + nm.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nm.length, 12); end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nm, data, central, nm, end]);
}

test('zip reader: deflated and stored entries', () => {
  const csv = '1,google.com\n2,facebook.com\n'.repeat(1000);
  assert.equal(readFirstZipEntry(makeZip('top-1m.csv', csv, 8)).toString(), csv);
  assert.equal(readFirstZipEntry(makeZip('top-1m.csv', csv, 0)).toString(), csv);
});

test('zip reader: clear errors for non-zip and unsupported input', () => {
  assert.throws(() => readFirstZipEntry(Buffer.from('1,google.com\n')), /Not a zip/);
  assert.throws(() => readFirstZipEntry(makeZip('x.csv', 'abc', 8).subarray(0, 40)), /Not a zip/);
});
