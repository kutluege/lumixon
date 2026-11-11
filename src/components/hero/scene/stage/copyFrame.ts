"use client";

import { useEffect, useMemo } from "react";

/**
 * Where the hero copy and logo sit, in canvas-local CSS pixels, so the camera
 * can frame the robots in the free area beside / above them for every locale
 * and viewport. In RTL the canvas is mirrored by CSS, so x is mirrored here
 * too: "right" always means "toward the robots' side".
 */
export type CopyFrame = {
  valid: boolean;
  /** Right edge of the copy's ink: the eyebrow, headline and lede text, and the CTA buttons. */
  copyRight: number;
  /** Top of the whole copy block (eyebrow included). */
  copyTop: number;
  /** Bottom of the hero logo (0 when not found). */
  logoBottom: number;
};

const HEADLINE_ID = "hero-title";

function measure(canvas: HTMLCanvasElement, range: Range, out: CopyFrame) {
  // The copy drifts with scroll parallax: only trust it at the top of the page.
  if (window.scrollY > 8) return;
  const h1 = document.getElementById(HEADLINE_ID);
  const c = canvas.getBoundingClientRect();
  if (!h1 || c.width < 2 || c.height < 2) return;
  const block = h1.parentElement ?? h1;
  const rtl = getComputedStyle(h1).direction === "rtl";
  const toX = (left: number, right: number) => (rtl ? c.right - left : right - c.left);

  // Ink, not element boxes: the copy's blocks are as wide as their max-width,
  // but only their actual lines matter. Text runs give the line boxes (the
  // headline's sr-only twin is one long clipped line: skip it); the buttons
  // count with their padding and border.
  let right = -Infinity;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width >= 1 && r.height >= 1) right = Math.max(right, toX(r.left, r.right));
    }
  }
  const links = block.querySelectorAll("a");
  for (let i = 0; i < links.length; i++) {
    const r = links[i].getBoundingClientRect();
    if (r.width >= 1) right = Math.max(right, toX(r.left, r.right));
  }
  if (!Number.isFinite(right)) {
    const box = block.getBoundingClientRect();
    right = toX(box.left, box.right);
  }

  out.copyRight = right;
  out.copyTop = block.getBoundingClientRect().top - c.top;
  const logo = h1.closest("section")?.querySelector("img");
  out.logoBottom = logo ? logo.getBoundingClientRect().bottom - c.top : 0;
  out.valid = true;
}

/**
 * Tracks the copy's bounds without React state: the returned object is
 * mutated in place and `onChange` (e.g. invalidate) is called after each
 * measurement. Re-measures on resize, when fonts load, when the copy
 * reflows (locale change) and a few times while its entrance animation settles.
 */
export function useCopyFrame(canvas: HTMLCanvasElement, onChange: () => void): CopyFrame {
  const frame = useMemo<CopyFrame>(() => ({ valid: false, copyRight: 0, copyTop: 0, logoBottom: 0 }), []);

  useEffect(() => {
    const range = document.createRange();
    let raf = 0;
    const run = () => {
      raf = 0;
      measure(canvas, range, frame);
      onChange();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    schedule();
    const timers = [400, 1500, 3500].map((ms) => window.setTimeout(schedule, ms));
    window.addEventListener("resize", schedule);
    // Back at the top after loading (or measuring) scrolled down.
    const onScroll = () => {
      if (window.scrollY <= 8) schedule();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.fonts?.ready.then(schedule).catch(() => {});
    const block = document.getElementById(HEADLINE_ID)?.parentElement;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (block) ro?.observe(block);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [canvas, frame, onChange]);

  return frame;
}
