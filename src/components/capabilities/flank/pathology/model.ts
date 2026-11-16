/**
 * Pathology scene model: slide layout, the procedural tissue section, the scan
 * raster and the loop timeline. Pure math with no three.js import, so the live
 * scene (build.ts, shaders) and the static SVG still (Fallback.tsx, which is
 * part of the server-rendered page) describe the same specimen.
 *
 * Slide space: units are "slide widths" (a 75 x 25 mm slide is 3 x 1), the
 * slide lies on the stage in the XZ plane, long axis along X, centred on the
 * origin, +Z towards the camera, +Y up.
 */

/* ── slide ─────────────────────────────────────────────────────────────── */

export const SLIDE = { w: 3.0, d: 1.0, h: 0.05, r: 0.03 } as const;
/** The frosted label end covers the slide from its left edge to this x. */
export const LABEL_X1 = -0.82;
/** Coverslip footprint (a thin glass plate over the section). */
export const COVER = { x0: -0.74, x1: 1.45, z0: -0.465, z1: 0.465, h: 0.012 } as const;

/** Heights of the stacked layers above the stage. */
export const Y_TISSUE = SLIDE.h + 0.0012;
export const Y_NUCLEI = SLIDE.h + 0.0024;
export const Y_OVERLAY = SLIDE.h + COVER.h + 0.006;
export const Y_MARKERS = Y_OVERLAY + 0.002;

/* ── scan raster / image pyramid tiles ─────────────────────────────────── */

/** One tile of the pyramid's base level = the scanner's field of view = one raster strip. */
export const TILE = 0.13;
export const COLS = 15;
export const ROWS = 6; // even: the serpentine ends on the side it started
export const SCAN = {
  x0: -0.6,
  x1: -0.6 + COLS * TILE,
  z0: -(ROWS * TILE) / 2,
  z1: (ROWS * TILE) / 2,
} as const;

/** Rectangle covered by the tissue / analysis planes and the baked field texture. */
export const REGION = { x0: -0.72, x1: 1.43, z0: -0.45, z1: 0.45 } as const;

/* ── loop timeline (seconds) ───────────────────────────────────────────── */

export const LOOP = 24;
/** The head enters the first strip. */
export const T_SCAN0 = 0.9;
/** One strip, and the turn-around (step to the next strip). */
export const ROW_T = 1.85;
export const STEP_T = 0.45;
export const CYC = ROW_T + STEP_T;
export const T_SCAN1 = T_SCAN0 + ROWS * ROW_T + (ROWS - 1) * STEP_T; // 14.25
/** Patch-level scores resolve into a smooth heatmap. */
export const T_REFINE0 = T_SCAN1 + 0.3;
export const T_REFINE1 = T_REFINE0 + 1.5;
/** The contour of the suspicious region is traced. */
export const T_CONTOUR0 = T_REFINE0 + 0.5;
export const T_CONTOUR1 = T_CONTOUR0 + 1.7;
/** The "flagged region" bracket closes in and locks; the region then lifts off as a chip. */
export const T_LOCK0 = T_CONTOUR1 - 0.25;
export const T_LOCK1 = T_LOCK0 + 1.0;
export const T_LIFT0 = T_LOCK1 - 0.15;
export const T_LIFT1 = T_LIFT0 + 1.3;
/** How far the flagged-region chip rises above the analysis layer. */
export const CHIP_LIFT = 0.3;
/** The whole AI layer fades before the next pass. */
export const T_FADE0 = 21.7;
export const T_FADE1 = 23.3;
/** The head glides back to the first strip. */
const T_RETURN0 = 20.9;
const T_RETURN1 = 23.4;

const SCAN_V = (SCAN.x1 - SCAN.x0) / ROW_T;
/** Run-up / run-out so the head enters and leaves the raster at scan speed. */
const LEAD_T = 0.36;
const LEAD = (SCAN_V * LEAD_T) / 2;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Centre line (z) of raster strip `r`; strip 0 is the one nearest the camera. */
export const rowZ = (r: number) => SCAN.z1 - (r + 0.5) * TILE;

export type HeadPose = {
  /** Optical axis on the slide plane. */
  x: number;
  z: number;
  /** 0 = in focus (scanning), 1 = objective retracted (parked). */
  retract: number;
  /** Illumination 0..1. */
  lamp: number;
};

/**
 * Scan-head pose at loop time `t` in [0, LOOP). Writes into `out`; never allocates.
 * The shaders derive "when was this point scanned" from the same raster (`scanHit` /
 * `tileHit` in shaders.ts), so the analysis layer needs no per-point state.
 */
