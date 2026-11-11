"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, clamp, hash, r1, smooth, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";
import type { VisualText } from "@/i18n/types";

type Labels = VisualText["slam"];

/**
 * Top-down SLAM. A quadcopter flies a loop through an unknown floor plan; a
 * rotating LiDAR fan raycasts the true walls and the hits are written into the
 * map in the drone's *estimated* frame, which slowly drifts. Keyframes form a
 * pose graph. Back at the start, a loop closure is detected and the graph is
 * optimised: trajectory and map snap onto the true geometry.
 * The reveal order of every map point is raycast once at module load.
 */

type Seg = readonly [number, number, number, number];
const box = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
  [x0, y0, x1, y0],
  [x1, y0, x1, y1],
  [x1, y1, x0, y1],
  [x0, y1, x0, y0],
];
const WALLS: Seg[] = [
  ...box(12, 14, 388, 226),
  // inner block with a loading-bay notch on its south face
  [72, 74, 328, 74],
  [328, 74, 328, 166],
  [328, 166, 220, 166],
  [220, 166, 220, 152],
  [220, 152, 190, 152],
  [190, 152, 190, 166],
  [190, 166, 72, 166],
  [72, 166, 72, 74],
  // partition stubs + pillars
  [250, 14, 250, 30],
  [150, 226, 150, 210],
  [12, 104, 24, 104],
  ...box(100, 20, 107, 27),
  ...box(371, 100, 379, 108),
  ...box(262, 205, 270, 213),
];
const WALL_D = WALLS.map((w) => `M${w[0]} ${w[1]}L${w[2]} ${w[3]}`).join("");

const RANGE = 92;
function cast(ox: number, oy: number, a: number): [number, number] | null {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = RANGE;
  for (const [x0, y0, x1, y1] of WALLS) {
    const ex = x1 - x0;
    const ey = y1 - y0;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = x0 - ox;
    const qy = y0 - oy;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best < RANGE ? [ox + dx * best, oy + dy * best] : null;
}

/* ---- flight path: rounded loop along the corridor centre line, arc-length resampled ---- */
const N = 720;
const PATH: [number, number][] = (() => {
  const L = 42;
  const R = 358;
  const T = 44;
  const B = 196;
  const rr = 24;
  const dense: [number, number][] = [];
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i < n; i++) dense.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i < 24; i++) {
      const a = a0 + (i / 24) * (Math.PI / 2);
      dense.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  };
  line(L, 150, L, T + rr);
  corner(L + rr, T + rr, Math.PI);
  line(L + rr, T, R - rr, T);
  corner(R - rr, T + rr, -Math.PI / 2);
  line(R, T + rr, R, B - rr);
  corner(R - rr, B - rr, 0);
  line(R - rr, B, L + rr, B);
  corner(L + rr, B - rr, Math.PI / 2);
  line(L, B - rr, L, 150);
  dense.push([L, 150]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++)
    acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = acc[acc.length - 1];
  const out: [number, number][] = [];
  let j = 0;
  for (let k = 0; k <= N; k++) {
    const d = (k / N) * total;
    while (j < dense.length - 2 && acc[j + 1] < d) j++;
    const f = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f]);
  }
  // gentle lateral weave; zero at both ends so the loop closes
  return out.map((p, k) => {
    const a = out[Math.max(0, k - 1)];
    const b = out[Math.min(N, k + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const w = 4 * Math.sin((k / N) * Math.PI * 2 * 4);
    return [p[0] - ((b[1] - a[1]) / tl) * w, p[1] + ((b[0] - a[0]) / tl) * w];
  });
})();

function pose(s: number) {
  const f = clamp(s, 0, 1) * N;
  const i = Math.min(N - 1, Math.floor(f));
  const u = f - i;
  const a = PATH[i];
  const b = PATH[i + 1];
  const a0 = PATH[Math.max(0, i - 3)];
  const b0 = PATH[Math.min(N, i + 4)];
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, h: Math.atan2(b0[1] - a0[1], b0[0] - a0[0]) };
}

/* ---- timing ---- */
const FLY = 12; // seconds of flight
const DETECT = 12.7;
const OPT = 14.0;
const FADE = 16.4;
const P = 17;
const OFFSET = 12.6; // static frame (T0) lands in the corrected hold
const OMEGA = (Math.PI * 2) / 1.15; // LiDAR fan rotation
const FAN = (36 * Math.PI) / 180;

/* ---- drift model: rotation about the start + translation, growing with distance flown ---- */
const P0 = PATH[0];
const DRIFT_A = 0.05;
const DRIFT_T = [14, -10] as const;
const growth = (s: number) => Math.pow(clamp(s, 0, 1), 1.5);
function warp(x: number, y: number, g: number): [number, number] {
  const a = DRIFT_A * g;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - P0[0];
  const dy = y - P0[1];
  return [P0[0] + c * dx - s * dy + DRIFT_T[0] * g, P0[1] + s * dx + c * dy + DRIFT_T[1] * g];
}

