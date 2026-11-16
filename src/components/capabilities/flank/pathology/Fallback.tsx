import { useId } from "react";
import { buildTiles, COVER, GLANDS, heat, HOT, HOT_BOX, LABEL_X1, rowZ, sampleNuclei, SCAN, SLIDE, tissueSd, TILE } from "./model";

/*
 * Static still of the pathology scene, shown before the live scene mounts,
 * without WebGL, or if the scene fails. Same specimen as the live scene (it is
 * drawn from the same model), in a fixed axonometric view close to the 4:3
 * camera. Deterministic geometry computed once at module load with every
 * attribute pre-rounded, so server and client markup match. 400x300 frame,
 * scaled with "xMidYMid slice": square phone panels crop the stage, not the slide.
 */

const f = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

/* ── projection: yaw / elevation of the live 4:3 camera, orthographic ──── */
const YAW = 0.5;
const ELEV = 0.84;
const S = 80;
const CY_ = Math.cos(YAW);
const SY_ = Math.sin(YAW);
const SE = Math.sin(ELEV);
const CE = Math.cos(ELEV);
/** World point that lands on the frame centre. */
const AT = { x: 0.22, y: 0.2, z: -0.3 };
const px = (x: number, z: number) => 204 + S * ((x - AT.x) * CY_ - (z - AT.z) * SY_);
const py = (x: number, y: number, z: number) => 150 + S * ((x - AT.x) * SY_ * SE - (y - AT.y) * CE + (z - AT.z) * CY_ * SE);
const pt = (x: number, y: number, z: number) => `${f(px(x, z))} ${f(py(x, y, z))}`;

/** Affine matrix of the horizontal plane at height y, in units of 1/100 slide width. */
function planeMatrix(y: number) {
  const a = (S * CY_) / 100;
  const b = (S * SY_ * SE) / 100;
  const c = (-S * SY_) / 100;
  const d = (S * CY_ * SE) / 100;
  return `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${f2(px(0, 0))} ${f2(py(0, y, 0))})`;
}
const u = (v: number) => f(v * 100);

/** The three faces of an axis-aligned box that this view shows: top, front (+z), right (+x). */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return {
    top: `M${pt(x0, y1, z0)}L${pt(x1, y1, z0)}L${pt(x1, y1, z1)}L${pt(x0, y1, z1)}Z`,
    front: `M${pt(x0, y1, z1)}L${pt(x1, y1, z1)}L${pt(x1, y0, z1)}L${pt(x0, y0, z1)}Z`,
    right: `M${pt(x1, y1, z0)}L${pt(x1, y1, z1)}L${pt(x1, y0, z1)}L${pt(x1, y0, z0)}Z`,
  };
}
type Box = ReturnType<typeof box>;

/* ── slide and specimen (plane units) ──────────────────────────────────── */
const HW = SLIDE.w / 2;
const HD = SLIDE.d / 2;
const SLIDE_BOX = box(-HW, HW, 0, SLIDE.h, -HD, HD);
const TOP = planeMatrix(SLIDE.h);
const STAGE = planeMatrix(0);

const TILES = (() => {
  let d = "";
  const g = TILE * 0.06;
  for (const t of buildTiles()) {
    if (t.cover <= 0.07) continue;
    d += `M${u(t.x - TILE / 2 + g)} ${u(t.z - TILE / 2 + g)}h${u(TILE - 2 * g)}v${u(TILE - 2 * g)}h-${u(TILE - 2 * g)}z`;
  }
  return d;
})();

const NUCLEI = (() => {
  const n = sampleNuclei(0.07, 911);
  return Array.from({ length: n.count }, (_, i) => ({
    x: u(n.pos[i * 2]),
    z: u(n.pos[i * 2 + 1]),
    r: f2((n.shape[i * 3] + n.shape[i * 3 + 1]) * 62),
    hot: n.meta[i * 4 + 1] > 0.5,
    ring: n.meta[i * 4 + 2] > 0.5 || i % 3 === 0,
  }));
})();

