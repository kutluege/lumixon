"use client";

import { useMemo, useRef } from "react";
import {
  C,
  MONO,
  SVG_PROPS,
  T0,
  r1,
  useVisualLoop,
  type VisualProps,
} from "./engine";
import { useT } from "@/i18n/client";

/**
 * Isometric motor + flywheel. The physical asset (shaded) streams telemetry
 * along a link to its digital twin (wireframe), which mirrors the rotation
 * with a small synchronisation lag.
 */
const S = 32;
const W = 2.0;
const D = 1.2;
const HT = 1.0;
const FLY = { x: 2.35, y: 0.6, z: 0.55, r: 0.48 };
const PHYS = { ox: 72, oy: 112 };
const TWIN = { ox: 250, oy: 112 };

type V3 = readonly [number, number, number];
const iso = (p: V3, o: { ox: number; oy: number }): [number, number] => [
  o.ox + (p[0] - p[1]) * 0.866 * S,
  o.oy + (p[0] + p[1]) * 0.5 * S - p[2] * S,
];
const poly = (pts: V3[], o: { ox: number; oy: number }) =>
  pts.map((p, i) => (i ? "L" : "M") + iso(p, o).map(r1).join(" ")).join("") +
  "Z";

const FACES = {
  plate: [
    [-0.25, -0.25, 0],
    [2.75, -0.25, 0],
    [2.75, 1.45, 0],
    [-0.25, 1.45, 0],
  ] as V3[],
  top: [
    [0, 0, HT],
    [W, 0, HT],
    [W, D, HT],
    [0, D, HT],
  ] as V3[],
  px: [
    [W, 0, 0],
    [W, D, 0],
    [W, D, HT],
    [W, 0, HT],
  ] as V3[],
  py: [
    [0, D, 0],
    [W, D, 0],
    [W, D, HT],
    [0, D, HT],
  ] as V3[],
};

function staticGeometry(o: { ox: number; oy: number }) {
  const rim: V3[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    rim.push([FLY.x, FLY.y + FLY.r * Math.cos(a), FLY.z + FLY.r * Math.sin(a)]);
  }
  let fins = "";
  for (let k = 1; k <= 6; k++) {
    const x = (k / 7) * W;
    const a = iso([x, 0.12, HT], o);
    const b = iso([x, D - 0.12, HT], o);
    fins += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
  }
  const s0 = iso([W, FLY.y, FLY.z], o);
  const s1 = iso([FLY.x, FLY.y, FLY.z], o);
  const o0 = iso([0, 0, 0], o);
  const hidden = [iso([W, 0, 0], o), iso([0, D, 0], o), iso([0, 0, HT], o)]
    .map((p) => `M${r1(o0[0])} ${r1(o0[1])}L${r1(p[0])} ${r1(p[1])}`)
    .join("");
  return {
    plate: poly(FACES.plate, o),
    top: poly(FACES.top, o),
    px: poly(FACES.px, o),
    py: poly(FACES.py, o),
    rim: poly(rim, o),
    fins,
    shaft: `M${r1(s0[0])} ${r1(s0[1])}L${r1(s1[0])} ${r1(s1[1])}`,
    hidden,
    hub: iso([FLY.x, FLY.y, FLY.z], o),
    sensor: iso([1.0, D, 0.55], o),
  };
}

const GP = staticGeometry(PHYS);
const GT = staticGeometry(TWIN);

function spokes(angle: number, o: { ox: number; oy: number }) {
  let d = "";
  const c = iso([FLY.x, FLY.y, FLY.z], o);
  for (let i = 0; i < 6; i++) {
    const a = angle + (i / 6) * Math.PI * 2;
    const p = iso(
      [
        FLY.x,
        FLY.y + FLY.r * 0.92 * Math.cos(a),
        FLY.z + FLY.r * 0.92 * Math.sin(a),
      ],
      o,
    );
    d += `M${r1(c[0])} ${r1(c[1])}L${r1(p[0])} ${r1(p[1])}`;
  }
  return d;
}

// telemetry link: quadratic arc between the two assets
const LA: [number, number] = [GP.sensor[0] + 30, 62];
const LC: [number, number] = [161, 14];
const LB: [number, number] = [GT.sensor[0] + 30, 62];
const quad = (t: number): [number, number] => {
  const u = 1 - t;
  return [
    u * u * LA[0] + 2 * u * t * LC[0] + t * t * LB[0],
    u * u * LA[1] + 2 * u * t * LC[1] + t * t * LB[1],
  ];
};

function frame(t: number) {
  const ang = t * 2.4;
  const packets = [0, 1, 2].map((i) => quad((t * 0.42 + i / 3) % 1));
  const arrive = ((t * 0.42) % (1 / 3)) * 3; // 0..1 between arrivals
  return {
    sp: spokes(ang, PHYS),
    st: spokes(ang - 0.38, TWIN),
    packets,
    glow: Math.max(0, 1 - arrive * 4),
    rpm: `ω ${(1480 + Math.round(6 * Math.sin(t * 0.7))).toString()}`,
  };
}

