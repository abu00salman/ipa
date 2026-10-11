import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import plist from "plist";
import { zipSync, strToU8 } from "fflate";

const run = (file: string, args: string[]) =>
  new Promise<void>((resolve, reject) =>
    execFile(file, args, (err, _o, stderr) => (err ? reject(new Error(String(stderr || err.message))) : resolve())),
  );

/**
 * Minimal arm64 Mach-O executable with __TEXT, __LINKEDIT and LC_CODE_SIGNATURE, the layout zsign needs
 * before it can insert a code signature. It is not runnable code.
 */
export function machOExecutable(): Uint8Array {
  const MH_MAGIC_64 = 0xfeedfacf;
  const CPU_TYPE_ARM64 = 0x0100000c;
  const MH_EXECUTE = 2;
  const LC_SEGMENT_64 = 0x19;
  const LC_CODE_SIGNATURE = 0x1d;
  const segment = (name: string, vmaddr: number, vmsize: number, fileoff: number, filesize: number, prot: number) => {
    const b = Buffer.alloc(72);
    b.writeUInt32LE(LC_SEGMENT_64, 0);
    b.writeUInt32LE(72, 4);
    b.write(name, 8, "latin1");
    b.writeBigUInt64LE(BigInt(vmaddr), 24);
    b.writeBigUInt64LE(BigInt(vmsize), 32);
    b.writeBigUInt64LE(BigInt(fileoff), 40);
    b.writeBigUInt64LE(BigInt(filesize), 48);
    b.writeInt32LE(prot, 56);
    b.writeInt32LE(prot, 60);
    return b;
  };
  const cmds = Buffer.concat([
    segment("__TEXT", 0, 0x4000, 0, 0x1000, 5),
    segment("__LINKEDIT", 0x4000, 0x1000, 0x1000, 0x100, 1),
    Buffer.from([LC_CODE_SIGNATURE, 0, 0, 0, 16, 0, 0, 0, 0x00, 0x10, 0, 0, 0x00, 0x01, 0, 0]),
  ]);
  const header = Buffer.alloc(32);
  header.writeUInt32LE(MH_MAGIC_64, 0);
  header.writeUInt32LE(CPU_TYPE_ARM64, 4);
  header.writeUInt32LE(0, 8);
  header.writeUInt32LE(MH_EXECUTE, 12);
  header.writeUInt32LE(3, 16);
  header.writeUInt32LE(cmds.length, 20);
  const out = Buffer.alloc(0x1100);
  Buffer.concat([header, cmds]).copy(out, 0);
  return out;
}

export interface SigningAssets {
  dir: string;
  p12: Buffer;
  p12Password: string;
  profile: Buffer;
  profileUuid: string;
  ipa: Buffer;
  teamId: string;
  bundleId: string;
}

/**
 * Makes a self-signed certificate, a CMS-signed ad-hoc provisioning profile, and a minimal IPA.
 * This is not Apple-issued. It exercises the real signing pipeline (zsign + our checks) end to end.
 */
export async function makeSigningAssets(bundleId = "com.example.demo"): Promise<SigningAssets> {
  const teamId = "ABCDE12345";
  const uuid = "9F2C1A00-0000-4000-8000-00000000AB01";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "irz-sign-"));
  const p = (n: string) => path.join(dir, n);
  const p12Password = "test-pass-123";

  // Private CA -> leaf certificate. The CA travels inside the P12, which zsign uses as the issuer chain.
  // Apple-issued certificates chain to WWDR instead; this fixture only exercises our pipeline.
  await fs.writeFile(p("ext.cnf"), "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=codeSigning\n");
  await run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365", "-subj", "/CN=Test Root CA", "-keyout", p("ca.key"), "-out", p("ca.pem")]);
  await run("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-subj", `/CN=iPhone Distribution: Test (${teamId})/OU=${teamId}/O=Test/C=US`, "-keyout", p("key.pem"), "-out", p("leaf.csr")]);
  await run("openssl", ["x509", "-req", "-in", p("leaf.csr"), "-CA", p("ca.pem"), "-CAkey", p("ca.key"), "-CAcreateserial", "-days", "365", "-extfile", p("ext.cnf"), "-out", p("cert.pem")]);
  await run("openssl", ["pkcs12", "-export", "-inkey", p("key.pem"), "-in", p("cert.pem"), "-certfile", p("ca.pem"), "-out", p("cert.p12"), "-passout", `pass:${p12Password}`]);
  await run("openssl", ["x509", "-in", p("cert.pem"), "-outform", "DER", "-out", p("cert.der")]);

  const der = await fs.readFile(p("cert.der"));
  const xml = plist.build({
    Name: "Test AdHoc",
    UUID: uuid,
    TeamIdentifier: [teamId],
    TeamName: "Test",
    CreationDate: new Date(),
    ExpirationDate: new Date(Date.now() + 300 * 86_400_000),
    ProvisionedDevices: ["00008110-000A11220C00801E"],
    DeveloperCertificates: [der],
    Entitlements: { "application-identifier": `${teamId}.${bundleId}`, "get-task-allow": false, "keychain-access-groups": [`${teamId}.*`] },
    ApplicationIdentifierPrefix: [teamId],
    PlatformName: "iOS",
    Platform: ["iOS"],
  });
  await fs.writeFile(p("profile.plist"), xml);
  await run("openssl", ["smime", "-sign", "-nodetach", "-binary", "-in", p("profile.plist"), "-signer", p("cert.pem"), "-inkey", p("key.pem"), "-outform", "DER", "-out", p("profile.mobileprovision")]);
  const profile = await fs.readFile(p("profile.mobileprovision"));

  const appInfo = plist.build({
    CFBundleIdentifier: bundleId,
    CFBundleName: "Demo",
    CFBundleDisplayName: "Demo App",
    CFBundleShortVersionString: "1.0.0",
    CFBundleVersion: "7",
    CFBundleExecutable: "Demo",
    CFBundlePackageType: "APPL",
    MinimumOSVersion: "15.0",
    UIDeviceFamily: [1],
  });
  const ipa = Buffer.from(
    zipSync({
      "Payload/Demo.app/Demo": machOExecutable(),
      "Payload/Demo.app/Info.plist": strToU8(appInfo),
      "Payload/Demo.app/PkgInfo": strToU8("APPL????"),
    }, { level: 6 }),
  );

  return { dir, p12: await fs.readFile(p("cert.p12")), p12Password, profile, profileUuid: uuid, ipa, teamId, bundleId };
}
