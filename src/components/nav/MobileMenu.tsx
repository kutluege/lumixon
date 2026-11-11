"use client";

import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { NAV, SECTION_IDS, whatsappUrl } from "@/lib/site";
import { useT } from "@/i18n/client";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { WhatsAppGlyph } from "@/components/contact/WhatsAppGlyph";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { focusWithoutScroll, getLenis, scrollToTarget } from "./scroll";

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  active: string | null;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileMenu({ open, onClose, active, toggleRef }: MobileMenuProps) {
  const t = useT();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingTarget = useRef<string | null>(null);

  // Lock scroll, inert the page, trap focus, close on Escape / desktop resize.
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    getLenis()?.stop();

    const inerted = Array.from(document.querySelectorAll<HTMLElement>("main, body > footer"));
    inerted.forEach((el) => el.setAttribute("inert", ""));

    const toggle = toggleRef.current;
    const raf = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [
        ...(toggle ? [toggle] : []),
        ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? items.includes(current) : false;
      if (e.shiftKey && (current === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && onClose();
    mq.addEventListener("change", onMq);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onMq);
      inerted.forEach((el) => el.removeAttribute("inert"));
      root.style.overflow = prevOverflow;
      getLenis()?.start();

      const target = pendingTarget.current;
      pendingTarget.current = null;
      if (target) {
        scrollToTarget(target);
        focusWithoutScroll(document.getElementById(target));
      } else {
        toggle?.focus();
      }
    };
  }, [open, onClose, toggleRef]);

  const go = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    pendingTarget.current = id;
    onClose();
  };

  const ease = EASE.cinematic;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="mobile-menu"
          id="mobil-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.dialogAria}
          data-lenis-prevent
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto overscroll-contain bg-abyss-950/96 pt-[72px] backdrop-blur-2xl lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduce ? 0.15 : 0.45, ease } }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0.1 : 0.35, ease: EASE.precise, delay: reduce ? 0 : 0.1 } }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-blueprint opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -end-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(78_82_131/0.28),transparent)]"
          />

          <div className="container-site relative flex flex-1 flex-col justify-between gap-12 pb-10 pt-8">
            <nav aria-label={t.nav.mobileAria}>
              <motion.ul
                className="border-t border-line"
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{
                  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
                  show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.12 } },
                }}
              >
                {NAV.map((item, i) => {
                  const isActive = active === item.id;
                  return (
                    <li key={item.id} className="overflow-hidden border-b border-line">
                      <motion.a
                        href={`#${item.id}`}
                        onClick={go(item.id)}
                        aria-current={isActive ? "location" : undefined}
                        className="group flex items-baseline justify-between gap-4 py-5"
                        variants={{
                          hidden: reduce ? { opacity: 0 } : { y: "110%", opacity: 0 },
                          show: {
                            y: "0%",
                            opacity: 1,
                            transition: { duration: reduce ? 0.2 : 0.8, ease },
                          },
                        }}
                      >
                        <span
                          className={cn(
                            "type-display text-[2.5rem] transition-colors duration-300 sm:text-6xl",
                            isActive ? "text-ice-100" : "text-fg group-hover:text-ice",
                          )}
                        >
                          {t.nav.sections[item.key]}
                        </span>
                        <span aria-hidden className="type-label flex items-center gap-2 text-fg-subtle">
                          {isActive ? <span className="size-1.5 rounded-full bg-ice" /> : null}
                          {String(i + 2).padStart(2, "0")}
                        </span>
                      </motion.a>
                    </li>
                  );
                })}
              </motion.ul>
            </nav>

            <motion.div
              className="flex flex-col gap-8"
              initial={{ opacity: 0, y: reduce ? 0 : 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease, delay: reduce ? 0 : 0.4 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <LanguageSwitcher size="lg" className="-ms-2" />
              <a
                href={`#${SECTION_IDS.contact}`}
                onClick={go(SECTION_IDS.contact)}
                className="btn btn-accent min-h-14 justify-between text-base"
              >
                {t.nav.cta}
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100">
                  <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </a>
              <dl className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2">
                <div>
                  <dt className="type-label text-ice-400">{t.nav.whatsappTerm}</dt>
                  <dd className="mt-2">
                    <a
                      href={whatsappUrl(t.common.whatsappGreeting)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-3 inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted transition-colors duration-300 hover:text-fg"
                    >
                      <WhatsAppGlyph className="size-3.5 text-ice-400" />
                      {t.nav.whatsappLink}
                      <span className="sr-only"> {t.common.opensInNewTab.trim()}</span>
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="type-label text-ice-400">{t.nav.locationTerm}</dt>
                  <dd className="mt-2 text-sm text-fg-muted">{t.common.location}</dd>
                </div>
              </dl>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
