import * as THREE from "three";
import { EdgesGeometry } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FlankQuality } from "../contract";
import { HIP_X, L1, L2, FOOT_R } from "./gait";
import { band, cyl, drum, join, linkShape, loft, place, prism, rbox, roundedPoly, sphere, type Section } from "./geo";
import { TWIN_ORDER, type PartKey, type TwinMaterials } from "./materials";

/**
 * Procedural geometry of the quadruped, one bin set per rigid link.
 * Frames (all metres):
 * - body: origin midway between the hips at hip height, +X forward
 * - head: origin at the neck seam (body (HEAD_X, HEAD_Y, 0))
 * - abduction: origin on the abduction axis at the hip, rotates about X
 * - thigh: origin on the hip pitch axis in the leg plane, bone along -Y, rotates about Z
 * - shank: origin on the knee axis, bone along -Y, foot centre at (0, -L2, 0)
 */

export type Bins = Map<PartKey, THREE.BufferGeometry[]>;

function bins(): Bins {
  return new Map();
}

function add(b: Bins, key: PartKey, ...geos: THREE.BufferGeometry[]) {
  let list = b.get(key);
  if (!list) b.set(key, (list = []));
  list.push(...geos);
}

export const HEAD_X = 0.284;
export const HEAD_Y = 0.03;
/** Lidar optical centre, head frame. */
export const LIDAR = new THREE.Vector3(0.035, 0.122, 0);

const HP = Math.PI / 2;

/** Cylinder-like drum with its axis along X spanning x0..x1. */
function drumX(r: number, x0: number, x1: number, seg: number, chamfer?: number) {
  return place(drum(r, x0, x1, seg, chamfer), 0, 0, 0, 0, 0, -HP);
}
/** Drum with its axis along Z spanning z0..z1 (z0 < z1). */
function drumZ(r: number, z0: number, z1: number, seg: number, chamfer?: number) {
  return place(drum(r, -z1, -z0, seg, chamfer), 0, 0, 0, -HP, 0, 0);
}
function bandZ(rIn: number, rOut: number, z0: number, z1: number, seg: number) {
  return place(band(rIn, rOut, -z1, -z0, seg), 0, 0, 0, -HP, 0, 0);
}
function bandX(rIn: number, rOut: number, x0: number, x1: number, seg: number) {
  return place(band(rIn, rOut, x0, x1, seg), 0, 0, 0, 0, 0, -HP);
}

function scaleSections(s: readonly Section[], k: number, dx = 0): Section[] {
  return s.map((q) => ({ x: q.x + dx, y: q.y, w: q.w * k, h: q.h * k, c: q.c * k }));
}

/** Hull outline, body frame. */
const HULL: readonly Section[] = [
  { x: -0.35, y: 0.036, w: 0.15, h: 0.09, c: 0.028 },
  { x: -0.322, y: 0.03, w: 0.204, h: 0.13, c: 0.036 },
  { x: 0.245, y: 0.03, w: 0.204, h: 0.13, c: 0.036 },
  { x: 0.282, y: 0.03, w: 0.19, h: 0.122, c: 0.034 },
];

/** Hull between x0 and x1 (linear interpolation of the outline). */
function hullSlice(x0: number, x1: number, inset = 0): Section[] {
  const at = (x: number): Section => {
    for (let i = 0; i < HULL.length - 1; i++) {
      const a = HULL[i];
      const b = HULL[i + 1];
      if (x <= b.x + 1e-9) {
        const u = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
        return {
          x,
          y: a.y + (b.y - a.y) * u,
          w: a.w + (b.w - a.w) * u - inset * 2,
          h: a.h + (b.h - a.h) * u - inset * 2,
          c: a.c + (b.c - a.c) * u - inset * 0.8,
        };
      }
    }
    return { ...HULL[HULL.length - 1], x };
  };
  const out: Section[] = [at(x0)];
  for (const s of HULL) if (s.x > x0 + 1e-6 && s.x < x1 - 1e-6) out.push(at(s.x));
  out.push(at(x1));
  return out;
}

