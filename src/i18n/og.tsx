import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "./config";
import { getDictionary } from "./get-dictionary";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Fetches a TTF subset (only the glyphs in `text`) from Google Fonts at build
 * time. Satori cannot read woff2 and its bundled font is Latin-only.
 */
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@500&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Script-specific OG faces. Arabic is not shaped by Satori, so ar uses the English tagline. */
const OG_FONT: Partial<Record<Locale, string>> = { ru: "Golos Text", zh: "Noto Sans SC" };

/** Per-locale Open Graph card. */
export async function renderOgImage(locale: Locale) {
  const t = getDictionary(locale);
  const family = OG_FONT[locale];
  const font = family ? await loadGoogleFont(family, t.meta.ogTagline + t.meta.ogEyebrow) : null;
  // Fall back to English wherever the script can't be rendered faithfully.
  const tagline = locale === "ar" || (family && !font) ? getDictionary("en").meta.ogTagline : t.meta.ogTagline;

  const logo = await readFile(join(process.cwd(), "public/brand/lumixon-ai-wordmark-1200.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(70% 60% at 92% 100%, rgba(122,35,80,0.45) 0%, rgba(122,35,80,0) 70%), radial-gradient(120% 90% at 80% 10%, #3a4070 0%, #232a4a 50%, #181d34 100%)",
          color: "#E6EDF5",
          fontFamily: font ? "OG" : "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          {lines.map((i) => (
            <div key={i} style={{ height: 45, borderBottom: "1px solid rgba(175,193,214,0.08)" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 20, letterSpacing: 6, color: "#AFC1D6" }}>
          <div style={{ width: 48, height: 2, background: "#AFC1D6" }} />
          {t.meta.ogEyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Soft ice pool behind the mark so the burgundy APPLIED AI line reads on the dark ground. */}
          <div
            style={{
              display: "flex",
              marginLeft: -90,
              marginTop: -40,
              marginBottom: -40,
              padding: "40px 90px",
              background: "radial-gradient(50% 50% at 50% 58%, rgba(175,193,214,0.26) 0%, rgba(175,193,214,0.11) 50%, rgba(175,193,214,0) 100%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="LUMIXON Applied AI" width={720} height={158} />
          </div>
          <div style={{ marginTop: 28, fontSize: 40, color: "#AFC1D6", maxWidth: 900, lineHeight: 1.25 }}>
            {tagline}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ width: 120, height: 6, background: "#4E5283" }} />
          <div style={{ width: 40, height: 6, background: "#AFC1D6" }} />
          <div style={{ width: 20, height: 6, background: "#2E0219", border: "1px solid #7a2350" }} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "OG", data: font, weight: 500, style: "normal" }] : undefined },
  );
}
