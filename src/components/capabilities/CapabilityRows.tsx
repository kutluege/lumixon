"use client";

import { MotionConfig } from "framer-motion";
import { CapabilityRow } from "./CapabilityRow";
import { CAPABILITIES } from "./data";

/** The three capabilities, one full-width row under another; each row opens with its own index rule. */
export function CapabilityRows() {
  return (
    <MotionConfig reducedMotion="user">
      <ol className="mt-section-gap flex flex-col gap-[clamp(4.5rem,2.5rem+6vw,8rem)]">
        {CAPABILITIES.map((def) => (
          <CapabilityRow key={def.id} def={def} />
        ))}
      </ol>
    </MotionConfig>
  );
}
