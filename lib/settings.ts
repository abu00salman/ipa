import { readSettingsRaw, writeSettings } from "./db";

export type PaletteName = "blue" | "purple" | "aurora";
export type ColorMode = "system" | "light" | "dark";
export type LangPreference = "auto" | "ar" | "en";

export interface SiteSettings {
  storeName: string;
  logoUrl: string;
  defaultLanguage: LangPreference;
  palette: PaletteName;
  defaultColorMode: ColorMode;
  domain: string;
  supportEmail: string;
  telegramUrl: string;
  xUrl: string;
  instagramUrl: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: "iRaMzipa",
  logoUrl: "",
  defaultLanguage: "auto",
  palette: "blue",
  defaultColorMode: "system",
  domain: "iramzipa.com",
  supportEmail: "",
  telegramUrl: "",
  xUrl: "",
  instagramUrl: "",
};

const PALETTES: PaletteName[] = ["blue", "purple", "aurora"];
const MODES: ColorMode[] = ["system", "light", "dark"];
const LANGS: LangPreference[] = ["auto", "ar", "en"];

export function getSettings(): SiteSettings {
  const raw = readSettingsRaw();
  const merged = { ...DEFAULT_SETTINGS, ...raw } as SiteSettings;
  return {
    ...merged,
    palette: PALETTES.includes(merged.palette) ? merged.palette : "blue",
    defaultColorMode: MODES.includes(merged.defaultColorMode) ? merged.defaultColorMode : "system",
    defaultLanguage: LANGS.includes(merged.defaultLanguage) ? merged.defaultLanguage : "auto",
  };
}

export function saveSettings(input: Partial<SiteSettings>): void {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    clean[key] = String(value).trim().slice(0, 500);
  }
  writeSettings(clean);
}
