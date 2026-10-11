"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Logo } from "../../components/Logo";
import { ShareButtons } from "../../components/ShareButtons";
import { t, isLang, dirOf, type DictKey, type Lang } from "../../lib/i18n";
import { assetUrl, type Catalog, type CatalogApp } from "../lib/catalog";

type Theme = "light" | "dark" | "system";
const LANG_KEY = "irz_lang";
const THEME_KEY = "irz_theme";

interface Prefs {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

const PrefsContext = createContext<Prefs>({ lang: "ar", theme: "system", setLang: () => {}, setTheme: () => {} });
export const usePrefs = () => useContext(PrefsContext);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Language and theme live in the browser. Language follows the stored choice, then the browser, and defaults to Arabic. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = readStorage(LANG_KEY);
    const browser = (navigator.language || "").toLowerCase();
    setLangState(isLang(stored ?? undefined) ? (stored as Lang) : browser.startsWith("ar") || !browser ? "ar" : "en");
    const storedTheme = readStorage(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") setThemeState(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<Prefs>(
    () => ({
      lang,
      theme,
      setLang: (l) => {
        setLangState(l);
        try {
          localStorage.setItem(LANG_KEY, l);
        } catch {
          /* storage disabled */
        }
      },
      setTheme: (th) => {
        setThemeState(th);
        try {
          localStorage.setItem(THEME_KEY, th);
        } catch {
          /* storage disabled */
        }
      },
    }),
    [lang, theme],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function Prefs() {
  const { lang, theme, setLang, setTheme } = usePrefs();
  const themeLabel = theme === "light" ? t(lang, "theme_light") : theme === "dark" ? t(lang, "theme_dark") : t(lang, "theme_system");
  const nextTheme: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const btn = "btn btn-ghost !min-h-9 !px-3 !text-sm";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => setTheme(nextTheme)} aria-label={`${t(lang, "theme")}: ${themeLabel}`}>
        <span className="hidden sm:inline">{themeLabel}</span>
        <span className="sm:hidden" aria-hidden="true">◐</span>
      </button>
      <button type="button" className={btn} onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={t(lang, "language")}>
        <span aria-hidden="true">{lang === "ar" ? "EN" : "ع"}</span>
      </button>
    </div>
  );
}

export function Header({ catalog }: { catalog: Catalog }) {
  const { lang } = usePrefs();
  const links = [
    { href: "/#apps", label: t(lang, "nav_apps") },
    { href: "/#how", label: t(lang, "nav_how") },
    { href: "/#support", label: t(lang, "nav_support") },
  ];
  return (
    <header className="glass sticky top-0 z-40 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <Logo size={32} />
          <span className="text-[17px]">{catalog.settings.storeName}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="muted hover:opacity-80">{l.label}</a>
          ))}
        </nav>
        <Prefs />
      </div>
      <nav className="container-app flex gap-5 overflow-x-auto pb-3 text-sm font-medium md:hidden">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="muted whitespace-nowrap">{l.label}</a>
        ))}
      </nav>
    </header>
  );
}

