import Link from "next/link";
import { AppCardView } from "@/components/AppCard";
import { listApps } from "@/lib/db";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const ctx = await requestContext();
  const { lang } = ctx;
  const apps = listApps({ publishedOnly: true, query: query || undefined });
  const latest = query ? [] : apps.slice(0, 3);

  return (
    <>
      <section className="container-app pb-10 pt-14 text-center md:pt-20">
        <h1 className="reveal text-[34px] font-extrabold leading-tight tracking-tight md:text-[52px]">
          <span className="gradient-text">{t(lang, "hero_title")}</span>
        </h1>
        <p className="muted reveal mx-auto mt-4 max-w-xl text-[16px] leading-8 md:text-lg">{t(lang, "hero_body")}</p>

        <form action="/" className="reveal mx-auto mt-8 flex max-w-xl items-center gap-2" role="search">
          <input name="q" defaultValue={query} className="input" placeholder={t(lang, "search_placeholder")} aria-label={t(lang, "search_placeholder")} type="search" />
          <button type="submit" className="btn btn-primary shrink-0">
            {t(lang, "search_button")}
          </button>
        </form>
      </section>

      {!query && latest.length > 0 && (
        <section className="container-app py-6" aria-labelledby="latest">
          <h2 id="latest" className="mb-4 text-lg font-bold">{t(lang, "latest_title")}</h2>
          <div className="hscroll">
            {latest.map((app) => (
              <div key={app.id} className="w-[260px] shrink-0">
                <AppCardView app={app} lang={lang} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="apps" className="container-app scroll-mt-24 py-8" aria-labelledby="apps-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 id="apps-title" className="text-2xl font-bold tracking-tight">{t(lang, "apps_title")}</h2>
          <span className="muted text-sm">{apps.length === 1 ? t(lang, "apps_count_one") : t(lang, "apps_count", { count: apps.length })}</span>
        </div>
        {apps.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <p className="text-lg font-semibold">{query ? t(lang, "no_results") : t(lang, "empty_title")}</p>
            {!query && <p className="muted mt-2">{t(lang, "empty_body")}</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <AppCardView key={app.id} app={app} lang={lang} />
            ))}
          </div>
        )}
      </section>

      <section id="how" className="container-app scroll-mt-24 py-12" aria-labelledby="how-title">
        <h2 id="how-title" className="mb-5 text-2xl font-bold tracking-tight">{t(lang, "how_title")}</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {[t(lang, "how_1"), t(lang, "how_2"), t(lang, "how_3"), t(lang, "how_4")].map((step, i) => (
            <li key={i} className="card flex gap-4 p-5">
              <span className="btn btn-soft !min-h-9 !w-9 !p-0 shrink-0 self-start font-bold">{i + 1}</span>
              <p className="text-sm leading-7">{step}</p>
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
          {ctx.settings.supportEmail && (
            <a className="btn btn-primary shrink-0" href={`mailto:${ctx.settings.supportEmail}`}>
              {ctx.settings.supportEmail}
            </a>
          )}
        </div>
      </section>
    </>
  );
}
