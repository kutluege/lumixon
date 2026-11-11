import { SectionHeader } from "@/components/ui/SectionHeader";
import { SECTION_IDS } from "@/lib/site";
import type { Dictionary } from "@/i18n/types";
import { CapabilityExplorer } from "./CapabilityExplorer";
import { FlankStage } from "./flank/FlankStage";

/**
 * 02 · Yetenekler
 * Server shell: section frame + header. Two client islands follow: the
 * "research → field" band (lazy WebGL panels) and the interactive explorer
 * (tabs, cards, procedural visuals).
 */
export function Capabilities({ t }: { t: Dictionary }) {
  return (
    <section
      id={SECTION_IDS.capabilities}
      aria-label={t.capabilities.label}
      className="relative isolate border-t border-line py-section"
    >
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_70%,transparent)]"
      />
      {/* Palette washes: indigo light from the top-left, burgundy undertow low-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,#181d34,#1e2443_35%,#1f2546_70%,#181d34)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(65%_55%_at_18%_0%,rgb(108_113_168/0.34),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[44rem] bg-[radial-gradient(55%_50%_at_92%_100%,rgb(122_35_80/0.26),transparent_70%)]"
      />
      <div className="container-site">
        <SectionHeader
          index="02"
          label={t.capabilities.label}
          title={t.capabilities.title}
          lede={t.capabilities.lede}
        />
        <FlankStage />
        <CapabilityExplorer />
      </div>
    </section>
  );
}