export function headPose(t: number, out: HeadPose): HeadPose {
  const parkX = SCAN.x0 - LEAD;
  let x = parkX;
  let z = rowZ(0);
  let turn = 0;
  if (t < T_SCAN0 - LEAD_T) {
    // parked on the first strip, waiting
  } else if (t < T_SCAN0) {
    const s = (t - (T_SCAN0 - LEAD_T)) / LEAD_T;
    x = parkX + LEAD * s * s;
  } else if (t < T_SCAN1) {
    const u = t - T_SCAN0;
    const row = Math.min(ROWS - 1, Math.floor(u / CYC));
    const tau = u - row * CYC;
    const fwd = row % 2 === 0;
    if (tau <= ROW_T) {
      const f = tau / ROW_T;
      x = fwd ? lerp(SCAN.x0, SCAN.x1, f) : lerp(SCAN.x1, SCAN.x0, f);
      z = rowZ(row);
    } else {
      // Turn-around: overshoot and come back at scan speed while stepping one strip.
      const s = tau - ROW_T;
      const over = SCAN_V * s * (1 - s / STEP_T);
      x = fwd ? SCAN.x1 + over : SCAN.x0 - over;
      z = lerp(rowZ(row), rowZ(row + 1), smoothstep(0, 1, s / STEP_T));
      turn = Math.sin((Math.PI * s) / STEP_T);
    }
  } else if (t < T_SCAN1 + LEAD_T) {
    const s = t - T_SCAN1;
    x = SCAN.x0 - SCAN_V * s * (1 - s / (2 * LEAD_T));
    z = rowZ(ROWS - 1);
  } else {
    z = lerp(rowZ(ROWS - 1), rowZ(0), smoother(clamp01((t - T_RETURN0) / (T_RETURN1 - T_RETURN0))));
  }
  out.x = x;
  out.z = z;
  out.lamp = smoothstep(T_SCAN0 - 0.45, T_SCAN0 - 0.05, t) * (1 - smoothstep(T_SCAN1, T_SCAN1 + 0.4, t)) * (1 - 0.55 * turn);
  out.retract = 1 - smoothstep(0.05, T_SCAN0 - 0.15, t) * (1 - smoothstep(T_SCAN1 + 0.15, T_SCAN1 + 0.95, t));
  return out;
}

/* ── deterministic random ──────────────────────────────────────────────── */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── the tissue section ────────────────────────────────────────────────── */

