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
  const btn = "btn btn-ghost !min-h-9 !px-3.5 !text-[13px]";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => setTheme(nextTheme)} aria-label={`${t(lang, "theme")}: ${themeLabel}`}>
        <span aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span>
        <span className="hidden sm:inline">{themeLabel}</span>
      </button>
      <button type="button" className={btn} onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={t(lang, "language")}>
        <span aria-hidden="true">{lang === "ar" ? "EN" : "ع"}</span>
      </button>
    </div>
  );
}

/** Two-digit numeral in the reader's script: 01 / ٠١. */
function numeral(n: number, lang: Lang): string {
  return n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { minimumIntegerDigits: 2 });
}

function Wordmark({ name }: { name: string }) {
  return (
    <span className="display text-[22px] leading-none" dir="ltr">
      {name}
    </span>
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
    <header className="glass sticky top-0 z-40">
      <div className="container-app flex h-[72px] items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={34} />
          <Wordmark name={catalog.settings.storeName} />
        </Link>
        <nav className="hidden items-center gap-9 text-[14px] font-medium md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
        </nav>
        <Prefs />
      </div>
      <nav className="container-app flex gap-6 overflow-x-auto pb-3 text-sm font-medium md:hidden">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-link whitespace-nowrap">{l.label}</a>
        ))}
      </nav>
      <div className="hairline" />
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
    <footer className="mt-24">
      <div className="hairline" />
      <div className="container-app grid gap-10 py-14 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <Wordmark name={s.storeName} />
          </div>
          <p className="muted mt-4 text-sm">{t(lang, "tagline")}</p>
          <p className="muted mt-3 max-w-md text-xs leading-6 opacity-80">{t(lang, "static_note")}</p>
        </div>
        <div className="flex flex-col gap-5 md:items-end">
          <div className="flex flex-wrap items-center gap-5 text-sm">
            {s.supportEmail && <a className="nav-link" href={`mailto:${s.supportEmail}`}>{t(lang, "support_email")}</a>}
            {socials.map((x) => (
              <a key={x.label} className="nav-link" href={x.href} target="_blank" rel="noopener noreferrer">{x.label}</a>
            ))}
          </div>
          <p className="muted text-xs tracking-wide">© {new Date().getFullYear()} {s.storeName} · {t(lang, "footer_rights")}</p>
        </div>
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
    <div aria-hidden="true" className="app-icon app-icon-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}>
      {app.name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function formatSize(bytes: number, lang: Lang): string {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale).format(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

/** Decorative phone: real icons when the catalog has apps, gold monogram tiles otherwise. */
function PhoneMock({ catalog }: { catalog: Catalog }) {
  const { lang } = usePrefs();
  const apps = catalog.apps.slice(0, 12);
  const glyphs = ["R", "S", "N", "L", "◆", "M", "A", "Z", "I", "P", "✦", "Q"];
  const featured = catalog.apps[0];
  return (
    <div className="relative mx-auto w-fit" aria-hidden="true">
      <div className="orbit" />
      <div className="halo" />
      <div className="phone float">
        <div className="phone-screen">
          <div className="phone-island" />
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold opacity-90" dir="ltr">
            <span>9:41</span>
            <span className="tracking-[0.2em] text-[#e9d29b]">iRaMzipa</span>
          </div>
          <div className="phone-grid" dir="ltr">
            {Array.from({ length: 12 }).map((_, i) => {
              const app = apps[i];
              return (
                <div key={i} className="phone-tile">
                  {app?.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(app.icon)} alt="" />
                  ) : (
                    app ? app.name.charAt(0).toUpperCase() : glyphs[i]
                  )}
                </div>
              );
            })}
          </div>
          <div className="phone-sheet">
            <div className="flex items-center gap-3">
              <div className="phone-tile !w-10 !text-base" style={{ width: 40 }}>
                {featured?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(featured.icon)} alt="" />
                ) : (
                  (featured?.name.charAt(0) ?? "i").toUpperCase()
                )}
              </div>
              <div className="min-w-0 text-start">
                <p className="truncate text-[13px] font-semibold">{featured?.name ?? catalog.settings.storeName}</p>
                <p className="text-[11px] text-[#b9ad98]">{t(lang, "lux_phone_caption")}</p>
              </div>
            </div>
            <div className="phone-btn">{t(lang, "install")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, id, aside }: { eyebrow: string; title: string; id: string; aside?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="display mt-3 text-[34px] md:text-[46px]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function Card({ app }: { app: CatalogApp }) {
  const { lang } = usePrefs();
  const available = Boolean(app.manifestUrl);
  return (
    <Link href={`/app/${app.slug}/`} className="card-lux app-card group flex h-full flex-col p-6">
      <div className="flex items-start gap-4">
        <StoreIcon app={app} size={68} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold">{app.name}</h3>
          <p className="muted mt-0.5 truncate text-xs">{app.developer || app.slug}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="badge">v{app.version}</span>
            <span className="badge">{formatSize(app.sizeBytes, lang)}</span>
          </div>
        </div>
      </div>
      {app.description && <p className="muted mt-4 line-clamp-2 text-sm leading-7">{app.description}</p>}
      <div className="mt-auto pt-5"><div className="hairline" /></div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className={available ? "font-semibold" : "muted"} style={available ? { color: "var(--success)" } : undefined}>
          {available ? t(lang, "available") : t(lang, "install_via_live")}
        </span>
        <span className="font-semibold transition group-hover:translate-x-0.5" style={{ color: "var(--primary)" }}>
          {t(lang, "view")} <span aria-hidden="true">{lang === "ar" ? "←" : "→"}</span>
        </span>
      </div>
    </Link>
  );
}

