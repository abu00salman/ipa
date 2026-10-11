import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { UploadForm } from "@/components/admin/UploadForm";
import { AppIcon } from "@/components/AppIcon";
import { ShareButtons } from "@/components/ShareButtons";
import { config } from "@/lib/env";
import { getAppById, listCertificates, listProfiles } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";
import { distLabel } from "@/lib/labels";
import {
  deleteAppAction,
  removeScreenshotAction,
  signAppAction,
  updateAppDetailsAction,
  uploadAppMediaAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getAppById(id);
  if (!app) notFound();

  const { lang } = await requestContext();
  const now = Date.now();
  const certs = listCertificates().filter((c) => !c.disabled && new Date(c.notAfter).getTime() > now);
  const profiles = listProfiles().filter((p) => !p.disabled && new Date(p.notAfter).getTime() > now);
  const publicUrl = `${config.publicBaseUrl}/app/${app.slug}`;

  const steps = [
    { label: t(lang, "wizard_upload"), done: true },
    { label: t(lang, "wizard_review"), done: Boolean(app.description || app.developer) },
    { label: t(lang, "wizard_sign"), done: app.signingStatus === "signed" },
    { label: t(lang, "wizard_preview"), done: app.signingStatus === "signed" },
    { label: t(lang, "wizard_publish"), done: app.published },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <AppIcon slug={app.slug} name={app.name} hasIcon={Boolean(app.iconPath)} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{app.name}</h1>
          <p className="muted truncate text-sm">{app.bundleId} · v{app.version}</p>
        </div>
        <Link href="/admin/apps" className="btn btn-ghost !min-h-9 !text-sm">{t(lang, "back")}</Link>
      </header>

      <ol className="card grid grid-cols-5 gap-2 p-4 text-center text-xs font-semibold" aria-label="wizard">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-col items-center gap-1.5">
            <span
              className="grid size-8 place-items-center rounded-full text-sm"
              style={{ background: s.done ? "var(--primary-gradient)" : "var(--surface-2)", color: s.done ? "#fff" : "var(--muted)" }}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className={s.done ? "" : "muted"}>{s.label}</span>
          </li>
        ))}
      </ol>

      <Section title={`1 · ${t(lang, "analysis_title")}`}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
          <Info label={t(lang, "bundle_id")} value={app.bundleId} />
          <Info label={t(lang, "version")} value={`${app.version}${app.build ? ` (${app.build})` : ""}`} />
          <Info label={t(lang, "min_ios")} value={app.minIos || "—"} />
          <Info label={t(lang, "devices")} value={app.devices.join(" · ") || "—"} />
          <Info label={t(lang, "size")} value={formatBytes(app.sizeBytes, lang)} />
          <Info label={t(lang, "updated")} value={formatDate(app.updatedAt, lang)} />
        </dl>
        {!app.iconPath && <p className="notice notice-warn mt-4">{t(lang, "warn_no_icon")}</p>}
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-semibold">SHA-256</summary>
          <code className="mt-2 block break-all muted">{app.sha256}</code>
        </details>
      </Section>

      <Section title={`2 · ${t(lang, "details_title")}`}>
        <ActionForm action={updateAppDetailsAction.bind(null, app.id)} lang={lang} submitLabel={t(lang, "save")} pendingLabel={t(lang, "save")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t(lang, "name")} name="name" defaultValue={app.name} />
            <Field label={t(lang, "developer")} name="developer" defaultValue={app.developer} />
            <Field label="TestFlight" name="testflightUrl" defaultValue={app.testflightUrl ?? ""} type="url" placeholder="https://testflight.apple.com/join/…" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextArea label={t(lang, "description")} name="description" defaultValue={app.description} />
            <TextArea label={t(lang, "release_notes")} name="releaseNotes" defaultValue={app.releaseNotes} />
          </div>
        </ActionForm>
      </Section>

      <Section title={t(lang, "media_title")}>
        <div className="flex flex-wrap items-center gap-4">
          <AppIcon slug={app.slug} name={app.name} hasIcon={Boolean(app.iconPath)} size={72} />
          <div className="flex-1">
            <ActionForm action={uploadAppMediaAction.bind(null, app.id)} lang={lang} submitLabel={t(lang, "save")} pendingLabel={t(lang, "save")}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="icon">{t(lang, "icon_upload")}</label>
                  <input id="icon" name="icon" type="file" accept="image/png" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="screenshots">{t(lang, "screenshots_upload")}</label>
                  <input id="screenshots" name="screenshots" type="file" accept="image/png,image/jpeg" multiple className="input" />
                </div>
              </div>
            </ActionForm>
          </div>
        </div>
        {app.screenshots.length > 0 && (
          <ul className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {app.screenshots.map((_, i) => (
              <li key={i} className="flex shrink-0 flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/shot/${app.slug}/${i}`} alt="" className="h-40 w-auto rounded-2xl border" style={{ borderColor: "var(--border)" }} />
                <form action={removeScreenshotAction.bind(null, app.id, i)}>
                  <button type="submit" className="btn btn-danger !min-h-8 !px-3 !text-xs">{t(lang, "remove")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`3 · ${t(lang, "sign_title")}`}>
        <p className="muted mb-4 text-sm leading-7">{t(lang, "sign_hint")}</p>
        {certs.length === 0 || profiles.length === 0 ? (
          <p className="notice notice-warn">{certs.length === 0 ? t(lang, "no_certificates") : t(lang, "no_profiles")}</p>
        ) : (
          <ActionForm action={signAppAction.bind(null, app.id)} lang={lang} submitLabel={t(lang, "sign_button")} pendingLabel={t(lang, "sign_running")}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="certificateId">{t(lang, "sign_select_cert")}</label>
                <select id="certificateId" name="certificateId" className="select" defaultValue={app.certificateId ?? certs[0].id}>
                  {certs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.teamId} · {t(lang, c.kind === "distribution" ? "cert_kind_distribution" : c.kind === "development" ? "cert_kind_development" : "cert_kind_unknown")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="profileId">{t(lang, "sign_select_profile")}</label>
                <select id="profileId" name="profileId" className="select" defaultValue={app.profileId ?? profiles[0].id}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.appIdentifier} · {distLabel(p.distribution, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ActionForm>
        )}
        {app.signingStatus === "failed" && app.signingError && <p className="notice notice-bad mt-4">{t(lang, "msg_sign_failed")}: {app.signingError}</p>}
        {app.signingStatus === "signed" && (
          <p className="notice notice-ok mt-4">
            {t(lang, "signature_ok")} · {distLabel(app.distribution, lang)} · {t(lang, "signed_until")} {app.signedAt ? formatDate(app.signedAt, lang) : "—"}
          </p>
        )}
      </Section>

      <Section title={`4 · ${t(lang, "publish_title")}`}>
        <p className="muted text-sm">{t(lang, "public_link")}</p>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-semibold" style={{ color: "var(--primary)" }}>
          {publicUrl}
        </a>
        <div className="mt-4">
          <ShareButtons url={publicUrl} title={app.name} copyLabel={t(lang, "copy_link")} copiedLabel={t(lang, "copied")} shareLabel={t(lang, "share")} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PublishToggle
            appId={app.id}
            published={app.published}
            lang={lang}
            labels={{ publish: t(lang, "publish"), unpublish: t(lang, "unpublish") }}
          />
          <Link href={`/app/${app.slug}`} className="btn btn-ghost !min-h-10 !text-sm">{t(lang, "open_public_page")}</Link>
        </div>
        {app.signingStatus !== "signed" && <p className="muted mt-3 text-sm">{t(lang, "publish_blocked")}</p>}
      </Section>

      <Section title={t(lang, "upload_new_build")}>
        <UploadForm lang={lang} maxMb={Math.round(config.maxUploadBytes / 1024 / 1024)} appId={app.id} />
      </Section>

      <Section title={t(lang, "danger_title")}>
        <ConfirmForm action={deleteAppAction.bind(null, app.id)} message={t(lang, "delete_confirm")}>
          <button type="submit" className="btn btn-danger">{t(lang, "delete_app")}</button>
        </ConfirmForm>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="muted text-xs">{label}</dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", placeholder }: { label: string; name: string; defaultValue: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="input" />
    </div>
  );
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea id={name} name={name} defaultValue={defaultValue} className="textarea" />
    </div>
  );
}
