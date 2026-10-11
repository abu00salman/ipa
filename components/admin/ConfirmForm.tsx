"use client";

import type { ReactNode } from "react";

/** Form that asks for confirmation before submitting a destructive server action. */
export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
