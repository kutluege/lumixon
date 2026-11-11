import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural geometry kit for the industrial arm. Every builder returns a
 * plain non-indexed position+normal geometry so parts can be transformed and
 * merged into one mesh per material per link (few draw calls, no textures).
 */

export type P2 = readonly [number, number];

/** Reduce to non-indexed position + normal. */
function plain(g: THREE.BufferGeometry) {
  let out = g;
  if (g.index) {
    out = g.toNonIndexed();
    g.dispose();
  }
  for (const name of Object.keys(out.attributes)) {
    if (name !== "position" && name !== "normal") out.deleteAttribute(name);
  }
  out.clearGroups();
  return out;
}

const mtx = new THREE.Matrix4();
const eul = new THREE.Euler();
const quat = new THREE.Quaternion();
const vPos = new THREE.Vector3();
const vOne = new THREE.Vector3(1, 1, 1);

/** Rotate (XYZ euler) then translate a geometry in place. */
export function place(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  mtx.compose(vPos.set(x, y, z), quat.setFromEuler(eul.set(rx, ry, rz)), vOne);
  return g.applyMatrix4(mtx);
}

/**
 * Solid of revolution about Y from an (r, y) profile listed bottom → top
 * (outer surface on the right). `crisp` keeps every profile corner a hard
 * machined edge; otherwise the profile is shaded as one smooth curve.
 */
export function lathe(profile: readonly P2[], seg: number, crisp = true) {
  const pts: THREE.Vector2[] = [];
  profile.forEach(([r, y], i) => {
    pts.push(new THREE.Vector2(r, y));
    if (crisp && i > 0 && i < profile.length - 1) pts.push(new THREE.Vector2(r, y));
  });
  return plain(new THREE.LatheGeometry(pts, seg));
}

/** Chamfered solid cylinder about Y spanning y0..y1. */
export function drum(r: number, y0: number, y1: number, seg: number, chamfer = 0.006) {
  const c = Math.min(chamfer, r * 0.5, (y1 - y0) * 0.45);
  return lathe(
    [
      [0, y0],
      [r - c, y0],
      [r, y0 + c],
      [r, y1 - c],
      [r - c, y1],
      [0, y1],
    ],
    seg,
  );
}

/** Solid ring (rectangular section) about Y. */
export function band(rIn: number, rOut: number, y0: number, y1: number, seg: number) {
  return lathe(
    [
      [rIn, y0],
      [rOut, y0],
      [rOut, y1],
      [rIn, y1],
    ],
    seg,
  );
}

/** Flat annulus facing +Y. */
export function annulus(rIn: number, rOut: number, y: number, seg: number) {
  return lathe(
    [
      [rOut, y],
      [rIn, y],
    ],
    seg,
  );
}

/**
 * Extrude a 2D outline along Z, centred on z = 0, total thickness `depth`,
 * with a chamfer of `bevel` that stays inside the drawn outline. Curved
 * outline runs shade smooth; chamfers and corners stay crisp.
 */
export function prism(shape: THREE.Shape, depth: number, bevel: number, curveSegments: number, bevelSegments = 1) {
  const b = Math.min(bevel, depth / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    steps: 1,
    curveSegments,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments,
  });
  g.translate(0, 0, -depth / 2 + b);
  // toCreasedNormals welds on a 0.01 grid, far too coarse at this scale: work at ×100.
  const out = plain(g);
  out.scale(100, 100, 100);
  toCreasedNormals(out, 0.3);
  out.scale(0.01, 0.01, 0.01);
  return out;
}

export function rbox(w: number, h: number, d: number, radius: number, seg = 2) {
  return plain(new RoundedBoxGeometry(w, h, d, seg, radius));
}

export function cyl(rTop: number, rBottom: number, h: number, seg: number, open = false) {
  return plain(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
}

export function tube(points: readonly (readonly [number, number, number])[], radius: number, tubular: number, radial: number) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal",
  );
  return plain(new THREE.TubeGeometry(curve, tubular, radius, radial, false));
}

/** `n` hex bolt heads on a circle of radius R in the XZ plane, heads rising from y = 0 to y = h. */
export function boltCircle(n: number, R: number, r: number, h: number, phase = 0) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    parts.push(place(cyl(r, r, h, 6), Math.cos(a) * R, h / 2, Math.sin(a) * R, 0, a));
  }
  return join(parts);
}

