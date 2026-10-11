import type { AppRecord } from "./db";
import { t, type Lang } from "./i18n";

export function distLabel(d: AppRecord["distribution"], lang: Lang): string {
  const key = {
    "ad-hoc": "type_ad_hoc",
    enterprise: "type_enterprise",
    development: "type_development",
    "app-store": "type_app_store",
    unknown: "type_unknown",
  } as const;
  return t(lang, key[d]);
}
