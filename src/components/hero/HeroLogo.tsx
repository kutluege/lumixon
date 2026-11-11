"use client";

import { motion, type MotionValue } from "framer-motion";
import { Wordmark } from "@/components/ui/Wordmark";
import { EASE } from "@/lib/motion";

/**
 * The page's primary brand mark, set large and horizontally centred at the
 * top of the hero, over the lit horizon (above the copy on mobile).
 * Entrance: a left-to-right mask reveal with a slight rise; reduced motion
 * gets a plain fade. Scroll: drifts up and fades slightly ahead of the copy.
 */
export function HeroLogo({
  reduce,
  y,
  opacity,
}: {
  reduce: boolean;
  y: MotionValue<number>;
  opacity: MotionValue<number>;
}) {
  return (
    <motion.div
      style={reduce ? undefined : { y, opacity }}
      className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center md:top-[clamp(58px,8svh,84px)]"
    >
      <div className="relative isolate w-[min(64vw,260px)] md:w-[clamp(360px,36vw,580px)]">
        {/*
          Soft ice backplate: the artwork's dark indigo end letters and burgundy
          APPLIED AI line sit on a dark sky, so a faint light pool behind the mark
          (strongest under the descriptor) gives them a lit ground to read against.
          The artwork itself only gets a thin ice rim; its colours are untouched.
        */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0.5 : 2.2, ease: EASE.cinematic, delay: reduce ? 0 : 0.6 }}
          className="absolute -inset-x-[16%] -inset-y-[45%] -z-10 bg-[radial-gradient(50%_50%_at_50%_58%,rgba(175,193,214,0.30)_0%,rgba(175,193,214,0.13)_48%,rgba(175,193,214,0)_100%)] blur-xl"
        />
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, clipPath: "inset(-30% 100% -30% -10%)" }}
          animate={{ opacity: 1, y: 0, clipPath: "inset(-30% -10% -30% -10%)" }}
          transition={{ duration: reduce ? 0.5 : 1.8, ease: EASE.cinematic, delay: reduce ? 0 : 0.35 }}
        >
          <Wordmark
            variant="hero"
            priority
            title="LUMIXON Applied AI"
            sizes="(min-width: 768px) 36vw, 64vw"
            className="w-full [filter:drop-shadow(0_0_1px_rgba(214,226,240,0.55))_drop-shadow(0_0_10px_rgba(175,193,214,0.22))]"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
