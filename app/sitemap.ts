import type { MetadataRoute } from "next";
import { config } from "@/lib/env";
import { listApps } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.publicBaseUrl;
  const apps = listApps({ publishedOnly: true }).map((app) => ({
    url: `${base}/app/${app.slug}`,
    lastModified: new Date(app.updatedAt),
  }));
  return [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }, ...apps];
}
