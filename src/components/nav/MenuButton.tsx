"use client";

import type { Ref } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

type MenuButtonProps = {
  open: boolean;
  onClick: () => void;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** Two hairlines that rotate into a precise X. */
export function MenuButton({ open, onClick, className, ref }: MenuButtonProps) {
  const { nav } = useT();
  const reduce = useReducedMotion();
  const t = { duration: reduce ? 0 : 0.45, ease: EASE.snap };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="mobil-menu"
      aria-label={open ? nav.menuClose : nav.menuOpen}
      className={cn(
        "relative -me-2 inline-flex size-11 items-center justify-center text-fg transition-colors hover:text-ice",
        className,
      )}
    >
      <span aria-hidden className="relative block h-3 w-6">
        <motion.span
          className="absolute start-0 top-0 block h-[1.5px] w-full bg-current"
          initial={false}
          animate={open ? { top: "50%", y: "-50%", rotate: 45 } : { top: "0%", y: "0%", rotate: 0 }}
          transition={t}
        />
        <motion.span
          className="absolute bottom-0 end-0 block h-[1.5px] bg-current"
          initial={false}
          animate={
            open
              ? { bottom: "50%", y: "50%", rotate: -45, width: "100%" }
              : { bottom: "0%", y: "0%", rotate: 0, width: "66%" }
          }
          transition={t}
        />
      </span>
    </button>
  );
}
