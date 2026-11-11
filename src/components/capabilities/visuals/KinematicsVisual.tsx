"use client";

import { useMemo, useRef } from "react";
import {
  C,
  MONO,
  SVG_PROPS,
  T0,
  clamp,
  linePath,
  r1,
  useVisualLoop,
  type VisualProps,
} from "./engine";

/** Planar 3-link arm solving analytic 2-link IK toward a moving target. */
const B = { x: 124, y: 198 };
const L1 = 102;
const L2 = 86;
const L3 = 22;

function target(t: number) {
  return {
    x: 232 + 62 * Math.sin(t * 0.55),
    y: 110 + 36 * Math.sin(t * 1.1 + 0.6),
  };
}

function solve(t: number) {
  const p = target(t);
  let dx = p.x - B.x;
  let dy = p.y - B.y;
  let d = Math.hypot(dx, dy);
  const max = L1 + L2 + L3 - 6;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  // wrist point sits L3 "above" the tool tip; tool tilts slowly
  const a3 = 1.15 + 0.3 * Math.sin(t * 0.8);
  const wx = B.x + dx - L3 * Math.cos(a3);
  const wy = B.y + dy - L3 * Math.sin(a3);
  const ex = wx - B.x;
  const ey = wy - B.y;
  const dw = Math.min(Math.hypot(ex, ey), L1 + L2 - 1);
  const c2 = clamp((dw * dw - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
  const q2 = Math.acos(c2); // elbow-up in y-down space
  const q1 =
    Math.atan2(ey, ex) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
  const e = { x: B.x + L1 * Math.cos(q1), y: B.y + L1 * Math.sin(q1) };
  const w = {
    x: e.x + L2 * Math.cos(q1 + q2),
    y: e.y + L2 * Math.sin(q1 + q2),
  };
  const tip = { x: w.x + L3 * Math.cos(a3), y: w.y + L3 * Math.sin(a3) };
  return { q1, q2, a3, e, w, tip, p };
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${r1(cx + r * Math.cos(a0))} ${r1(cy + r * Math.sin(a0))}A${r} ${r} 0 ${large} ${sweep} ${r1(cx + r * Math.cos(a1))} ${r1(cy + r * Math.sin(a1))}`;
}

const deg = (a: number) => ((a * 180) / Math.PI).toFixed(1).padStart(6, " ");

function frame(t: number) {
  const s = solve(t);
  const trail: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const p = solve(t - i * 0.07).tip;
    trail.push([p.x, p.y]);
  }
  const ext = 28;
  return {
    links: linePath([
      [B.x, B.y],
      [s.e.x, s.e.y],
      [s.w.x, s.w.y],
      [s.tip.x, s.tip.y],
    ]),
    a1: arc(B.x, B.y, 26, 0, s.q1),
    a2: arc(s.e.x, s.e.y, 18, s.q1, s.q1 + s.q2),
    ref2: linePath([
      [s.e.x, s.e.y],
      [s.e.x + ext * Math.cos(s.q1), s.e.y + ext * Math.sin(s.q1)],
    ]),
    trail: linePath(trail),
    e: s.e,
    w: s.w,
    tip: s.tip,
    p: s.p,
    t1: `θ1 ${deg(-s.q1)}°`,
    t2: `θ2 ${deg(-s.q2)}°`,
    t3: `θ3 ${deg(-(s.a3 - s.q1 - s.q2))}°`,
  };
}

export function KinematicsVisual(props: VisualProps) {
  const links = useRef<SVGPathElement>(null);
  const linksWide = useRef<SVGPathElement>(null);
  const a1 = useRef<SVGPathElement>(null);
  const a2 = useRef<SVGPathElement>(null);
  const ref2 = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const je = useRef<SVGCircleElement>(null);
  const jw = useRef<SVGCircleElement>(null);
  const tip = useRef<SVGGElement>(null);
  const tgt = useRef<SVGGElement>(null);
  const t1 = useRef<SVGTextElement>(null);
  const t2 = useRef<SVGTextElement>(null);
  const t3 = useRef<SVGTextElement>(null);

  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    links.current?.setAttribute("d", f.links);
    linksWide.current?.setAttribute("d", f.links);
    a1.current?.setAttribute("d", f.a1);
    a2.current?.setAttribute("d", f.a2);
    ref2.current?.setAttribute("d", f.ref2);
    trail.current?.setAttribute("d", f.trail);
    je.current?.setAttribute("cx", String(r1(f.e.x)));
    je.current?.setAttribute("cy", String(r1(f.e.y)));
    jw.current?.setAttribute("cx", String(r1(f.w.x)));
    jw.current?.setAttribute("cy", String(r1(f.w.y)));
    tip.current?.setAttribute(
      "transform",
      `translate(${r1(f.tip.x)} ${r1(f.tip.y)})`,
    );
    tgt.current?.setAttribute(
      "transform",
      `translate(${r1(f.p.x)} ${r1(f.p.y)})`,
    );
    if (t1.current) t1.current.textContent = f.t1;
    if (t2.current) t2.current.textContent = f.t2;
    if (t3.current) t3.current.textContent = f.t3;
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* reach envelope + base joint range */}
      <path
        d={arc(B.x, B.y, L1 + L2 + L3, Math.PI, 2 * Math.PI)}
        stroke={C.ice}
        strokeOpacity={0.14}
        strokeDasharray="2 5"
      />
      <path
        d={arc(B.x, B.y, 40, Math.PI, 2 * Math.PI)}
        stroke={C.ice}
        strokeOpacity={0.22}
        strokeDasharray="1 3"
      />
      {/* ground */}
      <path d={`M16 ${B.y + 14}H384`} stroke={C.ice} strokeOpacity={0.25} />
      {Array.from({ length: 23 }, (_, i) => (
        <path
          key={i}
          d={`M${24 + i * 16} ${B.y + 14}l-7 7`}
          stroke={C.ice}
          strokeOpacity={0.1}
        />
      ))}
      <path
        d={`M${B.x - 24} ${B.y + 14}L${B.x - 14} ${B.y - 5}H${B.x + 14}L${B.x + 24} ${B.y + 14}Z`}
        fill={C.indigoLo}
        stroke={C.ice}
        strokeOpacity={0.4}
      />

      {/* end-effector trail */}
      <path
        ref={trail}
        d={init.trail}
        stroke={C.indigoHi}
        strokeDasharray="1.5 3"
        className="transition-[stroke-opacity] duration-500"
        strokeOpacity={hot ? 0.75 : 0.4}
      />

      {/* links */}
      <path
        ref={linksWide}
        d={init.links}
        stroke={C.indigo}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.55}
      />
      <path
        ref={links}
        d={init.links}
        stroke={C.ice}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeOpacity={0.9}
      />

      {/* joint angle arcs */}
      <path ref={a1} d={init.a1} stroke={C.iceHi} strokeOpacity={0.7} />
      <path
        ref={ref2}
        d={init.ref2}
        stroke={C.ice}
        strokeOpacity={0.3}
        strokeDasharray="2 2"
      />
      <path ref={a2} d={init.a2} stroke={C.iceHi} strokeOpacity={0.7} />

      {/* joints */}
      <circle
        cx={B.x}
        cy={B.y}
        r={7}
        fill={C.bg}
        stroke={C.ice}
        strokeOpacity={0.9}
      />
      <circle cx={B.x} cy={B.y} r={2} fill={C.ice} />
      <circle
        ref={je}
        cx={r1(init.e.x)}
        cy={r1(init.e.y)}
        r={6}
        fill={C.bg}
        stroke={C.ice}
        strokeOpacity={0.9}
      />
      <circle
        ref={jw}
        cx={r1(init.w.x)}
        cy={r1(init.w.y)}
        r={4.5}
        fill={C.bg}
        stroke={C.ice}
        strokeOpacity={0.9}
      />
      <g ref={tip} transform={`translate(${r1(init.tip.x)} ${r1(init.tip.y)})`}>
        <circle r={2.6} fill={C.iceHi} />
      </g>

      {/* target */}
      <g ref={tgt} transform={`translate(${r1(init.p.x)} ${r1(init.p.y)})`}>
        <circle r={8} stroke={C.accent} strokeOpacity={0.9} />
        <path
          d="M-14 0h8M6 0h8M0 -14v8M0 6v8"
          stroke={C.accent}
          strokeOpacity={0.9}
        />
      </g>

      {/* joint readouts (illustrative) */}
      <g
        fontFamily={MONO}
        fontSize={10}
        fill={C.ice}
        textAnchor="end"
        className="transition-[fill-opacity] duration-500"
        fillOpacity={hot ? 0.95 : 0.6}
        style={{ whiteSpace: "pre" }}
      >
        <text ref={t1} x={384} y={30}>
          {init.t1}
        </text>
        <text ref={t2} x={384} y={45}>
          {init.t2}
        </text>
        <text ref={t3} x={384} y={60}>
          {init.t3}
        </text>
      </g>
      <text
        x={B.x + 32}
        y={B.y + 4}
        fontFamily={MONO}
        fontSize={9}
        fill={C.ice}
        fillOpacity={0.45}
      >
        J1
      </text>
    </svg>
  );
}
