import { Archivo, Golos_Text, IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono, Noto_Kufi_Arabic, Noto_Sans_SC } from "next/font/google";
import type { Locale } from "./config";

/*
 * Base faces (every locale). `subsets` only controls preloading: next/font
 * self-hosts every unicode-range slice Google serves, so Inter and JetBrains
 * Mono already cover Cyrillic without preloading it on the Turkish page.
 */
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
});

/*
 * Latin faces without the metric-matched local fallback. next/font's
 * "<Family> Fallback" face is a size-adjusted local Arial with no
 * unicode-range, so it would swallow Arabic/CJK glyphs before the script
 * font in the stack is reached. Arabic and Chinese stacks use these instead;
 * the font files are identical (same content hash), so nothing downloads twice.
 */
const archivoNF = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo-nf",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const interNF = Inter({
  subsets: ["latin"],
  variable: "--font-inter-nf",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const jetbrainsNF = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-nf",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const NO_FALLBACK = [archivoNF.variable, interNF.variable, jetbrainsNF.variable];

/*
 * Script-specific faces. Never preloaded; their CSS variables are only set on
 * <html> for the locale that needs them, and globals.css references them only
 * inside matching :lang() rules, so other locales never download them.
 */
/** Russian display: Archivo has no Cyrillic. Golos Text is a neutral grotesque drawn for Cyrillic first. */
const golos = Golos_Text({
  subsets: ["cyrillic", "cyrillic-ext", "latin"],
  variable: "--font-golos",
  display: "swap",
  preload: false,
});
/** Arabic display: geometric Kufi that sits well next to Archivo for Latin tokens. */
const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-kufi",
  display: "swap",
  preload: false,
});
/** Arabic text + mono fallback: highly legible Naskh-influenced sans. */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});
/** Simplified Chinese: Google serves ~100 unicode-range slices; only used glyph slices download. */
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
});

const BASE = [archivo.variable, inter.variable, jetbrains.variable];

const EXTRA: Partial<Record<Locale, string[]>> = {
  ru: [golos.variable],
  ar: [...NO_FALLBACK, kufi.variable, plexArabic.variable],
  zh: [...NO_FALLBACK, notoSC.variable],
};

/** className for <html>: font CSS variables for this locale. */
export function fontClassName(locale: Locale): string {
  return [...BASE, ...(EXTRA[locale] ?? [])].join(" ");
}
