/**
 * Capabilities structure: ids, codes, visuals and category membership.
 * All copy (titles, summaries, applications, methods, visual captions, image
 * alts) lives in the dictionaries (src/i18n/dictionaries/*.ts) under
 * `categories[id]` and `items[id]`; `buildCategories(t)` merges the two.
 * Copy rules: present tense, what LUMIXON builds; no clients, no metrics, no claims.
 */
import type { CapabilityId, CategoryId, Dictionary } from "@/i18n/types";

export type VisualKey =
  | "kinematics"
  | "spectrum"
  | "fusion"
  | "geospatial"
  | "twin"
  | "forecast"
  | "network"
  | "document"
  | "agentic"
  | "timeline"
  | "mesh"
  | "slam";

export type Capability = {
  /** DOM-safe slug, also used for element ids */
  id: CapabilityId;
  /** e.g. "A.01" */
  code: string;
  title: string;
  /** English subtitle, rendered in mono */
  subtitle: string;
  summary: string;
  applications: string[];
  methods: string[];
  visual: VisualKey;
  /** Mono caption shown above the technical visual */
  visualLabel: string;
};

export type CapabilityCategory = {
  id: CategoryId;
  index: "A" | "B" | "C";
  title: string;
  /** Compact label for the tab rail */
  shortTitle: string;
  subtitle: string;
  capabilities: Capability[];
};

type CategoryDef = {
  id: CategoryId;
  index: "A" | "B" | "C";
  capabilities: { id: CapabilityId; code: string; visual: VisualKey }[];
};

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    id: "fiziksel",
    index: "A",
    capabilities: [
      { id: "robotik-otonom", code: "A.01", visual: "kinematics" },
      { id: "kestirimci-bakim", code: "A.02", visual: "spectrum" },
      { id: "sinyal-sensor-fuzyonu", code: "A.03", visual: "fusion" },
      { id: "cografi-uzaktan-algilama", code: "A.04", visual: "geospatial" },
      { id: "dijital-ikiz", code: "A.05", visual: "twin" },
      { id: "zaman-serisi-anomali", code: "A.06", visual: "forecast" },
      { id: "lojistik-tedarik", code: "A.07", visual: "network" },
      { id: "slam-haritalama", code: "A.08", visual: "slam" },
    ],
  },
  {
    id: "kurumsal",
    index: "B",
    capabilities: [
      { id: "dokuman-zekasi", code: "B.01", visual: "document" },
      { id: "ajan-otomasyon", code: "B.02", visual: "agentic" },
    ],
  },
  {
    id: "uretken-medya",
    index: "C",
    capabilities: [
      { id: "video-uretimi", code: "C.01", visual: "timeline" },
      { id: "3d-cgi-animasyon", code: "C.02", visual: "mesh" },
    ],
  },
];

/** Structure + localized copy for one locale. */
export function buildCategories(t: Dictionary): CapabilityCategory[] {
  return CATEGORY_DEFS.map((c) => ({
    id: c.id,
    index: c.index,
    ...t.categories[c.id],
    capabilities: c.capabilities.map((cap) => {
      const copy = t.items[cap.id];
      return {
        id: cap.id,
        code: cap.code,
        visual: cap.visual,
        title: copy.title,
        subtitle: copy.subtitle,
        summary: copy.summary,
        applications: copy.applications,
        methods: copy.methods,
        visualLabel: copy.visualLabel,
      };
    }),
  }));
}
