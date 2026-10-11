import Link from "next/link";
import { Logo } from "./Logo";
import { PrefToggles } from "./PrefToggles";
import { t, type Lang } from "@/lib/i18n";
import type { SiteSettings } from "@/lib/settings";

export function Header({ lang, settings, theme }: { lang: Lang; settings: SiteSettings; theme?: "light" | "dark" }) {
  const links = [
    { href: "/#apps", label: t(lang, "nav_apps") },
    { href: "/#how", label: t(lang, "nav_how") },
    { href: "/#support", label: t(lang, "nav_support") },
  ];
  return (
    <header className="glass sticky top-0 z-40 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight" aria-label={settings.storeName}>
          <Logo size={32} logoUrl={settings.logoUrl || undefined} />
          <span className="text-[17px]">{settings.storeName}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label={t(lang, "nav_menu")}>
          {links.map((l) => (
            <a key={l.href} href={l.href} className="muted transition hover:opacity-80">
              {l.label}
            </a>
          ))}
        </nav>
        <PrefToggles
          lang={lang}
          initialTheme={theme}
          labels={{
            language: t(lang, "language"),
            theme: t(lang, "theme"),
            light: t(lang, "theme_light"),
            dark: t(lang, "theme_dark"),
            system: t(lang, "theme_system"),
          }}
        />
      </div>
      <nav className="container-app flex gap-5 overflow-x-auto pb-3 text-sm font-medium md:hidden" aria-label={t(lang, "nav_menu")}>
        {links.map((l) => (
          <a key={l.href} href={l.href} className="muted whitespace-nowrap">
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