export function Footer({ catalog }: { catalog: Catalog }) {
  const { lang } = usePrefs();
  const s = catalog.settings;
  const socials = [
    { href: s.telegramUrl, label: "Telegram" },
    { href: s.xUrl, label: "X" },
    { href: s.instagramUrl, label: "Instagram" },
  ].filter((x) => x.href);
  return (
    <footer className="mt-20 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="container-app flex flex-col gap-6 py-10 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">{s.storeName}</p>
          <p className="muted mt-1">{t(lang, "tagline")}</p>
          <p className="muted mt-2 max-w-md text-xs leading-6">{t(lang, "static_note")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {s.supportEmail && <a className="muted hover:opacity-80" href={`mailto:${s.supportEmail}`}>{t(lang, "support_email")}</a>}
          {socials.map((x) => (
            <a key={x.label} className="muted hover:opacity-80" href={x.href} target="_blank" rel="noopener noreferrer">{x.label}</a>
          ))}
        </div>
        <p className="muted">© {new Date().getFullYear()} {s.storeName}. {t(lang, "footer_rights")}</p>
      </div>
    </footer>
  );
}

export function StoreIcon({ app, size }: { app: CatalogApp; size: number }) {
  if (app.icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={assetUrl(app.icon)} alt="" width={size} height={size} className="app-icon" loading="lazy" decoding="async" />;
  }
  return (
    <div aria-hidden="true" className="app-icon app-icon-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {app.name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function formatSize(bytes: number, lang: Lang): string {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale).format(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function Card({ app }: { app: CatalogApp }) {
  const { lang } = usePrefs();
  const available = Boolean(app.manifestUrl);
  return (
    <Link href={`/app/${app.slug}/`} className="card group flex h-full gap-4 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <StoreIcon app={app} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold">{app.name}</h3>
          <span className="badge shrink-0" style={{ color: "var(--primary)" }}>{t(lang, "view")}</span>
        </div>
        <p className="muted truncate text-xs">{app.developer || app.slug}</p>
        {app.description && <p className="mt-1.5 line-clamp-2 text-sm leading-6">{app.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="badge">v{app.version}</span>
          <span className="badge">{formatSize(app.sizeBytes, lang)}</span>
          <span className={`badge ${available ? "badge-ok" : ""}`}>{available ? t(lang, "available") : t(lang, "install_via_live")}</span>
        </div>
      </div>
    </Link>
  );
}

export function Home({ catalog }: { catalog: Catalog }) {
  const { lang } = usePrefs();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const apps = catalog.apps.filter((a) => !q || `${a.name} ${a.developer} ${a.slug}`.toLowerCase().includes(q));
  return (
    <>
      <section className="container-app pb-10 pt-14 text-center md:pt-20">
        <h1 className="reveal text-[34px] font-extrabold leading-tight tracking-tight md:text-[52px]">
          <span className="gradient-text">{t(lang, "hero_title")}</span>
        </h1>
        <p className="muted reveal mx-auto mt-4 max-w-xl text-[16px] leading-8 md:text-lg">{t(lang, "hero_body")}</p>
        <div role="search" className="reveal mx-auto mt-8 flex max-w-xl items-center gap-2">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder={t(lang, "search_placeholder")} aria-label={t(lang, "search_placeholder")} />
        </div>
      </section>

      <section id="apps" className="container-app scroll-mt-24 py-8" aria-labelledby="apps-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 id="apps-title" className="text-2xl font-bold tracking-tight">{t(lang, "apps_title")}</h2>
          <span className="muted text-sm">{catalog.apps.length === 1 ? t(lang, "apps_count_one") : t(lang, "apps_count", { count: catalog.apps.length })}</span>
        </div>
        {apps.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {["feature_1", "feature_2", "feature_3"].map((key, i) => (
              <div key={key} className="card p-6">
                <div className="btn btn-soft !min-h-10 !w-10 !p-0 mb-4 font-bold">{i + 1}</div>
                <h3 className="font-semibold">{t(lang, `${key}_title` as DictKey)}</h3>
                <p className="muted mt-2 text-sm leading-7">{t(lang, `${key}_body` as DictKey)}</p>
              </div>
            ))}
            <div className="card px-6 py-8 text-center md:col-span-3">
              <p className="text-lg font-semibold">{q ? t(lang, "no_results") : t(lang, "empty_title")}</p>
              {!q && <p className="muted mt-2">{t(lang, "empty_body")}</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => <Card key={app.slug} app={app} />)}
          </div>
        )}
      </section>

      <section id="how" className="container-app scroll-mt-24 py-12" aria-labelledby="how-title">
        <h2 id="how-title" className="mb-5 text-2xl font-bold tracking-tight">{t(lang, "how_title")}</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {(["how_1", "how_2", "how_3", "how_4"] as DictKey[]).map((key, i) => (
            <li key={key} className="card flex gap-4 p-5">
              <span className="btn btn-soft !min-h-9 !w-9 !p-0 shrink-0 self-start font-bold">{i + 1}</span>
              <p className="text-sm leading-7">{t(lang, key)}</p>
            </li>
          ))}
        </ol>
        <p className="muted mt-5 text-sm leading-7">{t(lang, "how_note")}</p>
      </section>

      <section id="support" className="container-app scroll-mt-24 py-12" aria-labelledby="support-title">
        <div className="card flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="support-title" className="text-xl font-bold">{t(lang, "support_title")}</h2>
            <p className="muted mt-1 text-sm leading-7">{t(lang, "support_body")}</p>
          </div>
          {catalog.settings.supportEmail && (
            <a className="btn btn-primary shrink-0" href={`mailto:${catalog.settings.supportEmail}`}>{catalog.settings.supportEmail}</a>
          )}
        </div>
      </section>
    </>
  );
}

type Phase = "ready" | "installing";

/** Direct install when a signed package is published; otherwise a link to the live server, where signing lives. */
function StaticInstall({ app }: { app: CatalogApp }) {
  const { lang } = usePrefs();
  const [isIOS, setIsIOS] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  const liveLabel = t(lang, "install_via_live");
  return (
    <div className="card p-5">
      {app.manifestUrl ? (
        <>
          <a
            className="btn btn-primary w-full !text-[17px]"
            href={isIOS ? `itms-services://?action=download-manifest&url=${encodeURIComponent(app.manifestUrl)}` : undefined}
            aria-disabled={!isIOS}
            onClick={() => isIOS && setPhase("installing")}
          >
            {phase === "installing" ? t(lang, "install_state_installing") : t(lang, "install")}
          </a>
          {!isIOS && <p className="notice notice-warn mt-4">{t(lang, "install_unsupported_browser")}</p>}
          {phase === "installing" && <p className="muted mt-4 text-sm leading-7">{t(lang, "install_hint_after")}</p>}
        </>
      ) : (
        <a className="btn btn-primary w-full !text-[17px]" href={app.liveUrl} target="_blank" rel="noopener noreferrer">
          {liveLabel}
        </a>
      )}
      {app.testflightUrl && (
        <a href={app.testflightUrl} target="_blank" rel="noopener noreferrer" className="btn btn-soft mt-3 w-full">
          {t(lang, "testflight_cta")}
        </a>
      )}
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">{t(lang, "install_help_title")}</summary>
        <p className="muted mt-2 leading-7">{t(lang, "install_help_body")}</p>
      </details>
    </div>
  );
}

export function AppDetail({ app }: { app: CatalogApp }) {
  const { lang } = usePrefs();
  return (
    <article className="container-app pt-8 md:pt-12">
      <div className="grid gap-8 md:grid-cols-[1fr_340px] md:items-start">
        <div className="min-w-0">
          <header className="reveal flex items-center gap-5">
            <StoreIcon app={app} size={112} />
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-extrabold tracking-tight md:text-4xl">{app.name}</h1>
              <p className="muted mt-1">{app.developer || app.slug}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge">v{app.version}{app.build ? ` (${app.build})` : ""}</span>
                <span className="badge">{formatSize(app.sizeBytes, lang)}</span>
              </div>
            </div>
          </header>

          <dl className="card mt-8 grid grid-cols-2 gap-x-6 gap-y-5 p-5 text-sm md:grid-cols-3">
            <Info label={t(lang, "version")} value={app.version || "—"} />
            <Info label={t(lang, "size")} value={formatSize(app.sizeBytes, lang)} />
            <Info label={t(lang, "updated")} value={app.updatedAt.slice(0, 10)} />
            <Info label={t(lang, "developer")} value={app.developer || "—"} />
            <Info label={t(lang, "min_ios")} value={app.minIos ? `iOS ${app.minIos}+` : "—"} />
            <Info label={t(lang, "devices")} value={app.devices.join(" · ") || "—"} />
          </dl>

          {app.screenshots.length > 0 && (
            <section className="mt-10" aria-labelledby="shots">
              <h2 id="shots" className="mb-3 text-lg font-bold">{t(lang, "screenshots")}</h2>
              <div className="hscroll">
                {app.screenshots.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s} src={assetUrl(s)} alt="" loading="lazy" className="h-[420px] w-auto rounded-[22px] border" style={{ borderColor: "var(--border)" }} />
                ))}
              </div>
            </section>
          )}

          {app.description && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold">{t(lang, "description")}</h2>
              <p className="whitespace-pre-line leading-8">{app.description}</p>
            </section>
          )}
          {app.releaseNotes && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold">{t(lang, "release_notes")}</h2>
              <p className="muted whitespace-pre-line leading-8">{app.releaseNotes}</p>
            </section>
          )}

          <div className="mt-10">
            <ShareButtons url={app.liveUrl} title={app.name} copyLabel={t(lang, "copy_link")} copiedLabel={t(lang, "copied")} shareLabel={t(lang, "share")} />
          </div>
        </div>
        <aside className="md:sticky md:top-24">
          <StaticInstall app={app} />
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
