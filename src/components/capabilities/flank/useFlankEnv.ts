"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import type { FlankQuality } from "./contract";

export type FlankEnv = { quality: FlankQuality };

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Decides whether (and at which quality) the scenes of one stage may mount:
 * only once that stage is within ~one viewport of the screen, then on the next
 * idle slot, and never without WebGL. `null` means "keep the static fallback".
 * Quality follows the hero's rule: small screens or ≤4 cores render "low".
 */
export function useFlankEnv(ref: RefObject<HTMLElement | null>): FlankEnv | null {
  const [near, setNear] = useState(false);
  const [env, setEnv] = useState<FlankEnv | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    const start = () => {
      if (cancelled || !hasWebGL()) return;
      const small = window.matchMedia("(max-width: 767px)").matches;
      const cores = navigator.hardwareConcurrency ?? 8;
      setEnv({ quality: small || cores <= 4 ? "low" : "high" });
    };
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(start, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [near]);

  return env;
}

/** True while the element intersects the viewport and the tab is visible. */
export function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref]);

  return inView && pageVisible;
}

/** A media query that is `false` during SSR and hydration, then follows the viewport. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * prefers-reduced-motion that is `false` during SSR and hydration, then
 * follows the user preference (avoids hydration mismatches).
 */
export function useFlankReducedMotion(): boolean {
  const pref = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && pref === true;
}
