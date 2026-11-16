"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { DURATION, EASE, VIEWPORT } from "@/lib/motion";
import { FlankBoundary } from "./FlankBoundary";
import type { FlankKind } from "./contract";
import { FlankFallback } from "./FlankFallback";
import { useFlankEnv, useFlankReducedMotion, useMediaQuery, useOnScreen, type FlankEnv } from "./useFlankEnv";

/* three / R3F and every scene live in this chunk and its children; nothing loads until a stage is near. */
const FlankCanvas = dynamic(() => import("./FlankCanvas"), { ssr: false, loading: () => null });

/** Hairline ticks closing the bottom corners of a viewport (the label rule is its top edge; no box, no border). */
function Ticks() {
  const tick = "pointer-events-none absolute size-2.5 border-ice/30";
  return (
    <>
      <span className={cn(tick, "bottom-0 start-0 border-b border-s")} />
      <span className={cn(tick, "bottom-0 end-0 border-b border-e")} />
    </>
  );
}

type ViewportProps = {
  kind: FlankKind;
  /** `null` keeps the static fallback (stage not near yet, no WebGL, or the slot is not shown at this width). */
  env: FlankEnv | null;
  reduce: boolean;
  /** Aspect ratio utilities of the slot. */
  className?: string;
  ticks?: boolean;
};

/** The live viewport of one scene: fallback line-work, cross-fading to the canvas on its first frame. */
function FlankViewport({ kind, env, reduce, className, ticks = true }: ViewportProps) {
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
      className={cn("pointer-events-none relative select-none", className)}
    >
      {/* Mirrored in RTL so the scene moves with the reading direction. */}
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
      {ticks ? <Ticks /> : null}
    </div>
  );
}

const LABEL = "type-label text-[0.6875rem] tracking-[0.14em]";

/** Stage title row: live glyph, label, hairline to the stage edge. */
function StageLabel({ label }: { label: string }) {
  return (
    <div className="flex min-h-8 min-w-0 items-center gap-2.5 pb-3 text-ice-400 sm:gap-3">
      <span aria-hidden className="relative flex size-1.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-ice/50 [animation-duration:2.4s] motion-reduce:hidden" />
        <span className="relative size-1.5 rounded-full bg-ice/80" />
      </span>
      {/* Wraps instead of truncating in narrow phone columns (ru, de). */}
      <span className={cn(LABEL, "min-w-0 text-ice")}>{label}</span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line-strong" />
    </div>
  );
}

/** Shown from md up; phones keep the single large scene and never mount the second canvas. */
const INSET_QUERY = "(min-width: 768px)";

/**
 * Picture-in-picture: a second, small scene in the bottom end corner of the
 * stage (the robot's wireframe digital twin beside the real machine).
 */
function StageInset({ kind, caption, env, reduce }: { kind: FlankKind; caption: string; env: FlankEnv | null; reduce: boolean }) {
  const shown = useMediaQuery(INSET_QUERY);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 end-0 hidden w-[30%] min-w-40 border border-line-strong bg-abyss-950/75 select-none md:block"
    >
      <p className="type-label flex items-baseline gap-2 border-b border-line px-2 py-1.5 text-[0.625rem] tracking-[0.1em] text-ice-400">
        <span className="size-1.5 shrink-0 -translate-y-px border border-ice/70" />
        <span className="min-w-0">{caption}</span>
      </p>
      <FlankViewport kind={kind} env={shown ? env : null} reduce={reduce} className="aspect-[4/3]" ticks={false} />
    </div>
  );
}

export type FlankStageProps = {
  kind: FlankKind;
  /** HUD line on the rule above the viewport. */
  label: string;
  /** Mono caption under the viewport. */
  detail: string;
  /** Text alternative of the (decorative) canvases. */
  alt: string;
  inset?: { kind: FlankKind; caption: string };
  className?: string;
};

/**
 * One large animation stage of a capability row: a label rule, a borderless
 * transparent viewport that melts into the section background, and a mono
 * caption. Each stage gates its own scenes: they mount only when this stage
 * is near the screen and WebGL exists, and stop rendering while off-screen.
 */
export function FlankStage({ kind, label, detail, alt, inset, className }: FlankStageProps) {
  const ref = useRef<HTMLElement>(null);
  const env = useFlankEnv(ref);
  const reduce = useFlankReducedMotion();

  return (
    <motion.figure
      ref={ref}
      data-flank-stage={kind}
      className={cn("relative", className)}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.slow, ease: EASE.cinematic, delay: 0.1 }}
    >
      <figcaption className="sr-only">{alt}</figcaption>
      <StageLabel label={label} />
      <div className="relative">
        <FlankViewport kind={kind} env={env} reduce={reduce} className="aspect-square sm:aspect-[4/3]" />
        {inset ? <StageInset kind={inset.kind} caption={inset.caption} env={env} reduce={reduce} /> : null}
      </div>
      <p className={cn(LABEL, "mt-3 text-pretty text-fg-subtle")}>{detail}</p>
    </motion.figure>
  );
}
