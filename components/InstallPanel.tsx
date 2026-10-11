"use client";

import { useEffect, useState } from "react";

export interface InstallLabels {
  ready: string;
  checking: string;
  installing: string;
  install: string;
  hint: string;
  helpTitle: string;
  helpBody: string;
  unsupported: string;
  unavailableTitle: string;
  networkError: string;
  testflight: string;
  testflightUrl: string | null;
}

type Phase = "ready" | "checking" | "installing" | "error";

/**
 * Install button. It is honest about what it knows: the website asks the server whether the
 * app can be installed, then hands off to iOS. It never claims that installation succeeded.
 */
export function InstallPanel({
  slug,
  available,
  reasonCode,
  reasons,
  labels,
}: {
  slug: string;
  available: boolean;
  reasonCode: string | null;
  reasons: Record<string, string>;
  labels: InstallLabels;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(true);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  }, []);

  async function install() {
    if (!isIOS) {
      setMessage(labels.unsupported);
      return;
    }
    setMessage(null);
    setPhase("checking");
    try {
      const res = await fetch(`/api/apps/${slug}/install`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; code?: string; installUrl?: string };
      if (!res.ok || !data.ok || !data.installUrl) {
        setPhase("error");
        setMessage(reasons[data.code ?? ""] ?? reasons.default ?? labels.networkError);
        return;
      }
      setPhase("installing");
      window.location.href = data.installUrl;
    } catch {
      setPhase("error");
      setMessage(labels.networkError);
    }
  }

  const steps: { key: Phase; label: string }[] = [
    { key: "ready", label: labels.ready },
    { key: "checking", label: labels.checking },
    { key: "installing", label: labels.installing },
  ];
  const activeIndex = phase === "error" ? 0 : steps.findIndex((s) => s.key === phase);
  const busy = phase === "checking" || phase === "installing";

  return (
    <div className="card p-5">
      {available ? (
        <>
          <button type="button" className="btn btn-primary w-full !text-[17px]" onClick={install} disabled={busy}>
            {phase === "checking" && <Spinner />}
            {phase === "checking" ? labels.checking : phase === "installing" ? labels.installing : labels.install}
          </button>
          <ol className="mt-4 flex items-center justify-between gap-2 text-xs font-medium" aria-label="progress">
            {steps.map((s, i) => (
              <li key={s.key} className={`flex items-center gap-1.5 ${i <= activeIndex ? "" : "muted opacity-60"}`} style={i <= activeIndex ? { color: "var(--primary)" } : undefined}>
                <span className={`inline-block size-2 rounded-full ${i === activeIndex && busy ? "dot-pulse" : ""}`} style={{ background: i <= activeIndex ? "var(--primary)" : "var(--border)" }} />
                {s.label}
              </li>
            ))}
          </ol>
          {phase === "installing" && <p className="muted mt-4 text-sm leading-7">{labels.hint}</p>}
        </>
      ) : (
        <>
          <button type="button" className="btn btn-ghost w-full" disabled>
            {labels.unavailableTitle}
          </button>
          {reasonCode && <p className="notice notice-warn mt-4">{reasons[reasonCode] ?? reasons.default}</p>}
        </>
      )}

      {message && <p role="alert" className="notice notice-bad mt-4">{message}</p>}
      {!isIOS && available && <p className="notice notice-warn mt-4">{labels.unsupported}</p>}

      {labels.testflightUrl && (
        <a href={labels.testflightUrl} target="_blank" rel="noopener noreferrer" className="btn btn-soft mt-3 w-full">
          {labels.testflight}
        </a>
      )}

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">{labels.helpTitle}</summary>
        <p className="muted mt-2 leading-7">{labels.helpBody}</p>
      </details>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
