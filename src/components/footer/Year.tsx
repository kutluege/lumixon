"use client";

/** Rendered on the client so a statically built page never shows a stale year. */
export function Year() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
