"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import Image from "next/image";
import {
  motion,
  useInView,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/site";
import type { Capability } from "./data";
import { CAPABILITY_IMAGES } from "./images";
import { useI18n } from "@/i18n/client";
import { joiner, plur } from "@/i18n/format";
import type { CapabilityId } from "@/i18n/types";
import { VISUALS } from "./visuals";

type LenisLike = {
  scrollTo: (
    target: HTMLElement | number,
    opts?: { offset?: number; duration?: number },
  ) => void;
};

/** Shared timing for every layout-animated node so the card grows as one piece. */
export const CARD_LAYOUT: Transition = { duration: 0.6, ease: EASE.snap };

/** Border-only mask: shows the gradient on a 1px ring. */
const RING_MASK: CSSProperties = {
  padding: 1,
  WebkitMask:
    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
};

/** Ice (#AFC1D6) hairline grid behind the drawings. */
const GRID_BG: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgb(175 193 214 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(175 193 214 / 0.05) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  backgroundPosition: "-1px -1px",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Clears the fixed nav when we scroll an expanded card into place. */
const SCROLL_OFFSET = 104;

/** Readable mono label size shared by the card's small captions. */
const LABEL = "font-mono text-[0.75rem] tracking-[0.06em] sm:text-[0.8125rem]";

/** Frame ticks. The bottom-start one is dropped when a photo credit sits in that corner. */
function Corners({ credit = false }: { credit?: boolean }) {
  const tick = "pointer-events-none absolute size-2 border-ice/40";
  return (
    <>
      <span aria-hidden className={cn(tick, "start-2 top-2 border-s border-t")} />
      <span aria-hidden className={cn(tick, "end-2 top-2 border-e border-t")} />
      {credit ? null : (
        <span aria-hidden className={cn(tick, "bottom-2 start-2 border-b border-s")} />
      )}
      <span aria-hidden className={cn(tick, "bottom-2 end-2 border-b border-e")} />
    </>
  );
}

/** Real photograph for the capability, with a restrained indigo grade. Empty frame if none is registered yet. */
function Photo({ id, open }: { id: CapabilityId; open: boolean }) {
  const { locale, t } = useI18n();
  const img = CAPABILITY_IMAGES[id];
  const needsCredit = img ? img.license.startsWith("CC BY") : false;

  return (
    <div className="relative aspect-[2/1] overflow-hidden bg-abyss-900 sm:aspect-[5/3]">
      {img ? (
        <>
          <Image
            src={withBase(img.src)}
            alt={t.items[id].imageAlt}
            fill
            sizes={
              open
                ? "(min-width: 640px) 50vw, 100vw"
                : "(min-width: 1280px) 340px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover saturate-[0.85] transition-transform duration-[1200ms] ease-cinematic group-hover:scale-[1.04]"
          />
          {/* grade: faint indigo tint + floor gradient so the frame sits in the palette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-indigo/15 mix-blend-multiply"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-abyss-950/60 via-abyss-950/5 to-transparent"
          />
          {needsCredit ? (
            <a
              href={img.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-0 start-0 z-10 max-w-[calc(100%-1.5rem)] bg-abyss-950/80 px-2.5 py-1.5 font-mono text-[0.625rem] leading-[1.4] tracking-[0.02em] text-ice-100/90 backdrop-blur-[2px] transition-colors duration-300 hover:text-ice-100"
            >
              {t.capabilities.photoCredit}{joiner(locale)}<bdi>{img.credit} · <span className="whitespace-nowrap">{img.license}</span></bdi>
              <span className="sr-only">{t.common.opensInNewTab}</span>
            </a>
          ) : null}
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-abyss-800/80 via-abyss-900 to-abyss-950"
          style={GRID_BG}
        />
      )}
      <Corners credit={needsCredit} />
    </div>
  );
}

type Props = {
  item: Capability;
  order: number;
  open: boolean;
  onToggle: () => void;
};

/**
 * Compact by default: photo + technical animation side by side, then the title.
 * When open it spans the full grid row: the media pair grows, and the summary,
 * methods and applications appear underneath. Media boxes are locked to the
 * SVG's 5:3 viewBox so the drawing always fills its frame. Text nodes use
 * position-only layout animation so they never stretch while the card grows.
 */
export function CapabilityCard({ item, order, open, onToggle }: Props) {
  const { locale, t } = useI18n();
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const inView = useInView(visualRef, { margin: "80px 0px 80px 0px" });
  const [hot, setHot] = useState(false);

  const Visual = VISUALS[item.visual];
  const detailId = `yetenek-${item.id}-detay`;
  const appsId = `yetenek-${item.id}-uygulamalar`;
  const titleId = `yetenek-${item.id}-baslik`;

  /** Once the grow animation settles, bring the card into a comfortable reading position. */
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(
      () => {
        const el = cardRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // already comfortably placed: top visible below the nav, and the card fits or starts high enough
        if (
          r.top >= SCROLL_OFFSET - 24 &&
          (r.bottom <= vh || r.top <= vh * 0.3)
        )
          return;
        const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
        if (lenis && !reduce)
          lenis.scrollTo(el, { offset: -SCROLL_OFFSET, duration: 0.9 });
        else
          window.scrollTo({
            top: window.scrollY + r.top - SCROLL_OFFSET,
            behavior: reduce ? "auto" : "smooth",
          });
      },
      reduce ? 40 : 640,
    );
    return () => window.clearTimeout(t);
  }, [open, reduce]);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setHot(false);
  };

  return (
    <motion.article
      ref={cardRef}
      id={`yetenek-${item.id}`}
      aria-labelledby={titleId}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHot(true)}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={onBlur}
      initial={{ opacity: 0, y: reduce ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{
        duration: reduce ? 0.3 : DURATION.slow,
        ease: EASE.cinematic,
        delay: Math.min(order, 5) * 0.06,
      }}
      className={cn(
        "group relative isolate flex h-full flex-col border transition-colors duration-500 [--mx:30%] [--my:0%]",
        "has-[button:focus-visible]:border-ice/60",
        open
          ? "border-line-strong bg-abyss-800/60"
          : "border-line bg-abyss-800/35",
      )}
    >
      {/* cursor spotlight (behind the content; the card isolates its own stacking context) */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500",
          hot ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "radial-gradient(520px circle at var(--mx) var(--my), rgb(175 193 214 / 0.065), transparent 55%)",
        }}
      />
      {/* border light */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-px z-20 transition-opacity duration-500",
          hot ? "opacity-100" : "opacity-0",
        )}
        style={{
          ...RING_MASK,
          background:
            "radial-gradient(360px circle at var(--mx) var(--my), rgb(210 221 233 / 0.55), rgb(78 82 131 / 0.35) 40%, transparent 70%)",
        }}
      />

      {/* header: code + what the animation shows (up to two lines, fixed height so rows stay aligned) */}
      <div className="relative flex min-h-[3.25rem] items-center justify-between gap-4 border-b border-line px-4 py-2 sm:px-5">
        <motion.span
          layout="position"
          transition={{ layout: CARD_LAYOUT }}
          className={cn(LABEL, "shrink-0 text-ice")}
        >
          {item.code}
        </motion.span>
        <motion.span
          layout="position"
          transition={{ layout: CARD_LAYOUT }}
          className={cn(LABEL, "line-clamp-2 min-w-0 text-end leading-[1.3] text-fg-subtle")}
        >
          {item.visualLabel}
        </motion.span>
      </div>

      {/* media: real photo + technical animation, each locked to 5:3 */}
      <motion.div
        layout
        transition={{ layout: CARD_LAYOUT }}
        className="relative grid grid-cols-1 border-b border-line sm:grid-cols-2"
      >
        <div className="relative min-w-0 border-b border-line sm:border-b-0 sm:border-e">
          <Photo id={item.id} open={open} />
        </div>
        <div
          ref={visualRef}
          className="relative aspect-[5/3] min-w-0 bg-abyss-950/70"
          style={GRID_BG}
        >
          <div className="absolute inset-0">
            <Visual active={inView && !reduce} hot={hot || open} />
          </div>
        </div>
      </motion.div>

      {/* body: deliberately not positioned, so the closed card's toggle can stretch over the whole article */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          open && "lg:grid lg:grid-cols-2",
        )}
      >
        <motion.div
          layout="position"
          transition={{ layout: CARD_LAYOUT }}
          className={cn(
            "flex min-w-0 flex-1 flex-col p-5 sm:p-6 lg:p-7",
            open && "lg:p-8 xl:p-10",
          )}
        >
          {item.subtitle !== item.title ? (
            <p lang="en" className={cn(LABEL, "text-fg-subtle")}>
              {item.subtitle}
            </p>
          ) : null}
          <h3
            id={titleId}
            className={cn(
              "mt-3 text-balance wrap-anywhere font-display font-semibold first:mt-0 leading-[1.12] tracking-[-0.02em] text-fg",
              open
                ? "text-[1.75rem] sm:text-[2rem] xl:text-[2.5rem]"
                : "text-[1.375rem] sm:text-[1.5rem] lg:text-[1.75rem]",
            )}
            style={{ fontStretch: "108%" }}
          >
            {item.title}
          </h3>

          {open ? (
            <motion.div
              id={detailId}
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: EASE.cinematic,
                  delay: reduce ? 0 : 0.2,
                },
              }}
            >
              <p className="mt-5 max-w-[62ch] text-[0.9375rem] leading-relaxed text-fg-muted text-pretty sm:text-base">
                {item.summary}
              </p>
              <ul
                className="mt-6 flex flex-wrap gap-2"
                aria-label={t.capabilities.methodsAria}
              >
                {item.methods.map((m) => (
                  <li
                    key={m}
                    className="border border-line-strong px-2.5 py-1.5 font-mono text-[0.75rem] leading-none tracking-[0.02em] text-ice-200"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}

          <div className={cn("mt-auto pt-6", open && "pt-8")}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? `${detailId} ${appsId}` : undefined}
              onClick={onToggle}
              className={cn(
                "group/btn flex w-full items-center justify-between gap-4 text-start focus-visible:outline-offset-4",
                // closed: the whole card (header, media and body) is the hit area
                !open && "after:absolute after:inset-0 after:content-['']",
              )}
            >
              <span className="flex items-center gap-2.5 font-mono text-[0.75rem] uppercase tracking-[0.16em] sm:text-[0.8125rem]">
                <span className="text-ice">{open ? t.capabilities.close : t.capabilities.inspect}</span>
                {!open ? (
                  <>
                    <span aria-hidden className="text-fg-subtle/60">
                      ·
                    </span>
                    <span className="text-fg-subtle">
                      {plur(locale, t.capabilities.applicationCount, item.applications.length, pad(item.applications.length))}
                    </span>
                  </>
                ) : null}
                <span className="sr-only">: {item.title}</span>
              </span>
              <span className="relative flex size-11 shrink-0 items-center justify-center border border-line-strong transition-colors duration-300 group-hover:border-ice/60 group-hover:bg-ice/5 group-active/btn:bg-ice/10">
                <span className="absolute h-px w-3.5 bg-ice" />
                <span
                  className={cn(
                    "absolute h-3.5 w-px bg-ice transition-transform duration-300 ease-precise",
                    open && "scale-y-0",
                  )}
                />
              </span>
            </button>
          </div>
        </motion.div>

        {/* applications: beside the copy on desktop, underneath on small screens */}
        {open ? (
          <motion.div
            id={appsId}
            layout="position"
            transition={{ layout: CARD_LAYOUT }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: {
                duration: 0.5,
                ease: EASE.cinematic,
                delay: reduce ? 0 : 0.3,
              },
            }}
            className="relative min-w-0 border-t border-line px-5 pb-5 pt-6 sm:px-6 sm:pb-6 lg:border-s lg:border-t-0 lg:p-8 xl:p-10"
          >
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-ice-400">
              {t.capabilities.systemsHeading}
            </p>
            <ol className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-1">
              {item.applications.map((a, i) => (
                <li key={a} className="flex gap-4 border-t border-line py-4">
                  <span className="shrink-0 pt-0.5 font-mono text-[0.75rem] tracking-[0.1em] text-ice/70">
                    {pad(i + 1)}
                  </span>
                  <span className="text-[0.9375rem] leading-relaxed text-fg/90">
                    {a}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        ) : null}
      </div>
    </motion.article>
  );
}
