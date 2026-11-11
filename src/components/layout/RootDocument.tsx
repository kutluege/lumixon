import type { ReactNode } from "react";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { fontClassName } from "@/i18n/fonts";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildJsonLd } from "@/i18n/metadata";

/**
 * Shared <html> shell for both root layouts ("/" Turkish and "/[locale]").
 * Sets lang/dir and the locale's font variables, and provides the dictionary
 * to client components.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getDictionary(locale);
  const meta = LOCALE_META[locale];
  return (
    <html lang={meta.hreflang} dir={meta.dir} className={fontClassName(locale)}>
      <body>
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:bg-ice focus:px-4 focus:py-2 focus:text-abyss"
        >
          {t.common.skipToContent}
        </a>
        <SmoothScroll />
        <I18nProvider locale={locale} dict={t}>
          {children}
        </I18nProvider>
        <div className="grain" aria-hidden />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(locale)) }}
        />
      </body>
    </html>
  );
}
