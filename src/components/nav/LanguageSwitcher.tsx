"use client";

import { Fragment, type MouseEvent } from "react";
import { LOCALE_META, localePath, locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/site";

/**
 * Compact mono locale rail: "TR · EN · DE · AR · RU · ZH". Plain links (each
 * locale is its own static document); the current #section is carried over.
 */
export function LanguageSwitcher({ className, size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  const { locale, t } = useI18n();

  const onClick = (target: Locale) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (target === locale) {
      e.preventDefault();
      return;
    }
    const hash = window.location.hash;
    if (hash) {
      e.preventDefault();
      window.location.assign(withBase(localePath(target)) + hash);
    }
  };

  return (
    <nav aria-label={t.nav.languageAria} className={className}>
      <ul
        dir="ltr"
        className={cn(
          "flex items-center font-mono uppercase rtl:justify-end",
          size === "lg" ? "text-[0.8125rem] tracking-[0.12em]" : "gap-0.5 text-[0.75rem] tracking-[0.12em]",
        )}
      >
        {locales.map((l, i) => {
          const meta = LOCALE_META[l];
          const current = l === locale;
          return (
            <Fragment key={l}>
              {i > 0 ? (
                <li aria-hidden className="select-none text-fg-subtle/50">
                  ·
                </li>
              ) : null}
              <li>
                <a
                  href={withBase(localePath(l))}
                  hrefLang={meta.hreflang}
                  title={meta.name}
                  aria-current={current ? "page" : undefined}
                  onClick={onClick(l)}
                  className={cn(
                    "relative inline-flex items-center justify-center transition-colors duration-300",
                    size === "lg" ? "h-11 min-w-10 px-1.5" : "h-11 min-w-8 px-1",
                    current ? "text-ice-100" : "text-fg-subtle hover:text-fg",
                  )}
                >
                  <span lang={meta.hreflang} className="sr-only">{meta.name}</span>
                  <span aria-hidden>{meta.short}</span>
                  {current ? (
                    <span
                      aria-hidden
                      className={cn("absolute bottom-2 h-px bg-ice", size === "lg" ? "inset-x-2" : "inset-x-1")}
                    />
                  ) : null}
                </a>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
