import Image from "next/image";
import { withBase } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * LUMIXON brand logo, rendered from the official artwork ("lastlogo.png":
 * LUMIXON in an indigo-to-ice metallic gradient over a burgundy APPLIED AI
 * line), trimmed and exported to /public/brand. Every variant is the same
 * artwork at a different resolution; next/image serves WebP/AVIF from these.
 *
 * - "nav": small (~220px wide) renditions.
 * - "lockup": footer / mid-size use.
 * - "watermark": large decorative, low-opacity use.
 * - "hero": large display in the hero.
 */
const ASSETS = {
  nav: { src: "/brand/lumixon-ai-nav@2x.png", width: 480, height: 105 },
  lockup: { src: "/brand/lumixon-ai-lockup@2x.png", width: 900, height: 197 },
  watermark: { src: "/brand/lumixon-ai-wordmark-1200.png", width: 1200, height: 263 },
  hero: { src: "/brand/lumixon-ai-hero.png", width: 1300, height: 284 },
} as const;

const DEFAULT_SIZES: Record<keyof typeof ASSETS, string> = {
  nav: "220px",
  lockup: "320px",
  watermark: "100vw",
  hero: "(min-width: 1024px) 50vw, 90vw",
};

export type WordmarkVariant = keyof typeof ASSETS;

export function Wordmark({
  className,
  variant,
  withDescriptor = false,
  title = "LUMIXON Applied AI",
  priority = false,
  sizes,
}: {
  className?: string;
  variant?: WordmarkVariant;
  /** Back-compat: true renders the full lockup. */
  withDescriptor?: boolean;
  /** Alt text; pass "" for a decorative instance. */
  title?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const v: WordmarkVariant = variant ?? (withDescriptor ? "lockup" : "nav");
  const asset = ASSETS[v];
  const decorative = title === "";
  return (
    <Image
      src={withBase(asset.src)}
      width={asset.width}
      height={asset.height}
      alt={title}
      aria-hidden={decorative || undefined}
      priority={priority}
      quality={90}
      sizes={sizes ?? DEFAULT_SIZES[v]}
      draggable={false}
      className={cn("block h-auto select-none", className)}
    />
  );
}
