import type { MetadataRoute } from "next";
import { config } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/dl/", "/i/"] }],
    sitemap: `${config.publicBaseUrl}/sitemap.xml`,
  };
}
