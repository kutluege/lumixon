import { SectionHeader } from "@/components/ui/SectionHeader";
import { SECTION_IDS } from "@/lib/site";
import type { Dictionary } from "@/i18n/types";
import { CapabilityRows } from "./CapabilityRows";

/**
 * 02 · Yetenekler
 * Server shell: section frame + header. One client island follows: the three
 * capability rows (copy at the start edge, a lazy WebGL scene at the end edge).
 * No ancestor here may set `overflow`: the scenes are sticky from lg up.
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
        <CapabilityRows />
      </div>
    </section>
  );
}
