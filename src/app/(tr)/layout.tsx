import type { Metadata } from "next";
import "../globals.css";
import { RootDocument } from "@/components/layout/RootDocument";
import { buildMetadata } from "@/i18n/metadata";
import { siteViewport } from "@/i18n/viewport";

/** Root layout for the default locale (Turkish), served unprefixed at "/". */
export const metadata: Metadata = buildMetadata("tr");
export const viewport = siteViewport;

export default function TurkishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale="tr">{children}</RootDocument>;
}
