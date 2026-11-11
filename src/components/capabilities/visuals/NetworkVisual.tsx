"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Vehicle routing on a road graph: three tours out of a depot, one disrupted
 * link avoided by the plan, vehicles advancing along their routes.
 */
const N: [number, number][] = [
  [200, 124], // 0 depot
  [70, 58],
  [146, 40],
  [252, 44],
  [338, 58],
  [366, 128],
  [330, 194],
  [240, 202],
  [150, 196],
  [56, 168],
  [104, 112],
  [292, 118],
];
const ROUTES = [
  [0, 8, 9, 10, 1, 2, 0],
  [0, 3, 4, 5, 11, 0],
  [0, 7, 6, 0],
];
const EXTRA: [number, number][] = [
  [2, 3],
  [8, 7],
  [10, 0],
  [3, 11],
  [1, 9],
  [4, 11],
  [10, 8],
  [6, 11],
];
const BLOCKED: [number, number] = [5, 6];

function routeGeom(r: number[]) {
  const pts = r.map((i) => N[i]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}
const GEOM = ROUTES.map(routeGeom);

function pointAt(g: (typeof GEOM)[number], s: number): [number, number] {
  const d = s * g.len;
  let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < d) i++;
  const t = (d - g.cum[i - 1]) / (g.cum[i] - g.cum[i - 1] || 1);
  const a = g.pts[i - 1];
  const b = g.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

const path = (pts: [number, number][]) => pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join("");

function frame(t: number) {
  return GEOM.map((g, i) => pointAt(g, ((t * 26) / g.len + i * 0.37) % 1));
}

export function NetworkVisual(props: VisualProps) {
  const L = useT().visuals.network;
  const veh = useRef<(SVGGElement | null)[]>([]);
  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    frame(t).forEach((p, i) => veh.current[i]?.setAttribute("transform", `translate(${r1(p[0])} ${r1(p[1])})`));
  }, props);

  const hot = props.hot;
  const routeStyle = [
    { stroke: C.iceHi, dash: undefined },
    { stroke: C.indigoHi, dash: undefined },
    { stroke: C.ice, dash: "4 3" },
  ];
  const mid: [number, number] = [(N[BLOCKED[0]][0] + N[BLOCKED[1]][0]) / 2, (N[BLOCKED[0]][1] + N[BLOCKED[1]][1]) / 2];

  return (
    <svg {...SVG_PROPS}>
      {/* road graph */}
      <g stroke={C.ice} strokeOpacity={0.14}>
        {EXTRA.map(([a, b]) => (
          <path key={`${a}-${b}`} d={path([N[a], N[b]])} />
        ))}
      </g>

      {/* disrupted link */}
      <path d={path([N[BLOCKED[0]], N[BLOCKED[1]]])} stroke={C.accent} strokeOpacity={0.8} strokeDasharray="2 3" />
      <g transform={`translate(${mid[0]} ${mid[1]})`}>
        <circle r={7} fill={C.bg} stroke={C.accent} />
        <path d="M-3 -3L3 3M3 -3L-3 3" stroke={C.accent} strokeWidth={1.3} />
        <text x={12} y={3} fontFamily={MONO} fontSize={8.5} fill={C.iceHi} fillOpacity={0.85}>
          {L.disruption}
        </text>
      </g>

      {/* planned routes */}
      {GEOM.map((g, i) => (
        <path
          key={i}
          d={path(g.pts)}
          stroke={routeStyle[i].stroke}
          strokeDasharray={routeStyle[i].dash}
          strokeOpacity={hot ? 0.75 : 0.45}
          strokeLinejoin="round"
          className="transition-[stroke-opacity] duration-500"
        />
      ))}

      {/* stops */}
      {N.slice(1).map((p, i) => (
        <g key={i} transform={`translate(${p[0]} ${p[1]})`}>
          <circle r={4} fill={C.bg} stroke={C.ice} strokeOpacity={0.7} />
          <circle r={1.3} fill={C.ice} fillOpacity={0.7} />
        </g>
      ))}

      {/* depot */}
      <g transform={`translate(${N[0][0]} ${N[0][1]})`}>
        <rect x={-8} y={-8} width={16} height={16} fill={C.indigo} stroke={C.iceHi} />
        <text y={22} fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.7} textAnchor="middle">
          {L.depot}
        </text>
      </g>

      {/* vehicles */}
      {init.map((p, i) => (
        <g
          key={i}
          ref={(el) => {
            veh.current[i] = el;
          }}
          transform={`translate(${r1(p[0])} ${r1(p[1])})`}
        >
          <circle r={7} fill={C.ice} fillOpacity={0.12} />
          <circle r={3} fill={i === 1 ? C.indigoHi : C.iceHi} />
        </g>
      ))}

      <g fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.5}>
        <text x={16} y={226}>R1 · R2 · R3</text>
        <text x={388} y={226} textAnchor="end">
          {L.caption}
        </text>
      </g>
    </svg>
  );
}
