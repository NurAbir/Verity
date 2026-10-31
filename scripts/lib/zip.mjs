// Node adapter for the shared zip parser: inflate with zlib. Works on Windows, macOS and Linux (no `unzip` needed).
import { inflateRawSync } from 'node:zlib';
import { firstZipEntry } from '../../extension/src/core/zip.js';

/** Returns the contents (Buffer) of the first file entry in a zip archive. */
export function readFirstZipEntry(buf) {
  const entry = firstZipEntry(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  if (entry.method === 0) return Buffer.from(entry.data);
  if (entry.method === 8) return inflateRawSync(entry.data);
  throw new Error(`Unsupported zip compression method ${entry.method}`);
}
