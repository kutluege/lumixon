"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * A rotating geodesic sphere, split by a sweeping render boundary:
 * wireframe on the left, Lambert + Blinn-Phong shaded faces on the right.
 * Pure SVG: 80 polygons, attributes updated in place.
 */
type V = [number, number, number];

function icosphere(): { verts: V[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: V[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const norm = (v: V): V => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  for (let i = 0; i < verts.length; i++) verts[i] = norm(verts[i]);
  const cache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const va = verts[a];
    const vb = verts[b];
    verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]));
    cache.set(key, verts.length - 1);
    return verts.length - 1;
  };
  const next: [number, number, number][] = [];
  for (const [a, b, c] of faces) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  faces = next;
  return { verts, faces };
}

const MESH = icosphere();
const CX = 200;
const CY = 120;
const R = 80;
const LIGHT = (() => {
  const l: V = [-0.45, -0.6, 0.66];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n] as V;
})();
const HALF = (() => {
  const h: V = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const n = Math.hypot(...h);
  return [h[0] / n, h[1] / n, h[2] / n] as V;
})();

// shading ramp: indigo-900 → indigo → ice
const RAMP: V[] = [
  [0x1c, 0x1e, 0x38],
  [0x4e, 0x52, 0x83],
  [0xaf, 0xc1, 0xd6],
];
function shade(x: number, spec: number) {
  const s = Math.max(0, Math.min(1, x));
  const [a, b, u] = s < 0.6 ? [RAMP[0], RAMP[1], s / 0.6] : [RAMP[1], RAMP[2], (s - 0.6) / 0.4];
  const c = [0, 1, 2].map((i) => Math.round(Math.min(255, a[i] + (b[i] - a[i]) * u + spec * 120)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

type Face = { pts: string; fill: string; mode: 0 | 1 | 2 }; // 0 hidden, 1 wire, 2 shaded

function frame(t: number) {
  const yaw = t * 0.5;
  const pitch = 0.38 + 0.12 * Math.sin(t * 0.3);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const P = MESH.verts.map(([x, y, z]) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const k = 1 / (1 - z2 * 0.12);
    return [CX + x1 * R * k, CY + y2 * R * k, z2] as V;
  });
  const split = CX + 104 * Math.sin(t * 0.42 + 2.2);
  const faces: Face[] = MESH.faces.map(([a, b, c]) => {
    const A = P[a];
    const B = P[b];
    const Cc = P[c];
    const front = A[2] + B[2] + Cc[2] > 0; // convex sphere: centroid faces the viewer
    const pts = `${r1(A[0])},${r1(A[1])} ${r1(B[0])},${r1(B[1])} ${r1(Cc[0])},${r1(Cc[1])}`;
    const cx = (A[0] + B[0] + Cc[0]) / 3;
    if (cx < split) return { pts, fill: "none", mode: front ? 1 : 0 };
    if (!front) return { pts, fill: "none", mode: 0 };
    // normal from rotated verts (unit sphere ⇒ centroid direction)
    const nx = (A[0] + B[0] + Cc[0]) / 3 - CX;
    const ny = (A[1] + B[1] + Cc[1]) / 3 - CY;
    const nz = ((A[2] + B[2] + Cc[2]) / 3) * R;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const n: V = [nx / nl, ny / nl, nz / nl];
    const diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const spec = Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), 24);
    return { pts, fill: shade(0.12 + diff * 0.9, spec), mode: 2 };
  });
  return { faces, split };
}

export function MeshVisual(props: VisualProps) {
  const L = useT().visuals.mesh;
  const polys = useRef<(SVGPolygonElement | null)[]>([]);
  const divider = useRef<SVGGElement>(null);
  const init = useMemo(() => frame(T0), []);
  const hot = props.hot;

  useVisualLoop((t) => {
    const f = frame(t);
    f.faces.forEach((fc, i) => {
      const el = polys.current[i];
      if (!el) return;
      el.setAttribute("points", fc.pts);
      el.setAttribute("fill", fc.fill);
      el.setAttribute("stroke", fc.mode === 2 ? C.indigoLo : C.ice);
      el.setAttribute("stroke-opacity", fc.mode === 0 ? "0" : fc.mode === 2 ? "0.5" : "0.55");
    });
    divider.current?.setAttribute("transform", `translate(${r1(f.split)} 0)`);
  }, props);

  return (
    <svg {...SVG_PROPS}>
      <ellipse cx={CX} cy={214} rx={74} ry={6} fill={C.indigo} fillOpacity={0.22} />
      <g strokeLinejoin="round" strokeWidth={0.7}>
        {init.faces.map((fc, i) => (
          <polygon
            key={i}
            ref={(el) => {
              polys.current[i] = el;
            }}
            points={fc.pts}
            fill={fc.fill}
            stroke={fc.mode === 2 ? C.indigoLo : C.ice}
            strokeOpacity={fc.mode === 0 ? 0 : fc.mode === 2 ? 0.5 : 0.55}
          />
        ))}
      </g>
      <g ref={divider} transform={`translate(${r1(init.split)} 0)`}>
        <path d="M0 24V216" stroke={C.ice} strokeOpacity={hot ? 0.8 : 0.5} strokeDasharray="2 3" className="transition-[stroke-opacity] duration-500" />
        <g fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.7}>
          <text x={-6} y={30} textAnchor="end">
            {L.wireframe}
          </text>
          <text x={6} y={30}>
            PBR
          </text>
        </g>
      </g>
      <g fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.45}>
        <text x={16} y={228}>{L.stats}</text>
        <text x={388} y={228} textAnchor="end">
          Lambert + Blinn-Phong
        </text>
      </g>
      <path d="M48 52l14 10" stroke={C.ice} strokeOpacity={0.4} />
      <circle cx={44} cy={49} r={4} stroke={C.ice} strokeOpacity={0.5} />
    </svg>
  );
}
