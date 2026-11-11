"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { NAV, SECTION_IDS } from "@/lib/site";
import { DURATION, EASE, springUI } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useActiveSection } from "./useActiveSection";
import { MobileMenu } from "./MobileMenu";
import { MenuButton } from "./MenuButton";

const SCROLLED_AT = 40;
const HIDE_AFTER = 180;

export function Nav() {
  const t = useT();
  const reduce = useReducedMotion();
  const active = useActiveSection();
  const { scrollY } = useScroll();

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setScrolled(window.scrollY > SCROLLED_AT);
  }, []);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? y;
    setScrolled(y > SCROLLED_AT);
    if (reduce || open) return;
    if (y > HIDE_AFTER && y - prev > 4) setHidden(true);
    else if (prev - y > 4 || y <= HIDE_AFTER) setHidden(false);
  });

  const close = useCallback(() => setOpen(false), []);
  const isHidden = hidden && !open && !reduce;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={false}
        animate={{ y: isHidden ? "-100%" : "0%" }}
        transition={{ duration: DURATION.fast + 0.1, ease: EASE.precise }}
        onFocusCapture={() => setHidden(false)}
      >
        {/* Glass layer: fades in after the first ~40px of scroll */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 border-b transition-[opacity,border-color] duration-500 ease-cinematic",
            "bg-abyss-950/72 backdrop-blur-xl backdrop-saturate-150",
            scrolled && !open ? "border-line opacity-100" : "border-transparent opacity-0",
          )}
        />

        {/* No logo in the bar (the brand lives large in the hero): links left, CTA right. */}
        <div className="container-site relative flex h-[72px] items-center justify-between gap-6 lg:h-20">
          <nav aria-label={t.nav.mainAria} className="hidden lg:block">
            <ul className="-ms-4 flex items-center xl:-ms-5">
              {NAV.map((item, i) => {
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={isActive ? "location" : undefined}
                      className={cn(
                        "group relative flex items-baseline gap-2.5 px-4 py-3 text-base tracking-[-0.005em] transition-colors duration-300 xl:px-5 xl:text-[1.0625rem]",
                        isActive ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "font-mono text-[0.75rem] tracking-[0.14em] transition-colors duration-300",
                          isActive ? "text-ice" : "text-fg-subtle group-hover:text-ice-400",
                        )}
                      >
                        {String(i + 2).padStart(2, "0")}
                      </span>
                      {t.nav.sections[item.key]}
                      {isActive ? (
                        <motion.span
                          layoutId="nav-active-indicator"
                          aria-hidden
                          className="absolute inset-x-4 -bottom-px h-px bg-ice xl:inset-x-5"
                          transition={reduce ? { duration: 0 } : springUI}
                        />
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-3 xl:gap-5">
            <LanguageSwitcher className="hidden md:block" />
            <a
              href={`#${SECTION_IDS.contact}`}
              className="btn btn-accent group hidden min-h-11 gap-3 sm:inline-flex lg:text-base"
            >
              <span className="whitespace-nowrap">{t.nav.cta}</span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4 transition-transform duration-300 ease-cinematic group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              >
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </a>
            <MenuButton
              ref={toggleRef}
              open={open}
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden"
            />
          </div>
        </div>
      </motion.header>

      <MobileMenu open={open} onClose={close} active={active} toggleRef={toggleRef} />
    </>
  );
}
