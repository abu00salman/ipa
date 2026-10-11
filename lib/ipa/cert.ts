import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createPrivateTempDir, removeDir } from "../storage";

export interface P12Info {
  commonName: string;
  teamId: string;
  kind: "distribution" | "development" | "unknown";
  subject: string;
  notAfter: Date;
  /** SHA-1 of the certificate DER, lowercase hex. Matches Apple's DeveloperCertificates entries. */
  fingerprint: string;
}

function run(file: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { env, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.toString().trim().split("\n").slice(-1)[0] || "OpenSSL failed"));
      else resolve(stdout.toString());
    });
  });
}

function normalizePem(pem: string): string {
  return pem.replace(/\s+/g, "");
}

/**
 * Inspects a .p12 with the OpenSSL CLI. OpenSSL 3 reads modern AES-encrypted bundles,
 * which pure-JS parsers often reject. The password goes through an environment variable
 * so it never appears in the process list.
 */
export async function inspectP12(p12: Buffer, password: string): Promise<P12Info> {
  const dir = await createPrivateTempDir();
  try {
    const p12Path = path.join(dir, "in.p12");
    const certPath = path.join(dir, "cert.pem");
    const keyPath = path.join(dir, "key.pem");
    await fs.writeFile(p12Path, p12, { mode: 0o600 });
    const env = { ...process.env, IRZ_P12_PASS: password };
    const passin = ["-passin", "env:IRZ_P12_PASS"];

    let certOut: string;
    try {
      certOut = await run("openssl", ["pkcs12", "-in", p12Path, "-clcerts", "-nokeys", ...passin], env);
    } catch (err) {
      throw new Error(`تعذّر فتح ملف P12: تأكد من كلمة المرور. (${(err as Error).message})`);
    }
    const certPem = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(certOut)?.[0];
    if (!certPem) throw new Error("لا يحتوي ملف P12 على شهادة.");
    await fs.writeFile(certPath, certPem, { mode: 0o600 });

    const keyOut = await run("openssl", ["pkcs12", "-in", p12Path, "-nocerts", "-nodes", ...passin], env).catch(() => "");
    const keyPem = /-----BEGIN (?:ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:ENCRYPTED )?PRIVATE KEY-----/.exec(keyOut)?.[0];
    if (!keyPem) throw new Error("لا يحتوي ملف P12 على المفتاح الخاص.");
    await fs.writeFile(keyPath, keyPem, { mode: 0o600 });

    const [certPub, keyPub] = await Promise.all([
      run("openssl", ["x509", "-in", certPath, "-noout", "-pubkey"], env),
      run("openssl", ["pkey", "-in", keyPath, "-pubout"], env),
    ]);
    if (normalizePem(certPub) !== normalizePem(keyPub)) {
      throw new Error("المفتاح الخاص لا يطابق الشهادة داخل ملف P12.");
    }

    const subjectLine = (await run("openssl", ["x509", "-in", certPath, "-noout", "-subject", "-nameopt", "RFC2253"], env)).trim();
    const subject = subjectLine.replace(/^subject=/, "");
    const endLine = (await run("openssl", ["x509", "-in", certPath, "-noout", "-enddate"], env)).trim();
    const notAfter = new Date(endLine.replace(/^notAfter=/, ""));
    const fpLine = (await run("openssl", ["x509", "-in", certPath, "-noout", "-fingerprint", "-sha1"], env)).trim();
    const fingerprint = fpLine.split("=")[1].replace(/:/g, "").toLowerCase();

    const commonName = /CN=([^,]+)/.exec(subject)?.[1]?.trim() ?? "";
    const teamId = /OU=([^,]+)/.exec(subject)?.[1]?.trim() ?? "";
    let kind: P12Info["kind"] = "unknown";
    if (/Distribution/i.test(commonName)) kind = "distribution";
    else if (/Development|Developer/i.test(commonName)) kind = "development";

    return { commonName, teamId, kind, subject, notAfter, fingerprint };
  } finally {
    await removeDir(dir);
  }
}
