import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural geometry kit for the quadruped (self-contained: the hero scene
 * has its own copy). Every builder returns a plain non-indexed
 * position + normal geometry so parts can be transformed and merged into one
 * mesh per material per moving link.
 */

export type P2 = readonly [number, number];

/** Reduce to non-indexed position + normal. */
export function plain(g: THREE.BufferGeometry) {
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

/** Solid of revolution about Y from an (r, y) profile listed bottom → top; corners stay crisp. */
export function lathe(profile: readonly P2[], seg: number, crisp = true) {
  const pts: THREE.Vector2[] = [];
  profile.forEach(([r, y], i) => {
    pts.push(new THREE.Vector2(r, y));
    if (crisp && i > 0 && i < profile.length - 1) pts.push(new THREE.Vector2(r, y));
  });
  return plain(new THREE.LatheGeometry(pts, seg));
}

/** Chamfered solid cylinder about Y spanning y0..y1. */
export function drum(r: number, y0: number, y1: number, seg: number, chamfer = 0.004) {
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
      [rIn, y0],
    ],
    seg,
  );
}

export function cyl(rTop: number, rBottom: number, h: number, seg: number, open = false) {
  return plain(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
}

export function rbox(w: number, h: number, d: number, radius: number, seg = 2) {
  return plain(new RoundedBoxGeometry(w, h, d, seg, radius));
}

export function sphere(r: number, w: number, h: number) {
  return plain(new THREE.SphereGeometry(r, w, h));
}

/**
 * Extrude a 2D outline along Z, centred on z = 0, total thickness `depth`,
 * with a chamfer of `bevel` that stays inside the drawn outline.
 */
export function prism(shape: THREE.Shape, depth: number, bevel: number, curveSegments: number) {
  const b = Math.min(bevel, depth / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    steps: 1,
    curveSegments,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 1,
  });
  g.translate(0, 0, -depth / 2 + b);
  const out = plain(g);
  // toCreasedNormals welds on a 0.01 grid, far too coarse at this scale: work at ×100.
  out.scale(100, 100, 100);
  toCreasedNormals(out, 0.5);
  out.scale(0.01, 0.01, 0.01);
  return out;
}

export function join(parts: THREE.BufferGeometry[]) {
  const out = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!out) throw new Error("quadruped geometry merge failed");
  return out;
}

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

/**
 * Faceted hull lofted along X through chamfered-rectangle sections (eight
 * sided rings in the YZ plane). Flat shaded, end caps closed. Reads as a
 * panelled shell when solid and gives clean longitudinal edges as line-work.
 */
export type Section = { x: number; y: number; w: number; h: number; c: number };

function ring(s: Section): number[] {
  const hw = s.w / 2;
  const hh = s.h / 2;
  const c = Math.min(s.c, hw * 0.9, hh * 0.9);
  // Counter-clockwise seen from +X, as (y, z) pairs.
  return [
    s.y - hh, -hw + c,
    s.y - hh, hw - c,
    s.y - hh + c, hw,
    s.y + hh - c, hw,
    s.y + hh, hw - c,
    s.y + hh, -hw + c,
    s.y + hh - c, -hw,
    s.y - hh + c, -hw,
  ];
}

export function loft(sections: readonly Section[]) {
  const pos: number[] = [];
  const tri = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  };
  const rings = sections.map(ring);
  for (let k = 0; k < sections.length - 1; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    const xa = sections[k].x;
    const xb = sections[k + 1].x;
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const a0y = a[i * 2], a0z = a[i * 2 + 1], a1y = a[j * 2], a1z = a[j * 2 + 1];
      const b0y = b[i * 2], b0z = b[i * 2 + 1], b1y = b[j * 2], b1z = b[j * 2 + 1];
      // Outward winding: ring runs CCW seen from +X, sections run toward +X.
      tri(xa, a0y, a0z, xb, b0y, b0z, xa, a1y, a1z);
      tri(xa, a1y, a1z, xb, b0y, b0z, xb, b1y, b1z);
    }
  }
  // Caps (fan around the section centre).
  const cap = (k: number, flip: boolean) => {
    const r = rings[k];
    const x = sections[k].x;
    const cy = sections[k].y;
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      if (flip) tri(x, cy, 0, x, r[i * 2], r[i * 2 + 1], x, r[j * 2], r[j * 2 + 1]);
      else tri(x, cy, 0, x, r[j * 2], r[j * 2 + 1], x, r[i * 2], r[i * 2 + 1]);
    }
  };
  cap(0, false);
  cap(sections.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Cast-link silhouette in the XY plane: a hub of radius r0 at the origin and
 * one of radius r1 at (0, -len), joined by straight tangent flanks.
 */
export function linkShape(r0: number, r1: number, len: number, seg = 10) {
  const s = new THREE.Shape();
  // External tangent between the two circles.
  const d = len;
  const a = Math.asin((r0 - r1) / d); // flank tilt
  // Right flank (x > 0) leaves the top hub at angle -a, meets the bottom hub at -a.
  const tx0 = r0 * Math.cos(a);
  const ty0 = -r0 * Math.sin(a);
  const tx1 = r1 * Math.cos(a);
  const ty1 = -len - r1 * Math.sin(a);
  s.moveTo(tx0, ty0);
  s.lineTo(tx1, ty1);
  s.absarc(0, -len, r1, -a, Math.PI + a, true);
  s.lineTo(-tx0, ty0);
  s.absarc(0, 0, r0, Math.PI + a, -a, true);
  s.closePath();
  void seg;
  return s;
}
