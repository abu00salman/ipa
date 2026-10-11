import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { exportCatalog } = require("../scripts/export-catalog.mjs");

describe("static catalog export", () => {
  let dataDir = "";
  let siteDir = "";
  const id = "11111111-2222-4333-8444-555555555555";

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "irz-cat-data-"));
    siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "irz-cat-site-"));
    process.env.DATA_DIR = dataDir;
    const db = await import("../lib/db");
    db.insertApp({ id, slug: "demo-studio", name: "Demo <Studio>", bundleId: "com.example.demo", originalPath: `ipa/${id}/original.ipa` });
    db.updateApp(id, {
      published: true,
      version: "2.4.0",
      sizeBytes: 2048,
      developer: "Demo Studio",
      description: "Safe & <b>text</b>",
      devices: ["iPhone"],
      signingStatus: "signed",
      signedPath: `signed/${id}.ipa`,
      distribution: "ad-hoc",
      iconPath: `icons/${id}.png`,
    });
    const profileId = db.insertProfile({
      name: "Demo AdHoc",
      uuid: "U",
      teamId: "ABCDE12345",
      appIdentifier: "ABCDE12345.com.example.demo",
      distribution: "ad-hoc",
      notAfter: "2030-01-01T00:00:00.000Z",
      deviceCount: 1,
      certFingerprints: ["aa"],
      blobEnc: "unused",
    });
    db.updateApp(id, { profileId });
    fs.mkdirSync(path.join(dataDir, "icons"), { recursive: true });
    fs.mkdirSync(path.join(dataDir, "signed"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, `icons/${id}.png`), Buffer.from("89504e470d0a1a0a", "hex"));
    fs.writeFileSync(path.join(dataDir, `signed/${id}.ipa`), "SIGNED-IPA-BYTES");
  });

  it("exports metadata and media without copying signed IPAs by default", () => {
    const res = exportCatalog({ dataDir, siteDir, liveUrl: "https://live.test", origin: "https://abu00salman.github.io", withPackages: false });
    expect(res).toEqual({ apps: 1, packaged: 0 });
    const catalog = JSON.parse(fs.readFileSync(path.join(siteDir, "data/catalog.json"), "utf8"));
    expect(catalog.apps[0].name).toBe("Demo <Studio>");
    expect(catalog.apps[0].manifestUrl).toBeNull();
    expect(catalog.apps[0].liveUrl).toBe("https://live.test/app/demo-studio");
    expect(fs.existsSync(path.join(siteDir, "public/media/demo-studio/icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(siteDir, "public/packages"))).toBe(false);
  });

  it("publishes a manifest and package only when explicitly requested, on the Pages origin", () => {
    const res = exportCatalog({ dataDir, siteDir, liveUrl: "https://live.test", origin: "https://abu00salman.github.io", withPackages: true, now: new Date() });
    expect(res.packaged).toBe(1);
    const catalog = JSON.parse(fs.readFileSync(path.join(siteDir, "data/catalog.json"), "utf8"));
    expect(catalog.apps[0].manifestUrl).toBe("https://abu00salman.github.io/ipa/manifest/demo-studio.plist");
    const manifest = fs.readFileSync(path.join(siteDir, "public/manifest/demo-studio.plist"), "utf8");
    expect(manifest).toContain("https://abu00salman.github.io/ipa/packages/demo-studio.ipa");
    expect(manifest).toContain("<string>com.example.demo</string>");
    expect(fs.readFileSync(path.join(siteDir, "public/packages/demo-studio.ipa"), "utf8")).toBe("SIGNED-IPA-BYTES");
  });

  it("does not offer direct install after the profile expires", () => {
    const later = new Date("2031-06-01T00:00:00Z");
    exportCatalog({ dataDir, siteDir, liveUrl: "https://live.test", origin: "https://abu00salman.github.io", withPackages: true, now: later });
    const catalog = JSON.parse(fs.readFileSync(path.join(siteDir, "data/catalog.json"), "utf8"));
    expect(catalog.apps[0].manifestUrl).toBeNull();
  });
});
