import { isLocale, locales } from "@/i18n/config";
import { renderOgImage } from "@/i18n/og";

/**
 * Social share cards, one PNG per locale: /og/tr.png, /og/en.png, ...
 * A plain route with a real file extension instead of the `opengraph-image`
 * convention, so the static export writes files a static host serves as
 * image/png. Referenced from buildMetadata().
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ file: `${locale}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const locale = file.replace(/\.png$/, "");
  return renderOgImage(isLocale(locale) ? locale : "tr");
}
