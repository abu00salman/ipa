import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { bumpCounter, getAppBySlug, getCertificate, getProfile } from "@/lib/db";
import { checkInstallEligibility } from "@/lib/install";
import { itmsInstallUrl } from "@/lib/manifest";

export const dynamic = "force-dynamic";

/**
 * Called by the install button right before it opens the itms-services link.
 * It returns whether iOS should be asked to install, and never claims that installation succeeded.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) return NextResponse.json({ ok: false, code: "not_published" }, { status: 404 });

  const profile = app.profileId ? getProfile(app.profileId) : null;
  const cert = app.certificateId ? getCertificate(app.certificateId) : null;
  const eligibility = checkInstallEligibility(app, profile, cert, config.publicBaseUrl);
  if (!eligibility.ok) {
    return NextResponse.json({ ok: false, code: eligibility.code, distribution: eligibility.distribution }, { status: 409 });
  }

  bumpCounter(app.id, "install_requests");
  const manifestUrl = `${config.publicBaseUrl}/i/${app.slug}/manifest`;
  return NextResponse.json({ ok: true, code: "ok", installUrl: itmsInstallUrl(manifestUrl) });
}
