import { useId } from "react";
import type { FlankKind } from "./contract";
import { PathologyFallback } from "./pathology/Fallback";
import { SonarFallback } from "./sonar/Fallback";

/*
 * Static line-work shown before the live scenes mount, without WebGL, or if a
 * scene fails. Deterministic geometry (computed once at module load) with every
 * attribute pre-rounded, so server and client markup match. Drawn in a 400×300
 * (4:3) frame and scaled with "xMidYMid slice", so square phone panels crop the
 * edges, not the robot.
 */

const f = (n: number) => n.toFixed(1);

/* Where the robot stands in the frame (feet centre) and its drawing scale. */
const AT = { x: 190, y: 205, s: 1.45 };
const toFrame = (x: number, y: number) => ({ x: AT.x + x * AT.s, y: AT.y + y * AT.s });
const SENSOR_LOCAL = { x: 66, y: -61 };
const SENSOR = toFrame(SENSOR_LOCAL.x, SENSOR_LOCAL.y);
const FRONT_FOOT = toFrame(36, 0);

/* ── research: perspective simulation grid, policy rollouts ────────────── */
const VP = { x: 200, y: -30 };
const FLOOR_BOTTOM = 300;
const GRID_ROWS = [1, 1.15, 1.33, 1.55, 1.82, 2.2].map((d) => VP.y + (FLOOR_BOTTOM - VP.y) / d);
const GRID_TOP = GRID_ROWS[GRID_ROWS.length - 1];
const GRID = (() => {
  let d = "";
  for (const y of GRID_ROWS) d += `M-40 ${f(y)}H440`;
  const t = (GRID_TOP - VP.y) / (FLOOR_BOTTOM - VP.y);
  for (let x0 = -520; x0 <= 920; x0 += 80) {
    d += `M${f(VP.x + (x0 - VP.x) * t)} ${f(GRID_TOP)}L${x0} ${FLOOR_BOTTOM}`;
  }
  return d;
})();
const fx = f(FRONT_FOOT.x);
const fy = f(FRONT_FOOT.y);
/** The chosen trajectory (solid) and discarded rollouts (faint, dashed). */
const POLICY = `M${fx} ${fy} C 290 200, 330 214, 420 206`;
const ROLLOUTS = [
  `M${fx} ${fy} C 286 192, 330 170, 420 160`,
  `M${fx} ${fy} C 288 210, 336 236, 420 250`,
  `M${fx} ${fy} C 290 198, 340 188, 420 186`,
];
const STEPS = [276, 312, 348, 384].map((x, i) => ({ x, y: 203 + (i % 2 ? 5 : -2) }));

/* ── field: uneven terrain profiles + a deterministic point cloud ──────── */
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const TERRAIN_ROWS = [-2, -1, 0, 1, 2];
function terrainY(x: number, r: number) {
  const base = AT.y + r * 24 + r * r * 3;
  const amp = 3 + (r + 2) * 1.6;
  return base - amp * (Math.sin(x * 0.021 + r * 1.9) * 0.7 + Math.sin(x * 0.053 + r * 0.7) * 0.3);
}
const TERRAIN = TERRAIN_ROWS.map((r) => {
  let d = "";
  for (let x = -20; x <= 420; x += 10) d += `${x === -20 ? "M" : "L"}${x} ${f(terrainY(x, r))}`;
  return { d, o: (0.12 + (r + 2) * 0.045).toFixed(2) };
});
/** Points fall on the terrain rows, densest in the swept area ahead of the robot. */
const CLOUD = Array.from({ length: 110 }, (_, i) => {
  const r = TERRAIN_ROWS[Math.floor(hash(i) * 4.99)];
  const ahead = hash(i + 0.37) < 0.64;
  const x = ahead ? 250 + hash(i + 0.71) * 160 : hash(i + 0.71) * 400;
  const y = terrainY(x, r) + (hash(i + 0.13) - 0.5) * 5;
  return { x: f(x), y: f(y), r: ahead ? "1.15" : "0.85", o: ahead ? (0.5 + hash(i + 0.5) * 0.4).toFixed(2) : "0.2" };
});

/* ── the quadruped (local units, feet centre at 0,0, +x forward) ───────── */
const BODY = "M-48 -58 L46 -62 L50 -44 L-44 -40 Z";
const HEAD = "M46 -66 L64 -68 L67 -54 L50 -52 Z";
type Leg = { d: string; knee: [number, number]; far: boolean };
const leg = (h: [number, number], k: [number, number], p: [number, number], far: boolean): Leg => ({
  d: `M${h[0]} ${h[1]}L${k[0]} ${k[1]}L${p[0]} ${p[1]}`,
  knee: k,
  far,
});
const LEGS: Leg[] = [
  leg([-36, -44], [-44, -22], [-34, 0], true),
  leg([32, -46], [24, -24], [36, -1], true),
  leg([-42, -42], [-52, -20], [-44, 2], false),
  leg([26, -44], [16, -22], [26, 2], false),
];

