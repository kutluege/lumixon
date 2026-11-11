# LUMIXON i18n plan

Locales: `tr` (default, source, served at `/`), `en`, `de`, `ar` (RTL), `ru`, `zh` (zh-CN), served at `/en`, `/de`, `/ar`, `/ru`, `/zh`.
No new dependencies, no middleware: every locale page is statically generated.

## Routing (App Router, two root layouts)

```
src/app/
  (tr)/layout.tsx              root layout, locale = "tr"   → "/"
  (tr)/page.tsx                <HomePage locale="tr" />
  (tr)/opengraph-image.tsx     renderOgImage("tr")
  (intl)/[locale]/layout.tsx   root layout; generateStaticParams = prefixedLocales; dynamicParams = false
  (intl)/[locale]/page.tsx     <HomePage locale={locale} />
  (intl)/[locale]/opengraph-image.tsx
  sitemap.ts                   one entry per locale + alternates.languages
  robots.ts                    unchanged
  icon*.png, apple-icon.png    unchanged (apply to all routes)
```

Route groups with two root layouts give Turkish an unprefixed URL without a middleware rewrite.
Switching between `/` and `/xx` is a full document load, which the language switcher does anyway
(plain `<a href>` links). Both root layouts render the shared `RootDocument` (`src/components/layout/RootDocument.tsx`):
`<html lang dir className={fontClassName(locale)}>`, skip link, `<I18nProvider>`, SmoothScroll, grain, JSON-LD.

## Dictionaries

- `dictionaries/tr.ts` is the source; `types.ts` derives `Dictionary = typeof tr`. All other locales are annotated
  `: Dictionary`, so a missing/extra key is a compile error (including per-capability `items[id]` and per-visual labels).
- Plurals: `plural({ one, few, many, other, … })` + `plur(locale, forms, n, display)` (Intl.PluralRules; Russian
  one/few/many, Arabic zero/one/two/few/many).
- Placeholders: `fmt("STEP {n}/{total}", {…})`.

## Getting strings

- Server components (`HomePage`, `Hero`, `Capabilities`, `Approach`, `Contact`, `Footer`) receive `t` (and `locale`)
  as props from `getDictionary(locale)` (`get-dictionary.ts`, server-only by convention).
- Client components use `useI18n()` / `useT()` from `client.tsx`. `<I18nProvider>` serializes only the active
  locale's dictionary into the RSC payload.
- `data.ts` keeps structure only (ids, codes, visual keys, category membership); `buildCategories(t)` merges the
  localized text. `images.ts` keeps src/credit/license; alt comes from `t.items[id].imageAlt`, credit prefix from
  `t.capabilities.photoCredit`.
- SVG visuals read `useT().visuals.<key>` inside the component. Agentic/SLAM frame functions take the label set as an
  argument (the visual loop re-reads the latest closure each render).
- `lib/site.ts`: `NAV` keeps ids + dictionary keys; `whatsappUrl(t.common.whatsappGreeting)`.

## Metadata / SEO

`metadata.ts` → `buildMetadata(locale)`: localized title/description/keywords, `alternates.canonical` per locale,
`alternates.languages` (tr, en, de, ar, ru, zh-CN, x-default → `/`), OG `locale` + `alternateLocale`
(tr_TR, en_US, de_DE, ar_AR, ru_RU, zh_CN). `buildJsonLd(locale)`: localized description + knowsAbout,
availableLanguage lists all six languages. OG image per locale (`og.tsx`): ru/zh fetch a glyph-subset TTF from
Google Fonts at build time (Golos Text / Noto Sans SC) and fall back to the English tagline if offline; ar always
uses the English tagline because Satori does not shape Arabic.

## Fonts (next/font/google, `fonts.ts`)

| Use | tr / en / de | ru | ar | zh |
|---|---|---|---|---|
| Display | Archivo (wdth axis) | **Golos Text** (Archivo has no Cyrillic) | Archivo for Latin tokens → **Noto Kufi Arabic** | Archivo for Latin → **Noto Sans SC** |
| Text | Inter | Inter (has Cyrillic) | Inter for Latin → **IBM Plex Sans Arabic** | Inter for Latin → Noto Sans SC |
| Mono | JetBrains Mono | JetBrains Mono (has Cyrillic) | JetBrains → IBM Plex Sans Arabic | JetBrains → Noto Sans SC |

Script faces use `preload: false`; their CSS variables are only put on `<html>` for their locale and are referenced
only in `:lang()` rules in globals.css, so the Turkish page keeps exactly the same font setup as before.
Arabic and Chinese stacks use second instances of Archivo/Inter/JetBrains with `adjustFontFallback: false`:
next/font's "<Family> Fallback" face (local Arial, no unicode-range) would otherwise capture Arabic glyphs before
the script face is reached. Same file hashes, so nothing downloads twice.

## RTL (ar)

- `<html dir="rtl">`. Use logical utilities (`ms/me/ps/pe/start/end/text-start/border-s/e`) or `rtl:` variants where a
  physical side is currently hard-coded (`-ml-4`, `-mr-2`, `text-left`, `left-2.5`, `border-r`, `lg:border-l`,
  `origin-left`, scrims `bg-linear-to-r`).
- Directional arrows (→, ↗) mirror with `rtl:-scale-x-100`; hover nudges flip (`rtl:group-hover:-translate-x-1`).
  Down/up arrows are not mirrored. HUD pipeline uses `t.hud.flowArrow` (← in Arabic).
- Tab keyboard nav: ArrowLeft/ArrowRight swap under RTL.
- Coordinates, timecodes, method tags, credits: `dir="ltr"` / `<bdi>`.
- SVG visuals stay LTR schematics (`direction: ltr` on the root `<svg>`); only the label strings change.
- Arabic: no letter-spacing (breaks joining), no uppercase, taller line-height for display type and the TextReveal clip.

## CJK (zh)

`word-break: keep-all` is avoided (Chinese has no spaces); use `line-break: strict` and normal word-break,
no negative/positive tracking on CJK headings, `font-stretch` neutral. TextReveal splits on spaces, so Chinese
headlines reveal as a single phrase (acceptable) unless they contain spaces.

## Language switcher

Desktop nav: compact mono row `TR · EN · DE · AR · RU · ZH`, current locale highlighted with `aria-current="page"`,
each link `hrefLang`, `lang`, `title` = endonym; links keep the current `#hash`. Mobile menu: same row above the
contact block.