export function buildBody(quality: FlankQuality): Bins {
  const b = bins();
  const seg = quality === "high" ? 24 : 14;
  // Shell in three panels with dark seams between them; the core hull shows through the gaps.
  const seams = [-0.115, 0.105];
  const gap = 0.0045;
  add(b, "shell", loft(hullSlice(-0.35, seams[0] - gap)));
  add(b, "shell", loft(hullSlice(seams[0] + gap, seams[1] - gap)));
  add(b, "shell", loft(hullSlice(seams[1] + gap, 0.282)));
  add(b, "inner", loft(hullSlice(-0.34, 0.278, 0.005)));

  // Indigo side covers (proud of the flat flank), split at the seams.
  for (const s of [-1, 1]) {
    const cover = (x0: number, x1: number) => {
      const shape = roundedPoly([
        [x0, 0.004, 0.01],
        [x1, 0.004, 0.01],
        [x1, 0.057, 0.01],
        [x0, 0.057, 0.01],
      ]);
      return place(prism(shape, 0.008, 0.002, 4), 0, 0, s * 0.1);
    };
    add(b, "panel", cover(-0.305, seams[0] - gap * 2), cover(seams[0] + gap * 2, seams[1] - gap * 2), cover(seams[1] + gap * 2, 0.222));
    // Burgundy anodised tab on the rear cover and an ice status strip on the front one.
    add(b, "accent", place(rbox(0.05, 0.008, 0.004, 0.0015, 1), -0.25, 0.014, s * 0.1045));
    add(b, "glow", place(rbox(0.07, 0.004, 0.003, 0.0012, 1), 0.17, 0.046, s * 0.1045));
  }

  // Top: flush indigo service hatch with a small burgundy release tab.
  add(b, "panel", place(prism(roundedPoly([
    [-0.2, -0.052, 0.014],
    [0.07, -0.052, 0.014],
    [0.07, 0.052, 0.014],
    [-0.2, 0.052, 0.014],
  ]), 0.006, 0.0018, 4), 0, 0.094, 0, HP, 0, 0));
  add(b, "accent", place(rbox(0.018, 0.004, 0.03, 0.0015, 1), -0.185, 0.0975, 0));

  // Belly plate and the rear face light bar.
  add(b, "core", place(rbox(0.52, 0.014, 0.15, 0.006, 2), -0.03, -0.038, 0));
  add(b, "glow", place(rbox(0.004, 0.006, 0.07, 0.002, 1), -0.352, 0.05, 0));
  add(b, "visor", place(rbox(0.006, 0.04, 0.1, 0.008, 2), -0.35, 0.03, 0));

  // Hip mounting bosses where the abduction actuators enter the hull.
  for (const fx of [-1, 1]) {
    for (const s of [-1, 1]) {
      add(b, "steel", place(bandX(0.036, 0.046, -0.004, 0.004, seg), fx * HIP_X - fx * 0.06, 0, s * 0.085));
    }
  }
  return b;
}

export function buildHead(quality: FlankQuality): Bins {
  const b = bins();
  const seg = quality === "high" ? 28 : 16;
  const sections: Section[] = [
    { x: 0.004, y: 0, w: 0.19, h: 0.122, c: 0.034 },
    { x: 0.1, y: -0.004, w: 0.176, h: 0.11, c: 0.032 },
    { x: 0.138, y: -0.012, w: 0.134, h: 0.078, c: 0.026 },
  ];
  add(b, "shell", loft(sections));
  add(b, "inner", loft(scaleSections([sections[0], { ...sections[0], x: 0.03 }], 0.94, -0.01)));
  // Mirror-black sensor face with a stereo pair, a centre camera and an ice light line.
  add(b, "visor", place(rbox(0.008, 0.062, 0.118, 0.012, 2), 0.139, -0.012, 0));
  for (const z of [-0.034, 0.034]) {
    add(b, "lens", place(drumX(0.0095, 0.141, 0.146, 16, 0.002), 0, -0.016, z));
    add(b, "steel", place(bandX(0.0095, 0.013, 0.14, 0.144, 16), 0, -0.016, z));
  }
  add(b, "lens", place(drumX(0.0125, 0.141, 0.147, 18, 0.002), 0, -0.004, 0));
  add(b, "glow", place(rbox(0.003, 0.0035, 0.07, 0.0012, 1), 0.144, 0.013, 0));
  // Side cameras.
  for (const s of [-1, 1]) {
    add(b, "visor", place(rbox(0.04, 0.026, 0.006, 0.006, 2), 0.075, -0.004, s * 0.088));
    add(b, "lens", place(drumZ(0.007, -0.003, 0.003, 12, 0.0015), 0.075, -0.004, s * 0.091));
  }

  // Lidar: mast, puck with a black window and a glowing scan line, white cap.
  const L = LIDAR;
  add(b, "core", place(cyl(0.02, 0.026, 0.03, seg), L.x, 0.07, 0));
  add(b, "joint", place(drum(0.044, 0.084, 0.106, seg, 0.003), L.x, 0, 0));
  add(b, "visor", place(drum(0.042, 0.106, 0.138, seg, 0.001), L.x, 0, 0));
  add(b, "glow", place(band(0.0422, 0.0428, L.y - 0.0018, L.y + 0.0018, seg), L.x, 0, 0));
  add(b, "shell", place(drum(0.044, 0.138, 0.15, seg, 0.004), L.x, 0, 0));
  add(b, "steel", place(band(0.044, 0.0452, 0.104, 0.108, seg), L.x, 0, 0));
  return b;
}