/**
 * Zero contour of a scalar field over the scan area as one SVG path (plane
 * units): marching squares, with the cell segments chained into closed loops.
 */
function contour(fn: (x: number, z: number) => number, nx: number, nz: number) {
  const x0 = SCAN.x0 - 0.06;
  const z0 = SCAN.z0 - 0.04;
  const dx = (SCAN.x1 - SCAN.x0 + 0.12) / nx;
  const dz = (SCAN.z1 - SCAN.z0 + 0.08) / nz;
  const v: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) v.push(fn(x0 + i * dx, z0 + j * dz));
  const at = (i: number, j: number) => v[j * (nx + 1) + i];
  // Crossing points live on grid edges: "h" = edge from (i, j) to (i + 1, j), "v" = (i, j) to (i, j + 1).
  const pts = new Map<string, [number, number]>();
  const links = new Map<string, string[]>();
  const edge = (kind: "h" | "v", i: number, j: number) => {
    const key = `${kind}${i},${j}`;
    if (!pts.has(key)) {
      const a = at(i, j);
      const b = kind === "h" ? at(i + 1, j) : at(i, j + 1);
      const t = a / (a - b);
      pts.set(key, kind === "h" ? [x0 + (i + t) * dx, z0 + j * dz] : [x0 + i * dx, z0 + (j + t) * dz]);
    }
    return key;
  };
  const link = (a: string, b: string) => {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const inside = [at(i, j) < 0, at(i + 1, j) < 0, at(i + 1, j + 1) < 0, at(i, j + 1) < 0];
      const cut: string[] = [];
      if (inside[0] !== inside[1]) cut.push(edge("h", i, j));
      if (inside[1] !== inside[2]) cut.push(edge("v", i + 1, j));
      if (inside[2] !== inside[3]) cut.push(edge("h", i, j + 1));
      if (inside[3] !== inside[0]) cut.push(edge("v", i, j));
      if (cut.length === 2) link(cut[0], cut[1]);
      else if (cut.length === 4) {
        link(cut[0], cut[1]);
        link(cut[2], cut[3]);
      }
    }
  }
  let d = "";
  const seen = new Set<string>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    let cur: string | undefined = start;
    let first = true;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const p = pts.get(cur)!;
      d += `${first ? "M" : "L"}${u(p[0])} ${u(p[1])}`;
      first = false;
      cur = links.get(cur)?.find((k) => !seen.has(k));
    }
    d += "Z";
  }
  return d;
}

/** The section outline, the flagged region (score >= 0.5) and its wider halo. */
const TISSUE = contour(tissueSd, 110, 46);
const HEAT_HALO = contour((x, z) => 0.2 - heat(x, z), 64, 30);
const HEAT_CORE = contour((x, z) => 0.5 - heat(x, z), 64, 30);

const BRACKET = (() => {
  const x0 = HOT_BOX.cx - HOT_BOX.hx - 0.04;
  const x1 = HOT_BOX.cx + HOT_BOX.hx + 0.04;
  const z0 = HOT_BOX.cz - HOT_BOX.hz - 0.04;
  const z1 = HOT_BOX.cz + HOT_BOX.hz + 0.04;
  const l = 0.07;
  return (
    `M${u(x0)} ${u(z0 + l)}V${u(z0)}H${u(x0 + l)}M${u(x1 - l)} ${u(z0)}H${u(x1)}V${u(z0 + l)}` +
    `M${u(x1)} ${u(z1 - l)}V${u(z1)}H${u(x1 - l)}M${u(x0 + l)} ${u(z1)}H${u(x0)}V${u(z1 - l)}`
  );
})();

/** Abstract matrix code on the label end (no glyphs): 8 x 8 modules from a fixed hash. */
const CODE = (() => {
  let d = "";
  const cell = 0.045;
  const x0 = (-HW + LABEL_X1) / 2 - 4 * cell + 0.03;
  const z0 = -0.09 - 4 * cell;
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      const h = Math.abs(Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453) % 1;
      if (!(i === 0 || j === 7 || h > 0.52)) continue;
      d += `M${u(x0 + i * cell)} ${u(z0 + j * cell)}h${u(cell * 0.86)}v${u(cell * 0.86)}h-${u(cell * 0.86)}z`;
    }
  }
  return d;
})();

