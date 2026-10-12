import Link from "next/link";
import { t } from "../../lib/i18n";

export default function NotFound() {
  return (
    <main className="container-app flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <p className="numeral gradient-text text-[96px]">404</p>
      <h1 className="display mt-4 text-[34px]">{t("ar", "not_found_title")}</h1>
      <p className="muted mt-2">{t("ar", "not_found_body")}</p>
      <Link href="/" className="btn btn-primary mt-8">{t("ar", "go_home")}</Link>
    </main>
  );
}
