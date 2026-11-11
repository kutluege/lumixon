"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, hash, r1, useVisualLoop, vnoise, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Streaming time series: history scrolls into a "now" line, the model projects
 * a median forecast with widening P10–P90 / P50 bands, and the most recent
 * out-of-envelope sample is marked as an anomaly.
 */
const X0 = 24;
const NOW = 268;
const X1 = 388;
const DX = 4;
const HIST = Math.floor((NOW - X0) / DX);
const FUT = Math.ceil((X1 - NOW) / DX);
const MID = 128;
const AMP = 62;

const seasonal = (n: number) => 0.42 * Math.sin(n * 0.21) + 0.18 * Math.sin(n * 0.057 + 1);
const isAnom = (n: number) => hash(n * 1.713 + 3.1) > 0.972;
const value = (n: number) =>
  seasonal(n) + 0.22 * (vnoise(n * 0.9) - 0.5) + (isAnom(n) ? (hash(n) > 0.5 ? 0.62 : -0.58) : 0);
const Y = (v: number) => MID - v * AMP;

function frame(t: number) {
  const s = t * 5;
  const n0 = Math.floor(s);
  const frac = s - n0;
  let hist = "";
  let envU = "";
  let envL = "";
  let anomX = -1;
  let anomY = 0;
  for (let i = 0; i <= HIST; i++) {
    const n = n0 - HIST + i;
    const x = NOW - (HIST - i + frac) * DX;
    if (x < X0 - 0.01) continue;
    const y = Y(value(n));
    hist += (hist ? "L" : "M") + r1(x) + " " + r1(y);
    envU += (envU ? "L" : "M") + r1(x) + " " + r1(Y(seasonal(n) + 0.24));
    envL += (envL ? "L" : "M") + r1(x) + " " + r1(Y(seasonal(n) - 0.24));
    if (isAnom(n)) {
      anomX = x;
      anomY = y;
    }
  }
  let med = "";
  let outerU = "";
  let outerL = "";
  let innerU = "";
  let innerL = "";
  const x0 = NOW - frac * DX;
  for (let j = 0; j <= FUT; j++) {
    const x = Math.min(x0 + j * DX, X1);
    const n = n0 + j;
    const m = j === 0 ? value(n0) : seasonal(n);
    const w = 0.05 + 0.055 * Math.sqrt(j);
    med += (j ? "L" : "M") + r1(x) + " " + r1(Y(m));
    outerU += (j ? "L" : "M") + r1(x) + " " + r1(Y(m + w * 1.9));
    outerL = "L" + r1(x) + " " + r1(Y(m - w * 1.9)) + outerL;
    innerU += (j ? "L" : "M") + r1(x) + " " + r1(Y(m + w));
    innerL = "L" + r1(x) + " " + r1(Y(m - w)) + innerL;
  }
  return {
    hist,
    envU,
    envL,
    med,
    outer: outerU + outerL + "Z",
    inner: innerU + innerL + "Z",
    anomX,
    anomY,
  };
}

export function ForecastVisual(props: VisualProps) {
  const L = useT().visuals.forecast;
  const hist = useRef<SVGPathElement>(null);
  const envU = useRef<SVGPathElement>(null);
  const envL = useRef<SVGPathElement>(null);
  const med = useRef<SVGPathElement>(null);
  const outer = useRef<SVGPathElement>(null);
  const inner = useRef<SVGPathElement>(null);
  const anom = useRef<SVGGElement>(null);
  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    hist.current?.setAttribute("d", f.hist);
    envU.current?.setAttribute("d", f.envU);
    envL.current?.setAttribute("d", f.envL);
    med.current?.setAttribute("d", f.med);
    outer.current?.setAttribute("d", f.outer);
    inner.current?.setAttribute("d", f.inner);
    if (anom.current) {
      anom.current.setAttribute("transform", `translate(${r1(f.anomX)} ${r1(f.anomY)})`);
      anom.current.style.opacity = f.anomX >= X0 + 6 ? "1" : "0";
    }
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* axes */}
      <path d={`M${X0} 206H${X1}`} stroke={C.ice} strokeOpacity={0.3} />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M${X0 + i * 40} 206v4`} stroke={C.ice} strokeOpacity={0.3} />
      ))}
      <path d={`M${X0} ${MID}H${X1}`} stroke={C.ice} strokeOpacity={0.06} />

      {/* expected envelope */}
      <path ref={envU} d={init.envU} stroke={C.ice} strokeOpacity={0.16} strokeDasharray="2 3" />
      <path ref={envL} d={init.envL} stroke={C.ice} strokeOpacity={0.16} strokeDasharray="2 3" />

      {/* forecast bands */}
      <path ref={outer} d={init.outer} fill={C.indigo} fillOpacity={hot ? 0.28 : 0.18} className="transition-[fill-opacity] duration-500" />
      <path ref={inner} d={init.inner} fill={C.indigo} fillOpacity={hot ? 0.5 : 0.36} className="transition-[fill-opacity] duration-500" />
      <path ref={med} d={init.med} stroke={C.indigoHi} strokeDasharray="3 2" strokeWidth={1.2} />

      {/* history */}
      <path ref={hist} d={init.hist} stroke={C.iceHi} strokeOpacity={0.9} strokeLinejoin="round" strokeWidth={1.1} />

      {/* now */}
      <path d={`M${NOW} 30V206`} stroke={C.ice} strokeOpacity={0.5} strokeDasharray="1 3" />
      <g fontFamily={MONO} fontSize={9.5} fill={C.ice}>
        <text x={X0} y={22} fillOpacity={0.45}>
          {L.history}
        </text>
        <text x={X1} y={22} textAnchor="end" fillOpacity={0.75}>
          {L.forecast}
        </text>
        <text x={NOW} y={222} textAnchor="middle" fillOpacity={0.6}>
          t₀
        </text>
      </g>

      {/* anomaly marker */}
      <g
        ref={anom}
        transform={`translate(${r1(init.anomX)} ${r1(init.anomY)})`}
        style={{ opacity: init.anomX >= X0 + 6 ? 1 : 0, transition: "opacity 300ms" }}
      >
        <circle r={6} stroke={C.accent} strokeWidth={1.2} />
        <circle r={1.8} fill={C.accent} />
        <path d="M0 -6V-22" stroke={C.accent} strokeOpacity={0.7} />
        <text y={-26} fontFamily={MONO} fontSize={9.5} fill={C.iceHi} textAnchor="middle">
          {L.anomaly}
        </text>
      </g>
    </svg>
  );
}
