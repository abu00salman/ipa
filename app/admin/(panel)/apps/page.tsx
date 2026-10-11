import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { listApps } from "@/lib/db";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const { lang } = await requestContext();
  const apps = listApps();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t(lang, "admin_apps")}</h1>
        <Link href="/admin/apps/new" className="btn btn-primary">{t(lang, "new_app")}</Link>
      </div>
      {apps.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">{t(lang, "no_items")}</p>
          <p className="muted mt-2 text-sm">{t(lang, "empty_body")}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/apps/${a.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
                <AppIcon slug={a.slug} name={a.name} hasIcon={Boolean(a.iconPath)} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="muted truncate text-xs">{a.bundleId} · v{a.version} · {formatBytes(a.sizeBytes, lang)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`badge ${a.published ? "badge-ok" : ""}`}>{a.published ? t(lang, "stat_published") : t(lang, "step_pending")}</span>
                  <span className={`badge ${a.signingStatus === "signed" ? "badge-ok" : a.signingStatus === "failed" ? "badge-bad" : ""}`}>
                    {a.signingStatus === "signed" ? t(lang, "signature_ok") : a.signingStatus === "failed" ? t(lang, "signature_failed") : t(lang, "signature_pending")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
