import { Nav } from "@/components/nav/Nav";
import { Hero } from "@/components/hero/Hero";
import { Capabilities } from "@/components/capabilities/Capabilities";
import { Approach } from "@/components/team/Approach";
import { Contact } from "@/components/contact/Contact";
import { Footer } from "@/components/footer/Footer";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

/** The single page, rendered once per locale. */
export function HomePage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <>
      <Nav />
      <main id="icerik">
        <Hero />
        <Capabilities t={t} />
        <Approach t={t} locale={locale} />
        <Contact t={t} />
      </main>
      <Footer t={t} />
    </>
  );
}
