"use client";

import { motion } from "framer-motion";
import { TextReveal, revealStagger, revealUnits } from "@/components/ui/TextReveal";
import { useI18n } from "@/i18n/client";
import { joiner } from "@/i18n/format";
import { EASE } from "@/lib/motion";
import { SECTION_IDS } from "@/lib/site";
import { useStableReducedMotion } from "./useStableReducedMotion";

const HEAD_DELAY = 0.25;
const STAGGER = 0.06;

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={down ? "h-4 w-4 shrink-0 rotate-90" : "h-4 w-4 shrink-0 rtl:-scale-x-100"} fill="none">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}

export function HeroContent() {
  const { locale, t } = useI18n();
  const reduce = useStableReducedMotion();
  const LINE_A = t.hero.headlineA;
  const LINE_B = t.hero.headlineB;
  const step = revealStagger(LINE_A + LINE_B, STAGGER);
  const unitsA = revealUnits(LINE_A).length;
  const HEAD_END = HEAD_DELAY + (unitsA + revealUnits(LINE_B).length) * step + 0.5;
  // Chinese has no word spaces: keep each half of the headline together so the line
  // breaks between the two phrases instead of inside a word.
  const phrase = locale === "zh" ? "inline-block" : undefined;
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.4 : 1, ease: EASE.cinematic, delay: reduce ? 0 : delay },
  });

  return (
    <div className="max-w-[62rem] hero-wide:-ms-[clamp(0.75rem,1.6vw,1.75rem)] hero-wide:max-w-[clamp(22rem,max(42vw,100vw-105svh),40rem)]">
      <motion.p
        {...rise(0.1)}
        className="flex items-start gap-3 font-mono text-[0.8125rem] font-medium uppercase leading-[1.45] tracking-[0.14em] text-ice md:gap-4 md:text-[0.9375rem] md:tracking-[0.16em] xl:text-base"
      >
        <span aria-hidden className="mt-[0.72em] h-px w-8 shrink-0 bg-ice/60 md:w-12" />
        <span>
          {/* Two unbreakable halves so narrow screens wrap after "&", never mid-phrase */}
          <span className="whitespace-nowrap">{t.hero.eyebrowA}</span>
          {joiner(locale)}
          <span className="whitespace-nowrap">{t.hero.eyebrowB}</span>
        </span>
      </motion.p>

      <h1
        id="hero-title"
        className="type-display type-hero mt-4 max-w-[15em] leading-[1.02] text-fg text-pretty md:mt-7 hero-wide:mt-[clamp(1rem,2.6svh,1.75rem)] hero-wide:max-w-none hero-wide:text-balance hero-short:mt-3"
      >
        <TextReveal as="span" immediate text={LINE_A} delay={HEAD_DELAY} stagger={STAGGER} className={phrase} />
        {joiner(locale)}
        <TextReveal
          as="span"
          immediate
          text={LINE_B}
          delay={HEAD_DELAY + unitsA * step}
          stagger={STAGGER}
          className={phrase ? `${phrase} text-ice-400` : "text-ice-400"}
        />
      </h1>

      <motion.p
        {...rise(HEAD_END - 0.2)}
        className="mt-5 max-w-[36rem] text-[0.9375rem] leading-[1.6] text-fg-muted text-pretty md:mt-8 md:text-lg md:leading-relaxed hero-wide:mt-[clamp(1rem,3svh,2rem)] hero-wide:text-[clamp(1rem,2.1svh,1.125rem)] hero-short:mt-3.5 hero-short:leading-[1.5]"
      >
        {t.hero.lede}
      </motion.p>

      <motion.div {...rise(HEAD_END)} className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:mt-10 hero-wide:mt-[clamp(1.25rem,3.6svh,2.5rem)] hero-wide:w-[max(100%,min(36rem,46vw))] hero-short:mt-4 hero-short:gap-2">
        <a
          href={`#${SECTION_IDS.contact}`}
          className="btn btn-solid group justify-between sm:justify-start hero-short:min-h-11"
        >
          {t.hero.ctaPrimary}
          <span className="transition-transform duration-300 ease-cinematic group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
            <Arrow />
          </span>
        </a>
        <a
          href={`#${SECTION_IDS.capabilities}`}
          className="btn btn-ghost group justify-between bg-abyss-950/40 backdrop-blur-sm sm:justify-start hero-short:min-h-11"
        >
          {t.hero.ctaSecondary}
          <span className="text-ice-400 transition-transform duration-300 ease-cinematic group-hover:translate-y-0.5">
            <Arrow down />
          </span>
        </a>
      </motion.div>
    </div>
  );
}
