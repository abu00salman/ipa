import Link from "next/link";
import { AppIcon } from "./AppIcon";
import { type AppRecord } from "@/lib/db";
import { eligibilityFor } from "@/lib/install";
import { formatBytes } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";

export function AppCardView({ app, lang }: { app: AppRecord; lang: Lang }) {
  const eligible = eligibilityFor(app).ok;
  return (
    <Link href={`/app/${app.slug}`} className="card group flex h-full gap-4 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <AppIcon slug={app.slug} name={app.name} hasIcon={Boolean(app.iconPath)} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold">{app.name}</h3>
          <span className="badge shrink-0" style={{ color: "var(--primary)" }}>{t(lang, "view")}</span>
        </div>
        <p className="muted truncate text-xs">{app.developer || app.bundleId}</p>
        {app.description && <p className="mt-1.5 line-clamp-2 text-sm leading-6">{app.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="badge">v{app.version}</span>
          <span className="badge">{formatBytes(app.sizeBytes, lang)}</span>
          <span className={`badge ${eligible ? "badge-ok" : ""}`}>{eligible ? t(lang, "available") : t(lang, "unavailable")}</span>
        </div>
      </div>
    </Link>
  );
}