/** Abduction actuator housing (rides on the abduction joint). */
export function buildAbduction(quality: FlankQuality, fore: number, side: number): Bins {
  const b = bins();
  const seg = quality === "high" ? 28 : 16;
  // Housing runs from the hip toward the body centre.
  const xIn = -fore * 0.078;
  const xOut = fore * 0.022;
  const x0 = Math.min(xIn, xOut);
  const x1 = Math.max(xIn, xOut);
  add(b, "joint", drumX(0.041, x0, x1, seg, 0.005));
  add(b, "steel", bandX(0.04, 0.0435, xOut - 0.006 * fore - 0.003, xOut - 0.006 * fore + 0.003, seg));
  add(b, "shell", place(drumX(0.034, -0.004, 0.004, seg, 0.002), xOut + fore * 0.002, 0, 0));
  // Hip pitch motor, inboard of the thigh.
  const zA = side > 0 ? 0.016 : -0.046;
  const zB = side > 0 ? 0.046 : -0.016;
  add(b, "joint", place(drumZ(0.047, zA, zB, seg, 0.005), 0, 0, 0));
  add(b, "steel", place(bandZ(0.04, 0.049, side > 0 ? 0.04 : -0.044, side > 0 ? 0.044 : -0.04, seg), 0, 0, 0));
  return b;
}

export function buildThigh(quality: FlankQuality, side: number): Bins {
  const b = bins();
  const seg = quality === "high" ? 24 : 14;
  const cs = quality === "high" ? 10 : 6;
  // Graphite link, white outboard cover, knee actuator with machined rings.
  add(b, "core", prism(linkShape(0.042, 0.03, L1), 0.036, 0.004, cs));
  add(b, "shell", place(prism(linkShape(0.038, 0.024, L1 - 0.02), 0.012, 0.003, cs), 0, -0.004, side * 0.022));
  // Hub cap: graphite centre inside a thin burgundy anodised ring.
  add(b, "joint", place(drumZ(0.0125, -0.002, 0.002, seg, 0.001), 0, 0, side * 0.03));
  add(b, "accent", place(bandZ(0.0125, 0.017, -0.0015, 0.0015, seg), 0, 0, side * 0.0305));
  add(b, "steel", place(bandZ(0.026, 0.031, -0.003, 0.003, seg), 0, 0, side * 0.029));
  add(b, "joint", place(drumZ(0.032, -0.028, 0.028, seg, 0.004), 0, -L1, 0));
  for (const z of [-0.028, 0.028]) add(b, "steel", place(bandZ(0.026, 0.0335, z - 0.002, z + 0.002, seg), 0, -L1, 0));
  return b;
}

