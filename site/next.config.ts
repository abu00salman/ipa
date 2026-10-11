import type { NextConfig } from "next";

/**
 * Static storefront for GitHub Pages. Served at https://<user>.github.io/<repo>/ (basePath "/ipa").
 * Override with SITE_BASE_PATH="" for a root domain such as iramzipa.com later.
 */
const basePath = process.env.SITE_BASE_PATH ?? "/ipa";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
