import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config, requireSecret } from "./env";
import { hashPassword, signPayload, verifyPassword, verifyPayload } from "./crypto";
import { verifyTotp } from "./totp";

export const SESSION_COOKIE = "irz_admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionPayload extends Record<string, unknown> {
  sub: string;
  exp: number;
}

export function issueSessionToken(email: string): string {
  return signPayload({ sub: email, exp: Date.now() + SESSION_TTL_MS }, requireSecret("sessionSecret"));
}

export type CredentialResult = { ok: true } | { ok: false; reason: "not_configured" | "invalid" };

/** One generic failure reason for wrong email, password, or code, so attackers learn nothing. */
export function checkAdminCredentials(email: string, password: string, totp: string): CredentialResult {
  if (!config.adminEmail || !config.adminPasswordHash || !config.sessionSecret) {
    return { ok: false, reason: "not_configured" };
  }
  const emailOk = email.trim().toLowerCase() === config.adminEmail;
  const passOk = verifyPassword(password, config.adminPasswordHash);
  const mfaOk = config.adminTotpSecret ? verifyTotp(config.adminTotpSecret, totp) : true;
  return emailOk && passOk && mfaOk ? { ok: true } : { ok: false, reason: "invalid" };
}

export async function currentAdmin(): Promise<string | null> {
  if (!config.sessionSecret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyPayload<SessionPayload>(token, config.sessionSecret);
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload.sub === config.adminEmail ? payload.sub : null;
}

/** For pages and layouts. Redirects to login when there is no valid admin session. */
export async function requireAdmin(): Promise<string> {
  const who = await currentAdmin();
  if (!who) redirect("/admin/login");
  return who;
}

export function generatePasswordHash(password: string): string {
  return hashPassword(password);
}
