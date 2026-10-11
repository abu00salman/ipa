import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { InstallPanel } from "@/components/InstallPanel";
import { ShareButtons } from "@/components/ShareButtons";
import { currentAdmin } from "@/lib/auth";
import { config } from "@/lib/env";
import { getAppBySlug, type AppRecord } from "@/lib/db";
import { eligibilityFor, type EligibilityCode } from "@/lib/install";
import { formatBytes, formatDate } from "@/lib/format";
import { requestContext } from "@/lib/request";
import { t, type DictKey, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const REASON_CODES: EligibilityCode[] = [
  "not_published",
  "not_signed",
  "https_required",
  "profile_missing",
  "profile_disabled",
  "profile_expired",
  "certificate_expired",
  "store_distribution",
  "unknown_distribution",
];

function reasonMap(lang: Lang): Record<string, string> {
  const map: Record<string, string> = { default: t(lang, "install_unavailable_title") };
  for (const code of REASON_CODES) map[code] = t(lang, `reason_${code}` as DictKey);
  return map;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) return { title: "Not found" };
  return {
    title: app.name,
    description: app.description.slice(0, 160) || app.name,
    openGraph: { title: app.name, description: app.description.slice(0, 160), url: `/app/${app.slug}`, images: app.iconPath ? [`/icon/${app.slug}`] : [] },
    robots: app.published ? undefined : { index: false, follow: false },
  };
}

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) notFound();

  const admin = await currentAdmin();
  if (!app.published && !admin) notFound();

  const ctx = await requestContext();
  const { lang } = ctx;
  const eligibility = eligibilityFor(app);
  const url = `${config.publicBaseUrl}/app/${app.slug}`;
  const signatureState = signatureBadge(app, lang);

  return (
    <article className="container-app pt-8 md:pt-12">
      {!app.published && (
        <p className="notice notice-warn mb-6">{lang === "ar" ? "معاينة للمدير فقط: هذا التطبيق غير منشور." : "Admin preview only: this app is not published."}</p>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_340px] md:items-start">
        <div className="min-w-0">
          <header className="reveal flex items-center gap-5">
            <AppIcon slug={app.slug} name={app.name} hasIcon={Boolean(app.iconPath)} size={112} />
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-extrabold tracking-tight md:text-4xl">{app.name}</h1>
              <p className="muted mt-1">{app.developer || app.bundleId}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge">v{app.version}{app.build ? ` (${app.build})` : ""}</span>
                <span className="badge">{formatBytes(app.sizeBytes, lang)}</span>
              </div>
            </div>
          </header>

          <dl className="card mt-8 grid grid-cols-2 gap-x-6 gap-y-5 p-5 text-sm md:grid-cols-3">
            <Info label={t(lang, "version")} value={app.version || "—"} />
            <Info label={t(lang, "size")} value={formatBytes(app.sizeBytes, lang)} />
            <Info label={t(lang, "updated")} value={formatDate(app.updatedAt, lang)} />
            <Info label={t(lang, "developer")} value={app.developer || "—"} />
            <Info label={t(lang, "min_ios")} value={app.minIos ? `iOS ${app.minIos}+` : "—"} />
            <Info label={t(lang, "devices")} value={app.devices.join(" · ") || "—"} />
            <div>
              <dt className="muted text-xs">{t(lang, "signature")}</dt>
              <dd className="mt-1">{signatureState}</dd>
            </div>
          </dl>

          {app.screenshots.length > 0 && (
            <section className="mt-10" aria-labelledby="shots">
              <h2 id="shots" className="mb-3 text-lg font-bold">{t(lang, "screenshots")}</h2>
              <div className="hscroll">
                {app.screenshots.map((_, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={`/shot/${app.slug}/${i}`} alt="" loading="lazy" className="h-[420px] w-auto rounded-[22px] border" style={{ borderColor: "var(--border)" }} />
                ))}
              </div>
            </section>
          )}

          {app.description && (
            <section className="mt-10" aria-labelledby="desc">
              <h2 id="desc" className="mb-3 text-lg font-bold">{t(lang, "description")}</h2>
              <p className="whitespace-pre-line leading-8">{app.description}</p>
            </section>
          )}

          {app.releaseNotes && (
            <section className="mt-10" aria-labelledby="notes">
              <h2 id="notes" className="mb-3 text-lg font-bold">{t(lang, "release_notes")}</h2>
              <p className="muted whitespace-pre-line leading-8">{app.releaseNotes}</p>
            </section>
          )}

          <div className="mt-10">
            <ShareButtons url={url} title={app.name} copyLabel={t(lang, "copy_link")} copiedLabel={t(lang, "copied")} shareLabel={t(lang, "share")} />
          </div>
        </div>

        <aside className="md:sticky md:top-24">
          <InstallPanel
            slug={app.slug}
            available={eligibility.ok && app.published}
            reasonCode={eligibility.ok ? null : eligibility.code}
            reasons={reasonMap(lang)}
            labels={{
              ready: t(lang, "install_state_ready"),
              checking: t(lang, "install_state_checking"),
              installing: t(lang, "install_state_installing"),
              install: t(lang, "install"),
              hint: t(lang, "install_hint_after"),
              helpTitle: t(lang, "install_help_title"),
              helpBody: t(lang, "install_help_body"),
              unsupported: t(lang, "install_unsupported_browser"),
              unavailableTitle: t(lang, "install_unavailable_title"),
              networkError: t(lang, "retry"),
              testflight: t(lang, "testflight_cta"),
              testflightUrl: app.testflightUrl,
            }}
          />
        </aside>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="muted text-xs">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function signatureBadge(app: AppRecord, lang: Lang) {
  if (app.signingStatus === "signed") return <span className="badge badge-ok">{t(lang, "signature_ok")}</span>;
  if (app.signingStatus === "failed") return <span className="badge badge-bad">{t(lang, "signature_failed")}</span>;
  return <span className="badge">{t(lang, "signature_pending")}</span>;
}
