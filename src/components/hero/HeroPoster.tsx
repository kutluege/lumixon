import { LAYOUT_WIDE } from "./scene/math";
import { stageOf } from "./scene/stage/stage";

/**
 * Static first-paint layers (server-rendered, zero JS).
 * Backdrop: tonal gradients that also sit behind the transparent WebGL canvas.
 * Linework: SVG terrain profiles + orbit arcs + the work-cell floor plan
 * (deck pool, inlaid cell outline, the arm's working circle), faded out once
 * the scene is live.
 */

export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 bg-abyss-950">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            // soft corner falloff: keeps the eye on the lit horizon and the work cell
            "radial-gradient(125% 95% at 52% 42%, transparent 52%, rgb(11 13 28 / 0.5) 100%)",
            // horizon haze
            "radial-gradient(95% 42% at 58% 34%, rgb(108 113 168 / 0.55), transparent 70%)",
            "radial-gradient(60% 24% at 62% 35%, rgb(175 193 214 / 0.22), transparent 70%)",
            // deep burgundy pooling low-right
            "radial-gradient(62% 48% at 90% 94%, rgb(122 35 80 / 0.55), transparent 72%)",
            "radial-gradient(45% 35% at 6% 100%, rgb(74 10 43 / 0.55), transparent 70%)",
            // sky falloff: indigo midnight → lit horizon → base
            "linear-gradient(to bottom, #1a1f3a 0%, #262c52 28%, #343b6a 40%, #222849 58%, #181d34 100%)",
          ].join(","),
        }}
      />
    </div>
  );
}

