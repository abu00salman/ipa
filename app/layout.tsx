import type { Metadata, Viewport } from "next";
import { catalog } from "../lib/catalog";
import { t } from "../../lib/i18n";
import { Footer, Header, PrefsProvider } from "../components/Store";
import "./globals.css";

const siteTitle = catalog.settings.storeName;

export const metadata: Metadata = {
  title: { default: `${siteTitle} · ${t("ar", "tagline")}`, template: `%s · ${siteTitle}` },
  description: t("ar", "hero_body"),
  applicationName: siteTitle,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a08" },
  ],
};

/** Runs before paint so the saved theme and language apply without a flash. */
const EARLY_PREFS = `(function(){try{var t=localStorage.getItem("irz_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);var l=localStorage.getItem("irz_lang");if(l!=="ar"&&l!=="en"){l=(navigator.language||"").toLowerCase().indexOf("ar")===0||!navigator.language?"ar":"en"}document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: EARLY_PREFS }} />
      </head>
      <body>
        <PrefsProvider>
          <Header catalog={catalog} />
          <main className="pb-6">{children}</main>
          <Footer catalog={catalog} />
        </PrefsProvider>
      </body>
    </html>
  );
}