/* ---- map points: first observation per 3-unit cell; a later pass re-adds it (loop overlap) ---- */
type MapPt = { x: number; y: number; s: number; g: number };
const MAP: MapPt[] = (() => {
  const seen = new Map<string, number>();
  const pts: MapPt[] = [];
  const steps = FLY * 30;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * FLY;
    const s = t / FLY;
    const p = pose(s);
    for (let r = 0; r < 13; r++) {
      const hit = cast(p.x, p.y, t * OMEGA - FAN + (r / 12) * 2 * FAN);
      if (!hit) continue;
      const key = `${Math.round(hit[0] / 3)},${Math.round(hit[1] / 3)}`;
      const prev = seen.get(key);
      if (prev === undefined || s - prev > 0.5) {
        seen.set(key, s);
        pts.push({ x: hit[0], y: hit[1], s, g: growth(s) });
      }
    }
  }
  return pts;
})();

const KF = 26;
const fmt = (v: number, w: number, d = 2) => {
  const a = Math.abs(v).toFixed(d);
  return ((Number(a) === 0 || v >= 0 ? "+" : "−") + a).padStart(w, " ");
};
const group3 = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function frame(t: number, L: Labels) {
  const tl = (((t + OFFSET) % P) + P) % P;
  const s = clamp(tl / FLY, 0, 1);
  const c = smooth(clamp((tl - DETECT) / (OPT - DETECT), 0, 1)); // optimisation progress
  const fade = 1 - smooth(clamp((tl - FADE) / (P - FADE), 0, 1));
  const keep = 1 - c;
  const truth = pose(s);
  const hover = tl > FLY ? Math.sin(tl * 2.2) * 1.2 : 0;

  // map points, split by layer
  let base = "";
  let drift = "";
  let fresh = "";
  let count = 0;
  for (const m of MAP) {
    if (m.s > s) break;
    count++;
    const [x, y] = warp(m.x, m.y, m.g * keep);
    const d = `M${r1(x)} ${r1(y)}h0`;
    if (tl < FLY && (s - m.s) * FLY < 0.35) fresh += d;
    else if (m.g > 0.42) drift += d;
    else base += d;
  }

  // pose graph
  const g = growth(s) * keep;
  const nodes: [number, number][] = [];
  const nk = Math.floor(s * KF + 1e-6);
  for (let i = 0; i <= nk; i++) {
    const q = pose(i / KF);
    nodes.push(warp(q.x, q.y, growth(i / KF) * keep));
  }
  const est = warp(truth.x, truth.y, g);
  let edges = "";
  for (let i = 0; i < nodes.length; i++) edges += (i ? "L" : "M") + r1(nodes[i][0]) + " " + r1(nodes[i][1]);
  edges += `L${r1(est[0])} ${r1(est[1])}`;
  let dots = "";
  for (const [x, y] of nodes) dots += `M${r1(x - 2.4)} ${r1(y)}a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0`;

  // LiDAR fan from the true drone position
  const phi = tl * OMEGA;
  const tx = truth.x;
  const ty = truth.y + hover;
  let fan = `M${r1(tx)} ${r1(ty)}`;
  let rays = "";
  let hits = "";
  for (let r = 0; r < 9; r++) {
    const a = phi - FAN + (r / 8) * 2 * FAN;
    const h = cast(tx, ty, a);
    const e = h ?? [tx + Math.cos(a) * RANGE, ty + Math.sin(a) * RANGE];
    fan += `L${r1(e[0])} ${r1(e[1])}`;
    rays += `M${r1(tx)} ${r1(ty)}L${r1(e[0])} ${r1(e[1])}`;
    if (h) hits += `M${r1(h[0])} ${r1(h[1])}h0`;
  }
  fan += "Z";

  const theta = -(truth.h + DRIFT_A * g);
  const err = Math.hypot(est[0] - truth.x, est[1] - truth.y) / 12;
  const phase = tl < FLY ? 0 : tl < DETECT ? 1 : tl < OPT ? 2 : 3;

  return {
    base,
    drift,
    fresh,
    edges,
    dots,
    fan,
    rays,
    hits,
    fade,
    est,
    ell: { rx: 3 + 10 * g, ry: 2 + 5 * g, a: (truth.h * 180) / Math.PI },
    drone: `translate(${r1(tx)} ${r1(ty)}) rotate(${r1((truth.h * 180) / Math.PI)})`,
    rotor: r1((tl * 90) % 20),
    closure: phase === 1 || phase === 2,
    closureD: `M${r1(est[0])} ${r1(est[1])}L${r1(nodes[0][0])} ${r1(nodes[0][1])}`,
    corrected: c > 0.55,
    px: `x ${fmt((est[0] - P0[0]) / 12, 6)} ${L.unit}`,
    py: `y ${fmt((P0[1] - est[1]) / 12, 6)} ${L.unit}`,
    pt: `θ ${fmt(((theta * 180) / Math.PI + 540) % 360 - 180, 6, 1)}°`,
    kf: `${L.keyframe} ${String(nodes.length).padStart(2, "0")}`,
    pts: `${L.points} ${group3(count * 23 + Math.floor(hash(count) * 23))}`.padEnd(L.points.length + 8, " "),
    err: `${L.drift} ${err.toFixed(2)} ${L.unit}`,
    errHi: err > 0.6,
    phase,
  };
}


