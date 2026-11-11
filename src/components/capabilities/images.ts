/**
 * Real representative photography shown next to each capability's technical animation.
 * Files live in /public/capabilities/. Every entry records its source and license.
 * Only licenses that allow commercial use (Unsplash, Pexels, CC0/PD, CC BY with credit).
 *
 * Contract: keys are Capability ids from data.ts. Consumers must handle a missing entry.
 */
export type CapabilityImage = {
  /** Public path, e.g. "/capabilities/robotik-otonom.jpg" */
  src: string;
  width: number;
  height: number;
  /** "Author / Source"; the UI prefixes the localized `capabilities.photoCredit` ("Foto:", "Photo:", …). Alt text lives in the dictionaries (`items[id].imageAlt`). */
  credit: string;
  license: "Unsplash" | "Pexels" | "CC0" | "Public domain" | "CC BY 2.0" | "CC BY 4.0" | "CC BY-SA 4.0";
  sourceUrl: string;
};

export const CAPABILITY_IMAGES: Partial<Record<string, CapabilityImage>> = {
  "robotik-otonom": {
    src: "/capabilities/robotik-otonom.jpg",
    width: 1600,
    height: 1003,
    credit: "Homa Appliances / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/blue-industrial-robot-arm-in-factory-sz1CHL7Pky0",
  },
  "kestirimci-bakim": {
    src: "/capabilities/kestirimci-bakim.jpg",
    width: 1600,
    height: 1067,
    credit: "Crystal Kwok / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/grey-industrial-equipment-mhUsz2ezlXQ",
  },
  "sinyal-sensor-fuzyonu": {
    src: "/capabilities/sinyal-sensor-fuzyonu.jpg",
    width: 1600,
    height: 1158,
    credit: "Steve Jurvetson / Wikimedia Commons",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Velodyne_High-Def_LIDAR.jpg",
  },
  "cografi-uzaktan-algilama": {
    src: "/capabilities/cografi-uzaktan-algilama.jpg",
    width: 1600,
    height: 1064,
    credit: "NASA / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/aerial-photo-of-coastline-6-jTZysYY_U",
  },
  "dijital-ikiz": {
    src: "/capabilities/dijital-ikiz.jpg",
    width: 1600,
    height: 1067,
    credit: "mos design / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/a-factory-with-a-lot-of-pipes-and-lights-oxj8rtcuq6c",
  },
  "zaman-serisi-anomali": {
    src: "/capabilities/zaman-serisi-anomali-2.jpg",
    width: 1600,
    height: 1067,
    credit: "Egor Komarov / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/a-computer-screen-with-a-sound-wave-on-it-nlNdinkC7dU",
  },
  "lojistik-tedarik": {
    src: "/capabilities/lojistik-tedarik.jpg",
    width: 1600,
    height: 851,
    credit: "Timelab / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/shipping-port-with-containers-and-cranes-sWOvgOOFk1g",
  },
  "dokuman-zekasi": {
    src: "/capabilities/dokuman-zekasi-2.jpg",
    width: 1600,
    height: 1067,
    credit: "Vooglam Eyewear / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/desk-with-laptop-blueprints-and-tools-0dhIl78b__o",
  },
  "ajan-otomasyon": {
    src: "/capabilities/ajan-otomasyon.jpg",
    width: 1600,
    height: 898,
    credit: "Taylor Vick / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/cable-network-M5tzZtFCOfs",
  },
  "video-uretimi": {
    src: "/capabilities/video-uretimi.jpg",
    width: 1600,
    height: 1067,
    credit: "Brands&People / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/film-crew-on-soundstage-workspace-br2HgQuvq6I",
  },
  "3d-cgi-animasyon": {
    src: "/capabilities/3d-cgi-animasyon.jpg",
    width: 1600,
    height: 1067,
    credit: "Ion (Ivan) Sipilov / Unsplash",
    license: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/man-sitting-and-using-computer-f5j-a8M1KEw",
  },
  "slam-haritalama": {
    src: "/capabilities/slam-haritalama.jpg",
    width: 1600,
    height: 1016,
    credit: "Gaelle1106 / Wikimedia Commons",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:DJI_Matrice_300_RTK_(cropped).jpg",
  },
};
