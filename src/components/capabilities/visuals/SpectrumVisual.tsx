"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, smooth, useVisualLoop, vnoise, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Vibration FFT spectrum: shaft harmonics (1×, 2×, 3×…) over a noise floor,
 * with a bearing outer-race fault frequency (BPFO) and its 1× sidebands
 * slowly growing past an alarm threshold. Inset: the raw time-domain signal.
 */
const X0 = 28;
const X1 = 388;
const BASE = 200;
const H = 118;
const N = 72;
const STEP = (X1 - X0) / N;
const SHAFT = 6;
const FAULT = 43;
const SIDE = [FAULT - SHAFT, FAULT + SHAFT];
const THRESH = 0.44;

const gauss = (i: number, c: number, w = 0.55) => Math.exp(-((i - c) ** 2) / (2 * w * w));

function growth(t: number) {
  const c = (t * 0.11 + 0.35) % 1;
  return c < 0.8 ? smooth(c / 0.8) : 1 - smooth((c - 0.8) / 0.2);
}

function amp(i: number, t: number, g: number) {
  let a = 0.03 + 0.05 * vnoise(i * 1.37 + t * 3.1) + 0.015 * vnoise(i * 4.1 - t * 7);
  a += 0.62 * gauss(i, SHAFT) + 0.33 * gauss(i, SHAFT * 2) + 0.18 * gauss(i, SHAFT * 3) + 0.1 * gauss(i, SHAFT * 4);
  a *= 1 + 0.04 * Math.sin(t * 5 + i);
  const fault = 0.05 + 0.6 * g;
  a += fault * gauss(i, FAULT, 0.45) + fault * 0.32 * (gauss(i, SIDE[0], 0.45) + gauss(i, SIDE[1], 0.45));
  return Math.min(a, 0.98);
}

function frame(t: number) {
  const g = growth(t);
  let bars = "";
  let faultBars = "";
  let env = "";
  let faultTop = BASE;
  for (let i = 0; i < N; i++) {
    const x = r1(X0 + (i + 0.5) * STEP);
    const a = amp(i, t, g);
    const y = r1(BASE - a * H);
    const seg = `M${x} ${BASE}V${y}`;
    if (i === FAULT || i === SIDE[0] || i === SIDE[1]) faultBars += seg;
    else bars += seg;
    if (i === FAULT) faultTop = y;
    env += (i ? "L" : "M") + x + " " + y;
  }
  // time-domain inset: shaft sinusoid + periodic impacts proportional to fault growth
  let wave = "";
  for (let j = 0; j <= 70; j++) {
    const x = 28 + j * 2;
    const ph = j * 0.18 + t * 6;
    const impact = Math.exp(-((ph * 1.7) % 6.283) * 1.6) * Math.sin(ph * 14) * g;
    const v = 0.45 * Math.sin(ph) + 0.2 * Math.sin(ph * 2 + 1) + 0.9 * impact + 0.12 * (vnoise(j * 0.9 + t * 20) - 0.5);
    wave += (j ? "L" : "M") + x + " " + r1(46 - v * 13);
  }
  return { bars, faultBars, env, faultTop, wave, alarm: g * 0.6 + 0.05 > THRESH };
}

export function SpectrumVisual(props: VisualProps) {
  const L = useT().visuals.spectrum;
  const bars = useRef<SVGPathElement>(null);
  const faultBars = useRef<SVGPathElement>(null);
  const env = useRef<SVGPathElement>(null);
  const wave = useRef<SVGPathElement>(null);
  const tag = useRef<SVGGElement>(null);
  const alarm = useRef<SVGGElement>(null);

  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    bars.current?.setAttribute("d", f.bars);
    faultBars.current?.setAttribute("d", f.faultBars);
    env.current?.setAttribute("d", f.env);
    wave.current?.setAttribute("d", f.wave);
    tag.current?.setAttribute("transform", `translate(0 ${r1(f.faultTop - BASE)})`);
    if (alarm.current) alarm.current.style.opacity = f.alarm ? "1" : "0";
  }, props);

  const fx = r1(X0 + (FAULT + 0.5) * STEP);
  const ty = BASE - THRESH * H;
  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* axes */}
      <path d={`M${X0} ${BASE}H${X1}`} stroke={C.ice} strokeOpacity={0.35} />
      {[0, 500, 1000, 1500, 2000].map((hz, i) => {
        const x = X0 + (i * (X1 - X0)) / 4;
        return (
          <g key={hz}>
            <path d={`M${x} ${BASE}v4`} stroke={C.ice} strokeOpacity={0.35} />
            <text x={x} y={BASE + 14} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.45} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>
              {i === 4 ? L.maxFreq : hz}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((v) => (
        <path key={v} d={`M${X0} ${BASE - v * H}H${X1}`} stroke={C.ice} strokeOpacity={0.06} />
      ))}

      {/* alarm threshold */}
      <path d={`M${X0} ${ty}H${X1}`} stroke={C.accent} strokeOpacity={0.55} strokeDasharray="4 4" />
      <text x={X1} y={ty - 5} fontFamily={MONO} fontSize={9.5} fill={C.accent} fillOpacity={0.8} textAnchor="end">
        {L.threshold}
      </text>

      {/* spectrum */}
      <path ref={env} d={init.env} stroke={C.ice} strokeOpacity={hot ? 0.4 : 0.2} className="transition-[stroke-opacity] duration-500" />
      <path ref={bars} d={init.bars} stroke={C.indigoHi} strokeWidth={2.4} strokeOpacity={hot ? 0.95 : 0.7} className="transition-[stroke-opacity] duration-500" />
      <path ref={faultBars} d={init.faultBars} stroke={C.accent} strokeWidth={2.4} />

      {/* fault tag follows the BPFO peak */}
      <g ref={tag} transform={`translate(0 ${r1(init.faultTop - BASE)})`}>
        <path d={`M${fx} ${BASE - 4}v-10`} stroke={C.accent} strokeOpacity={0.8} />
        <text x={fx} y={BASE - 18} fontFamily={MONO} fontSize={9.5} fill={C.iceHi} textAnchor="middle">
          BPFO
        </text>
      </g>
      <text x={X0 + (SHAFT + 0.5) * STEP + 6} y={BASE - 0.62 * H - 2} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.55}>
        1×
      </text>

      {/* raw signal inset */}
      <g>
        <rect x={22} y={26} width={152} height={40} stroke={C.ice} strokeOpacity={0.14} />
        <path ref={wave} d={init.wave} stroke={C.ice} strokeOpacity={0.75} strokeLinejoin="round" />
        <text x={180} y={34} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.45}>
          {L.signal}
        </text>
      </g>
      <g ref={alarm} style={{ opacity: init.alarm ? 1 : 0, transition: "opacity 400ms" }}>
        <rect x={180} y={44} width={58} height={14} fill={C.burgundy} fillOpacity={0.55} stroke={C.accent} strokeOpacity={0.8} />
        <text x={209} y={54} fontFamily={MONO} fontSize={9.5} fill={C.iceHi} textAnchor="middle">
          {L.warning}
        </text>
      </g>
    </svg>
  );
}
