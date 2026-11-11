import type { Locale } from "./config";
import type { Dictionary } from "./types";
import { tr } from "./dictionaries/tr";
import { en } from "./dictionaries/en";
import { de } from "./dictionaries/de";
import { ar } from "./dictionaries/ar";
import { ru } from "./dictionaries/ru";
import { zh } from "./dictionaries/zh";

/**
 * Server-side lookup. Only server components import this module, so client
 * bundles never contain all locales: the active dictionary reaches the client
 * once, serialized through <I18nProvider>.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { tr, en, de, ar, ru, zh };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
