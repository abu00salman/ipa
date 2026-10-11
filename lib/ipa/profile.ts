import { createHash } from "node:crypto";
import plist from "plist";
import type { Distribution } from "../db";

export interface ProfileInfo {
  name: string;
  uuid: string;
  teamId: string;
  /** Full application identifier, e.g. "ABCDE12345.com.example.app" or "ABCDE12345.*" */
  appIdentifier: string;
  distribution: Distribution;
  notAfter: Date;
  deviceCount: number;
  certFingerprints: string[];
  getTaskAllow: boolean;
}

/**
 * A .mobileprovision file is a CMS-signed wrapper around an XML plist. We read the plist
 * payload directly. Signature-chain verification against Apple's root is done at signing
 * time by the signing tool, which refuses malformed or mismatched profiles.
 */
export function parseProfile(buf: Buffer): ProfileInfo {
  const text = buf.toString("latin1");
  const start = text.indexOf("<?xml");
  const endMarker = "</plist>";
  const end = start >= 0 ? text.indexOf(endMarker, start) : -1;
  if (start < 0 || end < 0) {
    throw new Error("ملف Provisioning Profile غير صالح: لم يتم العثور على محتوى plist.");
  }
  const xml = Buffer.from(text.slice(start, end + endMarker.length), "latin1").toString("utf8");
  const p = plist.parse(xml);

  const entitlements = (p.Entitlements ?? {}) as Record<string, unknown>;
  const appIdentifier = String(entitlements["application-identifier"] ?? "");
  const teamId = String((p.TeamIdentifier as string[] | undefined)?.[0] ?? appIdentifier.split(".")[0] ?? "");
  const devices = Array.isArray(p.ProvisionedDevices) ? (p.ProvisionedDevices as string[]) : [];
  const certs = Array.isArray(p.DeveloperCertificates) ? (p.DeveloperCertificates as Buffer[]) : [];
  const getTaskAllow = entitlements["get-task-allow"] === true;

  if (!appIdentifier || !(p.ExpirationDate instanceof Date) || !p.UUID) {
    throw new Error("ملف Provisioning Profile لا يحتوي البيانات الأساسية المطلوبة.");
  }

  let distribution: Distribution = "app-store";
  if (p.ProvisionsAllDevices === true) distribution = "enterprise";
  else if (devices.length > 0) distribution = getTaskAllow ? "development" : "ad-hoc";

  return {
    name: String(p.Name ?? ""),
    uuid: String(p.UUID).toUpperCase(),
    teamId,
    appIdentifier,
    distribution,
    notAfter: p.ExpirationDate,
    deviceCount: devices.length,
    certFingerprints: certs.map((der) => createHash("sha1").update(der).digest("hex")),
    getTaskAllow,
  };
}

/** True when the profile's app identifier covers the bundle id (supports "TEAM.*" wildcards). */
export function profileCoversBundle(appIdentifier: string, bundleId: string): boolean {
  const dot = appIdentifier.indexOf(".");
  const pattern = dot >= 0 ? appIdentifier.slice(dot + 1) : appIdentifier;
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return bundleId.startsWith(pattern.slice(0, -1));
  return pattern === bundleId;
}
