"use client";

import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/site";
import { useI18n } from "@/i18n/client";
import { joiner } from "@/i18n/format";
import type { CapabilityDef } from "./data";
import { FlankStage } from "./flank/FlankStage";
import { CAPABILITY_IMAGES, type CapabilityImage } from "./images";

/** Readable mono size shared by the row's small captions. */
const MONO = "font-mono text-[0.75rem] tracking-[0.06em] sm:text-[0.8125rem]";

/** Rise used by the copy blocks: shorter than the section header's so the column settles quietly. */
const RISE = 20;

/**
 * Real photograph for the capability, with a restrained indigo grade and a
 * visible credit (every photo is credited; CC BY ones also name the license).
 */
function Photo({ img, alt, className }: { img: CapabilityImage; alt: string; className?: string }) {
  const { locale, t } = useI18n();
  const tick = "pointer-events-none absolute size-2 border-ice/40";
  return (
    <figure className={cn("relative isolate aspect-[16/9] overflow-hidden bg-abyss-900", className)}>
      <Image
        src={withBase(img.src)}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 36vw, (min-width: 640px) 46vw, 100vw"
        className="object-cover saturate-[0.85]"
      />
      {/* grade, identical for every photo so the three read as one set:
          1. highlight knee: everything brighter than ice is compressed towards it (a white
             microscope slide would otherwise be the brightest thing on the page), keeping some
             highlight detail; mid-tones and shadows pass untouched
          2. indigo tint  3. floor gradient under the credit */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-ice-400/60 mix-blend-darken" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-indigo/25 mix-blend-multiply" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-abyss-950/60 via-abyss-950/5 to-transparent"
      />
      <figcaption className="absolute bottom-0 start-0 max-w-[calc(100%-1.5rem)] bg-abyss-950/80 px-2.5 py-1.5 font-mono text-[0.625rem] leading-[1.4] tracking-[0.02em] text-ice-100/90 backdrop-blur-[2px]">
        {t.capabilities.photoCredit}
        {joiner(locale)}
        <bdi>
          {img.credit}
          {img.license.startsWith("CC BY") ? (
            <>
              {" · "}
              <span className="whitespace-nowrap">{img.license}</span>
            </>
          ) : null}
        </bdi>
      </figcaption>
      <span aria-hidden className={cn(tick, "start-2 top-2 border-s border-t")} />
      <span aria-hidden className={cn(tick, "end-2 top-2 border-e border-t")} />
      <span aria-hidden className={cn(tick, "bottom-2 end-2 border-b border-e")} />
    </figure>
  );
}

/**
 * One capability: copy at the start edge (index, title, photo, summary,
 * systems, methods), one large animation at the end edge. From lg up the
 * animation is sticky beside the longer copy column; below lg the row stacks
 * as heading → animation → photo and copy.
 */
export function CapabilityRow({ def }: { def: CapabilityDef }) {
  const { t } = useI18n();
  const copy = t.items[def.id];
  const img = CAPABILITY_IMAGES[def.id];
  const photo = img && copy.imageAlt ? img : null;
  const titleId = `yetenek-${def.id}-baslik`;

  return (
    <li id={`yetenek-${def.id}`} data-capability={def.id}>
      <article
        aria-labelledby={titleId}
        className="grid grid-cols-1 gap-y-8 md:gap-y-10 lg:grid-cols-12 lg:gap-x-12"
      >
        {/* ── heading: index rule, title, English subtitle ── */}
        <div className="min-w-0 lg:col-span-5 lg:col-start-1 lg:row-start-1">
          <Reveal y={RISE} className="flex min-h-8 items-center gap-4 pb-3 text-ice-400">
            <span className="type-label text-ice">{def.index}</span>
            <span aria-hidden className="h-px flex-1 bg-line-strong" />
          </Reveal>
          <Reveal y={RISE} delay={0.06}>
            <h3
              id={titleId}
              className="type-display mt-5 text-balance text-[length:calc(var(--row-title)*var(--display-scale,1))] leading-[1.04] text-fg [--row-title:clamp(1.75rem,7.6vw,2.25rem)] sm:[--row-title:2.375rem] md:mt-6 lg:[--row-title:2rem] xl:[--row-title:2.625rem] 2xl:[--row-title:2.875rem]"
            >
              {copy.title}
            </h3>
            {copy.subtitle !== copy.title ? (
              <p lang="en" className={cn(MONO, "mt-4 text-pretty text-fg-subtle md:mt-5")}>
                {copy.subtitle}
              </p>
            ) : null}
          </Reveal>
        </div>

        {/* ── animation: sticky under the fixed nav while the copy scrolls (lg+) ──
            Its width also follows the viewport height, so the whole stage always fits below the nav. */}
        <div className="min-w-0 lg:sticky lg:top-28 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:self-start">
          <FlankStage
            kind={def.scene}
            label={copy.scene.label}
            detail={copy.scene.detail}
            alt={copy.scene.alt}
            inset={def.inset ? { kind: def.inset, caption: t.capabilities.twinInset } : undefined}
            className="lg:ms-auto lg:w-[min(100%,max(24rem,calc((100svh-13rem)*4/3)))]"
          />
        </div>

        {/* ── body: photo, summary, systems, methods ── */}
        <div className="grid min-w-0 gap-8 sm:grid-cols-2 sm:gap-x-10 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:grid-cols-1">
          {photo ? (
            <Reveal y={RISE} className="min-w-0">
              <Photo img={photo} alt={copy.imageAlt} />
            </Reveal>
          ) : null}
          <Reveal y={RISE} delay={photo ? 0.06 : 0} className={cn("min-w-0", !photo && "sm:col-span-2 lg:col-span-1")}>
            <p className="max-w-[62ch] text-base leading-relaxed text-fg-muted text-pretty xl:text-[1.0625rem]">
              {copy.summary}
            </p>
          </Reveal>

          <Reveal y={RISE} className="min-w-0 sm:col-span-2 lg:col-span-1">
            <p className="type-label text-ice-400">{t.capabilities.systemsHeading}</p>
            <ul className="mt-4 grid gap-x-10 border-b border-line sm:grid-cols-2 lg:grid-cols-1">
              {copy.applications.map((a) => (
                <li key={a} className="flex gap-3.5 border-t border-line py-3.5">
                  <span aria-hidden className="mt-[0.62em] size-1 shrink-0 bg-ice/70" />
                  <span className="text-[0.9375rem] leading-relaxed text-fg/90 text-pretty">{a}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal y={RISE} className="min-w-0 sm:col-span-2 lg:col-span-1">
            <ul className="flex flex-wrap gap-2" aria-label={t.capabilities.methodsAria}>
              {copy.methods.map((m) => (
                <li
                  key={m}
                  className="border border-line-strong px-2.5 py-1.5 font-mono text-[0.75rem] leading-none tracking-[0.02em] text-ice-200"
                >
                  {m}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </article>
    </li>
  );
}