/* Deterministic terrain profile paths, computed at render on the server. */
function buildProfiles() {
  const W = 1600;
  const lines: { d: string; o: number }[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const depth = i / (n - 1); // 0 = horizon, 1 = foreground
    const yb = 350 + Math.pow(depth, 1.7) * 640;
    const amp = 10 + 46 * Math.pow(1 - depth, 1.4);
    let d = "";
    for (let x = -20; x <= W + 20; x += 20) {
      const r =
        0.55 * Math.abs(Math.sin(x * 0.0042 + i * 1.71)) +
        0.3 * Math.sin(x * 0.0113 + i * 0.93) +
        0.15 * Math.sin(x * 0.031 + i * 2.31);
      const y = yb - amp * r;
      d += `${x === -20 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    lines.push({ d, o: 0.08 + depth * 0.12 });
  }
  return lines;
}

const PROFILES = buildProfiles();

/*
 * Floor plan of the work cell as the live scene stages it in the wide layout
 * (left to right: learner, the arm's two part nests, arm base): the convex
 * hull of the learner's station and the arm's cell (the light line inlaid in
 * the deck), an inner hairline, the learner's station ring and the arm's
 * working circle. Ground points are projected with the camera the live rig
 * settles on at 1440×900 with the Turkish copy (CameraRig's placement, with
 * the copy column's ink and the logo at their measured spots there), so the
 * poster lines up with the render it hands over to; the live camera then
 * re-frames for other viewports and locales.
 */
const NOMINAL = { w: 1440, h: 900, copyRight: 610, logoBottom: 185 };

/** CameraRig's wide placement + pose at rest (no drift, pointer, scroll or intro). */
function nominalCamera() {
  const L = LAYOUT_WIDE;
  const { w, h, copyRight, logoBottom } = NOMINAL;
  const tanV = Math.tan((17 * Math.PI) / 180);
  const [, right, top, feetFrac] = L.frame;
  const gw = L.fit * 2;
  const x0 = copyRight + Math.max(24, w * 0.022);
  const x1 = w * right;
  const y0 = Math.max(h * top, logoBottom + Math.max(16, h * 0.02));
  const feet = h * feetFrac;
  const scale = Math.min((x1 - x0) / gw, (feet - y0) / L.height, h / 2 / (L.dist * tanV));
  const half = (gw * scale) / 2;
  const cx = Math.max(x0 + half, Math.min(x1 - half, w * L.aim));
  const dist = h / 2 / (scale * tanV);
  const offR = ((cx / w) * 2 - 1) * dist * tanV * (w / h);
  const offU = (1 - (feet / h) * 2) * dist * tanV;
  const sy = Math.sin(L.yaw);
  const cy = Math.cos(L.yaw);
  const sp = Math.sin(L.pitch);
  const cp = Math.cos(L.pitch);
  const [fx, fy, fz] = L.focus;
  return {
    x: fx - sy * cp * dist - cy * offR - sy * sp * offU,
    y: fy + sp * dist - cp * offU,
    z: fz + cy * cp * dist - sy * offR + cy * sp * offU,
    yaw: L.yaw,
    pitch: L.pitch,
    tan: tanV,
  };
}

function buildCell() {
  const { cellA, cellB } = stageOf(LAYOUT_WIDE);
  const ARM = cellA;
  const LEARNER = cellB;
  const CAM = nominalCamera();
  const TAN = CAM.tan;
  const sy = Math.sin(CAM.yaw);
  const cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch);
  const cp = Math.cos(CAM.pitch);
  /** Ground point (x, 0, z) to viewBox coordinates (1600×1000: the 1440×900 aspect). */
  const project = (x: number, z: number) => {
    const dx = x - CAM.x;
    const dy = -CAM.y;
    const dz = z - CAM.z;
    const depth = dx * sy * cp - dy * sp - dz * cy * cp;
    const right = dx * cy + dz * sy;
    const up = dx * sy * sp + dy * cp - dz * cy * sp;
    const nx = right / (depth * TAN * 1.6);
    const ny = up / (depth * TAN);
    return `${(800 + nx * 800).toFixed(1)} ${(500 - ny * 500).toFixed(1)}`;
  };
  const hull = (inset: number) => {
    const ra = ARM.r - inset;
    const rb = LEARNER.r - inset;
    const bx = LEARNER.x - ARM.x;
    const bz = LEARNER.z - ARM.z;
    const axis = Math.atan2(bz, bx);
    const phi = Math.acos((ra - rb) / Math.hypot(bx, bz));
    let d = "";
    const n = 56;
    for (let k = 0; k <= n; k++) {
      const t = axis + phi + ((Math.PI * 2 - 2 * phi) * k) / n;
      d += `${k === 0 ? "M" : "L"}${project(ARM.x + Math.cos(t) * ra, ARM.z + Math.sin(t) * ra)}`;
    }
    for (let k = 0; k <= n / 2; k++) {
      const t = axis - phi + (2 * phi * k) / (n / 2);
      d += `L${project(LEARNER.x + Math.cos(t) * rb, LEARNER.z + Math.sin(t) * rb)}`;
    }
    return `${d}Z`;
  };
  const circle = (c: { x: number; z: number }, r: number) => {
    let d = "";
    for (let k = 0; k <= 64; k++) {
      const t = (k / 64) * Math.PI * 2;
      d += `${k === 0 ? "M" : "L"}${project(c.x + Math.cos(t) * r, c.z + Math.sin(t) * r)}`;
    }
    return `${d}Z`;
  };
  return {
    outline: hull(0),
    inner: hull(0.085),
    reach: circle(ARM, 1.276),
    station: circle(LEARNER, 0.6),
    deck: circle({ x: ARM.x + (LEARNER.x - ARM.x) * 0.32, z: ARM.z + (LEARNER.z - ARM.z) * 0.32 }, 3.1),
  };
}

const CELL = buildCell();

export function HeroPosterLines() {
  return (
    <svg
      aria-hidden
      focusable="false"
      className="absolute inset-0 h-full w-full rtl:-scale-x-100"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <clipPath id="hero-sky">
          <rect x="0" y="0" width="1600" height="352" />
        </clipPath>
        <radialGradient id="hero-deck">
          <stop offset="0" stopColor="rgb(7 9 18)" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="rgb(7 9 18)" stopOpacity="0.42" />
          <stop offset="1" stopColor="rgb(7 9 18)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#hero-sky)">
      <ellipse cx="760" cy="1380" rx="1300" ry="1060" stroke="rgb(141 146 196 / 0.16)" strokeWidth="1" />
      <ellipse
        cx="620"
        cy="1240"
        rx="1150"
        ry="930"
        stroke="rgb(141 146 196 / 0.12)"
        strokeWidth="1"
        strokeDasharray="5 7"
      />
      </g>
      {PROFILES.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={`rgb(175 193 214 / ${p.o.toFixed(3)})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Work-cell floor plan where the live scene stages the robots (two-zone layout only, matching the scene). */}
      <g className="hidden hero-wide:block">
        <path d={CELL.deck} fill="url(#hero-deck)" />
        <path d={CELL.outline} fill="rgb(7 9 18 / 0.35)" stroke="rgb(175 193 214 / 0.42)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={CELL.inner} stroke="rgb(175 193 214 / 0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={CELL.reach} stroke="rgb(141 146 196 / 0.2)" strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
        <path d={CELL.station} stroke="rgb(141 146 196 / 0.24)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
