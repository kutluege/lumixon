import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SECTION_IDS } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { joiner } from "@/i18n/format";
import { PILLARS, type PillarGlyph } from "./approach-data";

export function Approach({ t, locale }: { t: Dictionary; locale: Locale }) {
  const gap = joiner(locale);
  return (
    <section id={SECTION_IDS.approach} aria-label={t.approach.label} className="relative bg-abyss-950">
      {/* Light ice band: header, manifesto, pillars (#0D160B on ice-100) */}
      <div className="theme-ice relative isolate overflow-hidden bg-ice-100 py-section">
        <div
          aria-hidden
          className="bg-blueprint-ink pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,black_60%,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_88%_6%,rgb(78_82_131/0.16),transparent_70%),radial-gradient(50%_40%_at_100%_100%,rgb(175_193_214/0.4),transparent_70%),linear-gradient(to_bottom,#eef3f9,#e6edf5_40%,#d9e3ef)]"
        />
        <div className="container-site">
          <SectionHeader
            index="03"
            label={t.approach.label}
            title={t.approach.title}
            lede={t.approach.lede}
          />

          {/* Manifesto */}
          <div className="mt-section-gap grid gap-6 lg:grid-cols-12 lg:gap-12">
            <Reveal className="lg:col-span-3">
              <p className="type-label text-fg-muted lg:pt-3">{t.approach.principle}</p>
            </Reveal>
            <Reveal delay={0.08} className="lg:col-span-9">
              <p className="font-display text-[clamp(1.5rem,1.05rem+2vw,2.5rem)] font-medium leading-[1.2] tracking-[-0.02em] text-fg-muted text-pretty md:leading-[1.15]">
                <span className="text-fg">{t.approach.manifestoLead}</span>
                {gap}
                {t.approach.manifestoBody}
                {gap}
                <span className="text-ice">{t.approach.manifestoAccent}</span>
              </p>
            </Reveal>
          </div>

          {/*
            Pillars: three columns only from lg (at md a third of the row leaves ~160px of text
            and long de/ru words overflow). Between md and lg each row is title | body.
            From lg the four parts of a pillar (code, title, tag, body) sit on shared subgrid
            rows, so tags and bodies line up across the row however many lines a title takes.
          */}
          <ul className="mt-section-gap grid border-s border-t border-line lg:grid-cols-3">
            {PILLARS.map((p, i) => {
              const copy = t.approach.pillars[i];
              return (
              <Reveal
                as="li"
                key={p.code}
                delay={i * 0.1}
                className="group relative border-b border-e border-line lg:row-span-4 lg:grid lg:grid-rows-subgrid"
              >
                <div className="relative flex h-full flex-col p-7 transition-colors duration-500 ease-cinematic group-hover:bg-abyss-800/60 sm:p-9 lg:row-span-4 lg:grid lg:grid-rows-subgrid xl:p-11">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-indigo rtl:origin-right transition-transform duration-700 ease-cinematic group-hover:scale-x-100"
                  />
                  <div className="flex items-start justify-between">
                    <span className="type-label text-burgundy-400">{p.code}</span>
                    <Glyph kind={p.glyph} />
                  </div>
                  <div className="mt-10 md:max-lg:grid md:max-lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:max-lg:gap-x-10 lg:contents">
                    <div className="lg:contents">
                      <h3 className="type-display text-balance text-[1.625rem] leading-[1.05] text-fg lg:mt-16 lg:self-end xl:text-[1.875rem]">
                        {copy.title}
                      </h3>
                      {copy.tag !== copy.title ? (
                        <p className="type-label mt-4 text-fg-muted" lang="en">
                          {copy.tag}
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-6 max-w-[60ch] text-[0.9375rem] leading-relaxed text-fg-muted md:text-base md:max-lg:mt-0">
                      {copy.body}
                    </p>
                  </div>
                </div>
              </Reveal>
              );
            })}
          </ul>

          {/* Closing hand-off into the contact section */}
          <Reveal className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 md:mt-16">
            <p className="max-w-xl text-base leading-relaxed text-fg-muted text-pretty md:text-lg">
              {t.approach.closing}
            </p>
            <a
              href={`#${SECTION_IDS.contact}`}
              className="btn btn-ghost group shrink-0 justify-between hover:border-ice hover:bg-ice hover:text-ice-100 max-sm:w-full"
            >
              {t.approach.cta}
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4 transition-transform duration-300 ease-cinematic group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              >
                <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
              </svg>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* Small technical glyphs for the pillars. Decorative. */
function Glyph({ kind }: { kind: PillarGlyph }) {
  const stroke = "stroke-ice-600 transition-colors duration-500 group-hover:stroke-ice";
  return (
    <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden focusable="false">
      <rect x="0.5" y="0.5" width="47" height="47" className="stroke-line" />
      {kind === "strata" ? (
        <g className={stroke} strokeWidth={1}>
          <path d="M10 14H38" />
          <path d="M10 20H34" />
          <path d="M10 26H30" />
          <path d="M10 32H26" />
          <path d="M10 38H22" />
          <path d="M40 12V38M38 36L40 38L42 36" />
        </g>
      ) : kind === "hypothesis" ? (
        <g className={stroke} strokeWidth={1}>
          <path d="M9 9V39H39" />
          <path d="M11 35L37 15" strokeDasharray="2 2.5" />
          <path d="M11 36C20 35 22 14 37 12" />
          <circle cx="16" cy="31" r="1.4" className="fill-ice-400 stroke-none" />
          <circle cx="23" cy="22" r="1.4" className="fill-ice-400 stroke-none" />
          <circle cx="31" cy="15" r="1.4" className="fill-ice-400 stroke-none" />
        </g>
      ) : (
        <g className={stroke} strokeWidth={1}>
          <rect x="16" y="16" width="16" height="16" />
          <path d="M8 21H16M8 27H16M32 24H40M24 8V16M24 32V40" />
          <path d="M21 24H27M24 21V27" />
        </g>
      )}
    </svg>
  );
}
