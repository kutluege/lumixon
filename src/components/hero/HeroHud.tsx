"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

function MissionClock({ active, reduce }: { active: boolean; reduce: boolean }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now() - ms;
    const id = window.setInterval(() => setMs(performance.now() - start), reduce ? 1000 : 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume from the last value only when toggled
  }, [active, reduce]);

  const total = Math.floor(ms / 100);
  const ds = total % 10;
  const s = Math.floor(total / 10) % 60;
  const m = Math.floor(total / 600) % 60;
  const h = Math.floor(total / 36000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span dir="ltr" className="tabular-nums">
      T+ {pad(h)}:{pad(m)}:{pad(s)}.{ds}
    </span>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute h-3.5 w-3.5 border-ice/35 ${className}`} />;
}

/**
 * Engineering-instrument overlay. Purely decorative (aria-hidden); numeric
 * values are illustrative telemetry, not claims.
 */
export function HeroHud({ active, reduce }: { active: boolean; reduce: boolean }) {
  const t = useT();
  const [p0, p1, p2] = t.hud.pipeline;
  const arrow = <span className="text-ice-600">{t.hud.flowArrow}</span>;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {/* Frame corner brackets */}
      <div className="absolute inset-x-5 bottom-5 top-[88px] hidden md:inset-x-10 md:block lg:top-[96px] xl:inset-x-14">
        <Corner className="left-0 top-0 border-l border-t" />
        <Corner className="right-0 top-0 border-r border-t" />
        <Corner className="bottom-0 left-0 border-b border-l" />
        <Corner className="bottom-0 right-0 border-b border-r" />
      </div>

      {/* Top row: pipeline + sensor tags (xl+, where both fit beside the logo in every locale) */}
      <div className="absolute inset-x-5 top-[88px] md:inset-x-14 md:top-[102px] lg:top-[110px] xl:inset-x-[4.5rem]">
        <div className="flex items-start justify-between gap-6">
          {/* Both labels are capped to the room beside the centred logo so longer locales never run under it. */}
          <p className="type-label hidden max-w-[calc(50vw_-_clamp(360px,36vw,580px)_/_2_-_5.5rem)] truncate text-[0.6875rem] tracking-[0.14em] text-fg-subtle xl:block">
            {p0} {arrow} {p1} {arrow} {p2}
          </p>
          <p className="type-label ms-auto hidden max-w-[calc(50vw_-_clamp(360px,36vw,580px)_/_2_-_5.5rem)] min-w-0 items-center gap-2 text-[0.6875rem] tracking-[0.14em] text-ice-400 xl:flex">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-ice/50 [animation-duration:2.4s] motion-reduce:hidden" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-ice/80" />
            </span>
            <span className="truncate">{t.hud.sensors}</span>
          </p>
        </div>
      </div>

      {/* Right edge elevation ruler */}
      <div className="absolute end-10 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-[9px] lg:flex xl:end-14">
        {Array.from({ length: 17 }, (_, i) => (
          <span key={i} className={i % 4 === 0 ? "h-px w-4 bg-ice/40" : "h-px w-2 bg-ice/20"} />
        ))}
        <span className="type-label mt-2 text-[0.625rem] tracking-[0.18em] text-fg-subtle">{t.hud.elevation}</span>
      </div>

      {/* Bottom-right telemetry */}
      {/* xl+ only: at lg the block would run into the call-to-action row in longer locales;
          and only on screens tall enough that it stays below the robots' deck. */}
      <div className="absolute bottom-10 end-14 hidden text-end xl:[@media(min-height:860px)]:block">
        <dl className="type-label grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 text-[0.625rem] tracking-[0.18em] text-fg-subtle">
          <dt>{t.hud.task}</dt>
          <dd className="text-ice-400">{t.hud.taskValue}</dd>
          <dt>{t.hud.position}</dt>
          <dd className="tabular-nums text-ice-400">
            <bdi>41.0151° {t.hud.north}</bdi> · <bdi>28.9795° {t.hud.east}</bdi>
          </dd>
          <dt>{t.hud.lidar}</dt>
          <dd className="tabular-nums text-ice-400">
            <span dir="ltr">{t.hud.lidarValue}</span>
          </dd>
          <dt>{t.hud.session}</dt>
          <dd className="text-ice-400">
            <MissionClock active={active} reduce={reduce} />
          </dd>
        </dl>
      </div>
    </div>
  );
}
