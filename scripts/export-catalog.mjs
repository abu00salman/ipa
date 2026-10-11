#!/usr/bin/env node
// Exports the published catalog from the server database into the static storefront (site/).
// Run locally or on the server, never in CI: the database is private.
//
//   node scripts/export-catalog.mjs [--live-url https://your-server] [--origin https://abu00salman.github.io]
//                                   [--with-packages]
//
// Default: catalog metadata and public media (icons, screenshots) only.
// --with-packages: also publishes signed IPAs and install manifests, so the Pages site can install directly.
//   Signed IPAs are public once published. Only use this for builds you are willing to share.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import plist from "plist";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PATH = process.env.SITE_BASE_PATH ?? "/ipa";

const INSTALLABLE_DISTRIBUTIONS = new Set(["ad-hoc", "enterprise"]);

/** Reads published apps and the store settings. Certificates, profiles and logs are never read. */
export function readCatalogSource(dataDir) {
  const file = path.join(dataDir, "iramzipa.db");
  if (!fs.existsSync(file)) return { apps: [], settings: {} };
  const db = new DatabaseSync(file);
  try {
    const apps = db
      .prepare(
        `SELECT a.id, a.slug, a.name, a.developer, a.description, a.release_notes, a.version, a.build, a.min_ios,
                a.devices, a.size_bytes, a.icon_path, a.screenshots, a.updated_at, a.testflight_url,
                a.signing_status, a.signed_path, a.distribution, a.bundle_id, p.not_after AS profile_not_after,
                p.disabled AS profile_disabled
           FROM apps a LEFT JOIN profiles p ON p.id = a.profile_id
          WHERE a.published = 1 ORDER BY a.created_at DESC`,
      )
      .all();
    const settings = Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value]));
    return { apps, settings };
  } finally {
    db.close();
  }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Builds the manifest.plist for a signed package hosted by the Pages site. */
export function buildPagesManifest({ bundleId, version, title, packageUrl, iconUrl }) {
  return plist.build({
    items: [
      {
        assets: [
          { kind: "software-package", url: packageUrl },
          { kind: "display-image", url: iconUrl },
          { kind: "full-size-image", url: iconUrl },
        ],
        metadata: { "bundle-identifier": bundleId, "bundle-version": version, kind: "software", title },
      },
    ],
  });
}

export function exportCatalog({ dataDir, siteDir, liveUrl, origin, withPackages, now = new Date() }) {
  const { apps, settings } = readCatalogSource(dataDir);
  const nowMs = now.getTime();
  const publicDir = path.join(siteDir, "public");
  for (const rel of ["media", "packages", "manifest"]) fs.rmSync(path.join(publicDir, rel), { recursive: true, force: true });

  const siteOrigin = `${origin.replace(/\/$/, "")}${BASE_PATH}`;
  const liveBase = liveUrl.replace(/\/$/, "");
  const entries = [];
  let packaged = 0;

  for (const app of apps) {
    const copy = (rel, dest) => {
      if (!rel) return null;
      const src = path.join(dataDir, rel);
      if (!fs.existsSync(src)) return null;
      fs.mkdirSync(path.dirname(path.join(publicDir, dest)), { recursive: true });
      fs.copyFileSync(src, path.join(publicDir, dest));
      return dest;
    };

    const icon = copy(app.icon_path, `media/${app.slug}/icon.png`);
    const screenshots = JSON.parse(app.screenshots).map((rel, i) => copy(rel, `media/${app.slug}/shot-${i}${path.extname(rel) || ".png"}`)).filter(Boolean);

    let manifestUrl = null;
    const profileValid = app.profile_not_after && !app.profile_disabled && new Date(app.profile_not_after).getTime() > nowMs;
    const installable =
      withPackages && app.signing_status === "signed" && app.signed_path && INSTALLABLE_DISTRIBUTIONS.has(app.distribution) && profileValid;
    if (installable && fs.existsSync(path.join(dataDir, app.signed_path))) {
      copy(app.signed_path, `packages/${app.slug}.ipa`);
      const manifestRel = `manifest/${app.slug}.plist`;
      fs.mkdirSync(path.join(publicDir, "manifest"), { recursive: true });
      fs.writeFileSync(
        path.join(publicDir, manifestRel),
        buildPagesManifest({
          bundleId: app.bundle_id,
          version: app.version || "1.0",
          title: app.name,
          packageUrl: `${siteOrigin}/packages/${app.slug}.ipa`,
          iconUrl: `${siteOrigin}/${icon ?? `media/${app.slug}/icon.png`}`,
        }),
      );
      manifestUrl = `${siteOrigin}/${manifestRel}`;
      packaged += 1;
    }

    entries.push({
      slug: app.slug,
      name: app.name,
      developer: app.developer,
      description: app.description,
      releaseNotes: app.release_notes,
      version: app.version,
      build: app.build,
      minIos: app.min_ios,
      devices: JSON.parse(app.devices),
      sizeBytes: app.size_bytes,
      updatedAt: app.updated_at,
      icon,
      screenshots,
      testflightUrl: app.testflight_url,
      manifestUrl,
      liveUrl: `${liveBase}/app/${app.slug}`,
      distribution: app.distribution,
    });
  }

  const catalog = {
    generatedAt: now.toISOString(),
    settings: {
      storeName: settings.storeName || "iRaMzipa",
      palette: ["blue", "purple", "aurora"].includes(settings.palette) ? settings.palette : "blue",
      supportEmail: settings.supportEmail || "",
      telegramUrl: settings.telegramUrl || "",
      xUrl: settings.xUrl || "",
      instagramUrl: settings.instagramUrl || "",
    },
    apps: entries,
  };
  fs.mkdirSync(path.join(siteDir, "data"), { recursive: true });
  fs.writeFileSync(path.join(siteDir, "data", "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  return { apps: entries.length, packaged };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const result = exportCatalog({
    dataDir: path.resolve(root, process.env.DATA_DIR || "data"),
    siteDir: path.join(root, "site"),
    liveUrl: opt("--live-url", process.env.PUBLIC_BASE_URL || "https://iramzipa.com"),
    origin: opt("--origin", "https://abu00salman.github.io"),
    withPackages: args.includes("--with-packages"),
  });
  console.log(`Catalog exported: ${result.apps} app(s), ${result.packaged} with direct install.`);
}
