import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, signPayload, verifyPassword, verifyPayload } from "../lib/crypto";
import { base32Decode, totpFor, verifyTotp } from "../lib/totp";
import { resolveLang, t } from "../lib/i18n";
import { allow } from "../lib/ratelimit";
import { checkInstallEligibility } from "../lib/install";
import { buildManifest, itmsInstallUrl } from "../lib/manifest";
import type { AppRecord, ProfileRecord } from "../lib/db";

describe("crypto", () => {
  it("round-trips secrets with AES-256-GCM and rejects tampering", () => {
    const enc = encryptSecret(Buffer.from("p12-bytes"));
    expect(decryptSecret(enc).toString()).toBe("p12-bytes");
    const parts = enc.split(".");
    parts[3] = Buffer.from("evil").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("signs and verifies payloads, rejecting a wrong secret", () => {
    const token = signPayload({ sub: "a", exp: 1 }, "secret-one");
    expect(verifyPayload(token, "secret-one")).toEqual({ sub: "a", exp: 1 });
    expect(verifyPayload(token, "secret-two")).toBeNull();
    expect(verifyPayload("garbage", "secret-one")).toBeNull();
  });

  it("hashes and verifies passwords with scrypt", () => {
    const hash = hashPassword("correct horse");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(verifyPassword("correct horse", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("totp", () => {
  // RFC 6238 test key "12345678901234567890", time 59s -> 8-digit 94287082, so 6-digit 287082.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("matches the RFC 6238 SHA-1 test vector", () => {
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(totpFor(secret, 59_000)).toBe("287082");
  });

  it("accepts the current code and one step of drift, rejects others", () => {
    const now = 59_000;
    expect(verifyTotp(secret, "287082", now)).toBe(true);
    expect(verifyTotp(secret, "287082", now + 30_000)).toBe(true);
    expect(verifyTotp(secret, "000000", now)).toBe(false);
    expect(verifyTotp(secret, "28708", now)).toBe(false);
  });
});

describe("i18n", () => {
  it("resolves language: cookie, then store default, then browser", () => {
    expect(resolveLang("en", "ar", "ar-SA")).toBe("en");
    expect(resolveLang(undefined, "en", "ar-SA")).toBe("en");
    expect(resolveLang(undefined, "auto", "ar-SA,en;q=0.8")).toBe("ar");
    expect(resolveLang(undefined, "auto", "fr-FR")).toBe("en");
    expect(resolveLang(undefined, "auto", null)).toBe("ar");
  });

  it("interpolates variables and keeps both dictionaries complete", () => {
    expect(t("en", "apps_count", { count: 3 })).toBe("3 apps");
    expect(t("ar", "apps_count", { count: 3 })).toBe("3 تطبيق");
  });
});

describe("rate limit", () => {
  it("blocks after the limit within the window", () => {
    const key = `test-${Math.random()}`;
    expect([1, 2, 3].map(() => allow(key, 3, 60_000))).toEqual([true, true, true]);
    expect(allow(key, 3, 60_000)).toBe(false);
  });
});

function app(overrides: Partial<AppRecord> = {}): AppRecord {
  return {
    id: "1",
    slug: "demo",
    name: "Demo",
    bundleId: "com.example.demo",
    version: "1.0",
    build: "1",
    minIos: "15.0",
    devices: ["iPhone"],
    sizeBytes: 10,
    sha256: "",
    developer: "",
    description: "",
    releaseNotes: "",
    published: true,
    iconPath: null,
    originalPath: "ipa/x.ipa",
    signedPath: "signed/x.ipa",
    signedAt: new Date().toISOString(),
    signingStatus: "signed",
    signingError: null,
    distribution: "ad-hoc",
    certificateId: "c",
    profileId: "p",
    screenshots: [],
    testflightUrl: null,
    installRequests: 0,
    downloads: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: "p",
    name: "p",
    uuid: "U",
    teamId: "T",
    appIdentifier: "T.com.example.demo",
    distribution: "ad-hoc",
    notAfter: new Date(Date.now() + 86_400_000).toISOString(),
    deviceCount: 1,
    certFingerprints: ["aa"],
    disabled: false,
    blobEnc: "",
    createdAt: "",
    ...overrides,
  };
}

describe("install eligibility", () => {
  const https = "https://iramzipa.com";

  it("allows a signed, published, ad-hoc app with a valid profile", () => {
    expect(checkInstallEligibility(app(), profile(), null, https)).toMatchObject({ ok: true, code: "ok" });
  });

  it("explains each blocker instead of failing silently", () => {
    expect(checkInstallEligibility(app({ published: false }), profile(), null, https).code).toBe("not_published");
    expect(checkInstallEligibility(app({ signingStatus: "failed" }), profile(), null, https).code).toBe("not_signed");
    expect(checkInstallEligibility(app(), profile(), null, "http://localhost:3000").code).toBe("https_required");
    expect(checkInstallEligibility(app(), null, null, https).code).toBe("profile_missing");
    expect(checkInstallEligibility(app(), profile({ disabled: true }), null, https).code).toBe("profile_disabled");
    expect(
      checkInstallEligibility(app(), profile({ notAfter: new Date(0).toISOString() }), null, https).code,
    ).toBe("profile_expired");
    expect(checkInstallEligibility(app({ distribution: "app-store" }), profile(), null, https).code).toBe("store_distribution");
  });
});

describe("manifest", () => {
  it("builds an itms-services manifest with the bundle id and HTTPS package URL", () => {
    const xml = buildManifest({
      bundleId: "com.example.demo",
      version: "1.2",
      title: "Demo & Co",
      packageUrl: "https://iramzipa.com/dl/demo?t=abc",
      iconUrl: "https://iramzipa.com/icon/demo",
    });
    expect(xml).toContain("<key>bundle-identifier</key>");
    expect(xml).toContain("<string>com.example.demo</string>");
    expect(xml).toContain("<string>software-package</string>");
    expect(xml).toContain("Demo &amp; Co");
  });

  it("encodes the manifest URL inside the itms-services link", () => {
    expect(itmsInstallUrl("https://x.test/m?a=1&b=2")).toBe(
      "itms-services://?action=download-manifest&url=https%3A%2F%2Fx.test%2Fm%3Fa%3D1%26b%3D2",
    );
  });
});
