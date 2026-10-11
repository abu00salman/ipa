"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { actionMessage, type Lang } from "@/lib/i18n";

export interface ActionResult {
  ok?: boolean;
  message?: string;
  warnings?: string[];
}

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/** Form that runs a server action and shows its result inline. Works without JavaScript for plain submit. */
export function ActionForm({
  action,
  lang,
  submitLabel,
  pendingLabel,
  className,
  children,
  disabled,
}: {
  action: Action;
  lang: Lang;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel ?? submitLabel} disabled={disabled} />
        {state.message && (
          <p role="status" className={`text-sm font-medium ${state.ok ? "" : "text-[color:var(--danger)]"}`} style={state.ok ? { color: "var(--success)" } : undefined}>
            {actionMessage(lang, state.message)}
          </p>
        )}
      </div>
      {state.warnings && state.warnings.length > 0 && (
        <ul className="notice notice-warn mt-3 list-disc ps-6">
          {state.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

function SubmitButton({ label, pendingLabel, disabled }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </button>
  );
}
