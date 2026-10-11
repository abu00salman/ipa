import { ActionForm } from "@/components/admin/ActionForm";
import { saveSettingsAction } from "../../actions";
import { getSettings } from "@/lib/settings";
import { PALETTES } from "@/lib/themes";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { lang } = await requestContext();
  const s = getSettings();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t(lang, "settings_title")}</h1>
      <section className="card p-5 md:p-6">
        <ActionForm action={saveSettingsAction} lang={lang} submitLabel={t(lang, "save")} pendingLabel={t(lang, "save")}>
          <div className="grid gap-5 md:grid-cols-2">
            <Text label={t(lang, "settings_store_name")} name="storeName" value={s.storeName} />
            <Text label={t(lang, "settings_domain")} name="domain" value={s.domain} placeholder="iramzipa.com" />
            <Text label={t(lang, "settings_logo_url")} name="logoUrl" value={s.logoUrl} type="url" placeholder="https://…/logo.png" />
            <Text label={t(lang, "settings_support_email")} name="supportEmail" value={s.supportEmail} type="email" />
            <Text label={t(lang, "settings_telegram")} name="telegramUrl" value={s.telegramUrl} type="url" />
            <Text label={t(lang, "settings_x")} name="xUrl" value={s.xUrl} type="url" />
            <Text label={t(lang, "settings_instagram")} name="instagramUrl" value={s.instagramUrl} type="url" />
            <div>
              <label className="label" htmlFor="defaultLanguage">{t(lang, "settings_default_language")}</label>
              <select id="defaultLanguage" name="defaultLanguage" defaultValue={s.defaultLanguage} className="select">
                <option value="auto">Auto · تلقائي</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="defaultColorMode">{t(lang, "settings_color_mode")}</label>
              <select id="defaultColorMode" name="defaultColorMode" defaultValue={s.defaultColorMode} className="select">
                <option value="system">{t(lang, "theme_system")}</option>
                <option value="light">{t(lang, "theme_light")}</option>
                <option value="dark">{t(lang, "theme_dark")}</option>
              </select>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="label">{t(lang, "settings_palette")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.values(PALETTES).map((p) => (
                <label key={p.name} className="card flex cursor-pointer items-center gap-3 p-3 has-[:checked]:ring-2" style={{ ["--tw-ring-color" as string]: p.primary }}>
                  <input type="radio" name="palette" value={p.name} defaultChecked={s.palette === p.name} className="sr-only" />
                  <span className="size-8 shrink-0 rounded-full" style={{ background: p.gradient }} aria-hidden="true" />
                  <span className="font-semibold">{p.label[lang]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </section>
    </div>
  );
}

function Text({ label, name, value, type = "text", placeholder }: { label: string; name: string; value: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} placeholder={placeholder} className="input" />
    </div>
  );
}
