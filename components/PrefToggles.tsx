"use client";

import { useState } from "react";
import { LANG_COOKIE, THEME_COOKIE, type Lang } from "@/lib/i18n";

export interface PrefLabels {
  language: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
}

type ThemeChoice = "light" | "dark" | "system";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/** Language and theme switches. Theme applies instantly; language reloads so direction (RTL/LTR) updates. */
export function PrefToggles({ lang, initialTheme, labels }: { lang: Lang; initialTheme?: "light" | "dark"; labels: PrefLabels }) {
  const [theme, setTheme] = useState<ThemeChoice>(initialTheme ?? "system");

  const nextLang: Lang = lang === "ar" ? "en" : "ar";
  const themeLabel = theme === "light" ? labels.light : theme === "dark" ? labels.dark : labels.system;

  function switchLanguage() {
    setCookie(LANG_COOKIE, nextLang);
    window.location.reload();
  }

  function cycleTheme() {
    const next: ThemeChoice = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    setCookie(THEME_COOKIE, next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  const btn = "btn btn-ghost !min-h-9 !px-3 !text-sm";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={cycleTheme} aria-label={`${labels.theme}: ${themeLabel}`} title={themeLabel}>
        <ThemeIcon theme={theme} />
        <span className="hidden sm:inline">{themeLabel}</span>
      </button>
      <button type="button" className={btn} onClick={switchLanguage} aria-label={labels.language}>
        <span aria-hidden="true">{lang === "ar" ? "EN" : "ع"}</span>
      </button>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  if (theme === "light") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
