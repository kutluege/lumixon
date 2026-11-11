import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { SECTION_IDS, whatsappUrl } from "@/lib/site";
import type { Dictionary } from "@/i18n/types";
import { WhatsAppGlyph } from "./WhatsAppGlyph";

/** Small engineering corner ticks framing a panel. */
function CornerTicks() {
  const base =
    "pointer-events-none absolute size-3 border-ice/40 transition-colors duration-500 group-hover:border-ice";
  return (
    <>
      <span aria-hidden className={`${base} -left-px -top-px border-l border-t`} />
      <span aria-hidden className={`${base} -right-px -top-px border-r border-t`} />
      <span aria-hidden className={`${base} -bottom-px -left-px border-b border-l`} />
      <span aria-hidden className={`${base} -bottom-px -right-px border-b border-r`} />
    </>
  );
}

export function Contact({ t }: { t: Dictionary }) {
  return (
    <section
      id={SECTION_IDS.contact}
      aria-label={t.contact.label}
      className="relative isolate overflow-hidden py-section"
    >
      {/* Backdrop: blueprint grid fading out, faint indigo and burgundy light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(ellipse_70%_55%_at_30%_0%,black,transparent)]" />
        <div className="absolute -top-56 left-[-10%] h-[44rem] w-[64rem] max-w-none bg-[radial-gradient(closest-side,rgb(78_82_131/0.2),transparent)]" />
        <div className="absolute -bottom-48 right-[-15%] h-[40rem] w-[56rem] max-w-none bg-[radial-gradient(closest-side,rgb(46_2_25/0.4),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      </div>

      <div className="container-site">
        <SectionHeader
          index="04"
          label={t.contact.label}
          title={t.contact.title}
          lede={t.contact.lede}
        />

        <Reveal className="mt-section-gap">
          <a
            href={whatsappUrl(t.common.whatsappGreeting)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.contact.cardAria}
            className="group relative isolate block border border-line-strong bg-abyss-800/40 p-6 backdrop-blur-sm transition-colors duration-500 hover:border-ice/40 focus-visible:border-ice sm:p-10 md:p-14"
          >
            <CornerTicks />

            {/* Hover light: indigo bloom rising from the lower right */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            >
              <span className="absolute -bottom-1/2 -end-1/4 h-[150%] w-[80%] bg-[radial-gradient(closest-side,rgb(78_82_131/0.38),transparent)] opacity-40 transition-opacity duration-700 ease-cinematic group-hover:opacity-100" />
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 rtl:origin-right bg-gradient-to-r from-ice/0 via-ice/70 to-ice/0 transition-transform duration-700 ease-cinematic group-hover:scale-x-100" />
            </span>

            <span className="flex items-center justify-between gap-4">
              <span className="type-label flex items-center gap-3 text-ice-400">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-ice/60 motion-reduce:animate-none" />
                  <span className="relative size-1.5 rounded-full bg-ice" />
                </span>
                {t.contact.channel}
              </span>
              <span className="type-label text-fg-subtle">WhatsApp</span>
            </span>

            <span className="mt-12 flex items-center justify-between gap-6 md:mt-20">
              <span className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center sm:gap-7">
                <span className="flex size-14 shrink-0 items-center justify-center border border-ice/30 bg-indigo/25 text-ice transition-colors duration-500 group-hover:border-ice/60 group-hover:bg-indigo/50 group-hover:text-ice-100 md:size-[4.5rem]">
                  <WhatsAppGlyph className="size-6 md:size-8" />
                </span>
                <span className="type-display text-balance text-[calc(clamp(2rem,1.1rem+3.9vw,4.5rem)*var(--display-scale,1))] leading-[1.02] text-fg transition-colors duration-500 group-hover:text-ice-100">
                  {t.contact.headline}
                </span>
              </span>

              <span
                aria-hidden
                className="hidden size-14 shrink-0 items-center justify-center border border-line-strong text-ice transition-[background-color,border-color,color] duration-500 group-hover:border-ice group-hover:bg-ice group-hover:text-abyss sm:flex md:size-[4.5rem]"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-4 transition-transform duration-500 ease-cinematic group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 md:size-5"
                >
                  <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
            </span>

            <span className="mt-10 flex flex-col gap-4 border-t border-line pt-6 text-sm leading-relaxed text-fg-muted sm:flex-row sm:items-center sm:justify-between md:mt-14">
              <span className="max-w-xl">
                {t.contact.note}
              </span>
              <span className="type-label flex items-center gap-2 text-ice-400 sm:hidden">
                {t.contact.start}
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 rtl:-scale-x-100">
                  <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
            </span>
          </a>
        </Reveal>

        <Reveal delay={0.1} className="mt-12 md:mt-16">
          <h3 className="type-label text-fg-muted">{t.contact.guideHeading}</h3>
          {/* Three across only from lg: at md each column is too narrow for the body copy */}
          <ol className="mt-6 grid divide-y divide-line border border-line bg-abyss-900/30 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {t.contact.guide.map((item, i) => (
              <li key={item.title} className="flex gap-5 p-6 md:px-8 lg:p-8">
                <span aria-hidden className="font-mono text-xs leading-6 text-ice">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium leading-6 text-fg">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
