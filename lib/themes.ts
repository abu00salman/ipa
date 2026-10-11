import type { PaletteName } from "./settings";

export interface Palette {
  name: PaletteName;
  label: { ar: string; en: string };
  primary: string;
  dark: string;
  light: string;
  gradient: string;
}

/** Blue is the default. Colors are applied as CSS variables, so changing a palette never needs a rebuild. */
export const PALETTES: Record<PaletteName, Palette> = {
  blue: {
    name: "blue",
    label: { ar: "أزرق", en: "Blue" },
    primary: "#2563EB",
    dark: "#1E40AF",
    light: "#EFF6FF",
    gradient: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
  },
  purple: {
    name: "purple",
    label: { ar: "بنفسجي", en: "Purple" },
    primary: "#7C3AED",
    dark: "#5B21B6",
    light: "#F5F3FF",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
  },
  aurora: {
    name: "aurora",
    label: { ar: "شفق", en: "Aurora" },
    primary: "#2563EB",
    dark: "#6D4AE0",
    light: "#EEF2FF",
    gradient: "linear-gradient(135deg, #2563EB 0%, #8B5CF6 100%)",
  },
};

/** Only the accent tokens change per palette. Surfaces and dark mode come from globals.css. */
export function paletteVars(name: PaletteName): Record<string, string> {
  const p = PALETTES[name];
  return { "--primary": p.primary, "--primary-dark": p.dark, "--primary-gradient": p.gradient };
}