export function SlamVisual(props: VisualProps) {
  const base = useRef<SVGPathElement>(null);
  const drift = useRef<SVGPathElement>(null);
  const fresh = useRef<SVGPathElement>(null);
  const edges = useRef<SVGPathElement>(null);
  const dots = useRef<SVGPathElement>(null);
  const fan = useRef<SVGPathElement>(null);
  const rays = useRef<SVGPathElement>(null);
  const hits = useRef<SVGPathElement>(null);
  const map = useRef<SVGGElement>(null);
  const ell = useRef<SVGEllipseElement>(null);
  const cur = useRef<SVGCircleElement>(null);
  const drone = useRef<SVGGElement>(null);
  const rotors = useRef<SVGGElement>(null);
  const closure = useRef<SVGPathElement>(null);
  const px = useRef<SVGTextElement>(null);
  const py = useRef<SVGTextElement>(null);
  const pt = useRef<SVGTextElement>(null);
  const kf = useRef<SVGTextElement>(null);
  const pts = useRef<SVGTextElement>(null);
  const err = useRef<SVGTextElement>(null);
  const status = useRef<SVGTextElement>(null);

  const L = useT().visuals.slam;
  const init = useMemo(() => frame(T0, L), [L]);

  useVisualLoop((t) => {
    const f = frame(t, L);
    base.current?.setAttribute("d", f.base);
    drift.current?.setAttribute("d", f.drift);
    fresh.current?.setAttribute("d", f.fresh);
    edges.current?.setAttribute("d", f.edges);
    dots.current?.setAttribute("d", f.dots);
    fan.current?.setAttribute("d", f.fan);
    rays.current?.setAttribute("d", f.rays);
    hits.current?.setAttribute("d", f.hits);
    if (map.current) map.current.style.opacity = String(r1(f.fade * 100) / 100);
    if (drift.current) drift.current.style.stroke = f.corrected ? C.ice : C.accent;
    ell.current?.setAttribute("transform", `translate(${r1(f.est[0])} ${r1(f.est[1])}) rotate(${r1(f.ell.a)})`);
    ell.current?.setAttribute("rx", String(r1(f.ell.rx)));
    ell.current?.setAttribute("ry", String(r1(f.ell.ry)));
    cur.current?.setAttribute("cx", String(r1(f.est[0])));
    cur.current?.setAttribute("cy", String(r1(f.est[1])));
    drone.current?.setAttribute("transform", f.drone);
    rotors.current?.setAttribute("stroke-dashoffset", String(f.rotor));
    if (closure.current) {
      closure.current.setAttribute("d", f.closureD);
      closure.current.style.opacity = f.closure ? "1" : "0";
      closure.current.style.stroke = f.phase === 2 ? C.iceHi : C.accent;
    }
    if (px.current) px.current.textContent = f.px;
    if (py.current) py.current.textContent = f.py;
    if (pt.current) pt.current.textContent = f.pt;
    if (kf.current) kf.current.textContent = f.kf;
    if (pts.current) pts.current.textContent = f.pts;
    if (err.current) {
      err.current.textContent = f.err;
      err.current.style.fill = f.errHi ? C.accent : C.ice;
    }
    if (status.current) {
      status.current.textContent = L.status[f.phase];
      status.current.style.fill = f.phase === 1 || f.phase === 2 ? C.accent : f.phase === 3 ? C.iceHi : C.ice;
      status.current.style.fillOpacity = f.phase === 0 ? "0.55" : "0.95";
    }
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* occupancy grid */}
      <g stroke={C.ice} strokeOpacity={0.05}>
        {Array.from({ length: 19 }, (_, i) => (
          <path key={`v${i}`} d={`M${12 + (i + 1) * 20} 14V226`} />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`h${i}`} d={`M12 ${14 + (i + 1) * 20}H388`} />
        ))}
      </g>

      {/* ground truth (unknown to the robot): ghosted */}
      <path
        d={WALL_D}
        stroke={C.indigoHi}
        strokeOpacity={hot ? 0.16 : 0.1}
        className="transition-[stroke-opacity] duration-500"
      />

      {/* LiDAR fan */}
      <path ref={fan} d={init.fan} fill={C.indigo} fillOpacity={hot ? 0.26 : 0.18} className="transition-[fill-opacity] duration-500" />
      <path ref={rays} d={init.rays} stroke={C.ice} strokeOpacity={0.16} strokeWidth={0.6} />

      <g ref={map} style={{ opacity: init.fade }}>
        {/* point map */}
        <path
          ref={base}
          d={init.base}
          stroke={C.ice}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeOpacity={hot ? 0.85 : 0.65}
          className="transition-[stroke-opacity] duration-500"
        />
        <path
          ref={drift}
          d={init.drift}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeOpacity={hot ? 0.95 : 0.8}
          style={{ stroke: init.corrected ? C.ice : C.accent, transition: "stroke 500ms, stroke-opacity 500ms" }}
        />
        <path ref={fresh} d={init.fresh} stroke={C.iceHi} strokeWidth={2.4} strokeLinecap="round" />

        {/* pose graph */}
        <path ref={edges} d={init.edges} stroke={C.indigoHi} strokeOpacity={hot ? 0.85 : 0.6} strokeLinejoin="round" className="transition-[stroke-opacity] duration-500" />
        <path
          ref={closure}
          d={init.closureD}
          strokeWidth={1.4}
          strokeDasharray="3 2"
          style={{ opacity: init.closure ? 1 : 0, stroke: init.phase === 2 ? C.iceHi : C.accent, transition: "opacity 300ms" }}
        />
        <path ref={dots} d={init.dots} fill={C.bg} stroke={C.ice} strokeOpacity={0.85} strokeWidth={0.9} />
        <ellipse
          ref={ell}
          rx={r1(init.ell.rx)}
          ry={r1(init.ell.ry)}
          transform={`translate(${r1(init.est[0])} ${r1(init.est[1])}) rotate(${r1(init.ell.a)})`}
          stroke={C.accent}
          strokeOpacity={0.9}
          fill={C.burgundy}
          fillOpacity={0.22}
        />
        <circle ref={cur} cx={r1(init.est[0])} cy={r1(init.est[1])} r={2} fill={C.accent} />
      </g>

      <path ref={hits} d={init.hits} stroke={C.iceHi} strokeWidth={2.6} strokeLinecap="round" />

      {/* quadcopter (true pose) */}
      <g ref={drone} transform={init.drone}>
        <path d="M-7 -7L7 7M7 -7L-7 7" stroke={C.ice} strokeWidth={1.4} />
        <g ref={rotors} stroke={C.ice} strokeOpacity={0.9} strokeDasharray="6 4" strokeDashoffset={init.rotor} fill={C.bg} fillOpacity={0.6}>
          <circle cx={-7} cy={-7} r={4.4} />
          <circle cx={7} cy={-7} r={4.4} />
          <circle cx={7} cy={7} r={4.4} />
          <circle cx={-7} cy={7} r={4.4} />
        </g>
        <rect x={-3.5} y={-3.5} width={7} height={7} fill={C.iceHi} />
        <path d="M5 -2.5L9.5 0L5 2.5Z" fill={C.iceHi} />
      </g>

      {/* HUD inside the (solid) inner block */}
      <g fontFamily={MONO} style={{ whiteSpace: "pre" }}>
        <text x={84} y={91} fontSize={9} fill={C.ice} fillOpacity={0.5}>
          {L.heading}
        </text>
        <text ref={kf} x={316} y={91} fontSize={9} fill={C.ice} fillOpacity={0.5} textAnchor="end">
          {init.kf}
        </text>
        <g fontSize={10} fill={C.ice} className="transition-[fill-opacity] duration-500" fillOpacity={hot ? 0.95 : 0.75}>
          <text ref={px} x={84} y={109}>
            {init.px}
          </text>
          <text ref={py} x={162} y={109}>
            {init.py}
          </text>
          <text ref={pt} x={240} y={109}>
            {init.pt}
          </text>
          <text ref={pts} x={84} y={125}>
            {init.pts}
          </text>
          <text ref={err} x={316} y={125} textAnchor="end" style={{ fill: init.errHi ? C.accent : C.ice }}>
            {init.err}
          </text>
        </g>
        <path d="M84 133H316" stroke={C.ice} strokeOpacity={0.15} />
        <text
          ref={status}
          x={84}
          y={146}
          fontSize={10}
          style={{
            fill: init.phase === 1 || init.phase === 2 ? C.accent : init.phase === 3 ? C.iceHi : C.ice,
            fillOpacity: init.phase === 0 ? 0.55 : 0.95,
          }}
        >
          {L.status[init.phase]}
        </text>
      </g>
    </svg>
  );
}