export function join(parts: THREE.BufferGeometry[]) {
  const out = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!out) throw new Error("arm geometry merge failed");
  return out;
}

/* ───────────── 2D outlines ───────────── */

/** Closed polygon whose corners are rounded by the given radii: [x, y, radius]. */
export function roundedPoly(pts: readonly (readonly [number, number, number])[]) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i + n - 1) % n];
    const [cx, cy, r] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const k = Math.min(r, inLen * 0.5, outLen * 0.5);
    const ax = cx - ((cx - px) / inLen) * k;
    const ay = cy - ((cy - py) / inLen) * k;
    if (i === 0) s.moveTo(ax, ay);
    else s.lineTo(ax, ay);
    if (k > 0) s.quadraticCurveTo(cx, cy, cx + ((nx - cx) / outLen) * k, cy + ((ny - cy) / outLen) * k);
  }
  s.closePath();
  return s;
}

/** Line to a corner and round it with radius r: previous point → corner → next point. */
export function corner(s: THREE.Path, px: number, py: number, cx: number, cy: number, nx: number, ny: number, r: number) {
  const inLen = Math.hypot(cx - px, cy - py);
  const outLen = Math.hypot(nx - cx, ny - cy);
  s.lineTo(cx - ((cx - px) / inLen) * r, cy - ((cy - py) / inLen) * r);
  s.quadraticCurveTo(cx, cy, cx + ((nx - cx) / outLen) * r, cy + ((ny - cy) / outLen) * r);
}

/**
 * Point where a line from (px, py) touches the circle (cx, cy, r), as
 * [x, y, angle on the circle]. side = -1 / +1 picks the tangent that a
 * counter-clockwise arc would start from / end at.
 */
export function tangentPoint(cx: number, cy: number, r: number, px: number, py: number, side: -1 | 1) {
  const dist = Math.hypot(cx - px, cy - py);
  const a = Math.atan2(cy - py, cx - px) + side * Math.asin(r / dist);
  const len = Math.sqrt(dist * dist - r * r);
  const x = px + Math.cos(a) * len;
  const y = py + Math.sin(a) * len;
  return [x, y, Math.atan2(y - cy, x - cx)] as const;
}

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  return roundedPoly([
    [cx - w / 2, cy - h / 2, r],
    [cx + w / 2, cy - h / 2, r],
    [cx + w / 2, cy + h / 2, r],
    [cx - w / 2, cy + h / 2, r],
  ]);
}

/**
 * Cast-link silhouette: a hub of radius r0 at the origin and one of radius r1
 * at (0, len), joined by flanks that neck in to a waist (tangent-continuous).
 * a0 / a1 are the angles at which the flanks leave / meet the hubs.
 */
export function boneShape(r0: number, r1: number, len: number, a0: number, a1: number) {
  const p0x = r0 * Math.cos(a0);
  const p0y = r0 * Math.sin(a0);
  const p1x = r1 * Math.cos(a1);
  const p1y = len - r1 * Math.sin(a1);
  // Tangent directions at the two hub points (pointing along the flank, bottom → top).
  const d0x = -Math.sin(a0);
  const d0y = Math.cos(a0);
  const d1x = Math.sin(a1);
  const d1y = Math.cos(a1);
  // Control point = intersection of the two tangent lines.
  const det = d0x * -d1y - d0y * -d1x;
  const u = ((p1x - p0x) * -d1y - (p1y - p0y) * -d1x) / det;
  const cx = p0x + d0x * u;
  const cy = p0y + d0y * u;
  const s = new THREE.Shape();
  s.moveTo(p0x, p0y);
  s.quadraticCurveTo(cx, cy, p1x, p1y);
  s.absarc(0, len, r1, -a1, Math.PI + a1, false);
  s.quadraticCurveTo(-cx, cy, -p0x, p0y);
  s.absarc(0, 0, r0, Math.PI - a0, Math.PI * 2 + a0, false);
  s.closePath();
  return s;
}

/* ───────────── Part collector ───────────── */

/** Collects geometry per material key and bakes one welded mesh per material. */
export class Kit<K extends string> {
  private bins = new Map<K, THREE.BufferGeometry[]>();

  add(key: K, ...geos: THREE.BufferGeometry[]) {
    let bin = this.bins.get(key);
    if (!bin) this.bins.set(key, (bin = []));
    bin.push(...geos);
    return this;
  }

