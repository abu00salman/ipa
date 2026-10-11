import { formatDate } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";

export function CertBadge({ expired, disabled, notAfter, lang }: { expired: boolean; disabled: boolean; notAfter: string; lang: Lang }) {
  if (disabled) return <span className="badge">{t(lang, "cert_status_disabled")}</span>;
  if (expired) return <span className="badge badge-bad">{t(lang, "cert_status_expired")}</span>;
  return <span className="badge badge-ok">{t(lang, "cert_status_valid")} · {formatDate(notAfter, lang)}</span>;
}