function Quadruped({ solid }: { solid: boolean }) {
  const ink = "#afc1d6";
  return (
    <g
      transform={`translate(${AT.x} ${AT.y}) scale(${AT.s})`}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    >
      {LEGS.filter((l) => l.far).map((l, i) => (
        <path key={`f${i}`} d={l.d} stroke={solid ? "#6c71a8" : ink} strokeOpacity={solid ? 0.7 : 0.32} strokeWidth={solid ? 3.4 : 0.7} />
      ))}
      <path d={BODY} fill={solid ? "#2e3559" : "none"} stroke={ink} strokeOpacity={solid ? 0.5 : 0.75} strokeWidth={0.7} />
      <path d={HEAD} fill={solid ? "#4e5283" : "none"} stroke={ink} strokeOpacity={solid ? 0.55 : 0.75} strokeWidth={0.7} />
      {solid ? (
        <path d="M-40 -50 L44 -54" stroke={ink} strokeOpacity={0.25} strokeWidth={0.7} />
      ) : (
        /* wireframe: internal edges of the twin's hull */
        <path d="M-48 -58 L50 -44 M46 -62 L-44 -40 M-1 -60 L3 -42" stroke={ink} strokeOpacity={0.3} strokeWidth={0.5} />
      )}
      {LEGS.filter((l) => !l.far).map((l, i) => (
        <path key={`n${i}`} d={l.d} stroke={solid ? "#8d92c4" : ink} strokeOpacity={solid ? 0.9 : 0.75} strokeWidth={solid ? 4 : 0.7} />
      ))}
      {LEGS.map((l, i) => (
        <circle
          key={`k${i}`}
          cx={l.knee[0]}
          cy={l.knee[1]}
          r={solid ? 1.6 : 1.3}
          fill={solid ? ink : "#1e2443"}
          fillOpacity={solid ? 0.55 : 1}
          stroke={ink}
          strokeOpacity={l.far ? 0.35 : 0.75}
          strokeWidth={0.5}
        />
      ))}
      <circle cx={SENSOR_LOCAL.x} cy={SENSOR_LOCAL.y} r={1.4} fill={ink} fillOpacity={0.9} />
    </g>
  );
}

/** Dispatches to the per-scene still; the quadruped pair is drawn in this file. */
export function FlankFallback({ kind }: { kind: FlankKind }) {
  if (kind === "pathology") return <PathologyFallback />;
  if (kind === "sonar") return <SonarFallback />;
  return <QuadrupedFallback kind={kind} />;
}

function QuadrupedFallback({ kind }: { kind: "research" | "field" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fade = `${uid}-fade`;
  const mask = `${uid}-mask`;
  const fan = `${uid}-fan`;
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={fade} cx="50%" cy="66%" r="58%">
          <stop offset="0.35" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={mask}>
          <rect width="400" height="300" fill={`url(#${fade})`} />
        </mask>
        <radialGradient id={fan} cx={f(SENSOR.x)} cy={f(SENSOR.y)} r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#afc1d6" stopOpacity="0.2" />
          <stop offset="1" stopColor="#afc1d6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {kind === "research" ? (
        <>
          <g mask={`url(#${mask})`}>
            <path d={GRID} stroke="#8d92c4" strokeOpacity={0.3} strokeWidth={0.75} fill="none" />
            {ROLLOUTS.map((d) => (
              <path key={d} d={d} stroke="#8d92c4" strokeOpacity={0.45} strokeWidth={0.75} strokeDasharray="2 4" fill="none" />
            ))}
            <path d={POLICY} stroke="#afc1d6" strokeOpacity={0.7} strokeWidth={1} fill="none" />
            {STEPS.map((p) => (
              <path key={p.x} d={`M${p.x - 3} ${p.y}h6m-3 -3v6`} stroke="#afc1d6" strokeOpacity={0.6} strokeWidth={0.75} />
            ))}
          </g>
          <Quadruped solid={false} />
        </>
      ) : (
        <>
          <g mask={`url(#${mask})`}>
            {TERRAIN.map((t, i) => (
              <path key={i} d={t.d} stroke="#8d92c4" strokeOpacity={t.o} strokeWidth={0.8} fill="none" />
            ))}
          </g>
          {/* lidar sweep: a forward fan from the sensor head */}
          <path d={`M${f(SENSOR.x)} ${f(SENSOR.y)} L420 128 L420 296 Z`} fill={`url(#${fan})`} />
          <g mask={`url(#${mask})`}>
            {CLOUD.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#afc1d6" fillOpacity={p.o} />
            ))}
          </g>
          <Quadruped solid />
        </>
      )}
    </svg>
  );
}
