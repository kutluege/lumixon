import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { languageAlternates, localePath, locales } from "@/i18n/config";

/** Required for the static export (GitHub Pages). */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const abs = (path: string) => (path === "/" ? SITE.url : `${SITE.url}${path}`);
  const languages = Object.fromEntries(Object.entries(languageAlternates()).map(([k, v]) => [k, abs(v)]));
  const lastModified = new Date();
  return locales.map((locale) => ({
    url: abs(localePath(locale)),
    lastModified,
    changeFrequency: "monthly",
    priority: locale === "tr" ? 1 : 0.9,
    alternates: { languages },
  }));
}
