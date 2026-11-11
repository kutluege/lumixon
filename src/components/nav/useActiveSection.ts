"use client";

import { useEffect, useState } from "react";
import { NAV, SECTION_IDS } from "@/lib/site";

const IDS = NAV.map((n) => n.id) as string[];

/**
 * Tracks which NAV section currently crosses a thin band just above the
 * viewport's vertical center. Returns null while the hero is in that band.
 */
export function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Map<string, boolean>();
    const watched = [SECTION_IDS.hero, ...IDS];

    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

    const resolve = () => {
      if (atBottom()) {
        setActive(IDS[IDS.length - 1]);
        return;
      }
      const current = IDS.filter((id) => visible.get(id)).pop() ?? null;
      setActive(visible.get(SECTION_IDS.hero) ? null : current);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        resolve();
      },
      { rootMargin: "-38% 0px -58% 0px", threshold: 0 },
    );

    // Sections may mount slightly after the nav; retry briefly until all are found.
    const observed = new Set<string>();
    const attach = () => {
      for (const id of watched) {
        if (observed.has(id)) continue;
        const el = document.getElementById(id);
        if (el) {
          observer.observe(el);
          observed.add(id);
        }
      }
      return observed.size === watched.length;
    };
    let tries = 0;
    const interval = attach()
      ? undefined
      : window.setInterval(() => {
          if (attach() || ++tries > 20) window.clearInterval(interval);
        }, 250);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        resolve();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      if (interval) window.clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return active;
}
