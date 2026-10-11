import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { config } from "../lib/env";
import { encryptSecret } from "../lib/crypto";
import { getAppById, insertCertificate, insertProfile, getCertificate } from "../lib/db";
import { ingestIpa } from "../lib/ingest";
import { inspectP12 } from "../lib/ipa/cert";
import { inspectSignedIpa } from "../lib/ipa/parse";
import { parseProfile } from "../lib/ipa/profile";
import { signApp } from "../lib/signing";
import { readBlob } from "../lib/storage";
import { makeSigningAssets, type SigningAssets } from "./helpers/signing-assets";

// Runs the real zsign binary. Set ZSIGN_BIN (see scripts/build-zsign.sh) to enable.
const zsign = process.env.ZSIGN_BIN ?? "";
const enabled = Boolean(zsign);

describe.skipIf(!enabled)("signing pipeline (real zsign)", () => {
  let assets: SigningAssets;
  let certId = "";
  let profileId = "";

  beforeAll(async () => {
    await fs.rm(config.dataDir, { recursive: true, force: true });
    process.env.ZSIGN_BIN = zsign;
    assets = await makeSigningAssets();

    const info = await inspectP12(assets.p12, assets.p12Password);
    certId = insertCertificate({
      name: "Test Distribution",
      kind: info.kind,
      teamId: info.teamId,
      subject: info.commonName,
      notAfter: info.notAfter.toISOString(),
      fingerprint: info.fingerprint,
      p12Enc: encryptSecret(assets.p12),
      passwordEnc: encryptSecret(assets.p12Password),
    });

    const prof = parseProfile(assets.profile);
    profileId = insertProfile({
      name: "Test AdHoc",
      uuid: prof.uuid,
      teamId: prof.teamId,
      appIdentifier: prof.appIdentifier,
      distribution: prof.distribution,
      notAfter: prof.notAfter.toISOString(),
      deviceCount: prof.deviceCount,
      certFingerprints: prof.certFingerprints,
      blobEnc: encryptSecret(assets.profile),
    });
  });

  it("detects the certificate type and team from the P12 and the profile type from the mobileprovision", async () => {
    const cert = getCertificate(certId);
    expect(cert?.kind).toBe("distribution");
    expect(cert?.teamId).toBe(assets.teamId);
    const prof = parseProfile(assets.profile);
    expect(prof.distribution).toBe("ad-hoc");
    expect(prof.uuid).toBe(assets.profileUuid);
  });

  it("signs an uploaded IPA and produces a verifiable signed package", async () => {
    const { app } = await ingestIpa(assets.ipa);
    const outcome = await signApp(app.id, certId, profileId);
    expect(outcome.message).toBeTruthy();
    expect(outcome.ok, outcome.message).toBe(true);

    const stored = getAppById(app.id);
    expect(stored?.signingStatus).toBe("signed");
    expect(stored?.distribution).toBe("ad-hoc");
    expect(stored?.signedPath).toBeTruthy();

    const signed = await readBlob(stored!.signedPath!);
    const check = inspectSignedIpa(signed);
    expect(check.bundleId).toBe(assets.bundleId);
    expect(check.embeddedProfileUuid).toBe(assets.profileUuid);
    expect(check.hasCodeResources).toBe(true);
  });

  it("refuses to sign when the profile does not cover the bundle id, and records why", async () => {
    const other = await makeSigningAssets("com.other.app");
    const { app } = await ingestIpa(other.ipa);
    const outcome = await signApp(app.id, certId, profileId);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/Bundle ID/);
    const stored = getAppById(app.id);
    expect(stored?.signingStatus).toBe("failed");
    expect(stored?.signedPath).toBeNull();
  });

  it("never leaves the certificate password in stored error text", async () => {
    const { app } = await ingestIpa((await makeSigningAssets("com.example.demo.two")).ipa);
    await signApp(app.id, certId, profileId);
    const stored = getAppById(app.id);
    expect(stored?.signingError ?? "").not.toContain(assets.p12Password);
  });
});
