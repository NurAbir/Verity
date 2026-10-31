// Compact, read-only set of domains stored as sorted 40-bit hashes (5 bytes each).
// File layout ("VDS1"): magic(4) version(1) keyBytes(1) reserved(2) count(4, big-endian) + count*5 bytes.
// A false match needs a 40-bit hash collision (about 1 in 10^12 per lookup per entry).
import { hash40 } from './hash.js';

const MAGIC = [0x56, 0x44, 0x53, 0x31];
export const HEADER_BYTES = 12;
export const KEY_BYTES = 5;
const TWO32 = 4294967296;

function writeKey(buf, o, v) {
  buf[o] = Math.floor(v / TWO32) & 0xff;
  const lo = v >>> 0;
  buf[o + 1] = (lo >>> 24) & 0xff;
  buf[o + 2] = (lo >>> 16) & 0xff;
  buf[o + 3] = (lo >>> 8) & 0xff;
  buf[o + 4] = lo & 0xff;
}

function readKey(buf, o) {
  return buf[o] * TWO32 + buf[o + 1] * 16777216 + buf[o + 2] * 65536 + buf[o + 3] * 256 + buf[o + 4];
}

/** Build the binary file contents from an iterable of normalized domains. */
export function packDomains(domains) {
  const hashes = Float64Array.from(domains, hash40).sort();
  const unique = [];
  for (let i = 0; i < hashes.length; i++) if (i === 0 || hashes[i] !== hashes[i - 1]) unique.push(hashes[i]);
  const out = new Uint8Array(HEADER_BYTES + unique.length * KEY_BYTES);
  out.set(MAGIC, 0);
  out[4] = 1;
  out[5] = KEY_BYTES;
  new DataView(out.buffer).setUint32(8, unique.length, false);
  unique.forEach((h, i) => writeKey(out, HEADER_BYTES + i * KEY_BYTES, h));
  return out;
}

export class DomainSet {
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < HEADER_BYTES || MAGIC.some((b, i) => bytes[i] !== b)) {
      throw new Error('Not a Verity domain set file');
    }
    if (bytes[5] !== KEY_BYTES) throw new Error('Unsupported key size');
    this.bytes = bytes;
    this.size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, false);
    if (bytes.length !== HEADER_BYTES + this.size * KEY_BYTES) throw new Error('Domain set file is truncated');
  }

  has(domain) {
    const target = hash40(domain);
    let lo = 0, hi = this.size - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const v = readKey(this.bytes, HEADER_BYTES + mid * KEY_BYTES);
      if (v === target) return true;
      if (v < target) lo = mid + 1; else hi = mid - 1;
    }
    return false;
  }
}

/** Stand-in used when a data file is missing, so the extension degrades instead of crashing. */
export const EMPTY_SET = Object.freeze({ size: 0, has: () => false });
