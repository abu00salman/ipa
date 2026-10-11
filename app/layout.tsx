import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { config } from "@/lib/env";
import { requestContext } from "@/lib/request";
import { paletteVars } from "@/lib/themes";
import { t } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requestContext();
  const name = ctx.settings.storeName;
  const description = t(ctx.lang, "hero_body");
  return {
    metadataBase: new URL(config.publicBaseUrl),
    title: { default: `${name} · ${t(ctx.lang, "tagline")}`, template: `%s · ${name}` },
    description,
    applicationName: name,
    manifest: "/manifest.webmanifest",
    alternates: { canonical: "/" },
    openGraph: { siteName: name, type: "website", locale: ctx.lang === "ar" ? "ar_SA" : "en_US", description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requestContext();
  return (
    <html
      lang={ctx.lang}
      dir={ctx.dir}
      data-theme={ctx.theme}
      style={paletteVars(ctx.settings.palette) as CSSProperties}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
