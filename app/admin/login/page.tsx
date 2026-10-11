import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { currentAdmin } from "@/lib/auth";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  const { lang, dir } = await requestContext();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" dir={dir}>
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 text-center">
          <p className="gradient-text text-2xl font-extrabold">iRaMzipa</p>
          <h1 className="mt-3 text-xl font-bold">{t(lang, "admin_login_title")}</h1>
          <p className="muted mt-1 text-sm">{t(lang, "admin_login_body")}</p>
        </div>
        <LoginForm lang={lang} />
      </div>
    </main>
  );
}
