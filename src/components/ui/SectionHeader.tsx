import { Reveal } from "./Reveal";
import { TextReveal } from "./TextReveal";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  /** e.g. "02" */
  index: string;
  /** small mono label, e.g. "Yetenekler" */
  label: string;
  title: string;
  lede?: string;
  className?: string;
  align?: "left" | "split";
};

/**
 * Standard section opener used by every section for visual consistency:
 *   [02 — YETENEKLER] ─────────────
 *   Big display headline           Lede paragraph (split layout)
 */
export function SectionHeader({ index, label, title, lede, className, align = "split" }: SectionHeaderProps) {
  return (
    <header className={cn("relative", className)}>
      <Reveal className="flex items-center gap-4 text-ice-400">
        <span className="type-label text-ice">{index}</span>
        <span className="type-label">{label}</span>
        <span className="h-px flex-1 bg-line-strong" />
      </Reveal>
      <div
        className={cn(
          "mt-8 grid gap-6 md:mt-10 md:gap-8",
          align === "split" && "lg:grid-cols-12 lg:items-end lg:gap-12",
        )}
      >
        <TextReveal
          as="h2"
          text={title}
          className={cn(
            "type-display text-balance text-h2 text-fg",
            align === "split" && "lg:col-span-7",
          )}
        />
        {lede ? (
          <Reveal
            delay={0.15}
            className={cn("max-w-xl text-base leading-relaxed text-fg-muted text-pretty md:text-lg", align === "split" && "lg:col-span-5 lg:pb-2")}
          >
            <p>{lede}</p>
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
