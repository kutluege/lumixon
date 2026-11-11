"use client";

import { focusWithoutScroll, scrollToTarget } from "@/components/nav/scroll";
import { useT } from "@/i18n/client";

export function BackToTop() {
  const t = useT();
  const onClick = () => {
    scrollToTarget(0);
    // Return keyboard focus to the top of the page without a second jump.
    focusWithoutScroll(document.getElementById("hero-title"));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-3 self-start text-fg-muted transition-colors duration-300 hover:text-fg sm:self-auto"
    >
      <span className="type-label">{t.footer.backToTop}</span>
      <span
        aria-hidden
        className="flex size-11 items-center justify-center border border-line-strong transition-colors duration-300 group-hover:border-ice/60 group-hover:bg-ice/5 group-active:bg-ice/10"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5 transition-transform duration-300 ease-cinematic group-hover:-translate-y-0.5"
        >
          <path d="M8 13V4M4.5 7.5 8 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
    </button>
  );
}
