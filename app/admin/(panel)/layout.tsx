import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PrefToggles } from "@/components/PrefToggles";
import { logoutAction } from "../actions";
import { requireAdmin } from "@/lib/auth";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const ctx = await requestContext();
  const { lang } = ctx;
  const nav = [
    { href: "/admin", label: t(lang, "admin_dashboard") },
    { href: "/admin/apps", label: t(lang, "admin_apps") },
    { href: "/admin/certificates", label: t(lang, "admin_certificates") },
    { href: "/admin/settings", label: t(lang, "admin_settings") },
    { href: "/admin/logs", label: t(lang, "admin_logs") },
  ];
  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-40 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="container-app flex h-16 items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 font-bold">
            <Logo size={30} logoUrl={ctx.settings.logoUrl || undefined} />
            <span className="hidden sm:inline">{ctx.settings.storeName} · {t(lang, "admin_dashboard")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <PrefToggles
              lang={lang}
              initialTheme={ctx.theme}
              labels={{ language: t(lang, "language"), theme: t(lang, "theme"), light: t(lang, "theme_light"), dark: t(lang, "theme_dark"), system: t(lang, "theme_system") }}
            />
            <Link href="/" className="btn btn-ghost !min-h-9 !px-3 !text-sm">{t(lang, "admin_view_store")}</Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost !min-h-9 !px-3 !text-sm">{t(lang, "logout")}</button>
            </form>
          </div>
        </div>
      </header>
      <div className="container-app grid gap-6 py-6 md:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Admin" className="hscroll md:flex-col md:overflow-visible">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="btn btn-ghost !justify-start !border-transparent !px-4 !text-sm whitespace-nowrap">
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 reveal">{children}</main>
      </div>
    </div>
  );
}
