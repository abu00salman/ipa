import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { PALETTES } from "@/lib/themes";

export default function manifest(): MetadataRoute.Manifest {
  const settings = getSettings();
  return {
    name: settings.storeName,
    short_name: settings.storeName,
    description: "iOS app signing and installation",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: PALETTES[settings.palette].primary,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
