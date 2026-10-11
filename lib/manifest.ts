import plist from "plist";

export interface ManifestInput {
  bundleId: string;
  version: string;
  title: string;
  /** Must be an HTTPS URL to the signed IPA. iOS refuses plain HTTP. */
  packageUrl: string;
  /** HTTPS URL to a PNG icon. */
  iconUrl: string;
}

/**
 * Builds the manifest.plist consumed by itms-services://?action=download-manifest.
 * This is the standard OTA install format for Ad Hoc, Enterprise, and Development builds.
 */
export function buildManifest(input: ManifestInput): string {
  return plist.build({
    items: [
      {
        assets: [
          { kind: "software-package", url: input.packageUrl },
          { kind: "display-image", url: input.iconUrl },
          { kind: "full-size-image", url: input.iconUrl },
        ],
        metadata: {
          "bundle-identifier": input.bundleId,
          "bundle-version": input.version,
          kind: "software",
          title: input.title,
        },
      },
    ],
  });
}

export function itmsInstallUrl(manifestUrl: string): string {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
}
