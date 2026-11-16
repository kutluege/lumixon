import { useId } from "react";
import {
  BASE_X,
  BASE_Z,
  CAMERA,
  DETECTIONS,
  fishAt,
  GRID_R,
  hash1,
  HEAD_Y,
  makeState,
  MOOR_X,
  MOOR_Z,
  PREDICT_GAP,
  PREDICT_LEN,
  RING_STEP,
  sonarState,
  STILL_T,
  T_FIRST,
} from "./timeline";

/*
 * Static still of the sonar scene, shown before the live canvas mounts,
 * without WebGL, or if the scene fails. Same conventions as FlankFallback:
 * a 400×300 (4:3) frame scaled with "xMidYMid slice", deterministic geometry
 * computed once at module load, every attribute pre-rounded so server and
 * client markup match. No three import: the layout is projected from the
 * scene's own timeline (the locked moment, STILL_T) with a pinhole camera a
 * little further back than the live one, so square panels crop sand, not
 * the tripod or the swimmer.
 */

const f = (n: number) => n.toFixed(1);
type P = { x: number; y: number };

const ICE = "#afc1d6";
const INDIGO = "#8d92c4";
const ALERT = "#cf4a80";

/* ── pinhole camera (matches SonarScene, 12 % further back) ─────────────── */
/** The composition is nudged left so the tripod clears the crop of a square panel. */
const SHIFT_X = -16;
const { project, scaleAt } = (() => {
  const [lx, ly, lz] = CAMERA.look;
  const dl = Math.hypot(...CAMERA.dir);
  const dist = CAMERA.dist * 1.12;
  const cx = lx + (CAMERA.dir[0] / dl) * dist;
  const cy = ly + (CAMERA.dir[1] / dl) * dist;
  const cz = lz + (CAMERA.dir[2] / dl) * dist;
  // forward, right (= forward × up), up (= right × forward)
  const fx = -CAMERA.dir[0] / dl;
  const fy = -CAMERA.dir[1] / dl;
  const fz = -CAMERA.dir[2] / dl;
  const rl = Math.hypot(fz, fx);
  const rx = -fz / rl;
  const rz = fx / rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const k = 150 / Math.tan((CAMERA.fov * Math.PI) / 360);
  const depth = (x: number, y: number, z: number) => (x - cx) * fx + (y - cy) * fy + (z - cz) * fz;
  return {
    project: (x: number, y: number, z: number): P => {
      const vx = x - cx;
      const vy = y - cy;
      const vz = z - cz;
      const d = depth(x, y, z);
      return { x: 200 + SHIFT_X + ((vx * rx + vz * rz) / d) * k, y: 150 - ((vx * ux + vy * uy + vz * uz) / d) * k };
    },
    /** Frame units per metre for something facing the camera at that point. */
    scaleAt: (x: number, y: number, z: number) => k / depth(x, y, z),
  };
})();

