import { config } from "./env";
import { getCertificate, getProfile, type AppRecord, type CertificateRecord, type ProfileRecord } from "./db";

export type EligibilityCode =
  | "ok"
  | "not_published"
  | "not_signed"
  | "https_required"
  | "profile_missing"
  | "profile_disabled"
  | "profile_expired"
  | "certificate_expired"
  | "store_distribution"
  | "unknown_distribution";

export interface Eligibility {
  ok: boolean;
  code: EligibilityCode;
  /** Shown to the admin and used to decide whether the install button is usable. */
  distribution: AppRecord["distribution"];
}

/**
 * Decides whether this app can be installed directly from the website.
 * It checks only what the server knows. Whether the device's UDID is in the profile is
 * decided by iOS itself, and the UI says so rather than claiming success.
 */
export function checkInstallEligibility(
  app: AppRecord,
  profile: ProfileRecord | null,
  cert: CertificateRecord | null,
  publicBaseUrl: string,
  now = new Date(),
): Eligibility {
  const base = { distribution: app.distribution };
  if (!app.published) return { ...base, ok: false, code: "not_published" };
  if (app.signingStatus !== "signed" || !app.signedPath) return { ...base, ok: false, code: "not_signed" };
  if (!publicBaseUrl.startsWith("https://")) return { ...base, ok: false, code: "https_required" };
  if (!profile) return { ...base, ok: false, code: "profile_missing" };
  if (profile.disabled) return { ...base, ok: false, code: "profile_disabled" };
  if (new Date(profile.notAfter) <= now) return { ...base, ok: false, code: "profile_expired" };
  if (cert && new Date(cert.notAfter) <= now) return { ...base, ok: false, code: "certificate_expired" };
  if (app.distribution === "app-store") return { ...base, ok: false, code: "store_distribution" };
  if (app.distribution === "unknown") return { ...base, ok: false, code: "unknown_distribution" };
  return { ...base, ok: true, code: "ok" };
}

/** Eligibility for a stored app, loading its profile and certificate. Server-only. */
export function eligibilityFor(app: AppRecord, now = new Date()): Eligibility {
  const profile = app.profileId ? getProfile(app.profileId) : null;
  const cert = app.certificateId ? getCertificate(app.certificateId) : null;
  return checkInstallEligibility(app, profile, cert, config.publicBaseUrl, now);
}
