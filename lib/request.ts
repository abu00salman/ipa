import { cookies, headers } from "next/headers";
import { dirOf, LANG_COOKIE, resolveLang, THEME_COOKIE, type Lang } from "./i18n";
import { getSettings, type SiteSettings } from "./settings";

export interface RequestContext {
  lang: Lang;
  dir: "rtl" | "ltr";
  settings: SiteSettings;
  /** undefined = follow the system setting */
  theme: "light" | "dark" | undefined;
}

/** Per-request preferences: language and theme from cookies, falling back to store defaults. */
export async function requestContext(): Promise<RequestContext> {
  const jar = await cookies();
  const h = await headers();
  const settings = getSettings();
  const lang = resolveLang(jar.get(LANG_COOKIE)?.value, settings.defaultLanguage, h.get("accept-language"));
  const themeCookie = jar.get(THEME_COOKIE)?.value;
  let theme: RequestContext["theme"];
  if (themeCookie === "light" || themeCookie === "dark") theme = themeCookie;
  else if (themeCookie === "system") theme = undefined;
  else theme = settings.defaultColorMode === "system" ? undefined : settings.defaultColorMode;
  return { lang, dir: dirOf(lang), settings, theme };
}
