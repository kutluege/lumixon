"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, useVisualLoop, vnoise, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Three imperfect sensor streams (high-frequency noise, low-rate quantised
 * fixes, drift with dropouts) converge into a filter node that outputs one
 * smooth state estimate with a narrow covariance band.
 */
const LANES = [
  { y: 56, name: "IMU · 200 Hz" },
  { y: 120, name: "GNSS · 10 Hz" },
  { y: 184, name: "ODOM · 50 Hz" },
] as const;
const IN_X0 = 24;
const IN_X1 = 196;
const NODE = { x: 252, y: 120 };
const OUT_X0 = 270;
const OUT_X1 = 386;

const truth = (u: number) => 0.6 * Math.sin(u * 0.9) + 0.3 * Math.sin(u * 2.1 + 1);

function lane(idx: number, t: number) {
  const y0 = LANES[idx].y;
  let d = "";
  let pen = false;
  for (let x = IN_X0; x <= IN_X1; x += 3) {
    const u = (x - IN_X0) / 40 + t * 0.8;
    let v = truth(u);
    let gap = false;
    if (idx === 0) v += (vnoise(u * 9 + 3) - 0.5) * 0.7 + (vnoise(u * 23) - 0.5) * 0.35;
    if (idx === 1) v = Math.round((v + 0.25 * Math.sin(u * 0.4)) * 4) / 4;
    if (idx === 2) {
      v += 0.35 * Math.sin(u * 0.27 + 2) + (vnoise(u * 5 + 9) - 0.5) * 0.2;
      gap = vnoise(u * 2.4 + 5) > 0.82;
    }
    if (gap) {
      pen = false;
      continue;
    }
    d += (pen ? "L" : "M") + x + " " + r1(y0 - v * 16);
    pen = true;
  }
  return d;
}

function frame(t: number) {
  let est = "";
  let upper = "";
  let lower = "";
  let lastY = NODE.y;
  for (let x = OUT_X0; x <= OUT_X1; x += 3) {
    const u = (x - OUT_X0) / 40 + t * 0.8 - 1.2;
    const y = NODE.y - truth(u) * 24;
    const w = 3 + 1.2 * Math.sin(u * 1.7);
    est += (x === OUT_X0 ? "M" : "L") + x + " " + r1(y);
    upper += (x === OUT_X0 ? "M" : "L") + x + " " + r1(y - w);
    lower = "L" + x + " " + r1(y + w) + lower;
    lastY = y;
  }
  return {
    l0: lane(0, t),
    l1: lane(1, t),
    l2: lane(2, t),
    est,
    band: upper + lower + "Z",
    lastY,
    dash: String(r1(-(t * 22) % 16)),
  };
}

export function FusionVisual(props: VisualProps) {
  const L = useT().visuals.fusion;
  const l0 = useRef<SVGPathElement>(null);
  const l1 = useRef<SVGPathElement>(null);
  const l2 = useRef<SVGPathElement>(null);
  const est = useRef<SVGPathElement>(null);
  const band = useRef<SVGPathElement>(null);
  const cov = useRef<SVGEllipseElement>(null);
  const links = useRef<SVGGElement>(null);

  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    l0.current?.setAttribute("d", f.l0);
    l1.current?.setAttribute("d", f.l1);
    l2.current?.setAttribute("d", f.l2);
    est.current?.setAttribute("d", f.est);
    band.current?.setAttribute("d", f.band);
    cov.current?.setAttribute("cy", String(r1(f.lastY)));
    links.current?.setAttribute("stroke-dashoffset", f.dash);
  }, props);

  const hot = props.hot;
  const laneRefs = [l0, l1, l2];
  const inits = [init.l0, init.l1, init.l2];

  return (
    <svg {...SVG_PROPS}>
      {LANES.map((ln, i) => (
        <g key={ln.name}>
          <path d={`M${IN_X0} ${ln.y}H${IN_X1}`} stroke={C.ice} strokeOpacity={0.08} />
          <text x={IN_X0} y={ln.y - 28} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.5}>
            {L.lanes[i]}
          </text>
          <path
            ref={laneRefs[i]}
            d={inits[i]}
            stroke={i === 1 ? C.indigoHi : C.ice}
            strokeOpacity={hot ? 0.85 : 0.55}
            strokeLinejoin="round"
            className="transition-[stroke-opacity] duration-500"
          />
        </g>
      ))}

      {/* converging links */}
      <g ref={links} stroke={C.ice} strokeOpacity={hot ? 0.6 : 0.3} strokeDasharray="3 5" strokeDashoffset={init.dash} className="transition-[stroke-opacity] duration-500">
        {LANES.map((ln) => (
          <path key={ln.y} d={`M${IN_X1 + 6} ${ln.y}C${IN_X1 + 34} ${ln.y} ${NODE.x - 34} ${NODE.y} ${NODE.x - 11} ${NODE.y}`} />
        ))}
      </g>

      {/* filter node */}
      <rect x={NODE.x - 10} y={NODE.y - 10} width={20} height={20} transform={`rotate(45 ${NODE.x} ${NODE.y})`} fill={C.indigo} fillOpacity={0.6} stroke={C.ice} strokeOpacity={0.9} />
      <text x={NODE.x} y={NODE.y + 30} fontFamily={MONO} fontSize={9.5} fill={C.iceHi} textAnchor="middle">
        EKF
      </text>
      <text x={NODE.x} y={NODE.y + 41} fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.45} textAnchor="middle">
        {L.filterSub}
      </text>

      {/* fused estimate */}
      <path ref={band} d={init.band} fill={C.indigo} fillOpacity={0.35} />
      <path ref={est} d={init.est} stroke={C.iceHi} strokeWidth={1.4} strokeLinejoin="round" />
      <ellipse ref={cov} cx={OUT_X1} cy={r1(init.lastY)} rx={4} ry={8} stroke={C.accent} strokeOpacity={0.9} />
      <text x={OUT_X1} y={NODE.y - 48} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.6} textAnchor="end">
        {L.output}
      </text>
    </svg>
  );
}
