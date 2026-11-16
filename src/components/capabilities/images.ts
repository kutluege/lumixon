/**
 * Real representative photography shown in the copy column of a capability row.
 * Files live in /public/capabilities/. Every entry records its source and license.
 * Only licenses that allow commercial use (Unsplash, Pexels, CC0/PD, CC BY with credit).
 *
 * Contract: keys are capability ids from data.ts. A row without an entry (or
 * with an empty `items[id].imageAlt`) renders without a photo.
 */
import type { CapabilityId } from "@/i18n/types";

export type CapabilityImage = {
  /** Public path, e.g. "/capabilities/robotik-otonom.jpg" */
  src: string;
  width: number;
  height: number;
  /** "Author / Source"; the UI prefixes the localized `capabilities.photoCredit` ("Foto:", "Photo:", …). Alt text lives in the dictionaries (`items[id].imageAlt`). */
  credit: string;
  /** CC BY variants require the visible credit to name the license; the UI appends it for those. */
  license: "Unsplash" | "Pexels" | "CC0" | "Public domain" | "CC BY 2.0" | "CC BY 4.0" | "CC BY-SA 4.0";
  sourceUrl: string;
};

export const CAPABILITY_IMAGES: Partial<Record<CapabilityId, CapabilityImage>> = {
  "robotik-otonom": {
    src: "/capabilities/robotik-otonom.jpg",
    width: 1600,
    height: 1003,
    credit: "Homa Appliances / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/blue-industrial-robot-arm-in-factory-sz1CHL7Pky0",
  },
  "saglik-dijital-patoloji": {
    src: "/capabilities/saglik-dijital-patoloji.jpg",
    width: 1600,
    height: 902,
    credit: "Fayette Reynolds / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/epithelial-tissues-transitional-8XAiz-wvwjo",
  },
  sonar: {
    src: "/capabilities/sonar.jpg",
    width: 1600,
    height: 901,
    credit: "Nott Peera / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/person-in-black-diving-suit-under-water-Q3ZF4C0UJO0",
  },
};
