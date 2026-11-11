/**
 * Single source of truth for site-wide constants.
 * NOTE: SITE_URL is a placeholder. Replace with the real value.
 */
export const SITE = {
  name: "LUMIXON",
  tagline: "Applied AI & Deep Technology",
  // Public origin (plus base path, if any) the site is served from. The deploy
  // workflow sets NEXT_PUBLIC_SITE_URL; the fallback is a PLACEHOLDER domain.
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://lumixon.ai").replace(/\/+$/, ""),
  // WhatsApp number: digits only, country code first (+90 530 119 89 70)
  whatsapp: "905301198970",
  location: "İstanbul, Türkiye", // PLACEHOLDER: confirm
} as const;

/**
 * Path prefix the site is served under ("" at a domain root, "/repo" on a
 * GitHub Pages project site). Mirrors `basePath` in next.config.ts.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

/** Prefix a root-relative path ("/brand/x.png", "/en") with the base path. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Absolute URL of a root-relative path, for canonical / hreflang / sitemap. */
export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE.url}/` : `${SITE.url}${path}`;
}

/** Pre-filled first message (Turkish default; components pass the localized `t.common.whatsappGreeting`). */
export const WHATSAPP_GREETING = "Merhaba LUMIXON, teknik bir ihtiyacımızı görüşmek istiyoruz.";

/** wa.me deep link for SITE.whatsapp, optionally with a pre-filled message. */
export function whatsappUrl(text: string = WHATSAPP_GREETING): string {
  const base = `https://wa.me/${SITE.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Anchor navigation. Section components must use these exact ids. */
/** Labels live in the dictionaries under `nav.sections[key]`. */
export const NAV = [
  { id: "yetenekler", key: "capabilities" },
  { id: "yaklasim", key: "approach" },
  { id: "iletisim", key: "contact" },
] as const;

export const SECTION_IDS = {
  hero: "giris",
  capabilities: "yetenekler",
  approach: "yaklasim",
  contact: "iletisim",
} as const;
