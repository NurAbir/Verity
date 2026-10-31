// Minimal zip writer (deflate) so releases can be packed on any OS without extra tools.
import { deflateRawSync } from 'node:zlib';

const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0, DOS_DATE = 0x21; // fixed 1980-01-01 so packing is reproducible

/** @param {{name:string, data:Buffer|Uint8Array|string}[]} files @returns {Buffer} */
export function makeZip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const raw = Buffer.from(data);
    const nm = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(raw);
    const method = packed.length < raw.length ? 8 : 0;
    const body = method === 8 ? packed : raw;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nm.length, 26);
    parts.push(local, nm, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(method, 10); entry.writeUInt16LE(DOS_TIME, 12); entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nm.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nm);
    offset += 30 + nm.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
