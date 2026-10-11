#!/usr/bin/env node
// Usage: npm run hash-password -- "your-strong-password"
// Prints an scrypt hash for ADMIN_PASSWORD_HASH. Parameters must match lib/crypto.ts.
import crypto from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: npm run hash-password -- \"<password of at least 12 characters>\"");
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
console.log(`scrypt:${salt.toString("base64")}:${key.toString("base64")}`);