  /** Adds one mesh per material to `parent`; created geometries are pushed to `trash` for disposal. */
  bake(parent: THREE.Object3D, mats: Record<K, THREE.Material>, trash: THREE.BufferGeometry[]) {
    this.bins.forEach((bin, key) => {
      const merged = join(bin);
      const geo = mergeVertices(merged, 1e-5);
      merged.dispose();
      geo.computeBoundingSphere();
      trash.push(geo);
      parent.add(new THREE.Mesh(geo, mats[key]));
    });
    this.bins.clear();
    return parent;
  }
}

/* ───────────── Flexing hose ───────────── */

/**
 * Tube swept along a cubic Bézier whose control points are rewritten every
 * frame (cable runs that cross a moving joint). Buffers are allocated once.
 */
export class Hose {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  private pos: THREE.BufferAttribute;
  private nor: THREE.BufferAttribute;
  private segs: number;
  private sides: number;
  private radius: number;
  private ring: Float32Array;

  constructor(material: THREE.Material, radius: number, segs: number, sides: number) {
    this.segs = segs;
    this.sides = sides;
    this.radius = radius;
    this.ring = new Float32Array(sides * 2);
    for (let j = 0; j < sides; j++) {
      this.ring[j * 2] = Math.cos((j / sides) * Math.PI * 2);
      this.ring[j * 2 + 1] = Math.sin((j / sides) * Math.PI * 2);
    }
    const count = (segs + 1) * sides;
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    const index: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j;
        const b = i * sides + ((j + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        index.push(a, b, c, b, d, c);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", this.pos);
    this.geometry.setAttribute("normal", this.nor);
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }

  /** Bézier from p0 to p1 with control points c0, c1 (all in the mesh's parent frame). */
  set(
    p0x: number, p0y: number, p0z: number,
    c0x: number, c0y: number, c0z: number,
    c1x: number, c1y: number, c1z: number,
    p1x: number, p1y: number, p1z: number,
  ) {
    const { segs, sides, radius, ring } = this;
    const P = this.pos.array as Float32Array;
    const N = this.nor.array as Float32Array;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const v = 1 - u;
      const b0 = v * v * v;
      const b1 = 3 * v * v * u;
      const b2 = 3 * v * u * u;
      const b3 = u * u * u;
      const x = b0 * p0x + b1 * c0x + b2 * c1x + b3 * p1x;
      const y = b0 * p0y + b1 * c0y + b2 * c1y + b3 * p1y;
      const z = b0 * p0z + b1 * c0z + b2 * c1z + b3 * p1z;
      // Derivative → unit tangent.
      const e0 = 3 * v * v;
      const e1 = 6 * v * u;
      const e2 = 3 * u * u;
      let tx = e0 * (c0x - p0x) + e1 * (c1x - c0x) + e2 * (p1x - c1x);
      let ty = e0 * (c0y - p0y) + e1 * (c1y - c0y) + e2 * (p1y - c1y);
      let tz = e0 * (c0z - p0z) + e1 * (c1z - c0z) + e2 * (p1z - c1z);
      const tl = 1 / (Math.hypot(tx, ty, tz) || 1);
      tx *= tl;
      ty *= tl;
      tz *= tl;
      if (i === 0) {
        // Any reference not parallel to the tangent seeds the frame.
        if (Math.abs(tz) < 0.9) {
          nx = 0;
          ny = 0;
          nz = 1;
        } else {
          nx = 1;
          ny = 0;
          nz = 0;
        }
      }
      // Parallel transport: project the previous normal off the new tangent.
      const dot = nx * tx + ny * ty + nz * tz;
      nx -= dot * tx;
      ny -= dot * ty;
      nz -= dot * tz;
      const nl = 1 / (Math.hypot(nx, ny, nz) || 1);
      nx *= nl;
      ny *= nl;
      nz *= nl;
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      for (let j = 0; j < sides; j++) {
        const ca = ring[j * 2];
        const sa = ring[j * 2 + 1];
        const rx = ca * nx + sa * bx;
        const ry = ca * ny + sa * by;
        const rz = ca * nz + sa * bz;
        const o = (i * sides + j) * 3;
        P[o] = x + rx * radius;
        P[o + 1] = y + ry * radius;
        P[o + 2] = z + rz * radius;
        N[o] = rx;
        N[o + 1] = ry;
        N[o + 2] = rz;
      }
    }
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
  }
}
