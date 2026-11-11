import type { Transition, Variants } from "framer-motion";

/** Shared easing curves. Use these, not ad-hoc beziers. */
export const EASE = {
  cinematic: [0.22, 1, 0.36, 1] as const, // long, decelerating: reveals
  precise: [0.65, 0, 0.35, 1] as const, // symmetric: state changes
  snap: [0.32, 0.72, 0, 1] as const, // Apple-like: UI interactions
};

export const DURATION = {
  fast: 0.35,
  base: 0.7,
  slow: 1.1,
  cinematic: 1.6,
};

export const springSoft: Transition = { type: "spring", stiffness: 140, damping: 22, mass: 0.9 };
export const springUI: Transition = { type: "spring", stiffness: 380, damping: 32 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.cinematic } },
};

export const stagger = (step = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

/** Viewport config for whileInView reveals */
export const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" } as const;
