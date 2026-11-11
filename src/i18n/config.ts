/**
 * Locale registry. Turkish is the source language and is served unprefixed at "/";
 * every other locale lives under its own path segment ("/en", "/de", "/ar", "/ru", "/zh").
 */
export const locales = ["tr", "en", "de", "ar", "ru", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

/** Locales served under a "/{locale}" prefix (everything except the default). */
export const prefixedLocales = locales.filter((l) => l !== defaultLocale) as Exclude<Locale, "tr">[];

export type LocaleMeta = {
  /** Endonym shown in the language switcher. */
  name: string;
  /** Compact code shown in the switcher (always Latin, uppercase). */
  short: string;
  dir: "ltr" | "rtl";
  /** BCP 47 tag for <html lang> and hreflang. */
  hreflang: string;
  /** Open Graph locale code. */
  og: string;
  /** Locale used for Intl formatting (Arabic keeps Western digits to match the mono UI). */
  intl: string;
  /** English name, used for schema.org availableLanguage. */
  englishName: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  tr: { name: "Türkçe", short: "TR", dir: "ltr", hreflang: "tr", og: "tr_TR", intl: "tr-TR", englishName: "Turkish" },
  en: { name: "English", short: "EN", dir: "ltr", hreflang: "en", og: "en_US", intl: "en-US", englishName: "English" },
  de: { name: "Deutsch", short: "DE", dir: "ltr", hreflang: "de", og: "de_DE", intl: "de-DE", englishName: "German" },
  ar: { name: "العربية", short: "AR", dir: "rtl", hreflang: "ar", og: "ar_AR", intl: "ar-u-nu-latn", englishName: "Arabic" },
  ru: { name: "Русский", short: "RU", dir: "ltr", hreflang: "ru", og: "ru_RU", intl: "ru-RU", englishName: "Russian" },
  zh: { name: "中文", short: "ZH", dir: "ltr", hreflang: "zh-CN", og: "zh_CN", intl: "zh-CN", englishName: "Chinese" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return LOCALE_META[locale].dir;
}

/** Root path of a locale: "/" for Turkish, "/en" etc. for the rest. */
export function localePath(locale: Locale): string {
  return locale === defaultLocale ? "/" : `/${locale}`;
}

/** hreflang → path map for metadata alternates and the sitemap (includes x-default). */
export function languageAlternates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) out[LOCALE_META[l].hreflang] = localePath(l);
  out["x-default"] = localePath(defaultLocale);
  return out;
}
