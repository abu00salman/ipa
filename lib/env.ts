import path from "node:path";

function read(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

/** Server-only configuration. Read lazily so tests and builds can set env first. */
export const config = {
  get dataDir() {
    return path.resolve(read("DATA_DIR", "./data"));
  },
  get publicBaseUrl() {
    return read("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get primaryDomain() {
    return read("PRIMARY_DOMAIN", "iramzipa.com");
  },
  get adminEmail() {
    return read("ADMIN_EMAIL").toLowerCase();
  },
  get adminPasswordHash() {
    return read("ADMIN_PASSWORD_HASH");
  },
  get adminTotpSecret() {
    return read("ADMIN_TOTP_SECRET");
  },
  get sessionSecret() {
    return read("SESSION_SECRET");
  },
  get certKey() {
    return read("CERT_ENCRYPTION_KEY");
  },
  get zsignBin() {
    return read("ZSIGN_BIN");
  },
  get maxUploadBytes() {
    return Number(read("MAX_UPLOAD_MB", "500")) * 1024 * 1024;
  },
};

/** Throws a readable error when a secret needed by the requested feature is missing. */
export function requireSecret(name: "sessionSecret" | "certKey" | "adminPasswordHash"): string {
  const value = config[name];
  if (!value) {
    const envName = {
      sessionSecret: "SESSION_SECRET",
      certKey: "CERT_ENCRYPTION_KEY",
      adminPasswordHash: "ADMIN_PASSWORD_HASH",
    }[name];
    throw new Error(`${envName} is not set. See .env.example.`);
  }
  return value;
}
