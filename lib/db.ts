import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./env";

export type Distribution = "ad-hoc" | "enterprise" | "development" | "app-store" | "unknown";
export type SigningStatus = "uploaded" | "signing" | "signed" | "failed";

export interface AppRecord {
  id: string;
  slug: string;
  name: string;
  bundleId: string;
  version: string;
  build: string;
  minIos: string;
  devices: string[];
  sizeBytes: number;
  sha256: string;
  developer: string;
  description: string;
  releaseNotes: string;
  published: boolean;
  iconPath: string | null;
  originalPath: string;
  signedPath: string | null;
  signedAt: string | null;
  signingStatus: SigningStatus;
  signingError: string | null;
  distribution: Distribution;
  certificateId: string | null;
  profileId: string | null;
  screenshots: string[];
  testflightUrl: string | null;
  installRequests: number;
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRecord {
  id: string;
  name: string;
  kind: "distribution" | "development" | "unknown";
  teamId: string;
  subject: string;
  notAfter: string;
  fingerprint: string;
  disabled: boolean;
  p12Enc: string;
  passwordEnc: string;
  createdAt: string;
}

export interface ProfileRecord {
  id: string;
  name: string;
  uuid: string;
  teamId: string;
  appIdentifier: string;
  distribution: Distribution;
  notAfter: string;
  deviceCount: number;
  certFingerprints: string[];
  disabled: boolean;
  blobEnc: string;
  createdAt: string;
}

export interface LogRecord {
  id: number;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  build TEXT NOT NULL DEFAULT '',
  min_ios TEXT NOT NULL DEFAULT '',
  devices TEXT NOT NULL DEFAULT '[]',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  developer TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  release_notes TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  icon_path TEXT,
  original_path TEXT NOT NULL,
  signed_path TEXT,
  signed_at TEXT,
  signing_status TEXT NOT NULL DEFAULT 'uploaded',
  signing_error TEXT,
  distribution TEXT NOT NULL DEFAULT 'unknown',
  certificate_id TEXT,
  profile_id TEXT,
  screenshots TEXT NOT NULL DEFAULT '[]',
  testflight_url TEXT,
  install_requests INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  team_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  not_after TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  p12_enc TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  uuid TEXT NOT NULL,
  team_id TEXT NOT NULL,
  app_identifier TEXT NOT NULL,
  distribution TEXT NOT NULL,
  not_after TEXT NOT NULL,
  device_count INTEGER NOT NULL DEFAULT 0,
  cert_fingerprints TEXT NOT NULL DEFAULT '[]',
  disabled INTEGER NOT NULL DEFAULT 0,
  blob_enc TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_published ON apps (published, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs (created_at);
`;

let instance: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (instance) return instance;
  const file = path.join(config.dataDir, "iramzipa.db");
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  conn.exec(SCHEMA);
  instance = conn;
  return conn;
}

const now = () => new Date().toISOString();
const newId = () => randomUUID();

type Row = Record<string, any>;

function toApp(r: Row): AppRecord {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    bundleId: r.bundle_id,
    version: r.version,
    build: r.build,
    minIos: r.min_ios,
    devices: JSON.parse(r.devices),
    sizeBytes: r.size_bytes,
    sha256: r.sha256,
    developer: r.developer,
    description: r.description,
    releaseNotes: r.release_notes,
    published: r.published === 1,
    iconPath: r.icon_path,
    originalPath: r.original_path,
    signedPath: r.signed_path,
    signedAt: r.signed_at,
    signingStatus: r.signing_status,
    signingError: r.signing_error,
    distribution: r.distribution,
    certificateId: r.certificate_id,
    profileId: r.profile_id,
    screenshots: JSON.parse(r.screenshots),
    testflightUrl: r.testflight_url,
    installRequests: r.install_requests,
    downloads: r.downloads,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toCert(r: Row): CertificateRecord {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    teamId: r.team_id,
    subject: r.subject,
    notAfter: r.not_after,
    fingerprint: r.fingerprint,
    disabled: r.disabled === 1,
    p12Enc: r.p12_enc,
    passwordEnc: r.password_enc,
    createdAt: r.created_at,
  };
}

function toProfile(r: Row): ProfileRecord {
  return {
    id: r.id,
    name: r.name,
    uuid: r.uuid,
    teamId: r.team_id,
    appIdentifier: r.app_identifier,
    distribution: r.distribution,
    notAfter: r.not_after,
    deviceCount: r.device_count,
    certFingerprints: JSON.parse(r.cert_fingerprints),
    disabled: r.disabled === 1,
    blobEnc: r.blob_enc,
    createdAt: r.created_at,
  };
}

// ---------- Apps ----------

export function listApps(opts: { publishedOnly?: boolean; query?: string } = {}): AppRecord[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (opts.publishedOnly) clauses.push("published = 1");
  if (opts.query) {
    clauses.push("(name LIKE ? OR developer LIKE ? OR bundle_id LIKE ?)");
    const like = `%${opts.query}%`;
    params.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db().prepare(`SELECT * FROM apps ${where} ORDER BY created_at DESC`).all(...params) as Row[];
  return rows.map(toApp);
}

export function getAppById(id: string): AppRecord | null {
  const row = db().prepare("SELECT * FROM apps WHERE id = ?").get(id) as Row | undefined;
  return row ? toApp(row) : null;
}

export function getAppBySlug(slug: string): AppRecord | null {
  const row = db().prepare("SELECT * FROM apps WHERE slug = ?").get(slug) as Row | undefined;
  return row ? toApp(row) : null;
}

export function slugExists(slug: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM apps WHERE slug = ?").get(slug));
}

export function insertApp(input: Pick<AppRecord, "id" | "slug" | "name" | "bundleId" | "originalPath">): void {
  const ts = now();
  db()
    .prepare("INSERT INTO apps (id, slug, name, bundle_id, original_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(input.id, input.slug, input.name, input.bundleId, input.originalPath, ts, ts);
}

const APP_COLUMNS: Record<string, string> = {
  name: "name",
  bundleId: "bundle_id",
  version: "version",
  build: "build",
  minIos: "min_ios",
  devices: "devices",
  sizeBytes: "size_bytes",
  sha256: "sha256",
  developer: "developer",
  description: "description",
  releaseNotes: "release_notes",
  published: "published",
  iconPath: "icon_path",
  originalPath: "original_path",
  signedPath: "signed_path",
  signedAt: "signed_at",
  signingStatus: "signing_status",
  signingError: "signing_error",
  distribution: "distribution",
  certificateId: "certificate_id",
  profileId: "profile_id",
  screenshots: "screenshots",
  testflightUrl: "testflight_url",
};

export function updateApp(id: string, patch: Partial<Omit<AppRecord, "id" | "slug" | "createdAt">>): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const column = APP_COLUMNS[key];
    if (!column) throw new Error(`Unknown app field: ${key}`);
    sets.push(`${column} = ?`);
    if (key === "devices" || key === "screenshots") values.push(JSON.stringify(value));
    else if (key === "published") values.push(value ? 1 : 0);
    else values.push((value as string | number | null) ?? null);
  }
  if (!sets.length) return;
  sets.push("updated_at = ?");
  values.push(now(), id);
  db().prepare(`UPDATE apps SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function bumpCounter(id: string, field: "install_requests" | "downloads"): void {
  db().prepare(`UPDATE apps SET ${field} = ${field} + 1 WHERE id = ?`).run(id);
}

export function deleteApp(id: string): void {
  db().prepare("DELETE FROM apps WHERE id = ?").run(id);
}

// ---------- Certificates ----------

export function listCertificates(): CertificateRecord[] {
  return (db().prepare("SELECT * FROM certificates ORDER BY created_at DESC").all() as Row[]).map(toCert);
}

export function getCertificate(id: string): CertificateRecord | null {
  const row = db().prepare("SELECT * FROM certificates WHERE id = ?").get(id) as Row | undefined;
  return row ? toCert(row) : null;
}

export function insertCertificate(input: Omit<CertificateRecord, "id" | "createdAt" | "disabled">): string {
  const id = newId();
  db()
    .prepare(
      "INSERT INTO certificates (id, name, kind, team_id, subject, not_after, fingerprint, disabled, p12_enc, password_enc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .run(id, input.name, input.kind, input.teamId, input.subject, input.notAfter, input.fingerprint, input.p12Enc, input.passwordEnc, now());
  return id;
}

export function setCertificateDisabled(id: string, disabled: boolean): void {
  db().prepare("UPDATE certificates SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, id);
}

export function deleteCertificate(id: string): void {
  db().prepare("DELETE FROM certificates WHERE id = ?").run(id);
}

// ---------- Profiles ----------

export function listProfiles(): ProfileRecord[] {
  return (db().prepare("SELECT * FROM profiles ORDER BY created_at DESC").all() as Row[]).map(toProfile);
}

export function getProfile(id: string): ProfileRecord | null {
  const row = db().prepare("SELECT * FROM profiles WHERE id = ?").get(id) as Row | undefined;
  return row ? toProfile(row) : null;
}

export function insertProfile(input: Omit<ProfileRecord, "id" | "createdAt" | "disabled">): string {
  const id = newId();
  db()
    .prepare(
      "INSERT INTO profiles (id, name, uuid, team_id, app_identifier, distribution, not_after, device_count, cert_fingerprints, disabled, blob_enc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .run(
      id,
      input.name,
      input.uuid,
      input.teamId,
      input.appIdentifier,
      input.distribution,
      input.notAfter,
      input.deviceCount,
      JSON.stringify(input.certFingerprints),
      input.blobEnc,
      now(),
    );
  return id;
}

export function setProfileDisabled(id: string, disabled: boolean): void {
  db().prepare("UPDATE profiles SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, id);
}

export function deleteProfile(id: string): void {
  db().prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

// ---------- Settings ----------

export function readSettingsRaw(): Record<string, string> {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function writeSettings(values: Record<string, string>): void {
  const stmt = db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(values)) stmt.run(key, value);
}

// ---------- Logs ----------

export function addLog(level: LogRecord["level"], category: string, message: string, meta: Record<string, unknown> = {}): void {
  db()
    .prepare("INSERT INTO logs (level, category, message, meta, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(level, category, message.slice(0, 2000), JSON.stringify(meta).slice(0, 4000), now());
}

export function listLogs(limit = 200, category?: string): LogRecord[] {
  const rows = category
    ? (db().prepare("SELECT * FROM logs WHERE category = ? ORDER BY id DESC LIMIT ?").all(category, limit) as Row[])
    : (db().prepare("SELECT * FROM logs ORDER BY id DESC LIMIT ?").all(limit) as Row[]);
  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    category: r.category,
    message: r.message,
    meta: JSON.parse(r.meta),
    createdAt: r.created_at,
  }));
}