/** Stage scale along the near edge of the slide. */
const TICKS = (() => {
  let d = "";
  for (let i = -15; i <= 15; i++) {
    const x = i / 10;
    d += `M${u(x)} ${u(HD + 0.2)}v${u(i % 5 === 0 ? 0.075 : 0.035)}`;
  }
  return d;
})();

/* ── scanner (screen space) ────────────────────────────────────────────── */
const RAIL_Z = -0.82;
const RAIL_X0 = (SCAN.x0 + SCAN.x1) / 2 - 0.1 - 1.5;
const RAIL_X1 = RAIL_X0 + 3.0;
/** Where the still catches the scan head: on the fifth strip, most of the section done. */
const HEAD = { x: 1.03, z: rowZ(4) };
const RAIL = box(RAIL_X0, RAIL_X1, 0.445, 0.555, RAIL_Z - 0.06, RAIL_Z + 0.06);
const POSTS = [RAIL_X0 + 0.02, RAIL_X1 - 0.02].map((x) => ({
  post: box(x - 0.045, x + 0.045, 0.02, 0.44, RAIL_Z - 0.045, RAIL_Z + 0.045),
  foot: box(x - 0.13, x + 0.13, 0, 0.03, RAIL_Z - 0.13, RAIL_Z + 0.13),
  cap: box(x - 0.06, x + 0.06, 0.4, 0.6, RAIL_Z - 0.1, RAIL_Z + 0.1),
}));
const CARRIAGE = box(HEAD.x - 0.18, HEAD.x + 0.18, 0.385, 0.625, RAIL_Z - 0.125, RAIL_Z + 0.125);
const SADDLE = box(HEAD.x - 0.09, HEAD.x + 0.09, 0.625, 0.745, RAIL_Z - 0.15, RAIL_Z + 0.15);
const RAM = box(HEAD.x - 0.037, HEAD.x + 0.037, 0.655, 0.725, HEAD.z - (rowZ(0) - RAIL_Z + 0.14), HEAD.z);
const BLOCK = box(HEAD.x - 0.125, HEAD.x + 0.125, 0.585, 0.755, HEAD.z - 0.12, HEAD.z + 0.12);

/** Vertical cylinder of the objective between two heights, as a closed path. */
function barrel(r: number, y0: number, y1: number) {
  const cx = px(HEAD.x, HEAD.z);
  const rx = r * S;
  const ry = r * S * SE;
  const a = py(HEAD.x, y1, HEAD.z);
  const b = py(HEAD.x, y0, HEAD.z);
  return `M${f(cx - rx)} ${f(a)}V${f(b)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(b)}V${f(a)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx - rx)} ${f(a)}Z`;
}
/** Drawn bottom to top, so each section hides the top of the one below. */
const OBJECTIVE = [
  { d: barrel(0.085, 0.313, 0.347), fill: "#141829" },
  { d: barrel(0.085, 0.347, 0.38), fill: "#7a2350" },
  { d: barrel(0.09, 0.38, 0.525), fill: "#dbe3ec" },
  { d: barrel(0.094, 0.525, 0.6), fill: "#141829" },
];
const NOSE = (() => {
  const cx = px(HEAD.x, HEAD.z);
  const yTop = py(HEAD.x, 0.313, HEAD.z);
  const yTip = py(HEAD.x, 0.235, HEAD.z);
  return `M${f(cx - 0.074 * S)} ${f(yTop)}L${f(cx - 0.03 * S)} ${f(yTip)}H${f(cx + 0.03 * S)}L${f(cx + 0.074 * S)} ${f(yTop)}Z`;
})();
/** Illuminated field of view: the light cone from the front lens down to one tile. */
const CONE = (() => {
  const y = SLIDE.h + COVER.h;
  const h = TILE / 2;
  return `M${pt(HEAD.x, 0.235, HEAD.z)}L${pt(HEAD.x - h, y, HEAD.z + h)}L${pt(HEAD.x + h, y, HEAD.z + h)}L${pt(HEAD.x + h, y, HEAD.z - h)}Z`;
})();

