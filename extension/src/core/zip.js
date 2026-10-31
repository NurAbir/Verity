// Pure zip structure parser (no decompression). Shared by the build scripts (Node zlib) and the
// in-browser updater (DecompressionStream), so both read ranking downloads the same way.
const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;

/** @param {Uint8Array} bytes @returns {{name:string, method:number, data:Uint8Array}} first file entry */
export function firstZipEntry(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (end-of-archive record not found)');
  const entries = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // start of central directory
  for (let n = 0; n < entries; n++) {
    if (dv.getUint32(p, true) !== CENTRAL) throw new Error('Corrupt zip directory');
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue; // directory
    if (size === 0xffffffff || offset === 0xffffffff) throw new Error('Zip64 archives are not supported');
    if (dv.getUint32(offset, true) !== LOCAL) throw new Error('Corrupt zip entry');
    const start = offset + 30 + dv.getUint16(offset + 26, true) + dv.getUint16(offset + 28, true);
    return { name, method, data: bytes.subarray(start, start + size) };
  }
  throw new Error('The zip archive contains no files');
}
