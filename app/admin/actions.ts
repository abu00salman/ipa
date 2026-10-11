"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { checkAdminCredentials, issueSessionToken, requireAdmin, SESSION_COOKIE } from "@/lib/auth";
import { config } from "@/lib/env";
import { allow } from "@/lib/ratelimit";
import { encryptSecret } from "@/lib/crypto";
import {
  addLog,
  deleteApp,
  deleteCertificate,
  deleteProfile,
  getAppById,
  getCertificate,
  getProfile,
  insertCertificate,
  insertProfile,
  setCertificateDisabled,
  setProfileDisabled,
  updateApp,
} from "@/lib/db";
import { inspectP12 } from "@/lib/ipa/cert";
import { parseProfile } from "@/lib/ipa/profile";
import { checkInstallEligibility } from "@/lib/install";
import { purgeAppFiles } from "@/lib/ingest";
import { signApp } from "@/lib/signing";
import { saveSettings, type ColorMode, type LangPreference, type PaletteName } from "@/lib/settings";
import { writeBlob, removeBlob } from "@/lib/storage";

export interface ActionState {
  ok?: boolean;
  message?: string;
  warnings?: string[];
  /** Echoed back on failed sign-in so the email field survives a React form reset. */
  email?: string;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ---------- Auth ----------

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!allow(`login:${ip}`, 8, 15 * 60_000)) return { ok: false, message: "login_rate_limited" };

  const email = str(form, "email");
  const result = checkAdminCredentials(email, String(form.get("password") ?? ""), str(form, "totp"));
  if (!result.ok) {
    addLog("warn", "auth", "محاولة دخول فاشلة", { ip, reason: result.reason });
    return { ok: false, message: result.reason === "not_configured" ? "login_not_configured" : "login_invalid", email };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, issueSessionToken(config.adminEmail), {
    httpOnly: true,
    secure: config.publicBaseUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  addLog("info", "auth", "تسجيل دخول المدير", { ip });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- Settings ----------

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  // Returns the cleaned URL, "" when empty, or null when it is not an http(s) URL.
  const httpUrl = (v: string): string | null => {
    if (!v) return "";
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      return null;
    }
  };
  const parsed = {
    telegramUrl: httpUrl(str(form, "telegramUrl")),
    xUrl: httpUrl(str(form, "xUrl")),
    instagramUrl: httpUrl(str(form, "instagramUrl")),
    logoUrl: httpUrl(str(form, "logoUrl")),
  };
  if (Object.values(parsed).some((v) => v === null)) return { ok: false, message: "invalid_url" };
  const links = parsed as Record<string, string>;

  const palette = str(form, "palette") as PaletteName;
  const mode = str(form, "defaultColorMode") as ColorMode;
  const lang = str(form, "defaultLanguage") as LangPreference;
  saveSettings({
    storeName: str(form, "storeName") || "iRaMzipa",
    logoUrl: links.logoUrl,
    domain: str(form, "domain").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    supportEmail: str(form, "supportEmail"),
    palette: ["blue", "purple", "aurora"].includes(palette) ? palette : "blue",
    defaultColorMode: ["system", "light", "dark"].includes(mode) ? mode : "system",
    defaultLanguage: ["ar", "en", "auto"].includes(lang) ? lang : "auto",
    telegramUrl: links.telegramUrl,
    xUrl: links.xUrl,
    instagramUrl: links.instagramUrl,
  });
  addLog("info", "settings", "تحديث إعدادات الموقع");
  revalidatePath("/", "layout");
  return { ok: true, message: "saved" };
}

// ---------- Apps ----------

