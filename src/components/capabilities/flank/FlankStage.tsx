"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { DURATION, EASE, VIEWPORT } from "@/lib/motion";
import { useT } from "@/i18n/client";
import { FlankBoundary } from "./FlankBoundary";
import type { FlankKind } from "./FlankCanvas";
import { FlankFallback } from "./FlankFallback";
import { useFlankEnv, useFlankReducedMotion, useOnScreen, type FlankEnv } from "./useFlankEnv";

/* three / R3F and both scenes live in this chunk and its children; nothing loads until the band is near. */
const FlankCanvas = dynamic(() => import("./FlankCanvas"), { ssr: false, loading: () => null });

/** Hairline ticks closing the bottom corners of a panel (the label rule is its top edge; no box, no border). */
function Ticks() {
  const tick = "pointer-events-none absolute size-2.5 border-ice/30";
  return (
    <>
      <span className={cn(tick, "bottom-0 start-0 border-b border-s")} />
      <span className={cn(tick, "bottom-0 end-0 border-b border-e")} />
    </>
  );
}

/** The live viewport of one panel: fallback line-work, cross-fading to the canvas on its first frame. */
function FlankViewport({ kind, env, reduce }: { kind: FlankKind; env: FlankEnv | null; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(ref);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  const live = ready && !failed;

  return (
    <div
      ref={ref}
      aria-hidden
      data-flank-live={live ? kind : undefined}
      className="pointer-events-none relative aspect-square select-none sm:aspect-[4/3]"
    >
      {/* Mirrored in RTL so the robot walks with the reading direction. */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-[1200ms] ease-cinematic rtl:-scale-x-100",
          live ? "opacity-0" : "opacity-100",
        )}
      >
        <FlankFallback kind={kind} />
      </div>
      {env && !failed ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-[1200ms] ease-cinematic rtl:-scale-x-100",
            live ? "opacity-100" : "opacity-0",
          )}
        >
          <FlankBoundary onError={onError}>
            <FlankCanvas kind={kind} quality={env.quality} reduce={reduce} active={onScreen} onReady={onReady} />
          </FlankBoundary>
        </div>
      ) : null}
      <Ticks />
    </div>
  );
}

const LABEL = "type-label text-[0.6875rem] tracking-[0.14em]";

/** Panel title row: status glyph, label, hairline to the panel edge. */
function PanelLabel({ kind, label, className }: { kind: FlankKind; label: string; className?: string }) {
  return (
    // self-end: when one label wraps (phones), both rules still sit right on top of their panels.
    <div className={cn("flex min-w-0 items-center gap-2.5 self-end pb-3 text-ice-400 sm:gap-3", className)}>
      {kind === "research" ? (
        <span aria-hidden className="size-1.5 shrink-0 border border-ice/70" />
      ) : (
        <span aria-hidden className="relative flex size-1.5 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-ice/50 [animation-duration:2.4s] motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-ice/80" />
        </span>
      )}
      {/* Wraps instead of truncating in narrow phone columns (ru, de). */}
      <span className={cn(LABEL, "min-w-0 text-ice")}>{label}</span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
    </div>
  );
}

/** Thin connector between the panels: research → field (flipped for RTL). */
function Bridge({ phrase }: { phrase: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 md:gap-3">
      <span className="relative flex w-full items-center">
        <motion.span
          aria-hidden
          className="h-px flex-1 origin-left bg-ice/40 rtl:origin-right"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: DURATION.cinematic, ease: EASE.cinematic, delay: 0.35 }}
        />
        <svg aria-hidden viewBox="0 0 8 10" className="-ms-px h-2.5 w-2 shrink-0 text-ice/70 rtl:-scale-x-100">
          <path d="M0 0 L8 5 L0 10" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </span>
      <span className={cn(LABEL, "hidden text-center text-balance text-fg-subtle lg:block")}>{phrase}</span>
    </div>
  );
}

/**
 * "Research → field" band under the capabilities header: the same quadruped
 * as its digital twin in simulation (start) and as the real machine mapping
 * terrain (end). Two transparent canvases melt into the section background;
 * the copy is a short HUD caption per panel plus a text alternative.
 */
export function FlankStage() {
  const t = useT();
  const f = t.capabilities.flank;
  const ref = useRef<HTMLElement>(null);
  const env = useFlankEnv(ref);
  const reduce = useFlankReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <motion.figure
        ref={ref}
        data-flank-band
        className="relative mt-section-gap"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: DURATION.slow, ease: EASE.cinematic, delay: 0.1 }}
      >
        <figcaption className="sr-only">{f.alt}</figcaption>
        <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]">
          {/* DOM order is the reading order (research, bridge, field); the grid places it. */}
          <PanelLabel kind="research" label={f.research.label} className="col-start-1 row-start-1" />
          <div className="col-start-1 row-start-2">
            <FlankViewport kind="research" env={env} reduce={reduce} />
          </div>
          <p className={cn(LABEL, "col-start-1 row-start-3 mt-3 hidden text-pretty text-fg-subtle sm:block")}>
            {f.research.detail}
          </p>

          <div className="col-start-2 row-start-2 flex items-center px-0.5 sm:px-1.5 lg:px-3">
            <Bridge phrase={f.bridge} />
          </div>

          <PanelLabel kind="field" label={f.field.label} className="col-start-3 row-start-1" />
          <div className="col-start-3 row-start-2">
            <FlankViewport kind="field" env={env} reduce={reduce} />
          </div>
          <p className={cn(LABEL, "col-start-3 row-start-3 mt-3 hidden text-pretty text-fg-subtle sm:block")}>
            {f.field.detail}
          </p>
        </div>
      </motion.figure>
    </MotionConfig>
  );
}
