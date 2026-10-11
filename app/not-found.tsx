import Link from "next/link";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export default async function NotFound() {
  const { lang } = await requestContext();
  return (
    <main className="container-app flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <p className="gradient-text text-6xl font-extrabold">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t(lang, "not_found_title")}</h1>
      <p className="muted mt-2">{t(lang, "not_found_body")}</p>
      <Link href="/" className="btn btn-primary mt-8">{t(lang, "go_home")}</Link>
    </main>
  );
}