export function buildShank(quality: FlankQuality): Bins {
  const b = bins();
  const seg = quality === "high" ? 20 : 12;
  const cs = quality === "high" ? 10 : 6;
  add(b, "core", prism(linkShape(0.027, 0.016, L2 - 0.02), 0.028, 0.003, cs));
  // Indigo shin guard on the front edge.
  add(b, "panel", prism(roundedPoly([
    [0.012, -0.03, 0.006],
    [0.03, -0.05, 0.008],
    [0.024, -0.15, 0.008],
    [0.008, -0.17, 0.006],
    [0.004, -0.06, 0.004],
  ]), 0.02, 0.003, 4));
  // Ferrule and rubber foot.
  add(b, "steel", place(band(0.013, 0.0165, -L2 + 0.016, -L2 + 0.024, seg), 0, 0, 0));
  const foot = sphere(FOOT_R, seg, Math.round(seg * 0.6));
  foot.scale(1, 0.92, 1);
  add(b, "rubber", place(foot, 0, -L2, 0));
  add(b, "rubber", place(cyl(0.015, FOOT_R * 0.85, 0.02, seg), 0, -L2 + 0.012, 0));
  return b;
}

/* ───────────── Baking ───────────── */

export function bakeField(parent: THREE.Object3D, b: Bins, mats: Record<PartKey, THREE.Material>, trash: THREE.BufferGeometry[]) {
  b.forEach((list, key) => {
    const merged = join(list);
    const geo = mergeVertices(merged, 1e-5);
    merged.dispose();
    geo.computeBoundingSphere();
    trash.push(geo);
    const mesh = new THREE.Mesh(geo, mats[key]);
    mesh.name = key;
    parent.add(mesh);
  });
  b.clear();
}

const MAIN: readonly PartKey[] = ["shell", "panel", "visor", "accent"];
const HOT: readonly PartKey[] = ["glow", "lens"];
/**
 * Crease angle (degrees) per slot for the line-work. Chamfered actuator drums
 * and tiny accents are left to the fresnel silhouette, otherwise the joints
 * turn into a knot of concentric rings at panel scale.
 */
const CREASE: Record<PartKey, number> = {
  shell: 28,
  panel: 28,
  visor: 28,
  accent: 70,
  glow: 28,
  lens: 70,
  core: 28,
  inner: 28,
  joint: 70,
  steel: 95,
  rubber: 28,
};

function edgeLines(geos: [THREE.BufferGeometry, number][], trash: THREE.BufferGeometry[]) {
  const chunks: Float32Array[] = [];
  let n = 0;
  for (const [g, crease] of geos) {
    const edges = new EdgesGeometry(g, crease);
    const a = edges.attributes.position.array as Float32Array;
    chunks.push(a);
    n += a.length;
    edges.dispose();
  }
  if (!n) return null;
  const all = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  const lg = new LineSegmentsGeometry().setPositions(all);
  trash.push(lg);
  return lg;
}

export function bakeTwin(parent: THREE.Object3D, b: Bins, m: TwinMaterials, trash: THREE.BufferGeometry[]) {
  const all: THREE.BufferGeometry[] = [];
  const main: [THREE.BufferGeometry, number][] = [];
  const mech: [THREE.BufferGeometry, number][] = [];
  const hot: [THREE.BufferGeometry, number][] = [];
  b.forEach((list, key) => {
    if (key === "inner") {
      // Seam backing only matters for the solid machine.
      list.forEach((g) => g.dispose());
      return;
    }
    const merged = join(list.map((g) => g.clone()));
    const entry: [THREE.BufferGeometry, number] = [merged, CREASE[key]];
    if (MAIN.includes(key)) main.push(entry);
    else if (HOT.includes(key)) hot.push(entry);
    else mech.push(entry);
    all.push(...list);
  });
  const mainGeo = edgeLines(main, trash);
  const lines: [THREE.BufferGeometry | null, (THREE.Material | null)[]][] = [
    [mainGeo, [m.glowMain, m.lineMain, m.hiddenMain]],
    [edgeLines(mech, trash), [m.lineMech, m.hiddenMech]],
    [edgeLines(hot, trash), [m.lineHot]],
  ];
  [...main, ...mech, ...hot].forEach(([g]) => g.dispose());
  const shellGeo = join(all);
  shellGeo.computeBoundingSphere();
  trash.push(shellGeo);
  const shell = new THREE.Mesh(shellGeo, m.shell);
  shell.renderOrder = TWIN_ORDER.shell;
  parent.add(shell);
  for (const [geo, mats] of lines) {
    if (!geo) continue;
    for (const mat of mats) {
      if (!mat) continue;
      const seg = new LineSegments2(geo as LineSegmentsGeometry, mat as never);
      seg.renderOrder = TWIN_ORDER.lines;
      parent.add(seg);
    }
  }
  b.clear();
}
