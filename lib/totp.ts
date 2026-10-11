import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  const out: number[] = [];
  let value = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 secret");
    value = ((value << 5) | idx) & 0xfffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

function codeAt(key: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** RFC 6238 TOTP (30s step, 6 digits). Accepts one step of clock drift either way. */
export function verifyTotp(secretBase32: string, token: string, now = Date.now()): boolean {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const key = base32Decode(secretBase32);
  const counter = Math.floor(now / 30_000);
  let matched = false;
  for (const drift of [-1, 0, 1]) {
    const expected = codeAt(key, counter + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) matched = true;
  }
  return matched;
}

export function totpFor(secretBase32: string, now = Date.now()): string {
  return codeAt(base32Decode(secretBase32), Math.floor(now / 30_000));
}