/** Approximate signed distance to an ellipse (negative inside). */
function ell(px: number, pz: number, cx: number, cz: number, rx: number, rz: number) {
  const x = px - cx;
  const z = pz - cz;
  const k0 = Math.hypot(x / rx, z / rz);
  const k1 = Math.hypot(x / (rx * rx), z / (rz * rz));
  return k1 < 1e-6 ? -Math.min(rx, rz) : (k0 * (k0 - 1)) / k1;
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Lobes of the section: cx, cz, rx, rz. */
const LOBES: readonly (readonly [number, number, number, number])[] = [
  [-0.17, 0.03, 0.33, 0.27],
  [0.38, -0.05, 0.37, 0.28],
  [0.93, 0.03, 0.29, 0.26],
  [0.63, 0.2, 0.2, 0.11],
  [-0.4, -0.17, 0.12, 0.1],
];
/** Clefts cut into the outline, and one detached fragment. */
const CLEFTS: readonly (readonly [number, number, number, number])[] = [
  [0.13, 0.4, 0.1, 0.12],
  [0.7, -0.4, 0.09, 0.11],
];
const FRAGMENT = [1.24, -0.27, 0.06, 0.042] as const;

/** Signed distance to the section outline (negative inside tissue). */
export function tissueSd(x: number, z: number) {
  const wx = x + 0.02 * Math.sin(7.3 * z + 1.2) + 0.009 * Math.sin(15.1 * x + 3.3 * z);
  const wz = z + 0.018 * Math.sin(6.1 * x + 2.0) + 0.008 * Math.sin(13.7 * x - 4.0 * z + 0.7);
  let d = 1;
  for (let i = 0; i < LOBES.length; i++) {
    const l = LOBES[i];
    const e = ell(wx, wz, l[0], l[1], l[2], l[3]);
    d = i === 0 ? e : smin(d, e, 0.09);
  }
  for (const c of CLEFTS) d = -smin(-d, ell(wx, wz, c[0], c[1], c[2], c[3]), 0.05);
  const rough = 0.005 * Math.sin(43 * x + 1.3) * Math.sin(39 * z + 0.4) + 0.0025 * Math.sin(91 * x + 57 * z);
  d += rough;
  return Math.min(d, ell(wx, wz, FRAGMENT[0], FRAGMENT[1], FRAGMENT[2], FRAGMENT[3]) + rough);
}

/** Glands / ducts: cx, cz, rx, rz, rotation. Each is a clear lumen ringed by epithelial nuclei. */
export const GLANDS: readonly (readonly [number, number, number, number, number])[] = [
  [-0.31, 0.1, 0.056, 0.035, 0.4],
  [-0.1, -0.11, 0.046, 0.03, -0.5],
  [-0.03, 0.15, 0.036, 0.027, 1.0],
  [-0.33, -0.08, 0.03, 0.021, 0.2],
  [0.87, 0.12, 0.052, 0.034, -0.3],
  [1.03, -0.06, 0.046, 0.03, 0.8],
  [0.85, -0.12, 0.033, 0.024, 0.1],
  [1.09, 0.13, 0.028, 0.02, -0.9],
  [0.2, 0.17, 0.036, 0.024, 0.6],
  [0.14, -0.2, 0.03, 0.021, 0.0],
];

/** Signed distance to the nearest gland lumen (negative inside a lumen). */
export function lumenSd(x: number, z: number) {
  let d = 1;
  for (const g of GLANDS) {
    const c = Math.cos(g[4]);
    const s = Math.sin(g[4]);
    const dx = x - g[0];
    const dz = z - g[1];
    const lx = c * dx + s * dz;
    const lz = -s * dx + c * dz;
    // a little waviness so the lumens are not perfect ellipses
    const wob = 1 + 0.12 * Math.sin(3 * Math.atan2(lz, lx) + g[0] * 9);
    d = Math.min(d, ell(lx, lz, 0, 0, g[2] * wob, g[3] * wob));
  }
  return d;
}

/** The suspicious focus: an irregular hot spot (main mass + satellite) inside the second lobe. */
export const HOT = { x: 0.5, z: -0.07 } as const;

/** Unmasked model score in 0..1 (the caller multiplies by the tissue mask). */
export function heatRaw(x: number, z: number) {
  const wx = x + 0.025 * Math.sin(11 * z + 0.6);
  const wz = z + 0.02 * Math.sin(9 * x + 1.9);
  const ax = (wx - HOT.x) / 0.215;
  const az = (wz - HOT.z) / 0.14;
  const bx = (wx - 0.74) / 0.095;
  const bz = (wz - 0.075) / 0.075;
  return Math.min(1, Math.exp(-(ax * ax + az * az)) + 0.85 * Math.exp(-(bx * bx + bz * bz)));
}

/** Model score in 0..1 ("probability of tumour") at a point of the section. */
export function heat(x: number, z: number) {
  return heatRaw(x, z) * smoothstep(0.004, -0.03, tissueSd(x, z));
}

/** Low-frequency staining variation in 0..1 (0 = pale eosin, 1 = deep). */
export function tone(x: number, z: number) {
  return clamp01(0.5 + 0.28 * Math.sin(3.1 * x + 1.0) * Math.sin(4.3 * z - 0.5) + 0.2 * Math.sin(9.0 * x - 6.0 * z + 2.0));
}

/** Bounding box of the heat contour (score >= 0.5), found once on a grid. */
export const HOT_BOX = (() => {
  let x0 = 9;
  let x1 = -9;
  let z0 = 9;
  let z1 = -9;
  for (let j = 0; j <= 90; j++) {
    for (let i = 0; i <= 200; i++) {
      const x = SCAN.x0 + ((SCAN.x1 - SCAN.x0) * i) / 200;
      const z = SCAN.z0 + ((SCAN.z1 - SCAN.z0) * j) / 90;
      if (heat(x, z) < 0.5) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 };
})();

/* ── tiles ─────────────────────────────────────────────────────────────── */

export type Tile = { col: number; row: number; x: number; z: number; cover: number; score: number };

/** Every tile of the base level: tissue coverage and mean score (4x4 samples). */
export function buildTiles(): Tile[] {
  const out: Tile[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let cover = 0;
      let score = 0;
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = SCAN.x0 + (col + (i + 0.5) / 4) * TILE;
          const z = SCAN.z1 - (row + (j + 0.5) / 4) * TILE;
          if (tissueSd(x, z) < 0) cover++;
          score += heat(x, z);
        }
      }
      out.push({ col, row, x: SCAN.x0 + (col + 0.5) * TILE, z: rowZ(row), cover: cover / 16, score: score / 16 });
    }
  }
  return out;
}

