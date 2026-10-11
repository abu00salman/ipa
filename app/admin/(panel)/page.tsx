import Link from "next/link";
import { config } from "@/lib/env";
import { listApps, listCertificates, listProfiles } from "@/lib/db";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";
import { CertBadge } from "@/components/admin/CertBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { lang } = await requestContext();
  const apps = listApps();
  const certs = listCertificates();
  const profiles = listProfiles();
  const now = Date.now();
  const validCerts = certs.filter((c) => !c.disabled && new Date(c.notAfter).getTime() > now).length;
  const published = apps.filter((a) => a.published).length;
  const installs = apps.reduce((n, a) => n + a.installRequests, 0);
  const downloads = apps.reduce((n, a) => n + a.downloads, 0);

  const stats = [
    { label: t(lang, "stat_apps"), value: apps.length },
    { label: t(lang, "stat_published"), value: published },
    { label: t(lang, "stat_pending"), value: apps.length - published },
    { label: t(lang, "stat_certs"), value: validCerts },
    { label: t(lang, "stat_profiles"), value: profiles.length },
    { label: t(lang, "stat_installs"), value: installs },
    { label: t(lang, "stat_downloads"), value: downloads },
  ];

  const health = [
    { label: t(lang, "health_signing_tool"), ok: Boolean(config.zsignBin) },
    { label: t(lang, "health_secrets"), ok: Boolean(config.certKey && config.sessionSecret && config.adminPasswordHash) },
    { label: t(lang, "health_https"), ok: config.publicBaseUrl.startsWith("https://") },
    { label: t(lang, "health_db"), ok: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t(lang, "admin_dashboard")}</h1>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="stats">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="muted text-xs">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t(lang, "recent_apps")}</h2>
            <Link href="/admin/apps" className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{t(lang, "view_all")}</Link>
          </div>
          {apps.length === 0 ? (
            <p className="muted text-sm">{t(lang, "no_items")}</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {apps.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/apps/${a.id}`} className="min-w-0 truncate font-semibold">{a.name}</Link>
                  <span className={`badge ${a.published ? "badge-ok" : ""}`}>v{a.version}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">{t(lang, "cert_section")}</h2>
          {certs.length === 0 ? (
            <p className="muted text-sm">{t(lang, "no_certificates")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {certs.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{c.name}</span>
                  <CertBadge expired={new Date(c.notAfter).getTime() <= now} disabled={c.disabled} notAfter={c.notAfter} lang={lang} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">{t(lang, "health_title")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {health.map((h) => (
              <li key={h.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{h.label}</span>
                <span className={`badge ${h.ok ? "badge-ok" : "badge-warn"}`}>{h.ok ? t(lang, "health_ok") : t(lang, "health_missing")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
