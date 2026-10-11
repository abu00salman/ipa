import { randomBytes, randomUUID } from "node:crypto";
import { addLog, getAppById, insertApp, slugExists, updateApp, type AppRecord } from "./db";
import { readIpa, type IpaInfo } from "./ipa/parse";
import { removeBlob, writeBlob } from "./storage";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Picks a readable, unique slug. Arabic-only names fall back to the bundle id, then to a random suffix. */
export function uniqueSlug(name: string, bundleId: string): string {
  const base = slugify(name) || slugify(bundleId.split(".").pop() ?? "") || "app";
  if (!slugExists(base)) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(2).toString("hex")}`;
    if (!slugExists(candidate)) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export interface IngestResult {
  app: AppRecord;
  info: IpaInfo;
  replacedBuild: boolean;
}

/**
 * Stores an uploaded IPA and its extracted metadata.
 * New uploads create a draft. Uploading a new build for an existing app replaces the binary
 * and resets signing and publication, so an unsigned or stale build is never served.
 */
export async function ingestIpa(data: Buffer, existingAppId?: string): Promise<IngestResult> {
  const info = readIpa(data);
  const existing = existingAppId ? getAppById(existingAppId) : null;

  if (existingAppId && !existing) throw new Error("التطبيق المطلوب غير موجود.");
  if (existing && existing.bundleId !== info.bundleId) {
    throw new Error(`Bundle ID مختلف (${info.bundleId}). لا يمكن تحديث ${existing.bundleId} بملف آخر.`);
  }

  const id = existing?.id ?? randomUUID();
  const originalPath = await writeBlob(`ipa/${id}/original.ipa`, data);
  let iconPath = existing?.iconPath ?? null;
  if (info.icon) iconPath = await writeBlob(`icons/${id}.png`, info.icon, 0o644);

  if (!existing) {
    insertApp({ id, slug: uniqueSlug(info.name, info.bundleId), name: info.name, bundleId: info.bundleId, originalPath });
  }

  const replacedBuild = Boolean(existing);
  updateApp(id, {
    version: info.version,
    build: info.build,
    minIos: info.minIos,
    devices: info.devices,
    sizeBytes: info.sizeBytes,
    sha256: info.sha256,
    originalPath,
    iconPath,
    ...(replacedBuild
      ? { signedPath: null, signedAt: null, signingStatus: "uploaded" as const, signingError: null, published: false, distribution: "unknown" as const }
      : { name: info.name }),
  });

  const app = getAppById(id);
  if (!app) throw new Error("تعذّر حفظ التطبيق.");
  addLog("info", "upload", `${replacedBuild ? "تحديث" : "رفع"} ${info.name} ${info.version} (${info.bundleId})`, {
    appId: id,
    sizeBytes: info.sizeBytes,
    alreadySigned: info.alreadySigned,
  });
  return { app, info, replacedBuild };
}

/** Removes stored files for an app (used on delete). */
export async function purgeAppFiles(app: AppRecord): Promise<void> {
  await Promise.all([
    removeBlob(`ipa/${app.id}/original.ipa`),
    removeBlob(`signed/${app.id}.ipa`),
    removeBlob(`icons/${app.id}.png`),
    ...app.screenshots.map((rel) => removeBlob(rel)),
  ]);
}
