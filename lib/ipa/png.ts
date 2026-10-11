import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Chunk {
  type: string;
  data: Buffer;
}

function readChunks(buf: Buffer): Chunk[] {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file");
  }
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function writeChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, "latin1"), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterRow(filter: number, src: Buffer, dst: Buffer, prev: Buffer | null, bpp: number): void {
  for (let i = 0; i < dst.length; i++) {
    const x = src[i];
    const a = i >= bpp ? dst[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = prev && i >= bpp ? prev[i - bpp] : 0;
    let value: number;
    switch (filter) {
      case 0:
        value = x;
        break;
      case 1:
        value = x + a;
        break;
      case 2:
        value = x + b;
        break;
      case 3:
        value = x + ((a + b) >> 1);
        break;
      case 4:
        value = x + paeth(a, b, c);
        break;
      default:
        throw new Error(`Unknown PNG filter ${filter}`);
    }
    dst[i] = value & 0xff;
  }
}

/**
 * iOS apps ship PNG icons in Apple's "CgBI" variant: BGRA pixels, premultiplied alpha,
 * and raw deflate without a zlib header. Browsers cannot display that variant, so it is
 * converted to a standard RGBA PNG. Ordinary PNGs are returned unchanged.
 */
export function toStandardPng(input: Uint8Array): Buffer {
  const buf = Buffer.from(input);
  const chunks = readChunks(buf);
  if (!chunks.some((c) => c.type === "CgBI")) return buf;

  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("CgBI PNG without IHDR");
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error("Unsupported CgBI PNG variant");
  }

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const raw = zlib.inflateRawSync(idat);
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const dst = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    unfilterRow(filter, src, dst, prev, 4);
  }

  // BGRA premultiplied -> RGBA straight alpha, with filter byte 0 on every row.
  const out = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const rowOut = y * (stride + 1);
    for (let x = 0; x < width; x++) {
      const si = y * stride + x * 4;
      const di = rowOut + 1 + x * 4;
      const b = pixels[si];
      const g = pixels[si + 1];
      const r = pixels[si + 2];
      const a = pixels[si + 3];
      if (a === 0) {
        out[di] = 0;
        out[di + 1] = 0;
        out[di + 2] = 0;
        out[di + 3] = 0;
      } else {
        out[di] = Math.min(255, Math.round((r * 255) / a));
        out[di + 1] = Math.min(255, Math.round((g * 255) / a));
        out[di + 2] = Math.min(255, Math.round((b * 255) / a));
        out[di + 3] = a;
      }
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk("IHDR", ihdr.data),
    writeChunk("IDAT", zlib.deflateSync(out, { level: 9 })),
    writeChunk("IEND", Buffer.alloc(0)),
  ]);
}
