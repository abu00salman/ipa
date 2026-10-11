import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ lang, settings }: { lang: Lang; settings: SiteSettings }) {
  const socials = [
    { href: settings.telegramUrl, label: "Telegram" },
    { href: settings.xUrl, label: "X" },
    { href: settings.instagramUrl, label: "Instagram" },
  ].filter((s) => s.href);
  return (
    <footer className="mt-20 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="container-app flex flex-col gap-6 py-10 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">{settings.storeName}</p>
          <p className="muted mt-1">{t(lang, "tagline")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {settings.supportEmail && (
            <a className="muted hover:opacity-80" href={`mailto:${settings.supportEmail}`}>
              {t(lang, "support_email")}
            </a>
          )}
          {socials.map((s) => (
            <a key={s.label} className="muted hover:opacity-80" href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
        <div className="muted flex flex-col gap-1 md:items-end">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. {t(lang, "footer_rights")}
          </p>
          <Link href="/admin" className="text-xs opacity-70 hover:opacity-100">
            {t(lang, "nav_admin")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
