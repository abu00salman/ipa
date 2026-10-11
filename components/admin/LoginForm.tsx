"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type ActionState } from "@/app/admin/actions";
import { actionMessage, t, type Lang } from "@/lib/i18n";

/**
 * Sign-in form. React 19 clears uncontrolled fields after each action, so the email is restored
 * from the returned state. The password and code are always cleared.
 */
export function LoginForm({ lang }: { lang: Lang }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="email">{t(lang, "email")}</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t(lang, "password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="totp">{t(lang, "totp_code")}</label>
        <input id="totp" name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input" />
      </div>
      {state.message && (
        <p role="alert" className="notice notice-bad">{actionMessage(lang, state.message)}</p>
      )}
      <SubmitLogin label={t(lang, "login")} />
    </form>
  );
}

function SubmitLogin({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary mt-2" disabled={pending}>
      {label}
    </button>
  );
}
