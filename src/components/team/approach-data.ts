/**
 * Structure of the "Yaklaşım" section: the three pillars. Copy (title, English
 * tag, body) lives in the dictionaries under `approach.pillars[i]`, same order.
 */

export type PillarGlyph = "strata" | "hypothesis" | "schematic";

export type Pillar = {
  code: string;
  glyph: PillarGlyph;
};

export const PILLARS: readonly Pillar[] = [
  { code: "A.01", glyph: "strata" },
  { code: "A.02", glyph: "hypothesis" },
  { code: "A.03", glyph: "schematic" },
];