export function TwinVisual(props: VisualProps) {
  const L = useT().visuals.twin;
  const sp = useRef<SVGPathElement>(null);
  const st = useRef<SVGPathElement>(null);
  const pk = useRef<(SVGRectElement | null)[]>([]);
  const glow = useRef<SVGCircleElement>(null);
  const rpm = useRef<SVGTextElement>(null);
  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    sp.current?.setAttribute("d", f.sp);
    st.current?.setAttribute("d", f.st);
    f.packets.forEach((p, i) =>
      pk.current[i]?.setAttribute(
        "transform",
        `translate(${r1(p[0])} ${r1(p[1])})`,
      ),
    );
    glow.current?.setAttribute("fill-opacity", String(r1(0.2 + f.glow * 0.8)));
    if (rpm.current) rpm.current.textContent = `${f.rpm} ${L.rpmUnit}`;
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* assets + link, scaled up about the composition centre to fill the canvas */}
      <g transform="translate(200 124) scale(1.17) translate(-180 -114)">
        {/* physical asset */}
        <g>
          <path
            d={GP.plate}
            fill={C.indigoLo}
            fillOpacity={0.5}
            stroke={C.ice}
            strokeOpacity={0.2}
          />
          <path
            d={GP.py}
            fill={C.indigo}
            fillOpacity={0.45}
            stroke={C.ice}
            strokeOpacity={0.55}
          />
          <path
            d={GP.px}
            fill={C.indigo}
            fillOpacity={0.28}
            stroke={C.ice}
            strokeOpacity={0.55}
          />
          <path
            d={GP.top}
            fill={C.indigoMid}
            fillOpacity={0.55}
            stroke={C.ice}
            strokeOpacity={0.7}
          />
          <path d={GP.fins} stroke={C.ice} strokeOpacity={0.3} />
          <path
            d={GP.shaft}
            stroke={C.ice}
            strokeOpacity={0.7}
            strokeWidth={2}
          />
          <path
            d={GP.rim}
            fill={C.indigoLo}
            fillOpacity={0.9}
            stroke={C.iceHi}
            strokeOpacity={0.8}
          />
          <path ref={sp} d={init.sp} stroke={C.ice} strokeOpacity={0.8} />
          <circle cx={r1(GP.hub[0])} cy={r1(GP.hub[1])} r={2.4} fill={C.ice} />
          <circle
            cx={r1(GP.sensor[0])}
            cy={r1(GP.sensor[1])}
            r={3}
            fill={C.accent}
          />
        </g>

        {/* digital twin */}
        <g
          stroke={C.ice}
          className="transition-[stroke-opacity] duration-500"
          strokeOpacity={hot ? 0.85 : 0.6}
        >
          <path d={GT.plate} strokeOpacity={0.2} strokeDasharray="2 3" />
          <path d={GT.hidden} strokeOpacity={0.18} strokeDasharray="2 3" />
          <path d={GT.py} strokeDasharray="4 2" />
          <path d={GT.px} strokeDasharray="4 2" />
          <path d={GT.top} strokeDasharray="4 2" />
          <path d={GT.fins} strokeOpacity={0.2} />
          <path d={GT.shaft} />
          <path d={GT.rim} stroke={C.indigoHi} />
          <path ref={st} d={init.st} stroke={C.indigoHi} />
        </g>
        <circle
          ref={glow}
          cx={r1(GT.sensor[0])}
          cy={r1(GT.sensor[1])}
          r={3}
          fill={C.ice}
          fillOpacity={r1(0.2 + init.glow * 0.8)}
        />

        {/* telemetry link */}
        <path
          d={`M${r1(LA[0])} ${LA[1]}Q${LC[0]} ${LC[1]} ${r1(LB[0])} ${LB[1]}`}
          stroke={C.ice}
          strokeOpacity={0.3}
          strokeDasharray="1 4"
        />
        {init.packets.map((p, i) => (
          <rect
            key={i}
            ref={(el) => {
              pk.current[i] = el;
            }}
            x={-2.5}
            y={-2.5}
            width={5}
            height={5}
            fill={C.iceHi}
            transform={`translate(${r1(p[0])} ${r1(p[1])})`}
          />
        ))}
      </g>

      {/* labels */}
      <g
        fontFamily={MONO}
        fontSize={9}
        fill={C.ice}
        fillOpacity={0.6}
        textAnchor="middle"
      >
        <text x={r1(200 + (PHYS.ox + 18 - 180) * 1.17)} y={222}>
          {L.physical}
        </text>
        <text x={r1(200 + (TWIN.ox + 18 - 180) * 1.17)} y={222}>
          {L.twin}
        </text>
      </g>
      <g
        fontFamily={MONO}
        fontSize={9}
        fill={C.ice}
        fillOpacity={hot ? 0.9 : 0.6}
        textAnchor="end"
        className="transition-[fill-opacity] duration-500"
      >
        <text ref={rpm} x={384} y={28}>
          {`${init.rpm} ${L.rpmUnit}`}
        </text>
        <text x={384} y={41}>
          {L.sync}
        </text>
      </g>
    </svg>
  );
}
