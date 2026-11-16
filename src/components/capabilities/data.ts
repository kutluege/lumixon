/**
 * Capabilities structure: the three rows of the section, in page order.
 * All copy (titles, summaries, applications, methods, image alts, scene
 * captions) lives in the dictionaries (src/i18n/dictionaries/*.ts) under
 * `items[id]`; this file only fixes the order, the index and the animation.
 * Copy rules: present tense, what LUMIXON builds; no clients, no metrics, no claims.
 */
import type { CapabilityId } from "@/i18n/types";
import type { FlankKind } from "./flank/contract";

export type CapabilityDef = {
  /** DOM-safe slug, also used for element ids and `data-capability`. */
  id: CapabilityId;
  /** Mono index shown above the title. */
  index: string;
  /** The large animation beside the copy. */
  scene: FlankKind;
  /** Optional picture-in-picture scene inside the large one (captioned by `capabilities.twinInset`). */
  inset?: FlankKind;
};

export const CAPABILITIES: readonly CapabilityDef[] = [
  { id: "robotik-otonom", index: "01", scene: "field", inset: "research" },
  { id: "saglik-dijital-patoloji", index: "02", scene: "pathology" },
  { id: "sonar", index: "03", scene: "sonar" },
];
