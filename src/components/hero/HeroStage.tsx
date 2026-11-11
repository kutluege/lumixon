"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";
import { HeroContent } from "./HeroContent";
import { HeroHud } from "./HeroHud";
import { HeroLogo } from "./HeroLogo";
import { SceneBoundary } from "./scene/SceneBoundary";
import { useStableReducedMotion } from "./useStableReducedMotion";
import { useT } from "@/i18n/client";

const HeroScene = dynamic(() => import("./scene/HeroScene"), { ssr: false, loading: () => null });

type Env = { quality: "high" | "low"; parallax: boolean };

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

/**
 * Client shell of the hero: owns scroll progress, visibility-based render
 * pausing, deferred WebGL mount, and the scroll-driven exit of the copy.
 */
export function HeroStage({ poster }: { poster: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const reduce = useStableReducedMotion();
  const [env, setEnv] = useState<Env | null>(null);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const hudOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const logoY = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const logoOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Defer the WebGL bundle until the main thread is idle, and only if WebGL exists.
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled || !hasWebGL()) return;
      const small = window.matchMedia("(max-width: 767px)").matches;
      const cores = navigator.hardwareConcurrency ?? 8;
      setEnv({
        quality: small || cores <= 4 ? "low" : "high",
        parallax: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
      });
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1200 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(start, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  // Pause rendering when the hero is offscreen or the tab is hidden.
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
  }, []);

  const onReady = useCallback(() => {
    // Let the first frame land before cross-fading from the poster.
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);
  const onError = useCallback(() => setFailed(true), []);

  const active = inView && pageVisible;
  const live = ready && !failed;

  return (
    <div ref={ref} className="relative flex min-h-[max(100svh,640px)] flex-col">
      {/* Poster linework: visible until the live scene takes over */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 transition-opacity duration-[1600ms] ease-cinematic",
          live ? "opacity-0" : "opacity-100",
        )}
      >
        {poster}
      </div>

      {/* WebGL scene */}
      <motion.div
        aria-hidden
        style={reduce ? undefined : { y: sceneY }}
        className={cn(
          "absolute inset-0 transition-opacity duration-[1600ms] ease-cinematic",
          live ? "opacity-100" : "opacity-0",
        )}
      >
        {env && !failed ? (
          /* RTL locales mirror the 3D render so the robots sit opposite the right-aligned headline. */
          <div className="absolute inset-0 rtl:-scale-x-100">
            <SceneBoundary onError={onError}>
              <HeroScene
                active={active}
                reduce={reduce}
                quality={env.quality}
                parallax={env.parallax}
                progress={scrollYProgress}
                onReady={onReady}
              />
            </SceneBoundary>
          </div>
        ) : null}
      </motion.div>

      {/* Legibility scrims + seamless hand-off into the next section */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-abyss-950/80 to-transparent" />
        <div className="absolute inset-y-0 start-0 hidden w-[68%] bg-linear-to-r rtl:bg-linear-to-l from-abyss-950/85 via-abyss-950/45 to-transparent md:block hero-wide:w-[54%]" />
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-linear-to-t from-abyss-950 via-abyss-950/75 to-transparent md:h-[38%] md:via-abyss-950/50" />
      </div>

      <HeroLogo reduce={reduce} y={logoY} opacity={logoOpacity} />

      <motion.div style={reduce ? undefined : { opacity: hudOpacity }} className="absolute inset-0">
        <HeroHud active={active} reduce={reduce} />
      </motion.div>

      {/*
        Copy: in flow, so it sets the hero height. The top padding always clears the
        centred logo (its top offset + rendered height + a gap, mirroring HeroLogo's sizes);
        when the copy is taller than the viewport allows, the hero grows instead of overlapping.
      */}
      <div className="container-site relative flex flex-1 flex-col justify-end pb-[max(2rem,5svh)] hero-wide:justify-center hero-short:pb-5 pt-[140px] md:pb-[max(2.5rem,5.5svh)] md:pt-[calc(clamp(58px,8svh,84px)+clamp(79px,7.87vw,127px)+1.5rem)]">
        <motion.div style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
          <HeroContent />
        </motion.div>
      </div>

      {/* Scroll cue: only where the centre is clear of the CTA row in the longest locales */}
      <motion.div
        aria-hidden
        style={reduce ? undefined : { opacity: hudOpacity }}
        className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 min-[1400px]:flex"
      >
        <span className="type-label text-[0.625rem] tracking-[0.18em] text-fg-subtle">{t.hero.scroll}</span>
        <span className="relative h-10 w-px overflow-hidden bg-ice/15">
          <span className="hero-scroll-tick absolute inset-x-0 top-0 h-3 bg-ice/70" />
        </span>
      </motion.div>

      <style>{`
        @keyframes hero-scroll-tick {
          0% { transform: translateY(-100%); }
          70%, 100% { transform: translateY(340%); }
        }
        .hero-scroll-tick { animation: hero-scroll-tick 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hero-scroll-tick { animation: none; transform: translateY(120%); }
        }
      `}</style>
    </div>
  );
}
