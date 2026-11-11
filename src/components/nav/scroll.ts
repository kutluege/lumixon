import type Lenis from "lenis";

/** Height of the fixed nav bar, used as the scroll offset for anchor jumps. */
export const NAV_HEIGHT = 72;

export function getLenis(): Lenis | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __lenis?: Lenis }).__lenis;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll to a section id (or the top when `target` is 0), through Lenis when it
 * is running, natively otherwise. Honors prefers-reduced-motion.
 */
export function scrollToTarget(target: string | 0) {
  const reduce = prefersReducedMotion();
  const lenis = getLenis();

  if (target === 0) {
    if (lenis) lenis.scrollTo(0, { immediate: reduce, force: true });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    return;
  }

  const el = document.getElementById(target);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -NAV_HEIGHT, immediate: reduce, force: true });
  else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * Move keyboard focus to an element without scrolling, so the next Tab
 * continues from there (mirrors native fragment navigation).
 */
export function focusWithoutScroll(el: HTMLElement | null) {
  if (!el) return;
  if (!el.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    el.setAttribute("tabindex", "-1");
    el.style.outline = "none";
  }
  el.focus({ preventScroll: true });
}
