import catalogData from "../data/catalog.json";

export interface CatalogApp {
  slug: string;
  name: string;
  developer: string;
  description: string;
  releaseNotes: string;
  version: string;
  build: string;
  minIos: string;
  devices: string[];
  sizeBytes: number;
  updatedAt: string;
  icon: string | null;
  screenshots: string[];
  testflightUrl: string | null;
  /** Direct install is possible only when a signed package and manifest are published. */
  manifestUrl: string | null;
  /** Install on the live server, where signing and eligibility checks run. */
  liveUrl: string;
  distribution: string;
}

export interface Catalog {
  generatedAt: string;
  settings: {
    storeName: string;
    palette: "blue" | "purple" | "aurora";
    supportEmail: string;
    telegramUrl: string;
    xUrl: string;
    instagramUrl: string;
  };
  apps: CatalogApp[];
}

export const catalog = catalogData as Catalog;

/** Prefixes a path under /public with the site's basePath. */
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/${path.replace(/^\//, "")}`;
}
