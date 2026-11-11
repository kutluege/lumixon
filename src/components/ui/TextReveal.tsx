"use client";

import { Fragment } from "react";
import { MotionConfig, motion } from "framer-motion";
import { EASE, VIEWPORT } from "@/lib/motion";
import { cn } from "@/lib/cn";

type TextRevealProps = {
  text: string;
  className?: string;
  /** Rendered element. Headline semantics stay intact; words are aria-hidden spans. */
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  stagger?: number;
  /** Animate on mount instead of on scroll into view (use for the hero). */
  immediate?: boolean;
};

/**
 * Masked per-word rise: each word slides up from behind a clip line.
 * Screen readers get the full string once via sr-only text.
 *
 * Reduced motion is handled by MotionConfig reducedMotion="user": framer skips the
 * transform animation and words appear in place. Server and client render the same
 * markup, so there is no hydration mismatch (branching on useReducedMotion caused one).
 */
const CJK = /[⺀-鿿豈-﫿＀-￯]/;
/** Closing punctuation that must not start a line (kept with the previous unit). */
const CJK_CLOSE = /^[，。、；：！？）」』》〉】”’,.;:!?)\]%]$/;
/** Opening punctuation that must not end a line (kept with the next unit). */
const CJK_OPEN = /^[（「『《〈【“‘(\[]$/;

/** Pause punctuation that ends a CJK phrase: the preferred place for a headline to break. */
const CJK_PAUSE = /[，、；：]$/;

/** `phrase`: index of the CJK phrase the unit belongs to (always 0 for space-separated scripts). */
export type RevealUnit = { text: string; space: boolean; phrase: number };

/**
 * Animation units: words for space-separated scripts; for CJK runs one unit per
 * character (Latin runs inside stay whole), so lines can still break anywhere.
 * Pure and deterministic, so server and client markup match.
 */
export function revealUnits(text: string): RevealUnit[] {
  const words = text.split(" ");
  const out: RevealUnit[] = [];
  let phrase = 0;
  words.forEach((w, wi) => {
    const space = wi < words.length - 1;
    if (!CJK.test(w)) {
      out.push({ text: w, space, phrase });
      return;
    }
    const parts: string[] = [];
    let carry = "";
    for (const p of w.match(/[A-Za-z0-9][A-Za-z0-9.\-+_/]*|./gu) ?? []) {
      if (CJK_CLOSE.test(p) && parts.length) parts[parts.length - 1] += p;
      else if (CJK_OPEN.test(p)) carry += p;
      else {
        parts.push(carry + p);
        carry = "";
      }
    }
    if (carry) parts.push(carry);
    parts.forEach((p, i) => {
      out.push({ text: p, space: space && i === parts.length - 1, phrase });
      if (CJK_PAUSE.test(p)) phrase += 1;
    });
  });
  return out;
}

/** Units grouped by phrase, each tagged with its index in the flat list (stable keys). */
function phraseGroups(units: RevealUnit[]): { unit: RevealUnit; index: number }[][] {
  const groups: { unit: RevealUnit; index: number }[][] = [];
  units.forEach((unit, index) => {
    (groups[unit.phrase] ??= []).push({ unit, index });
  });
  return groups;
}

/** Stagger per unit: CJK reveals per character, so it runs faster to keep the same overall pace. */
export function revealStagger(text: string, stagger: number): number {
  return CJK.test(text) ? stagger * 0.3 : stagger;
}

export function TextReveal({
  text,
  className,
  as = "h2",
  delay = 0,
  stagger = 0.06,
  immediate = false,
}: TextRevealProps) {
  const Tag = as;
  const units = revealUnits(text);
  const step = revealStagger(text, stagger);

  const trigger = immediate
    ? { animate: "show" as const }
    : { whileInView: "show" as const, viewport: VIEWPORT };

  const renderUnit = (unit: RevealUnit, i: number) => (
    <Fragment key={i}>
      <span className="reveal-unit inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
        <motion.span
          className="inline-block will-change-transform"
          variants={{
            hidden: { y: "105%", rotate: 2 },
            show: { y: "0%", rotate: 0, transition: { duration: 1.05, ease: EASE.cinematic } },
          }}
        >
          {unit.text}
        </motion.span>
      </span>
      {/* The space sits between units, not inside one: after a word that fills the
          whole line (a hyphenated de/ru compound) an inner space wrapped onto an empty line. */}
      {unit.space ? " " : null}
    </Fragment>
  );
  const groups = phraseGroups(units);

  return (
    <Tag className={cn(className)}>
      <span className="sr-only">{text}</span>
      <MotionConfig reducedMotion="user">
        <motion.span
          aria-hidden
          className="inline"
          initial="hidden"
          {...trigger}
          variants={{ hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } }}
        >
          {groups.length > 1
            ? /* CJK headline with internal pauses: each phrase is an inline-block, so a line
                 breaks after the comma rather than inside a word whenever the phrase fits. */
              groups.map((group, g) => (
                <span key={g} className="inline-block align-bottom">
                  {group.map(({ unit, index }) => renderUnit(unit, index))}
                </span>
              ))
            : units.map(renderUnit)}
        </motion.span>
      </MotionConfig>
    </Tag>
  );
}
