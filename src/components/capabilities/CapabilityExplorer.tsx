"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";
import { EASE, springUI } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/client";
import { plur } from "@/i18n/format";
import { buildCategories } from "./data";
import { CARD_LAYOUT, CapabilityCard } from "./CapabilityCard";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Three category tabs (side by side from sm up, stacked rows on phones so the
 * full titles fit in every locale), then a grid of compact capability cards.
 * Selecting a card expands it to span the full row (large visual + details).
 */
export function CapabilityExplorer() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [active, setActive] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { locale, t } = useI18n();
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);
  const rtl = locale === "ar";
  const cat = CATEGORIES[active];
  const tabId = (i: number) => `${uid}-sekme-${i}`;
  const panelId = `${uid}-panel`;

  const select = (i: number, focus = false) => {
    if (i !== active) {
      setActive(i);
      setOpenId(null);
    }
    if (focus) tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = CATEGORIES.length;
    let i: number | null = null;
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === next || e.key === "ArrowDown") i = (active + 1) % n;
    else if (e.key === prev || e.key === "ArrowUp")
      i = (active - 1 + n) % n;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    if (i === null) return;
    e.preventDefault();
    select(i, true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mt-section-gap">
        {/* ── category tabs: three across (rows below sm) ── */}
        <div
          role="tablist"
          aria-label={t.capabilities.tablistAria}
          onKeyDown={onKeyDown}
          className="grid grid-cols-1 border-y border-line sm:grid-cols-3"
        >
          {CATEGORIES.map((c, i) => {
            const selected = i === active;
            const count = plur(locale, t.capabilities.fieldCount, c.capabilities.length, pad(c.capabilities.length));
            return (
              <button
                key={c.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={tabId(i)}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(i)}
                className={cn(
                  "group relative flex min-h-14 min-w-0 items-center gap-3.5 px-4 py-3.5 text-start outline-offset-[-2px] transition-colors duration-300 sm:flex-col sm:items-stretch sm:gap-3 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
                  "border-b border-line last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0",
                  selected
                    ? "text-fg"
                    : "text-fg-subtle hover:bg-abyss-800/40 hover:text-fg-muted",
                )}
              >
                {selected ? (
                  <motion.span
                    layoutId={`${uid}-gosterge`}
                    transition={springUI}
                    aria-hidden
                    className="absolute inset-0 from-indigo/30 via-indigo/10 to-transparent max-sm:bg-linear-to-r max-sm:rtl:bg-linear-to-l sm:bg-linear-to-b"
                  >
                    {/* marker: leading edge on phones, top edge from sm up */}
                    <span className="absolute bg-ice max-sm:inset-y-0 max-sm:start-0 max-sm:w-0.5 sm:inset-x-0 sm:top-0 sm:h-px" />
                  </motion.span>
                ) : null}
                <span className="relative flex shrink-0 items-center justify-between font-mono text-xs">
                  <span className={selected ? "text-ice" : "text-fg-subtle"}>
                    {c.index}
                  </span>
                  <span className="hidden tracking-[0.06em] text-fg-subtle sm:inline">
                    {count}
                  </span>
                </span>
                <span
                  className="relative min-w-0 hyphens-auto text-balance wrap-anywhere font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] max-sm:flex-1 sm:text-lg sm:leading-tight md:text-xl lg:text-2xl"
                  style={{ fontStretch: "108%" }}
                >
                  {c.title}
                </span>
                <span className="relative shrink-0 font-mono text-xs tracking-[0.06em] text-fg-subtle sm:hidden">
                  {count}
                </span>
                {c.subtitle !== c.title ? (
                  <span
                    lang="en"
                    className="relative hidden font-mono text-xs tracking-[0.04em] text-fg-subtle sm:block"
                  >
                    {c.subtitle}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* ── capability grid ── */}
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(active)}
          className="mt-8 md:mt-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={cat.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: EASE.cinematic },
              }}
              exit={{
                opacity: 0,
                y: -10,
                transition: { duration: 0.22, ease: EASE.precise },
              }}
              className="grid grid-flow-row-dense grid-cols-1 gap-5 md:gap-6 lg:grid-cols-2"
            >
              <LayoutGroup id={cat.id}>
                {cat.capabilities.map((c, i) => {
                  const open = openId === c.id;
                  return (
                    <motion.li
                      key={c.id}
                      layout
                      transition={{ layout: CARD_LAYOUT }}
                      className={cn("min-w-0", open && "lg:col-span-full")}
                    >
                      <CapabilityCard
                        item={c}
                        order={i}
                        open={open}
                        onToggle={() =>
                          setOpenId((cur) => (cur === c.id ? null : c.id))
                        }
                      />
                    </motion.li>
                  );
                })}
              </LayoutGroup>
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
