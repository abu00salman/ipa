"use client";

import { useState, useTransition } from "react";
import { setPublishedAction } from "@/app/admin/actions";
import { actionMessage, type Lang } from "@/lib/i18n";

export function PublishToggle({
  appId,
  published,
  lang,
  labels,
}: {
  appId: string;
  published: boolean;
  lang: Lang;
  labels: { publish: string; unpublish: string };
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={`btn ${published ? "btn-ghost" : "btn-primary"}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setPublishedAction(appId, !published);
            setMessage({ ok: Boolean(res.ok), text: actionMessage(lang, res.message ?? "") });
          })
        }
      >
        {published ? labels.unpublish : labels.publish}
      </button>
      {message && (
        <p role="status" className="text-sm font-medium" style={{ color: message.ok ? "var(--success)" : "var(--danger)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
