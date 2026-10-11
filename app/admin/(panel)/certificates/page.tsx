import { ActionForm } from "@/components/admin/ActionForm";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { CertBadge } from "@/components/admin/CertBadge";
import { addCertificateAction, addProfileAction, deleteCertificateAction, deleteProfileAction, setCertificateDisabledAction, setProfileDisabledAction } from "../../actions";
import { listCertificates, listProfiles } from "@/lib/db";
import { requestContext } from "@/lib/request";
import { distLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const { lang } = await requestContext();
  const certs = listCertificates();
  const profiles = listProfiles();
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t(lang, "cert_title")}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-5 p-5 md:p-6">
          <h2 className="font-bold">{t(lang, "cert_add")}</h2>
          <ActionForm action={addCertificateAction} lang={lang} submitLabel={t(lang, "save")} pendingLabel={t(lang, "save")}>
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="cert-name">{t(lang, "cert_name")}</label>
                <input id="cert-name" name="name" className="input" placeholder="iPhone Distribution" />
              </div>
              <div>
                <label className="label" htmlFor="p12">{t(lang, "cert_file")}</label>
                <input id="p12" name="p12" type="file" accept=".p12,.pfx,application/x-pkcs12" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="p12pass">{t(lang, "cert_password")}</label>
                <input id="p12pass" name="password" type="password" autoComplete="off" className="input" />
              </div>
            </div>
          </ActionForm>
          <ul className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {certs.length === 0 && <li className="muted text-sm">{t(lang, "no_items")}</li>}
            {certs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="muted truncate text-xs">
                    {c.teamId} · {t(lang, c.kind === "distribution" ? "cert_kind_distribution" : c.kind === "development" ? "cert_kind_development" : "cert_kind_unknown")} · {t(lang, "cert_expires")} {formatDate(c.notAfter, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CertBadge expired={new Date(c.notAfter).getTime() <= now} disabled={c.disabled} notAfter={c.notAfter} lang={lang} />
                  <ConfirmForm action={setCertificateDisabledAction.bind(null, c.id, !c.disabled)}>
                    <button type="submit" className="btn btn-ghost !min-h-8 !px-3 !text-xs">{c.disabled ? t(lang, "cert_enable") : t(lang, "cert_disable")}</button>
                  </ConfirmForm>
                  <ConfirmForm action={deleteCertificateAction.bind(null, c.id)} message={t(lang, "delete_confirm")}>
                    <button type="submit" className="btn btn-danger !min-h-8 !px-3 !text-xs">{t(lang, "delete")}</button>
                  </ConfirmForm>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card flex flex-col gap-5 p-5 md:p-6">
          <h2 className="font-bold">{t(lang, "profile_add")}</h2>
          <ActionForm action={addProfileAction} lang={lang} submitLabel={t(lang, "save")} pendingLabel={t(lang, "save")}>
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="profile-name">{t(lang, "cert_name")}</label>
                <input id="profile-name" name="name" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="profile">{t(lang, "profile_file")}</label>
                <input id="profile" name="profile" type="file" accept=".mobileprovision,.provisionprofile" required className="input" />
              </div>
            </div>
          </ActionForm>
          <ul className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {profiles.length === 0 && <li className="muted text-sm">{t(lang, "no_items")}</li>}
            {profiles.map((p) => {
              const expired = new Date(p.notAfter).getTime() <= now;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="muted truncate text-xs">
                      {p.appIdentifier} · {distLabel(p.distribution, lang)}
                      {p.deviceCount > 0 ? ` · ${p.deviceCount}` : ""} · {t(lang, "cert_expires")} {formatDate(p.notAfter, lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${expired ? "badge-bad" : p.disabled ? "" : "badge-ok"}`}>
                      {p.disabled ? t(lang, "cert_status_disabled") : expired ? t(lang, "cert_status_expired") : t(lang, "cert_status_valid")}
                    </span>
                    <ConfirmForm action={setProfileDisabledAction.bind(null, p.id, !p.disabled)}>
                      <button type="submit" className="btn btn-ghost !min-h-8 !px-3 !text-xs">{p.disabled ? t(lang, "cert_enable") : t(lang, "cert_disable")}</button>
                    </ConfirmForm>
                    <ConfirmForm action={deleteProfileAction.bind(null, p.id)} message={t(lang, "delete_confirm")}>
                      <button type="submit" className="btn btn-danger !min-h-8 !px-3 !text-xs">{t(lang, "delete")}</button>
                    </ConfirmForm>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
