"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Lang } from "@/lib/i18n";

/** Drag-and-drop IPA upload with real progress. On success it opens the app's review page. */
export function UploadForm({ lang, maxMb, appId }: { lang: Lang; maxMb: number; appId?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".ipa")) {
      setError(lang === "ar" ? "الملف يجب أن يكون بامتداد .ipa" : "The file must have a .ipa extension");
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      setError(t(lang, "msg_file_too_large"));
      return;
    }
    setFile(f);
  }

  function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    const body = new FormData();
    body.append("file", file);
    if (appId) body.append("appId", appId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/apps");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { ok?: boolean; id?: string; message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.id) {
        router.push(`/admin/apps/${data.id}`);
        router.refresh();
      } else {
        setBusy(false);
        setError(data.message ?? t(lang, "upload_error"));
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setError(t(lang, "upload_error"));
    };
    xhr.send(body);
  }

  return (
    <div className="card p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={t(lang, "upload_drop")}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed px-6 py-14 text-center transition"
        style={{
          borderColor: drag ? "var(--primary)" : "var(--border)",
          background: drag ? "var(--primary-soft)" : "var(--surface-2)",
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
        </svg>
        <p className="font-semibold">{file ? file.name : t(lang, "upload_drop")}</p>
        <p className="muted text-sm">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : t(lang, "upload_hint", { mb: maxMb })}</p>
        <input
          ref={input}
          type="file"
          accept=".ipa,application/octet-stream"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {busy && (
        <div className="mt-5" aria-live="polite">
          <div className="mb-2 flex justify-between text-sm">
            <span className="muted">{progress < 100 ? `${progress}%` : t(lang, "upload_analyzing")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress}%`, background: "var(--primary-gradient)" }} />
          </div>
        </div>
      )}

      {error && <p role="alert" className="notice notice-bad mt-5">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={upload}>
          {busy ? t(lang, "upload_analyzing") : t(lang, "upload_ipa")}
        </button>
      </div>
    </div>
  );
}
