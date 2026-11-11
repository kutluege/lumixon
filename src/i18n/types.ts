import type { tr } from "./dictionaries/tr";

/**
 * The dictionary shape is derived from the Turkish source (tr.ts). Every other
 * locale is annotated with this type, so a missing or extra key anywhere
 * (including per-capability and per-visual entries) is a compile error.
 */
export type Dictionary = typeof tr;

export type CapabilityId = keyof Dictionary["items"];
export type CategoryId = keyof Dictionary["categories"];
export type CapabilityText = Dictionary["items"][CapabilityId];
export type VisualText = Dictionary["visuals"];