/* ── nuclei ────────────────────────────────────────────────────────────── */

export type Nuclei = {
  count: number;
  /** x, z per nucleus. */
  pos: Float32Array;
  /** semi-axes (a, b) and rotation per nucleus. */
  shape: Float32Array;
  /** seed 0..1, class (0 = typical, 1 = atypical), ring marker flag, local model score per nucleus. */
  meta: Float32Array;
};

/**
 * Hematoxylin nuclei: columnar cells lining every gland, spindle-shaped stromal
 * nuclei following the fibre direction, and a crowded, pleomorphic, disordered
 * population in the suspicious focus. `scale` thins the population (low tier,
 * SVG still).
 */
export function sampleNuclei(scale: number, seed = 20261): Nuclei {
  const rand = rng(seed);
  const pos: number[] = [];
  const shape: number[] = [];
  const meta: number[] = [];
  // Spatial hash so nuclei do not pile up on each other.
  const cell = 0.0135;
  const taken = new Set<number>();
  const key = (x: number, z: number) => Math.floor((x + 2) / cell) * 4096 + Math.floor((z + 2) / cell);
  const put = (x: number, z: number, a: number, b: number, rot: number, cls: number, ringP: number, force = false) => {
    const k = key(x, z);
    if (!force && taken.has(k)) return;
    taken.add(k);
    pos.push(x, z);
    shape.push(a, b, rot);
    meta.push(rand(), cls, rand() < ringP ? 1 : 0, heat(x, z));
  };

  // 1. Gland epithelium: a regular palisade around each lumen.
  for (const g of GLANDS) {
    const c = Math.cos(g[4]);
    const s = Math.sin(g[4]);
    const per = Math.PI * (3 * (g[2] + g[3]) - Math.sqrt((3 * g[2] + g[3]) * (g[2] + 3 * g[3])));
    const n = Math.max(6, Math.round((per / 0.018) * Math.sqrt(scale)));
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + g[0];
      const wob = 1 + 0.12 * Math.sin(3 * th + g[0] * 9);
      const lx = Math.cos(th) * (g[2] * wob + 0.013);
      const lz = Math.sin(th) * (g[3] * wob + 0.013);
      const x = g[0] + c * lx - s * lz + (rand() - 0.5) * 0.003;
      const z = g[1] + s * lx + c * lz + (rand() - 0.5) * 0.003;
      if (tissueSd(x, z) > -0.004) continue;
      // radially elongated (columnar)
      put(x, z, 0.0098, 0.0062, Math.atan2(s * lx + c * lz, c * lx - s * lz), 0, 0.22, true);
    }
  }

  // 2. Stroma: sparse spindles along the fibre flow.
  const nStroma = Math.round(3800 * scale);
  for (let i = 0; i < nStroma; i++) {
    const x = SCAN.x0 + rand() * (SCAN.x1 - SCAN.x0);
    const z = SCAN.z0 + rand() * (SCAN.z1 - SCAN.z0);
    const keep = rand();
    const size = rand();
    const jitter = rand();
    if (tissueSd(x, z) > -0.01 || lumenSd(x, z) < 0.03) continue;
    const h = heat(x, z);
    if (keep > 0.34 + 0.5 * tone(x, z) || h > 0.55) continue;
    const flow = 0.9 * Math.sin(2.4 * x + 0.8) + 0.7 * Math.sin(3.7 * z - 1.1);
    put(x, z, 0.009 + size * 0.005, 0.0044 + size * 0.0016, flow + (jitter - 0.5) * 0.9, 0, 0.2);
  }

  // 3. Suspicious focus: crowded, larger, rounder, randomly oriented.
  const nHot = Math.round(4200 * scale);
  for (let i = 0; i < nHot; i++) {
    const x = HOT_BOX.cx + (rand() - 0.5) * (HOT_BOX.hx * 2 + 0.2);
    const z = HOT_BOX.cz + (rand() - 0.5) * (HOT_BOX.hz * 2 + 0.2);
    const keep = rand();
    const size = rand();
    const rot = rand() * Math.PI;
    const h = heat(x, z);
    if (keep > h * 1.05 || h < 0.18) continue;
    const a = 0.0095 + size * size * 0.008;
    put(x, z, a, a * (0.62 + 0.35 * keep), rot, h > 0.38 ? 1 : 0, 0.14);
  }

  return {
    count: pos.length / 2,
    pos: new Float32Array(pos),
    shape: new Float32Array(shape),
    meta: new Float32Array(meta),
  };
}
