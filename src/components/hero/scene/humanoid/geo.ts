import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural surfacing kit for the humanoid: superelliptic lofts (solid cores
 * and proud shell panels with turned-down rims) plus a per-bone collector that
 * merges everything sharing a material into one draw call.
 *
 * Angles run around +Y: 0 = +Z (front), +π/2 = +X, π = -Z (back).
 */

export type Sec = {
  /** Station along the loft axis. */
  y: number;
  /** Half width (X). */
  rx: number;
  /** Half depth toward +Z. */
  rz: number;
  /** Half depth toward -Z (defaults to rz). */
  rb?: number;
  x?: number;
  z?: number;
  /** Superellipse exponent: 2 = ellipse, higher = boxier. */
  n?: number;
};
export type FullSec = Required<Sec>;

export const sec = (y: number, rx: number, rz: number, extra: Partial<Sec> = {}): Sec => ({ y, rx, rz, ...extra });

const blank = (): FullSec => ({ y: 0, rx: 0, rz: 0, rb: 0, x: 0, z: 0, n: 2.5 });

/** Fill defaults and order the stations bottom → top. */
export function norm(secs: readonly Sec[], n = 2.5): FullSec[] {
  const out = secs.map((s) => ({
    y: s.y,
    rx: s.rx,
    rz: s.rz,
    rb: s.rb ?? s.rz,
    x: s.x ?? 0,
    z: s.z ?? 0,
    n: s.n ?? n,
  }));
  if (out.length > 1 && out[out.length - 1].y < out[0].y) out.reverse();
  return out;
}

function crom(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
}

/** Catmull-Rom resample of a station list at v ∈ [0, 1]. */
export function sampleSec(secs: readonly FullSec[], v: number, out: FullSec): FullSec {
  const last = secs.length - 1;
  const f = Math.min(1, Math.max(0, v)) * last;
  const i = Math.min(last - 1, Math.floor(f));
  const t = f - i;
  const a = secs[Math.max(0, i - 1)];
  const b = secs[i];
  const c = secs[i + 1];
  const d = secs[Math.min(last, i + 2)];
  out.y = crom(a.y, b.y, c.y, d.y, t);
  out.rx = Math.max(1e-4, crom(a.rx, b.rx, c.rx, d.rx, t));
  out.rz = Math.max(1e-4, crom(a.rz, b.rz, c.rz, d.rz, t));
  out.rb = Math.max(1e-4, crom(a.rb, b.rb, c.rb, d.rb, t));
  out.x = crom(a.x, b.x, c.x, d.x, t);
  out.z = crom(a.z, b.z, c.z, d.z, t);
  out.n = b.n + (c.n - b.n) * t;
  return out;
}

