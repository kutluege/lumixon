import { Wordmark } from "@/components/ui/Wordmark";
import { NAV, SECTION_IDS, SITE, whatsappUrl } from "@/lib/site";
import { WhatsAppGlyph } from "@/components/contact/WhatsAppGlyph";
import type { Dictionary } from "@/i18n/types";
import { BackToTop } from "./BackToTop";
import { Year } from "./Year";

export function Footer({ t }: { t: Dictionary }) {
  return (
    <footer className="relative isolate overflow-hidden border-t border-line bg-abyss-950">
      {/* Oversized faint wordmark watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[6vw] -z-10 flex justify-center opacity-[0.04] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
      >
        <Wordmark variant="watermark" title="" sizes="110vw" className="w-[110%] max-w-none shrink-0" />
      </div>

      <div className="container-site">
        <div className="grid gap-10 py-16 md:grid-cols-12 md:gap-8 md:py-24">
          <div className="md:col-span-5 lg:col-span-6">
            <a
              href={`#${SECTION_IDS.hero}`}
              aria-label={t.footer.homeAria}
              className="relative isolate inline-block"
            >
              {/* Faint ice pool so the burgundy APPLIED AI line reads on the dark footer. */}
              <span
                aria-hidden
                className="absolute -inset-x-[14%] -inset-y-[45%] -z-10 bg-[radial-gradient(50%_50%_at_50%_58%,rgba(175,193,214,0.26)_0%,rgba(175,193,214,0.11)_50%,rgba(175,193,214,0)_100%)] blur-lg"
              />
              <Wordmark
                variant="lockup"
                sizes="340px"
                className="-ms-1 w-[280px] [filter:drop-shadow(0_0_1px_rgba(214,226,240,0.5))] sm:w-[340px]"
              />
            </a>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-fg-muted">
              {t.common.descriptor}
            </p>
          </div>

          <nav aria-label={t.footer.navAria} className="md:col-span-3">
            <h2 className="type-label text-ice-400">{t.footer.sectionsHeading}</h2>
            {/* 44px rows on touch layouts, tighter from md where a pointer is the norm */}
            <ul className="mt-2 md:mt-3">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors duration-300 hover:text-fg md:min-h-9"
                  >
                    {t.nav.sections[item.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-4 lg:col-span-3">
            <h2 className="type-label text-ice-400">{t.footer.contactHeading}</h2>
            <address className="mt-2 text-sm not-italic md:mt-3">
              <a
                href={whatsappUrl(t.common.whatsappGreeting)}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-11 items-center gap-2.5 text-fg-muted transition-colors duration-300 hover:text-fg md:min-h-9"
              >
                <WhatsAppGlyph className="size-4 text-ice-400 transition-colors duration-300 group-hover:text-ice" />
                {t.footer.whatsapp}
                <span className="sr-only"> {t.common.opensInNewTab.trim()}</span>
              </a>
              <p className="mt-1.5 text-fg-muted">{t.common.location}</p>
            </address>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-5 border-t border-line py-6 sm:flex-row sm:items-center sm:justify-between sm:py-8">
          <p className="type-label text-[0.6875rem] tracking-[0.14em] text-fg-subtle">
            <bdi>© <Year /> {SITE.name}.</bdi> {t.footer.rights}
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
