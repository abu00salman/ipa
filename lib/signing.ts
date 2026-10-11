import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./env";
import { decryptSecret } from "./crypto";
import { addLog, getAppById, getCertificate, getProfile, updateApp } from "./db";
import { inspectSignedIpa } from "./ipa/parse";
import { parseProfile } from "./ipa/profile";
import { checkSigningInputs } from "./ipa/validate";
import { createPrivateTempDir, dataPath, removeDir, writeBlob } from "./storage";

export interface SignOutcome {
  ok: boolean;
  message: string;
  warnings: string[];
}

/** zsign reports its errors on stdout, so both streams are checked. The reason is kept, the command line is not. */
function runZsign(args: string[], secrets: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(config.zsignBin, args, { timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve();
      const output = `${stderr}\n${stdout}`.replace(/\x1b\[[0-9;]*m/g, "");
      const reason = output.split("\n").map((l) => l.trim()).filter((l) => /^>>>/.test(l) || /error|fail|can't|invalid|unknown/i.test(l)).slice(-4).join(" ") || "zsign failed";
      let text = reason;
      // Never let the certificate password leak into logs or the UI.
      for (const secret of secrets) if (secret) text = text.split(secret).join("***");
      reject(new Error(text.slice(0, 500)));
    });
  });
}

/**
 * Signs the uploaded IPA with a certificate + provisioning profile pair.
 * Pre-checks block bad inputs, zsign performs the signing, and post-checks confirm the
 * output embeds the expected profile and bundle id before the signed file is stored.
 */
export async function signApp(appId: string, certificateId: string, profileId: string): Promise<SignOutcome> {
  const app = getAppById(appId);
  if (!app) return { ok: false, message: "التطبيق غير موجود.", warnings: [] };

  const fail = (message: string, warnings: string[] = []): SignOutcome => {
    updateApp(app.id, { signingStatus: "failed", signingError: message });
    addLog("error", "signing", `فشل توقيع ${app.name}`, { appId: app.id, error: message });
    return { ok: false, message, warnings };
  };

  const cert = getCertificate(certificateId);
  const profile = getProfile(profileId);
  if (!cert || !profile) return fail("الشهادة أو ملف Provisioning Profile غير موجود.");
  if (!config.zsignBin) {
    return fail("أداة التوقيع غير مُعدّة على الخادم (ZSIGN_BIN). شغّل scripts/build-zsign.sh ثم عيّن المسار.");
  }

  let profileInfo;
  try {
    profileInfo = parseProfile(decryptSecret(profile.blobEnc));
  } catch (err) {
    return fail((err as Error).message);
  }

  const validation = checkSigningInputs({
    bundleId: app.bundleId,
    now: new Date(),
    profile: {
      uuid: profileInfo.uuid,
      teamId: profileInfo.teamId,
      appIdentifier: profileInfo.appIdentifier,
      distribution: profileInfo.distribution,
      notAfter: profileInfo.notAfter,
      deviceCount: profileInfo.deviceCount,
      certFingerprints: profileInfo.certFingerprints,
      disabled: profile.disabled,
    },
    certificate: {
      teamId: cert.teamId,
      kind: cert.kind,
      fingerprint: cert.fingerprint,
      notAfter: new Date(cert.notAfter),
      disabled: cert.disabled,
    },
  });
  if (!validation.ok) return fail(validation.errors.join(" "), validation.warnings);

  updateApp(app.id, { signingStatus: "signing", signingError: null });
  let workDir: string | null = null;
  try {
    workDir = await createPrivateTempDir();
    const pass = decryptSecret(cert.passwordEnc).toString("utf8");
    const p12Path = path.join(workDir, "cert.p12");
    const profPath = path.join(workDir, "profile.mobileprovision");
    const outPath = path.join(workDir, "signed.ipa");
    const scratch = path.join(workDir, "work");
    await fs.mkdir(scratch, { mode: 0o700 });
    await fs.writeFile(p12Path, decryptSecret(cert.p12Enc), { mode: 0o600 });
    await fs.writeFile(profPath, decryptSecret(profile.blobEnc), { mode: 0o600 });

    await runZsign(
      ["-k", p12Path, "-p", pass, "-m", profPath, "-o", outPath, "-t", scratch, "-z", "9", "-q", dataPath(app.originalPath)],
      [pass],
    );

    const signed = await fs.readFile(outPath);
    const check = inspectSignedIpa(signed);
    if (check.bundleId !== app.bundleId) throw new Error("Bundle ID تغيّر أثناء التوقيع. تم إلغاء النتيجة.");
    if (check.embeddedProfileUuid !== profileInfo.uuid) throw new Error("ملف التعريف المضمّن لا يطابق الملف المختار.");
    if (!check.hasCodeResources) throw new Error("لم يتم إنشاء توقيع الكود داخل الملف.");

    const relative = await writeBlob(`signed/${app.id}.ipa`, signed);
    updateApp(app.id, {
      signedPath: relative,
      signedAt: new Date().toISOString(),
      signingStatus: "signed",
      signingError: null,
      distribution: profileInfo.distribution,
      certificateId: cert.id,
      profileId: profile.id,
    });
    addLog("info", "signing", `تم توقيع ${app.name} (${profileInfo.distribution})`, {
      appId: app.id,
      profileUuid: profileInfo.uuid,
    });
    return { ok: true, message: "تم توقيع التطبيق بنجاح.", warnings: validation.warnings };
  } catch (err) {
    return fail((err as Error).message, validation.warnings);
  } finally {
    if (workDir) await removeDir(workDir);
  }
}