export async function updateAppDetailsAction(appId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const app = getAppById(appId);
  if (!app) return { ok: false, message: "not_found" };
  const testflight = str(form, "testflightUrl");
  if (testflight && !/^https:\/\//.test(testflight)) return { ok: false, message: "invalid_url" };
  updateApp(appId, {
    name: str(form, "name").slice(0, 80) || app.name,
    developer: str(form, "developer").slice(0, 80),
    description: str(form, "description").slice(0, 4000),
    releaseNotes: str(form, "releaseNotes").slice(0, 4000),
    testflightUrl: testflight || null,
  });
  revalidatePath(`/admin/apps/${appId}`);
  revalidatePath(`/app/${app.slug}`);
  return { ok: true, message: "saved" };
}

export async function uploadAppMediaAction(appId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const app = getAppById(appId);
  if (!app) return { ok: false, message: "not_found" };

  const icon = form.get("icon");
  if (icon instanceof File && icon.size > 0) {
    if (icon.size > 4 * 1024 * 1024) return { ok: false, message: "file_too_large" };
    const bytes = Buffer.from(await icon.arrayBuffer());
    if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { ok: false, message: "icon_must_be_png" };
    updateApp(appId, { iconPath: await writeBlob(`icons/${appId}.png`, bytes, 0o644) });
  }

  const shots = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (shots.length) {
    const paths = [...app.screenshots];
    for (const shot of shots.slice(0, Math.max(0, 8 - paths.length))) {
      if (shot.size > 8 * 1024 * 1024) return { ok: false, message: "file_too_large" };
      const bytes = Buffer.from(await shot.arrayBuffer());
      const isPng = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
      if (!isPng && !isJpeg) return { ok: false, message: "screenshot_format" };
      paths.push(await writeBlob(`screenshots/${appId}/${randomUUID()}.${isPng ? "png" : "jpg"}`, bytes, 0o644));
    }
    updateApp(appId, { screenshots: paths });
  }

  revalidatePath(`/admin/apps/${appId}`);
  revalidatePath(`/app/${app.slug}`);
  return { ok: true, message: "saved" };
}

export async function removeScreenshotAction(appId: string, index: number): Promise<void> {
  await requireAdmin();
  const app = getAppById(appId);
  if (!app || !app.screenshots[index]) return;
  const [removed] = app.screenshots.splice(index, 1);
  await removeBlob(removed);
  updateApp(appId, { screenshots: app.screenshots });
  revalidatePath(`/admin/apps/${appId}`);
}

export async function signAppAction(appId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await signApp(appId, str(form, "certificateId"), str(form, "profileId"));
  revalidatePath(`/admin/apps/${appId}`);
  return { ok: result.ok, message: result.message, warnings: result.warnings };
}

export async function setPublishedAction(appId: string, publish: boolean): Promise<ActionState> {
  await requireAdmin();
  const app = getAppById(appId);
  if (!app) return { ok: false, message: "not_found" };

  if (publish) {
    const profile = app.profileId ? getProfile(app.profileId) : null;
    const cert = app.certificateId ? getCertificate(app.certificateId) : null;
    const check = checkInstallEligibility(app, profile, cert, config.publicBaseUrl);
    const blocking = ["not_signed", "profile_missing", "profile_disabled", "profile_expired", "certificate_expired"];
    if (app.signingStatus !== "signed" || blocking.includes(check.code)) {
      return { ok: false, message: "publish_blocked" };
    }
  }

  updateApp(appId, { published: publish });
  addLog("info", "publish", `${publish ? "نشر" : "إلغاء نشر"} ${app.name}`, { appId });
  revalidatePath("/", "layout");
  revalidatePath(`/admin/apps/${appId}`);
  return { ok: true, message: publish ? "published" : "unpublished" };
}

export async function deleteAppAction(appId: string): Promise<void> {
  await requireAdmin();
  const app = getAppById(appId);
  if (app) {
    await purgeAppFiles(app);
    deleteApp(appId);
    addLog("warn", "apps", `حذف ${app.name}`, { appId });
  }
  revalidatePath("/", "layout");
  redirect("/admin/apps");
}

// ---------- Certificates & profiles ----------

export async function addCertificateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("p12");
  const password = String(form.get("password") ?? "");
  const name = str(form, "name").slice(0, 80) || "Certificate";
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "file_required" };
  if (file.size > 1024 * 1024) return { ok: false, message: "file_too_large" };

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const info = await inspectP12(bytes, password);
    insertCertificate({
      name,
      kind: info.kind,
      teamId: info.teamId,
      subject: info.commonName,
      notAfter: info.notAfter.toISOString(),
      fingerprint: info.fingerprint,
      p12Enc: encryptSecret(bytes),
      passwordEnc: encryptSecret(password),
    });
    addLog("info", "certificates", `إضافة شهادة ${info.commonName}`, { teamId: info.teamId, kind: info.kind });
    revalidatePath("/admin/certificates");
    return { ok: true, message: "saved" };
  } catch (err) {
    addLog("error", "certificates", "فشل إضافة شهادة P12", { error: (err as Error).message });
    return { ok: false, message: (err as Error).message };
  }
}

export async function addProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("profile");
  const name = str(form, "name").slice(0, 80);
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "file_required" };
  if (file.size > 1024 * 1024) return { ok: false, message: "file_too_large" };
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const info = parseProfile(bytes);
    insertProfile({
      name: name || info.name || "Profile",
      uuid: info.uuid,
      teamId: info.teamId,
      appIdentifier: info.appIdentifier,
      distribution: info.distribution,
      notAfter: info.notAfter.toISOString(),
      deviceCount: info.deviceCount,
      certFingerprints: info.certFingerprints,
      blobEnc: encryptSecret(bytes),
    });
    addLog("info", "certificates", `إضافة ملف تعريف ${info.name} (${info.distribution})`, { uuid: info.uuid });
    revalidatePath("/admin/certificates");
    return { ok: true, message: "saved" };
  } catch (err) {
    addLog("error", "certificates", "فشل إضافة ملف التعريف", { error: (err as Error).message });
    return { ok: false, message: (err as Error).message };
  }
}

export async function setCertificateDisabledAction(id: string, disabled: boolean): Promise<void> {
  await requireAdmin();
  setCertificateDisabled(id, disabled);
  addLog("warn", "certificates", `${disabled ? "تعطيل" : "تفعيل"} شهادة`, { id });
  revalidatePath("/admin/certificates");
}

export async function setProfileDisabledAction(id: string, disabled: boolean): Promise<void> {
  await requireAdmin();
  setProfileDisabled(id, disabled);
  addLog("warn", "certificates", `${disabled ? "تعطيل" : "تفعيل"} ملف تعريف`, { id });
  revalidatePath("/admin/certificates");
}

export async function deleteCertificateAction(id: string): Promise<void> {
  await requireAdmin();
  if (getCertificate(id)) deleteCertificate(id);
  addLog("warn", "certificates", "حذف شهادة", { id });
  revalidatePath("/admin/certificates");
}

export async function deleteProfileAction(id: string): Promise<void> {
  await requireAdmin();
  if (getProfile(id)) deleteProfile(id);
  addLog("warn", "certificates", "حذف ملف تعريف", { id });
  revalidatePath("/admin/certificates");
}
