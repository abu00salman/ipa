"use client";

import { useState } from "react";

export function ShareButtons({ url, title, copyLabel, copiedLabel, shareLabel }: { url: string; title: string; copyLabel: string; copiedLabel: string; shareLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(copyLabel, url);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-ghost !min-h-10 !text-sm" onClick={copy}>
        {copied ? copiedLabel : copyLabel}
      </button>
      <button type="button" className="btn btn-soft !min-h-10 !text-sm" onClick={share}>
        {shareLabel}
      </button>
      <a className="btn btn-ghost !min-h-10 !text-sm" href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
    </div>
  );
}