export function Home({ catalog }: { catalog: Catalog }) {
  const { lang } = usePrefs();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const apps = catalog.apps.filter((a) => !q || `${a.name} ${a.developer} ${a.slug}`.toLowerCase().includes(q));
  const trust = ["lux_trust_1", "lux_trust_2", "lux_trust_3"] as DictKey[];
  return (
    <>
      {/* Hero */}
      <section className="hero container-app grid items-center gap-14 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:pb-24 md:pt-24">
        <div className="text-center md:text-start">
          <p className="eyebrow reveal">{t(lang, "lux_eyebrow")}</p>
          <h1 className="display reveal-2 mt-6 text-[44px] md:text-[72px]">
            <span className="block">{t(lang, "lux_hero_1")}</span>
            <span className="gradient-text italic-en block">{t(lang, "lux_hero_2")}</span>
          </h1>
          <p className="muted reveal-3 mx-auto mt-6 max-w-lg text-[16px] leading-8 md:mx-0 md:text-[17px]">{t(lang, "hero_body")}</p>
          <div className="reveal-3 mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
            <a href="#apps" className="btn btn-primary !min-h-12 !px-7">{t(lang, "lux_cta_browse")}</a>
            <a href="#how" className="btn btn-ghost !min-h-12 !px-7">{t(lang, "nav_how")}</a>
          </div>
        </div>
        <div className="reveal-3">
          <PhoneMock catalog={catalog} />
        </div>
      </section>

      {/* Trust strip */}
      <section className="container-app" aria-label={t(lang, "tagline")}>
        <div className="hairline" />
        <ul className="flex flex-col items-center justify-center gap-4 py-6 text-[13px] font-medium sm:flex-row sm:gap-10">
          {trust.map((k, i) => (
            <li key={k} className="flex items-center gap-10">
              {i > 0 && <span className="diamond hidden sm:block" aria-hidden="true" />}
              <span className="muted tracking-wide">{t(lang, k)}</span>
            </li>
          ))}
        </ul>
        <div className="hairline" />
      </section>

      {/* Collection */}
      <section id="apps" className="container-app scroll-mt-28 pt-24" aria-labelledby="apps-title">
        <SectionHead
          id="apps-title"
          eyebrow={t(lang, "lux_collection_eyebrow")}
          title={t(lang, "apps_title")}
          aside={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
              <span className="muted text-sm">{catalog.apps.length === 1 ? t(lang, "apps_count_one") : t(lang, "apps_count", { count: catalog.apps.length })}</span>
              {catalog.apps.length > 0 && (
                <div role="search" className="w-full sm:w-[340px]">
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder={t(lang, "search_placeholder")} aria-label={t(lang, "search_placeholder")} />
                </div>
              )}
            </div>
          }
        />
        {apps.length === 0 ? (
          <div className="card-lux flex flex-col items-center px-6 py-16 text-center">
            <div className="flex items-center gap-4" aria-hidden="true">
              <span className="hairline w-16" />
              <span className="diamond" />
              <span className="hairline w-16" />
            </div>
            <p className="display mt-6 text-[28px] md:text-[34px]">{q ? t(lang, "no_results") : t(lang, "empty_title")}</p>
            {!q && <p className="muted mt-3 max-w-md leading-7">{t(lang, "empty_body")}</p>}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => <Card key={app.slug} app={app} />)}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="container-app pt-24" aria-labelledby="features-title">
        <SectionHead id="features-title" eyebrow={t(lang, "lux_features_eyebrow")} title={t(lang, "tagline")} />
        <div className="grid gap-5 md:grid-cols-3">
          {["feature_1", "feature_2", "feature_3"].map((key, i) => (
            <div key={key} className="card-lux p-8">
              <span className="numeral gradient-text text-[52px]">{numeral(i + 1, lang)}</span>
              <h3 className="mt-6 text-lg font-semibold">{t(lang, `${key}_title` as DictKey)}</h3>
              <p className="muted mt-3 text-sm leading-7">{t(lang, `${key}_body` as DictKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="how" className="container-app scroll-mt-28 pt-24" aria-labelledby="how-title">
        <SectionHead id="how-title" eyebrow={t(lang, "lux_steps_eyebrow")} title={t(lang, "how_title")} />
        <ol className="steps grid gap-10 md:grid-cols-4 md:gap-8">
          {(["how_1", "how_2", "how_3", "how_4"] as DictKey[]).map((key, i) => (
            <li key={key} className="step">
              <span className="numeral text-[40px]" style={{ color: "var(--primary)" }}>{numeral(i + 1, lang)}</span>
              <p className="mt-4 text-[15px] leading-8">{t(lang, key)}</p>
            </li>
          ))}
        </ol>
        <p className="muted mt-10 text-sm leading-7">{t(lang, "how_note")}</p>
      </section>

      {/* Concierge */}
      <section id="support" className="container-app scroll-mt-28 pt-24" aria-labelledby="support-title">
        <div className="concierge flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow" style={{ color: "#d4b06a" }}>{t(lang, "lux_support_eyebrow")}</p>
            <h2 id="support-title" className="display mt-4 text-[32px] md:text-[42px]">{t(lang, "support_title")}</h2>
            <p className="muted mt-3 leading-8">{t(lang, "support_body")}</p>
          </div>
          {catalog.settings.supportEmail && (
            <a className="btn btn-primary !min-h-12 shrink-0 !px-7" href={`mailto:${catalog.settings.supportEmail}`}>{catalog.settings.supportEmail}</a>
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
    <div className="card-lux p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="eyebrow">{t(lang, "install")}</span>
        <span className="badge badge-gold">v{app.version}</span>
      </div>
      {app.manifestUrl ? (
        <>
          <a
            className="btn btn-primary !min-h-[52px] w-full !text-[17px]"
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
        <a className="btn btn-primary !min-h-[52px] w-full !text-[17px]" href={app.liveUrl} target="_blank" rel="noopener noreferrer">
          {liveLabel}
        </a>
      )}
      {app.testflightUrl && (
        <a href={app.testflightUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-3 w-full">
          {t(lang, "testflight_cta")}
        </a>
      )}
      <div className="hairline mt-6" />
      <details className="lux mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">{t(lang, "install_help_title")}</summary>
        <p className="muted mt-3 leading-7">{t(lang, "install_help_body")}</p>
      </details>
    </div>
  );
}

export function AppDetail({ app }: { app: CatalogApp }) {
  const { lang } = usePrefs();
  return (
    <article className="hero container-app pt-10 md:pt-16">
      <div className="grid gap-10 md:grid-cols-[1fr_360px] md:items-start">
        <div className="min-w-0">
          <header className="reveal flex flex-col items-center gap-6 text-center sm:flex-row sm:text-start">
            <div className="icon-ring">
              <StoreIcon app={app} size={120} />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{app.developer || app.slug}</p>
              <h1 className="display mt-2 text-[40px] md:text-[56px]">{app.name}</h1>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span className="badge badge-gold">v{app.version}{app.build ? ` (${app.build})` : ""}</span>
                <span className="badge">{formatSize(app.sizeBytes, lang)}</span>
                {app.minIos && <span className="badge">iOS {app.minIos}+</span>}
              </div>
            </div>
          </header>

          <section className="mt-12" aria-labelledby="details-title">
            <p id="details-title" className="eyebrow mb-5">{t(lang, "lux_details")}</p>
            <dl className="card-lux grid grid-cols-2 gap-px overflow-hidden text-sm md:grid-cols-3" style={{ background: "var(--border)" }}>
              <Info label={t(lang, "version")} value={app.version || "—"} />
              <Info label={t(lang, "size")} value={formatSize(app.sizeBytes, lang)} />
              <Info label={t(lang, "updated")} value={app.updatedAt.slice(0, 10)} />
              <Info label={t(lang, "developer")} value={app.developer || "—"} />
              <Info label={t(lang, "min_ios")} value={app.minIos ? `iOS ${app.minIos}+` : "—"} />
              <Info label={t(lang, "devices")} value={app.devices.join(" · ") || "—"} />
            </dl>
          </section>

          {app.screenshots.length > 0 && (
            <section className="mt-14" aria-labelledby="shots">
              <h2 id="shots" className="display mb-5 text-[28px]">{t(lang, "screenshots")}</h2>
              <div className="hscroll">
                {app.screenshots.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s} src={assetUrl(s)} alt="" loading="lazy" className="h-[440px] w-auto rounded-[26px] border" style={{ borderColor: "var(--hairline)" }} />
                ))}
              </div>
            </section>
          )}

          {app.description && (
            <section className="mt-14">
              <h2 className="display mb-4 text-[28px]">{t(lang, "description")}</h2>
              <p className="whitespace-pre-line text-[16px] leading-8">{app.description}</p>
            </section>
          )}
          {app.releaseNotes && (
            <section className="mt-14">
              <h2 className="display mb-4 text-[28px]">{t(lang, "release_notes")}</h2>
              <p className="muted whitespace-pre-line leading-8">{app.releaseNotes}</p>
            </section>
          )}

          <div className="hairline mt-14" />
          <div className="mt-8">
            <ShareButtons url={app.liveUrl} title={app.name} copyLabel={t(lang, "copy_link")} copiedLabel={t(lang, "copied")} shareLabel={t(lang, "share")} />
          </div>
        </div>
        <aside className="md:sticky md:top-28">
          <StaticInstall app={app} />
        </aside>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5" style={{ background: "var(--surface)" }}>
      <dt className="muted text-xs tracking-wide">{label}</dt>
      <dd className="mt-1.5 font-semibold">{value}</dd>
    </div>
  );
}
