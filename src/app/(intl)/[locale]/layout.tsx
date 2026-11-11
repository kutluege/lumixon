import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../globals.css";
import { RootDocument } from "@/components/layout/RootDocument";
import { isLocale, prefixedLocales } from "@/i18n/config";
import { buildMetadata } from "@/i18n/metadata";
import { siteViewport } from "@/i18n/viewport";

/** Root layout for the prefixed locales: /en, /de, /ar, /ru, /zh (all statically generated). */
export const dynamicParams = false;
export const viewport = siteViewport;

export function generateStaticParams() {
  return prefixedLocales.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? buildMetadata(locale) : {};
}

export default async function LocaleRootLayout({ children, params }: Readonly<Props & { children: React.ReactNode }>) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "tr") notFound();
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
