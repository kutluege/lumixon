"use client";

import { useEffect, useRef } from "react";

/** Props every procedural card visual receives. */
export type VisualProps = {
  /** Card is in view and motion is allowed: run the loop. */
  active: boolean;
  /** Card is hovered or focused: intensify. */
  hot: boolean;
};

/** Restrained palette for the visuals (brand tokens + derived tints). */
export const C = {
  ice: "#AFC1D6",
  iceHi: "#D2DDE9",
  iceLo: "#66788D",
  indigo: "#4E5283",
  indigoHi: "#8D92C4",
  indigoMid: "#6C71A8",
  /** Deep fill: follows the page surface so the visuals track the theme. */
  indigoLo: "var(--color-abyss-700)",
  burgundy: "#7A2350",
  /** lighter burgundy tint for small accent marks that must read on black */
  accent: "#B04A7D",
  /** Canvas base (knock-out fills behind joints, nodes, labels). */
  bg: "var(--color-abyss-950)",
} as const;

/** Time used for the static first frame (SSR + reduced motion). */
export const T0 = 2.4;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** 1-decimal rounding keeps path strings short and SSR/CSR identical. */
export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Deterministic hash in [0, 1). */
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 1D value noise in [0, 1). */
export function vnoise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i), hash(i + 1), smooth(f));
}

/** Polyline → SVG path "d". */
export function linePath(pts: ReadonlyArray<readonly [number, number]>) {
  let d = "";
  for (let i = 0; i < pts.length; i++) d += (i ? "L" : "M") + r1(pts[i][0]) + " " + r1(pts[i][1]);
  return d;
}

/** Cubic bezier point. */
export function cubic(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/**
 * Drives a procedural visual with requestAnimationFrame, but only while `active`.
 * `draw(t, k)` mutates SVG nodes through refs (no React re-render per frame).
 *   t: visual time in seconds (accelerates while hot)
 *   k: eased hover intensity 0..1
 * When inactive (out of view / reduced motion) a single static frame is drawn
 * whenever `hot` changes, so hover still reads as a state change.
 */
export function useVisualLoop(draw: (t: number, k: number) => void, { active, hot }: VisualProps, fps = 30) {
  const drawRef = useRef(draw);
  const hotRef = useRef(hot);
  const state = useRef({ t: T0, k: 0 });

  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    hotRef.current = hot;
    if (!active) {
      state.current.k = hot ? 1 : 0;
      drawRef.current(state.current.t, state.current.k);
    }
  }, [hot, active]);

  useEffect(() => {
    if (!active) return;
    const interval = 1000 / fps;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      if (dt < interval - 2) return;
      last = now;
      const s = state.current;
      const step = Math.min(dt, 80);
      s.k += ((hotRef.current ? 1 : 0) - s.k) * Math.min(1, step / 260);
      s.t += (step / 1000) * (1 + s.k * 0.85);
      drawRef.current(s.t, s.k);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, fps]);
}

/** Shared SVG root props for the 400×240 visual canvas. */
export const SVG_PROPS = {
  viewBox: "0 0 400 240",
  className: "block h-full w-full",
  "aria-hidden": true,
  focusable: "false",
  /* Schematics stay left-to-right in every locale (incl. Arabic); only labels change. */
  direction: "ltr",
  fill: "none",
} as const;

/** Mono font family for in-visual readouts. */
export const MONO = "var(--font-mono), ui-monospace, monospace";
