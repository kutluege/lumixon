import { LOCALE_META, type Locale } from "./config";

/**
 * Plural forms keyed by CLDR category. `other` is mandatory; languages fill in
 * the categories they need (ru: one/few/many, ar: zero/one/two/few/many).
 * "{n}" is replaced with the (optionally padded) number.
 */
export type Plural = { other: string } & Partial<Record<Exclude<Intl.LDMLPluralRule, "other">, string>>;

/** Identity helper so dictionary literals keep the wide Plural type. */
export const plural = (forms: Plural): Plural => forms;

/** Replace "{key}" placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const rulesCache = new Map<Locale, Intl.PluralRules>();

/** Pick the plural form for `n`; `display` (e.g. "08") replaces "{n}". */
export function plur(locale: Locale, forms: Plural, n: number, display: string = String(n)): string {
  let rules = rulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_META[locale].intl);
    rulesCache.set(locale, rules);
  }
  const cat = rules.select(n);
  const form = (cat !== "other" ? forms[cat] : undefined) ?? forms.other;
  return fmt(form, { n: display });
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Separator between adjacent copy segments: CJK runs take none, everything else a space. */
export function joiner(locale: Locale): string {
  return locale === "zh" ? "" : " ";
}