function Solid({ b, top, front, right, stroke = 0.4 }: { b: Box; top: string; front: string; right: string; stroke?: number }) {
  return (
    <g stroke="#afc1d6" strokeOpacity={stroke} strokeWidth={0.5} strokeLinejoin="round">
      <path d={b.front} fill={front} />
      <path d={b.right} fill={right} />
      <path d={b.top} fill={top} />
    </g>
  );
}

const SHELL = { top: "#dbe3ec", front: "#b4bfce", right: "#8f9bb0" };
const DARK = { top: "#2e3559", front: "#1b2040", right: "#141829" };

export function PathologyFallback() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fade = `${uid}-fade`;
  const mask = `${uid}-mask`;
  const heat = `${uid}-heat`;
  const lamp = `${uid}-lamp`;
  const clip = `${uid}-clip`;
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={fade} cx="50%" cy="58%" r="52%">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={mask}>
          <rect width="400" height="300" fill={`url(#${fade})`} />
        </mask>
        <radialGradient id={heat} cx={u(HOT.x + 0.03)} cy={u(HOT.z)} r={u(0.27)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4c6a0" />
          <stop offset="0.5" stopColor="#a8406d" />
          <stop offset="1" stopColor="#7a2350" />
        </radialGradient>
        <radialGradient id={lamp} cx={f(px(HEAD.x, HEAD.z))} cy={f(py(HEAD.x, SLIDE.h, HEAD.z))} r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e6edf5" stopOpacity="0.5" />
          <stop offset="1" stopColor="#e6edf5" stopOpacity="0" />
        </radialGradient>
        {/* the section outline clips the stain texture */}
        <clipPath id={clip}>
          <path d={TISSUE} />
        </clipPath>
      </defs>

      {/* stage: seat outline and scale, melting into the page */}
      <g mask={`url(#${mask})`}>
        <g transform={STAGE} fill="none" stroke="#8d92c4">
          <rect x={u(-HW - 0.045)} y={u(-HD - 0.045)} width={u(SLIDE.w + 0.09)} height={u(SLIDE.d + 0.09)} rx="5" strokeOpacity={0.35} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          <path d={TICKS} stroke="#afc1d6" strokeOpacity={0.4} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          <path d={`M${u(HEAD.x)} ${u(HD + 0.17)}v${u(0.14)}`} stroke="#e6edf5" strokeOpacity={0.9} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
        </g>
      </g>

      {/* rail behind the slide */}
      {POSTS.map((p, i) => (
        <g key={i}>
          <Solid b={p.foot} {...DARK} stroke={0.25} />
          <Solid b={p.post} {...DARK} stroke={0.25} />
        </g>
      ))}
      <Solid b={RAIL} {...DARK} stroke={0.45} />
      {POSTS.map((p, i) => (
        <Solid key={i} b={p.cap} {...SHELL} />
      ))}

      {/* glass slide */}
      <g stroke="#afc1d6" strokeLinejoin="round" strokeWidth={0.6}>
        <path d={SLIDE_BOX.front} fill="#afc1d6" fillOpacity={0.22} strokeOpacity={0.55} />
        <path d={SLIDE_BOX.right} fill="#afc1d6" fillOpacity={0.14} strokeOpacity={0.55} />
        <path d={SLIDE_BOX.top} fill="#232a4d" fillOpacity={0.75} strokeOpacity={0.7} />
      </g>

      <g transform={TOP}>
        {/* frosted label end with an abstract matrix code and a colour band */}
        <rect x={u(-HW + 0.012)} y={u(-HD + 0.012)} width={u(LABEL_X1 + HW - 0.012)} height={u(SLIDE.d - 0.024)} rx="2" fill="#c3cedb" fillOpacity={0.88} />
        <rect x={u(-HW + 0.012)} y={u(-HD + 0.012)} width={u(0.075)} height={u(SLIDE.d - 0.024)} rx="2" fill="#8d3560" />
        <path d={CODE} fill="#1b2040" fillOpacity={0.85} />

        {/* coverslip */}
        <rect
          x={u(COVER.x0)}
          y={u(COVER.z0)}
          width={u(COVER.x1 - COVER.x0)}
          height={u(COVER.z1 - COVER.z0)}
          rx="1.2"
          fill="#afc1d6"
          fillOpacity={0.05}
          stroke="#afc1d6"
          strokeOpacity={0.4}
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* H&E section: eosin stroma, gland lumens, hematoxylin nuclei */}
        <path d={TISSUE} fill="#b9668e" stroke="#8e466c" strokeOpacity={0.8} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <g clipPath={`url(#${clip})`}>
          {/* the hypercellular focus is darker and bluer */}
          <path d={HEAT_HALO} fill="#4a3f86" fillOpacity={0.42} />
          {GLANDS.map((g, i) => (
            <ellipse
              key={i}
              cx={u(g[0])}
              cy={u(g[1])}
              rx={u(g[2])}
              ry={u(g[3])}
              transform={`rotate(${f((g[4] * 180) / Math.PI)} ${u(g[0])} ${u(g[1])})`}
              fill="#efe2ec"
              fillOpacity={0.75}
              stroke="#4a3f86"
              strokeOpacity={0.7}
              strokeWidth={0.9}
            />
          ))}
          {NUCLEI.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.z} r={n.r} fill={n.hot ? "#2b2459" : "#4a3f86"} fillOpacity={0.9} />
          ))}
        </g>

        {/* analysis layer: pyramid tiles, detection markers, heatmap, contour, flag bracket */}
        <path d={TILES} fill="none" stroke="#afc1d6" strokeOpacity={0.36} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        {NUCLEI.filter((n) => n.ring).map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.z}
            r="1.7"
            fill="none"
            stroke={n.hot ? "#ffd6bd" : "#c9d7e8"}
            strokeOpacity={0.85}
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={HEAT_HALO} fill="#6c71a8" fillOpacity={0.4} stroke="#a8406d" strokeOpacity={0.6} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <path d={HEAT_CORE} fill={`url(#${heat})`} fillOpacity={0.92} stroke="#f4c6a0" strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={BRACKET} fill="none" stroke="#f2f6fb" strokeOpacity={0.95} strokeWidth={1.1} strokeLinecap="square" vectorEffect="non-scaling-stroke" />
      </g>

      {/* scan head: illuminated field of view, objective, ram and carriage */}
      <circle cx={f(px(HEAD.x, HEAD.z))} cy={f(py(HEAD.x, SLIDE.h, HEAD.z))} r="34" fill={`url(#${lamp})`} />
      <g transform={TOP}>
        <rect
          x={u(HEAD.x - TILE / 2)}
          y={u(HEAD.z - TILE / 2)}
          width={u(TILE)}
          height={u(TILE)}
          fill="#f2f6fb"
          fillOpacity={0.25}
          stroke="#f2f6fb"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path d={CONE} fill="#e6edf5" fillOpacity={0.16} />
      <Solid b={CARRIAGE} {...SHELL} />
      <Solid b={SADDLE} {...DARK} stroke={0.3} />
      <Solid b={RAM} {...DARK} stroke={0.45} />
      <path d={NOSE} fill="#9aa5b5" stroke="#afc1d6" strokeOpacity={0.4} strokeWidth={0.5} />
      {OBJECTIVE.map((o, i) => (
        <path key={i} d={o.d} fill={o.fill} stroke="#afc1d6" strokeOpacity={0.35} strokeWidth={0.5} />
      ))}
      <Solid b={BLOCK} {...SHELL} />
    </svg>
  );
}
