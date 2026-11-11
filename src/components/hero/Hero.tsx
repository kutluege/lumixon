import { SECTION_IDS } from "@/lib/site";
import { HeroBackdrop, HeroPosterLines } from "./HeroPoster";
import { HeroStage } from "./HeroStage";

/**
 * Full-viewport cinematic hero.
 * Layer order: static gradient backdrop (server) → poster linework → lazy
 * WebGL scene (client, ssr:false) → scrims → HUD → copy.
 * Height comes from HeroStage: at least one viewport, taller when long copy
 * (de/ru on short screens) needs the room, so it never collides with the logo.
 */
export function Hero() {
  return (
    <section
      id={SECTION_IDS.hero}
      aria-labelledby="hero-title"
      className="relative isolate w-full overflow-hidden bg-abyss-950"
    >
      <HeroBackdrop />
      <HeroStage poster={<HeroPosterLines />} />
    </section>
  );
}
