import type { Lang } from "./i18n";

export function formatBytes(bytes: number, lang: Lang): string {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  if (bytes < 1024 * 1024) {
    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${new Intl.NumberFormat(locale).format(kb)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(mb)} MB`;
}

export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}