function vAtY(secs: readonly FullSec[], y: number, tmp: FullSec) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) * 0.5;
    if (sampleSec(secs, mid, tmp).y < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

function ringX(s: FullSec, a: number, lift = 0) {
  const c = Math.sin(a);
  return s.x + Math.sign(c) * Math.pow(Math.abs(c), 2 / s.n) * (s.rx + lift);
}
function ringZ(s: FullSec, a: number, lift = 0) {
  const c = Math.cos(a);
  return s.z + Math.sign(c) * Math.pow(Math.abs(c), 2 / s.n) * ((c >= 0 ? s.rz : s.rb) + lift);
}

export type LoftOpts = {
  /** Segments around. */
  seg: number;
  /** Resampled rows along the axis. */
  rows: number;
  /** Open panel between two angles instead of a closed tube. */
  arc?: readonly [number, number];
  /** Depth of the turned-down edge wall (panels, or tubes with cap: false). */
  rim?: number;
  /** Close both ends of a tube (default true). */
  cap?: boolean;
  /** Panels: per-column [bottom, top] fraction of the station range (shapes the outline). */
  trim?: (u: number) => readonly [number, number];
  /** Default superellipse exponent for stations that carry none. */
  n?: number;
};

/** Superelliptic loft through the stations: a closed solid, or a shell panel with crisp rims. */
export function loft(input: readonly Sec[], o: LoftOpts): THREE.BufferGeometry {
  const secs = norm(input, o.n);
  const full = !o.arc;
  const R = o.rows + 1;
  const C = full ? o.seg : o.seg + 1;
  const a0 = o.arc ? o.arc[0] : 0;
  const a1 = o.arc ? o.arc[1] : Math.PI * 2;
  const pos: number[] = [];
  const cen: number[] = [];
  const idx: number[] = [];
  const s = blank();

  for (let i = 0; i < R; i++) {
    const v0 = i / (R - 1);
    for (let j = 0; j < C; j++) {
      const u = j / o.seg;
      let v = v0;
      if (o.trim) {
        const [lo, hi] = o.trim(u);
        v = lo + (hi - lo) * v0;
      }
      sampleSec(secs, v, s);
      const a = a0 + (a1 - a0) * u;
      pos.push(ringX(s, a), s.y, ringZ(s, a));
      cen.push(s.x, s.y, s.z);
    }
  }
  const W = full ? C : C - 1;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < W; j++) {
      const a = i * C + j;
      const b = i * C + ((j + 1) % C);
      const c = (i + 1) * C + j;
      const d = (i + 1) * C + ((j + 1) % C);
      idx.push(a, b, d, a, d, c);
    }
  }

  // Edge wall: duplicate the border (crisp crease) and drop it toward the axis.
  const wall = (ids: number[], flip: boolean, closed: boolean) => {
    const rim = o.rim ?? 0;
    const base = pos.length / 3;
    const n = ids.length;
    for (const id of ids) pos.push(pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2]);
    for (const id of ids) {
      const px = pos[id * 3];
      const py = pos[id * 3 + 1];
      const pz = pos[id * 3 + 2];
      const dx = cen[id * 3] - px;
      const dz = cen[id * 3 + 2] - pz;
      const l = Math.hypot(dx, dz);
      const f = l > 1e-6 ? Math.min(rim, l * 0.95) / l : 0;
      pos.push(px + dx * f, py, pz + dz * f);
    }
    const m = closed ? n : n - 1;
    for (let k = 0; k < m; k++) {
      const p0 = base + k;
      const p1 = base + ((k + 1) % n);
      const q0 = p0 + n;
      const q1 = p1 + n;
      if (flip) idx.push(p0, p1, q0, p1, q1, q0);
      else idx.push(p0, q0, p1, p1, q0, q1);
    }
  };
  const row = (i: number) => Array.from({ length: C }, (_, j) => i * C + j);
  const col = (j: number) => Array.from({ length: R }, (_, i) => i * C + j);

  if (full) {
    if (o.cap === false) {
      if (o.rim) {
        wall(row(0), false, true);
        wall(row(R - 1), true, true);
      }
    } else {
      const capAt = (i: number, top: boolean) => {
        const base = pos.length / 3;
        for (let j = 0; j < C; j++) {
          const id = i * C + j;
          pos.push(pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2]);
        }
        const c = pos.length / 3;
        pos.push(cen[i * C * 3], cen[i * C * 3 + 1], cen[i * C * 3 + 2]);
        for (let j = 0; j < C; j++) {
          const p0 = base + j;
          const p1 = base + ((j + 1) % C);
          if (top) idx.push(c, p0, p1);
          else idx.push(c, p1, p0);
        }
      };
      capAt(0, false);
      capAt(R - 1, true);
    }
  } else if (o.rim) {
    wall(row(0), false, false);
    wall(row(R - 1), true, false);
    wall(col(0), true, false);
    wall(col(C - 1), false, false);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Detail = { seg: number; rows: number; ps: number; hi: boolean };

export type ShellOpts = Omit<LoftOpts, "seg" | "rows" | "n"> & {
  /** Stations sampled from the body between y0 and y1. */
  k?: number;
  /** Row count override (thin bands need one). */
  rows?: number;
  /** Per-station tweak (f = 0 bottom → 1 top) after inflation. */
  mod?: (s: FullSec, f: number) => void;
};

/**
 * A limb/trunk volume described once, from which both the dark structural
 * core and the shell panels that sit proud of it are derived, so panels can
 * never sink into or float off the body underneath.
 */
export function body(input: readonly Sec[], n = 2.5) {
  const secs = norm(input, n);
  const tmp = blank();
  const y0 = secs[0].y;
  const y1 = secs[secs.length - 1].y;
  const stations = (from: number, to: number, d: number, k: number, mod?: ShellOpts["mod"]) => {
    const out: FullSec[] = [];
    const lo = Math.max(y0, Math.min(from, to));
    const hi = Math.min(y1, Math.max(from, to));
    for (let i = 0; i < k; i++) {
      const f = i / (k - 1);
      const y = lo + (hi - lo) * f;
      const st = sampleSec(secs, vAtY(secs, y, tmp), blank());
      st.y = y;
      st.rx += d;
      st.rz += d;
      st.rb += d;
      mod?.(st, f);
      out.push(st);
    }
    return out;
  };
  return {
    secs,
    /** Closed solid of the whole volume. */
    solid: (q: Detail) => loft(secs, { seg: q.seg, rows: q.rows * 2 }),
    /** Shell offset by d between two stations: a panel (arc) or a sleeve (no arc, open ends). */
    shell: (q: Detail, from: number, to: number, d: number, o: ShellOpts = {}) => {
      const { k = 6, mod, rows, ...rest } = o;
      return loft(stations(from, to, d, k, mod), {
        seg: q.seg,
        rows: rows ?? q.rows,
        cap: rest.arc ? undefined : false,
        ...rest,
      });
    },
    /** Point on the surface (lifted by `lift`) at station y, angle a. */
    at: (y: number, a: number, lift: number, out: THREE.Vector3) => {
      sampleSec(secs, vAtY(secs, y, tmp), tmp);
      return out.set(ringX(tmp, a, lift), y, ringZ(tmp, a, lift));
    },
  };
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Build-time transform: translate, then XYZ euler, then scale. */
export function xf(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(px, py, pz), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** Collects geometry per material for one rigid bone, then bakes one mesh per material. */
export class Part<K extends string> {
  readonly group = new THREE.Group();
  private readonly buckets = new Map<K, THREE.BufferGeometry[]>();

  add(mat: K, geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
    if (geo.getAttribute("uv")) geo.deleteAttribute("uv");
    if (m) geo.applyMatrix4(m);
    const list = this.buckets.get(mat);
    if (list) list.push(geo);
    else this.buckets.set(mat, [geo]);
    return this;
  }

  bake(mats: Record<K, THREE.Material>, sink: THREE.BufferGeometry[]) {
    this.buckets.forEach((list, key) => {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) return;
      if (list.length > 1) list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mats[key]);
      this.group.add(mesh);
      sink.push(merged);
    });
    this.buckets.clear();
    return this.group;
  }
}

/* Primitive helpers (segment counts supplied by the caller's detail tier). */
export const cylX = (r: number, len: number, seg: number) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
export const cylY = (r0: number, r1: number, len: number, seg: number) => new THREE.CylinderGeometry(r1, r0, len, seg);
export const torusX = (r: number, tube: number, seg: number) => new THREE.TorusGeometry(r, tube, 8, seg).rotateY(Math.PI / 2);
export const torusY = (r: number, tube: number, seg: number) => new THREE.TorusGeometry(r, tube, 8, seg).rotateX(Math.PI / 2);
export const ball = (r: number, seg: number) => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.6)));