const path = (pts: P[], close = false) => pts.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`).join("") + (close ? "Z" : "");

/** Circle of radius r on the sand around (x, z), as a projected polygon. */
function ring(x: number, z: number, r: number, n = 72, a0 = 0, a1 = Math.PI * 2) {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(project(x + Math.cos(a) * r, 0, z + Math.sin(a) * r));
  }
  return pts;
}

/* ── polar plot on the sand ─────────────────────────────────────────────── */
const RINGS = [1, 2, 3].map((i) => path(ring(BASE_X, BASE_Z, i * RING_STEP, 96)));
const RIM = path(ring(BASE_X, BASE_Z, GRID_R, 120));
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return path([project(BASE_X + Math.cos(a) * 0.8, 0, BASE_Z + Math.sin(a) * 0.8), project(BASE_X + Math.cos(a) * GRID_R, 0, BASE_Z + Math.sin(a) * GRID_R)]);
}).join("");
const TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = (i * Math.PI) / 18;
  return path([project(BASE_X + Math.cos(a) * (GRID_R - 0.22), 0, BASE_Z + Math.sin(a) * (GRID_R - 0.22)), project(BASE_X + Math.cos(a) * GRID_R, 0, BASE_Z + Math.sin(a) * GRID_R)]);
}).join("");

/* ── the ping: a ring on the sand and its arc through the water ─────────── */
const PING_R = 3.9;
const PING = path(ring(BASE_X, BASE_Z, PING_R, 96));
const HEAD = project(BASE_X, HEAD_Y, BASE_Z);
const ARC = (() => {
  // Silhouette of the spherical wavefront: a circle about the head, upper part only.
  const edge = project(BASE_X - PING_R, HEAD_Y, BASE_Z);
  const r = Math.hypot(edge.x - HEAD.x, edge.y - HEAD.y);
  const pts: P[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI * (1.02 + (0.96 * i) / 48);
    pts.push({ x: HEAD.x + Math.cos(a) * r, y: HEAD.y + Math.sin(a) * r });
  }
  return path(pts);
})();

/* ── the locked moment ──────────────────────────────────────────────────── */
const S = sonarState(STILL_T, makeState());
const MID = project(S.mid.x, S.mid.y, S.mid.z);
const GROUND = project(S.mid.x, 0, S.mid.z);
const LOCK_RING = path(ring(S.mid.x, S.mid.z, 0.62, 48));
const LOCK_DASH = path(ring(S.mid.x, S.mid.z, 0.9, 48));
const NODES = DETECTIONS.filter((d) => d.tau <= STILL_T).map((d) => project(d.x, 0, d.z));
const TRACK = (() => {
  const s = makeState();
  const pts: P[] = [];
  for (let i = 0; i <= 40; i++) {
    sonarState(T_FIRST + ((STILL_T - T_FIRST) * i) / 40, s);
    pts.push(project(s.mid.x, 0, s.mid.z));
  }
  return path(pts);
})();
const AHEAD0 = project(S.mid.x + S.dir.x * PREDICT_GAP, 0, S.mid.z + S.dir.z * PREDICT_GAP);
const AHEAD1 = project(S.mid.x + S.dir.x * (PREDICT_GAP + PREDICT_LEN), 0, S.mid.z + S.dir.z * (PREDICT_GAP + PREDICT_LEN));
const AHEAD_RING = path(ring(S.mid.x + S.dir.x * (PREDICT_GAP + PREDICT_LEN + 0.16), S.mid.z + S.dir.z * (PREDICT_GAP + PREDICT_LEN + 0.16), 0.13, 16));
const BEARING = path([project(BASE_X, 0, BASE_Z), GROUND]);

/* ── the swimmer: side-on line-work, placed along the projected heading ──── */
const DIVER = (() => {
  const a = project(S.mid.x - S.dir.x, S.mid.y, S.mid.z - S.dir.z);
  const b = project(S.mid.x + S.dir.x, S.mid.y, S.mid.z + S.dir.z);
  // The side-on drawing already shows the body's length; half the projected lean is enough.
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 90) / Math.PI;
  const scale = scaleAt(S.mid.x, S.mid.y, S.mid.z) * 1.02;
  // Pelvis sits 0.3 m ahead of the middle; local units are metres, +x forward, +y down.
  return { transform: `translate(${f(MID.x)} ${f(MID.y)}) rotate(${f(angle)}) scale(${scale.toFixed(2)}) translate(0.3 0)` };
})();
const BRACKET = (() => {
  const w = 104;
  const h = 56;
  const c = 11;
  const x0 = MID.x - w / 2;
  const y0 = MID.y - h / 2 - 2;
  const x1 = x0 + w;
  const y1 = y0 + h;
  return (
    `M${f(x0)} ${f(y0 + c)}V${f(y0)}H${f(x0 + c)}M${f(x1 - c)} ${f(y0)}H${f(x1)}V${f(y0 + c)}` +
    `M${f(x1)} ${f(y1 - c)}V${f(y1)}H${f(x1 - c)}M${f(x0 + c)} ${f(y1)}H${f(x0)}V${f(y1 - c)}`
  );
})();

/* ── the sonar node ─────────────────────────────────────────────────────── */
const NODE = (() => {
  const feet = [0.35, 0.35 + (2 * Math.PI) / 3, 0.35 + (4 * Math.PI) / 3].map((a) => project(BASE_X + Math.cos(a) * 0.66, 0, BASE_Z + Math.sin(a) * 0.66));
  const hub = project(BASE_X, 0.58, BASE_Z);
  const neck = project(BASE_X, HEAD_Y - 0.22, BASE_Z);
  const bottom = project(BASE_X, HEAD_Y - 0.15, BASE_Z);
  const top = project(BASE_X, HEAD_Y + 0.17, BASE_Z);
  const side = project(BASE_X + 0.2, HEAD_Y, BASE_Z);
  const rx = side.x - HEAD.x;
  const ry = rx * 0.42;
  return {
    feet,
    hub,
    legs: feet.map((p) => `M${f(hub.x)} ${f(hub.y)}L${f(p.x)} ${f(p.y)}`).join(""),
    mast: `M${f(hub.x)} ${f(hub.y)}L${f(neck.x)} ${f(neck.y)}`,
    body: `M${f(bottom.x - rx)} ${f(bottom.y)}V${f(top.y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(top.x + rx)} ${f(top.y)}V${f(bottom.y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(bottom.x - rx)} ${f(bottom.y)}Z`,
    cap: { cx: f(top.x), cy: f(top.y), rx: f(rx), ry: f(ry) },
    staves: Array.from({ length: 7 }, (_, i) => {
      const x = bottom.x + rx * Math.sin(((i - 3) / 3.5) * (Math.PI / 2));
      const drop = ry * Math.sqrt(Math.max(0, 1 - ((x - bottom.x) / rx) ** 2));
      return `M${f(x)} ${f(top.y + drop + 1.2)}V${f(bottom.y + drop - 0.8)}`;
    }).join(""),
    shade: { cx: f(project(BASE_X, 0, BASE_Z).x), cy: f(project(BASE_X, 0, BASE_Z).y), rx: f(rx * 3.3), ry: f(rx * 1.25) },
  };
})();

/* ── clutter: a few fish near the mooring line, boulders, marine snow ───── */
const FISH = Array.from({ length: 9 }, (_, i) => {
  const p = { x: 0, y: 0, z: 0 };
  const q = { x: 0, y: 0, z: 0 };
  fishAt(i, STILL_T, p);
  fishAt(i, STILL_T + 0.35, q);
  const a = project(p.x, p.y, p.z);
  const b = project(q.x, q.y, q.z);
  const s = 0.75 + hash1(i * 2.9 + 0.7) * 0.5;
  return { transform: `translate(${f(a.x)} ${f(a.y)}) rotate(${f((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI)}) scale(${s.toFixed(2)})` };
});
const MOORING = (() => {
  const base = project(MOOR_X, 0.45, MOOR_Z);
  const top = project(MOOR_X + 0.3, 4.6, MOOR_Z - 0.15);
  const c = [-0.37, 0.37].flatMap((dx) => [-0.37, 0.37].map((dz) => project(MOOR_X + dx, 0, MOOR_Z + dz)));
  const t = [-0.37, 0.37].flatMap((dx) => [-0.37, 0.37].map((dz) => project(MOOR_X + dx, 0.4, MOOR_Z + dz)));
  return {
    chain: `M${f(base.x)} ${f(base.y)}L${f(top.x)} ${f(top.y)}`,
    block: path([c[0], c[1], c[3], t[3], t[2], t[0]], true),
    lid: path([t[0], t[1], t[3], t[2]], true),
  };
})();
const ROCKS = [
  [-3.25, 1.35, 0.56, 0.4],
  [-2.55, 1.85, 0.3, 0.22],
  [-0.2, 2.6, 0.3, 0.2],
  [4.35, -2.3, 0.44, 0.32],
].map(([x, z, r, h], k) => {
  // A faceted hump: half an ellipse above the sand, a shallow curve where it sits in it.
  const c = project(x, 0, z);
  const s = scaleAt(x, 0, z);
  const pts: P[] = [];
  for (let i = 0; i <= 7; i++) {
    const a = (i / 7) * Math.PI;
    const j = 0.82 + 0.3 * hash1(k * 11 + i);
    pts.push({ x: c.x + Math.cos(a) * r * s * (i === 0 || i === 7 ? 1 : j), y: c.y - Math.sin(a) * h * 1.5 * s * j });
  }
  pts.push({ x: c.x - r * s * 0.5, y: c.y + r * s * 0.24 }, { x: c.x + r * s * 0.5, y: c.y + r * s * 0.24 });
  return path(pts, true);
});
const SNOW = Array.from({ length: 46 }, (_, i) => ({
  x: f(30 + hash1(i * 1.3 + 0.2) * 340),
  y: f(24 + hash1(i * 2.1 + 0.9) * 210),
  r: (0.4 + hash1(i * 3.7 + 0.4) * 0.6).toFixed(1),
  o: (0.12 + hash1(i * 5.3 + 0.1) * 0.3).toFixed(2),
}));
const BUBBLES = [0, 1, 2, 3, 4].map((i) => ({
  x: f(MID.x + 30 + hash1(i * 4.1) * 6),
  y: f(MID.y - 16 - i * 6.5),
  r: (0.9 + i * 0.22).toFixed(1),
  o: (0.75 - i * 0.12).toFixed(2),
}));

export function SonarFallback() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fade = `${uid}-fade`;
  const mask = `${uid}-mask`;
  const sand = `${uid}-sand`;
  const glow = `${uid}-glow`;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
      <defs>
        {/* Fully transparent at ±156 from the centre line: inside the crop of a square panel. */}
        <radialGradient id={fade} cx="200" cy="158" r="156" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 158) scale(1 0.92) translate(0 -158)">
          <stop offset="0.52" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={mask}>
          <rect width="400" height="300" fill={`url(#${fade})`} />
        </mask>
        <radialGradient id={sand} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2e3559" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2e3559" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={glow} cx={f(GROUND.x)} cy={f(GROUND.y)} r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={ALERT} stopOpacity="0.3" />
          <stop offset="1" stopColor={ALERT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sand, polar plot, clutter: everything that melts into the page */}
      <g mask={`url(#${mask})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="205" cy="200" rx="200" ry="92" fill={`url(#${sand})`} />
        {ROCKS.map((d) => (
          <path key={d} d={d} fill="#2c3149" stroke={INDIGO} strokeOpacity={0.3} strokeWidth={0.6} />
        ))}
        <path d={MOORING.block} fill="#2a2f4c" stroke={INDIGO} strokeOpacity={0.35} strokeWidth={0.6} />
        <path d={MOORING.lid} fill="#343a5c" stroke={INDIGO} strokeOpacity={0.35} strokeWidth={0.6} />
        <path d={MOORING.chain} stroke={INDIGO} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="1.6 1.4" strokeLinecap="butt" />
        {RINGS.map((d) => (
          <path key={d} d={d} stroke={ICE} strokeOpacity={0.3} strokeWidth={0.7} />
        ))}
        <path d={RIM} stroke={ICE} strokeOpacity={0.42} strokeWidth={0.8} />
        <path d={SPOKES} stroke={ICE} strokeOpacity={0.2} strokeWidth={0.6} />
        <path d={TICKS} stroke={ICE} strokeOpacity={0.4} strokeWidth={0.6} />
        {/* the ping: wavefront on the sand and its arc in the water */}
        <path d={PING} stroke="#e6edf5" strokeOpacity={0.7} strokeWidth={0.9} />
        <path d={ARC} stroke={ICE} strokeOpacity={0.42} strokeWidth={0.9} />
        {SNOW.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={ICE} fillOpacity={p.o} />
        ))}
        {FISH.map((p, i) => (
          <path key={i} transform={p.transform} d="M5 0C3 -1.9 -1.8 -1.9 -3.8 0L-6.2 -1.9V1.9L-3.8 0C-1.8 1.9 3 1.9 5 0Z" fill={INDIGO} fillOpacity={0.85} />
        ))}
      </g>

      {/* the AI layer: track, measured bearing, predicted path, lock */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx={f(GROUND.x)} cy={f(GROUND.y)} r="22" fill={`url(#${glow})`} />
        <path d={BEARING} stroke={ALERT} strokeOpacity={0.28} strokeWidth={0.6} />
        <path d={TRACK} stroke={ALERT} strokeOpacity={0.85} strokeWidth={0.9} strokeDasharray="0.2 2.6" />
        {NODES.map((p, i) => (
          <g key={i}>
            <circle cx={f(p.x)} cy={f(p.y)} r="2.4" stroke={ALERT} strokeOpacity={0.9} strokeWidth={0.7} />
            <circle cx={f(p.x)} cy={f(p.y)} r="0.8" fill={ALERT} />
          </g>
        ))}
        <path d={LOCK_RING} stroke={ALERT} strokeWidth={1.3} />
        <path d={LOCK_DASH} stroke={ALERT} strokeOpacity={0.8} strokeWidth={1} strokeDasharray="5 3.4" strokeLinecap="butt" />
        <path d={`M${f(AHEAD0.x)} ${f(AHEAD0.y)}L${f(AHEAD1.x)} ${f(AHEAD1.y)}`} stroke={ALERT} strokeOpacity={0.85} strokeWidth={0.9} strokeDasharray="4 3.2" strokeLinecap="butt" />
        <path d={AHEAD_RING} stroke={ALERT} strokeOpacity={0.9} strokeWidth={0.9} />
        <path d={`M${f(MID.x)} ${f(MID.y + 5)}L${f(GROUND.x)} ${f(GROUND.y)}`} stroke={ALERT} strokeOpacity={0.7} strokeWidth={0.7} strokeDasharray="2 1.8" strokeLinecap="butt" />
      </g>

      {/* the swimmer */}
      <g transform={DIVER.transform} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* far leg and fin */}
        <path d="M-0.05 0L-0.46 -0.09L-0.82 -0.26" stroke="#2f3558" strokeWidth={0.13} />
        <path d="M-0.8 -0.31L-1.33 -0.62L-1.42 -0.45L-0.85 -0.21Z" fill="#5f659f" stroke={ICE} strokeOpacity={0.55} strokeWidth={0.02} />
        {/* tank on the back, valve and hose */}
        <rect x={-0.1} y={-0.37} width={0.68} height={0.2} rx={0.095} fill="#dbe3ec" />
        <path d="M0.1 -0.37V-0.17M0.38 -0.37V-0.17" stroke="#11131c" strokeWidth={0.045} strokeLinecap="butt" />
        <path d="M0.2 -0.37V-0.17" stroke="#4e5283" strokeWidth={0.07} strokeLinecap="butt" />
        <path d="M0.58 -0.27C0.72 -0.32 0.86 -0.2 0.85 0.02" stroke="#11131c" strokeWidth={0.03} />
        {/* torso, hood, mask */}
        <path d="M-0.12 0.02C-0.13 -0.19 0.5 -0.22 0.63 -0.08C0.68 0.03 0.58 0.12 0.45 0.13C0.2 0.16 -0.11 0.17 -0.12 0.02Z" fill="#3a4168" stroke={ICE} strokeOpacity={0.45} strokeWidth={0.02} />
        <circle cx={0.76} cy={-0.03} r={0.125} fill="#3a4168" stroke={ICE} strokeOpacity={0.45} strokeWidth={0.02} />
        <path d="M0.79 0.03L0.9 -0.03L0.89 0.08Z" fill="#05070c" stroke={ICE} strokeOpacity={0.85} strokeWidth={0.025} />
        {/* near arm, near leg and fin, ice piping */}
        <path d="M0.5 0.04L0.22 0.1L-0.02 0.13" stroke="#585f9c" strokeWidth={0.1} />
        <path d="M-0.05 0.03L-0.5 0.09L-0.9 0.1" stroke="#3f4672" strokeWidth={0.15} />
        <path d="M-0.9 0.045L-1.5 0.03L-1.5 0.25L-0.9 0.155Z" fill="#7a80b8" stroke={ICE} strokeOpacity={0.7} strokeWidth={0.02} />
        <path d="M0.02 0.02H0.3M-0.46 0.08L-0.16 0.05M-1.44 0.13L-0.96 0.1" stroke={ICE} strokeOpacity={0.8} strokeWidth={0.025} />
      </g>
      {BUBBLES.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="none" stroke="#e6edf5" strokeOpacity={p.o} strokeWidth={0.4} />
      ))}
      <path d={BRACKET} fill="none" stroke={ALERT} strokeWidth={1} strokeLinecap="square" />

      {/* the sonar node */}
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <ellipse cx={NODE.shade.cx} cy={NODE.shade.cy} rx={NODE.shade.rx} ry={NODE.shade.ry} fill="#0b0d1c" fillOpacity={0.3} />
        <path d={NODE.legs} stroke="#dbe3ec" strokeWidth={1.5} />
        {NODE.feet.map((p, i) => (
          <ellipse key={i} cx={f(p.x)} cy={f(p.y)} rx="2.6" ry="1.1" fill="#11131c" stroke={ICE} strokeOpacity={0.5} strokeWidth={0.4} />
        ))}
        <path d={NODE.mast} stroke="#11131c" strokeWidth={2.6} />
        <circle cx={f(NODE.hub.x)} cy={f(NODE.hub.y)} r="2.4" fill="#4e5283" stroke={ICE} strokeOpacity={0.5} strokeWidth={0.4} />
        <path d={NODE.body} fill="#11131c" stroke={ICE} strokeOpacity={0.6} strokeWidth={0.5} />
        <path d={NODE.staves} stroke="#dbe3ec" strokeWidth={1} strokeLinecap="butt" />
        <ellipse cx={NODE.cap.cx} cy={NODE.cap.cy} rx={NODE.cap.rx} ry={NODE.cap.ry} fill="#dbe3ec" />
        <ellipse cx={NODE.cap.cx} cy={NODE.cap.cy} rx={f(Number(NODE.cap.rx) * 0.45)} ry={f(Number(NODE.cap.ry) * 0.45)} stroke="#7a2350" strokeWidth={0.9} />
      </g>
    </svg>
  );
}
