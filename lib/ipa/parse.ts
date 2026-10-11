import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import bplist from "bplist-parser";
import plist from "plist";
import { toStandardPng } from "./png";

export class IpaError extends Error {}

export interface IpaInfo {
  bundleId: string;
  name: string;
  version: string;
  build: string;
  minIos: string;
  devices: string[];
  executable: string;
  sizeBytes: number;
  sha256: string;
  icon: Buffer | null;
  alreadySigned: boolean;
}

const INFO_PATH = /^Payload\/[^/]+\.app\/Info\.plist$/;

export function parsePlist(buf: Buffer): Record<string, any> {
  if (buf.subarray(0, 8).toString("latin1") === "bplist00") {
    const [root] = bplist.parseBuffer(buf);
    return root as Record<string, any>;
  }
  return plist.parse(buf.toString("utf8")) as Record<string, any>;
}

function iconNames(info: Record<string, any>): string[] {
  const names = new Set<string>();
  const collect = (block: any) => {
    const files = block?.CFBundlePrimaryIcon?.CFBundleIconFiles;
    if (Array.isArray(files)) files.forEach((f) => typeof f === "string" && names.add(f));
  };
  collect(info.CFBundleIcons);
  collect(info["CFBundleIcons~ipad"]);
  if (Array.isArray(info.CFBundleIconFiles)) info.CFBundleIconFiles.forEach((f: unknown) => typeof f === "string" && names.add(f));
  if (typeof info.CFBundleIconFile === "string") names.add(info.CFBundleIconFile);
  return [...names];
}

const DEVICE_FAMILY: Record<number, string> = { 1: "iPhone", 2: "iPad", 3: "TV", 4: "Watch", 7: "Vision" };

/**
 * Reads an IPA entirely in memory. fflate's filter means only the entries we need are
 * decompressed, so a large IPA does not inflate every file.
 */
export function readIpa(data: Buffer): IpaInfo {
  if (data.length < 4 || data.readUInt32LE(0) !== 0x04034b50) {
    throw new IpaError("الملف ليس IPA صالحًا (ليس أرشيف ZIP).");
  }

  const infoFiles = unzipSync(data, { filter: (f) => INFO_PATH.test(f.name) });
  const infoName = Object.keys(infoFiles)[0];
  if (!infoName) throw new IpaError("لم يتم العثور على Payload/*.app/Info.plist داخل الملف.");

  const appDir = infoName.replace(/\/Info\.plist$/, "");
  const info = parsePlist(Buffer.from(infoFiles[infoName]));
  const bundleId = typeof info.CFBundleIdentifier === "string" ? info.CFBundleIdentifier : "";
  if (!bundleId) throw new IpaError("Info.plist لا يحتوي CFBundleIdentifier.");

  const wanted = iconNames(info);
  const iconCandidates = unzipSync(data, {
    filter: (f) => {
      if (!f.name.startsWith(appDir + "/") || !/\.png$/i.test(f.name)) return false;
      const base = f.name.slice(appDir.length + 1);
      if (base.includes("/")) return false;
      return wanted.length ? wanted.some((n) => base.startsWith(n)) : /^AppIcon/i.test(base);
    },
  });
  const largest = Object.entries(iconCandidates).sort((a, b) => b[1].length - a[1].length)[0];
  let icon: Buffer | null = null;
  if (largest) {
    try {
      icon = toStandardPng(largest[1]);
    } catch {
      icon = null;
    }
  }

  const alreadySigned = Object.keys(unzipSync(data, { filter: (f) => f.name === `${appDir}/_CodeSignature/CodeResources` })).length > 0;
  const families = Array.isArray(info.UIDeviceFamily) ? info.UIDeviceFamily : [1];

  return {
    bundleId,
    name: String(info.CFBundleDisplayName || info.CFBundleName || bundleId),
    version: String(info.CFBundleShortVersionString || info.CFBundleVersion || "1.0"),
    build: String(info.CFBundleVersion || ""),
    minIos: String(info.MinimumOSVersion || ""),
    devices: families.map((f: number) => DEVICE_FAMILY[f]).filter(Boolean),
    executable: String(info.CFBundleExecutable || ""),
    sizeBytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    icon,
    alreadySigned,
  };
}

/** Lightweight read of a signed IPA: used to verify the output of signing. */
export function inspectSignedIpa(data: Buffer): { bundleId: string; embeddedProfileUuid: string | null; hasCodeResources: boolean } {
  const files = unzipSync(data, {
    filter: (f) =>
      /^Payload\/[^/]+\.app\/(Info\.plist|embedded\.mobileprovision|_CodeSignature\/CodeResources)$/.test(f.name),
  });
  const infoName = Object.keys(files).find((n) => n.endsWith("/Info.plist"));
  const profileName = Object.keys(files).find((n) => n.endsWith("/embedded.mobileprovision"));
  const bundleId = infoName ? String(parsePlist(Buffer.from(files[infoName])).CFBundleIdentifier ?? "") : "";
  let embeddedProfileUuid: string | null = null;
  if (profileName) {
    const text = Buffer.from(files[profileName]).toString("latin1");
    const match = /<key>UUID<\/key>\s*<string>([0-9A-Fa-f-]{36})<\/string>/.exec(text);
    embeddedProfileUuid = match ? match[1].toUpperCase() : null;
  }
  const hasCodeResources = Object.keys(files).some((n) => n.endsWith("/_CodeSignature/CodeResources"));
  return { bundleId, embeddedProfileUuid, hasCodeResources };
}
