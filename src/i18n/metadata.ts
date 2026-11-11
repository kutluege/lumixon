import type { Metadata } from "next";
import { SITE, absoluteUrl, whatsappUrl } from "@/lib/site";
import { LOCALE_META, languageAlternates, localePath, locales, type Locale } from "./config";
import { getDictionary } from "./get-dictionary";

/** Per-locale <head> metadata: title, description, canonical + hreflang, OG/Twitter. */
export function buildMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale);
  const path = localePath(locale);
  // Share card rendered by src/app/og/[file]/route.tsx.
  const ogImage = absoluteUrl(`/og/${locale}.png`);
  return {
    // Origin only: Next already prefixes generated image routes with the base path.
    metadataBase: new URL(new URL(SITE.url).origin),
    title: { default: t.meta.title, template: "%s | LUMIXON" },
    description: t.meta.description,
    applicationName: "LUMIXON",
    keywords: t.meta.keywords,
    authors: [{ name: SITE.name, url: SITE.url }],
    // Absolute URLs: a root-relative path would drop the base path of a project site.
    alternates: {
      canonical: absoluteUrl(path),
      languages: Object.fromEntries(Object.entries(languageAlternates()).map(([k, v]) => [k, absoluteUrl(v)])),
    },
    openGraph: {
      type: "website",
      locale: LOCALE_META[locale].og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => LOCALE_META[l].og),
      url: absoluteUrl(path),
      siteName: "LUMIXON",
      title: t.meta.title,
      description: t.meta.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: t.meta.title, type: "image/png" }],
    },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description, images: [ogImage] },
    robots: { index: true, follow: true },
  };
}

/** schema.org Organization, localized. */
export function buildJsonLd(locale: Locale) {
  const t = getDictionary(locale);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LUMIXON",
    alternateName: "LUMIXON Applied AI",
    url: SITE.url,
    description: t.meta.description,
    inLanguage: LOCALE_META[locale].hreflang,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: whatsappUrl(""),
      availableLanguage: locales.map((l) => LOCALE_META[l].englishName),
    },
    knowsAbout: t.meta.knowsAbout,
  };
}
