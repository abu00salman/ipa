import type { Distribution } from "../db";
import { profileCoversBundle } from "./profile";

export interface SigningInputs {
  bundleId: string;
  now: Date;
  profile: {
    uuid: string;
    teamId: string;
    appIdentifier: string;
    distribution: Distribution;
    notAfter: Date;
    deviceCount: number;
    certFingerprints: string[];
    disabled: boolean;
  };
  certificate: {
    teamId: string;
    kind: "distribution" | "development" | "unknown";
    fingerprint: string;
    notAfter: Date;
    disabled: boolean;
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Pure rules that decide whether a certificate + profile pair may sign an app.
 * Every error blocks signing, and publishing is blocked for any app without a valid signature.
 */
export function checkSigningInputs(input: SigningInputs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { profile, certificate: cert } = input;

  if (cert.disabled) errors.push("الشهادة معطّلة.");
  if (profile.disabled) errors.push("ملف Provisioning Profile معطّل.");
  if (cert.notAfter <= input.now) errors.push(`الشهادة منتهية الصلاحية منذ ${cert.notAfter.toISOString().slice(0, 10)}.`);
  if (profile.notAfter <= input.now) errors.push(`ملف Provisioning Profile منتهي الصلاحية منذ ${profile.notAfter.toISOString().slice(0, 10)}.`);
  if (cert.teamId && profile.teamId && cert.teamId !== profile.teamId) {
    errors.push("فريق الشهادة (Team ID) لا يطابق فريق ملف التعريف.");
  }
  if (!profile.certFingerprints.includes(cert.fingerprint)) {
    errors.push("الشهادة المختارة غير موجودة ضمن الشهادات المسموح بها في ملف التعريف.");
  }
  if (!profileCoversBundle(profile.appIdentifier, input.bundleId)) {
    errors.push(`ملف التعريف لا يغطي Bundle ID التطبيق (${input.bundleId}).`);
  }

  const needsDevelopmentCert = profile.distribution === "development";
  if (cert.kind !== "unknown") {
    if (needsDevelopmentCert && cert.kind !== "development") {
      errors.push("ملف Development يتطلب شهادة Development.");
    }
    if (!needsDevelopmentCert && cert.kind !== "distribution") {
      errors.push("ملف التوزيع يتطلب شهادة Distribution وليس Development.");
    }
  }

  if (profile.distribution === "ad-hoc" && profile.deviceCount === 0) {
    errors.push("ملف Ad Hoc لا يحتوي أي جهاز مسجّل.");
  }
  if (profile.distribution === "app-store") {
    warnings.push("ملف App Store لا يدعم التثبيت المباشر من الموقع. استخدم TestFlight أو App Store.");
  }
  if (profile.distribution === "development") {
    warnings.push("ملف Development يعمل فقط على الأجهزة المسجلة فيه.");
  }

  return { ok: errors.length === 0, errors, warnings };
}
