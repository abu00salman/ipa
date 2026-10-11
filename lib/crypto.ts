import crypto from "node:crypto";
import { requireSecret } from "./env";

const CIPHER = "aes-256-gcm";
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function encryptionKey(): Buffer {
  const key = Buffer.from(requireSecret("certKey"), "base64");
  if (key.length !== 32) {
    throw new Error("CERT_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).");
  }
  return key;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<data>, all base64. */
export function encryptSecret(plain: Buffer | string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER, encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(payload: string): Buffer {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = crypto.createDecipheriv(CIPHER, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
}

/** Signs a JSON payload with HMAC-SHA256. Format: <base64url body>.<base64url sig>. */
export function signPayload(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string, secret: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, SCRYPT);
  // ":" separators on purpose: env loaders expand "$" even inside quotes.
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return crypto.timingSafeEqual(actual, expected);
}

/** Derives a purpose-specific key from the session secret so tokens cannot be reused across features. */
export function derivedKey(purpose: string): string {
  return crypto.createHmac("sha256", requireSecret("sessionSecret")).update(purpose).digest("hex");
}
