import { UploadForm } from "@/components/admin/UploadForm";
import { config } from "@/lib/env";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewAppPage() {
  const { lang } = await requestContext();
  const steps = [t(lang, "wizard_upload"), t(lang, "wizard_review"), t(lang, "wizard_sign"), t(lang, "wizard_preview"), t(lang, "wizard_publish")];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(lang, "upload_ipa")}</h1>
        <ol className="muted mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={s}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </div>
      <UploadForm lang={lang} maxMb={Math.round(config.maxUploadBytes / 1024 / 1024)} />
    </div>
  );
}
