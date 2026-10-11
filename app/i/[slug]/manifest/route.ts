import { config } from "@/lib/env";
import { derivedKey, signPayload } from "@/lib/crypto";
import { getAppBySlug, getCertificate, getProfile } from "@/lib/db";
import { checkInstallEligibility } from "@/lib/install";
import { buildManifest } from "@/lib/manifest";

export const dynamic = "force-dynamic";

/** The manifest iOS fetches during installation. It points at a short-lived, signed download URL. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) return new Response("Not found", { status: 404 });

  const profile = app.profileId ? getProfile(app.profileId) : null;
  const cert = app.certificateId ? getCertificate(app.certificateId) : null;
  const eligibility = checkInstallEligibility(app, profile, cert, config.publicBaseUrl);
  if (!eligibility.ok) return new Response(`Not installable: ${eligibility.code}`, { status: 403 });

  const token = signPayload(
    { slug: app.slug, exp: Date.now() + 60 * 60_000 },
    derivedKey("download"),
  );
  const xml = buildManifest({
    bundleId: app.bundleId,
    version: app.version || "1.0",
    title: app.name,
    packageUrl: `${config.publicBaseUrl}/dl/${app.slug}?t=${encodeURIComponent(token)}`,
    iconUrl: `${config.publicBaseUrl}/icon/${app.slug}`,
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
