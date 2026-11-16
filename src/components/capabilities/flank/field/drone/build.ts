import * as THREE from "three";
import type { FlankQuality } from "../../contract";
import type { Bins } from "../../robot/build";
import { band, cyl, drum, loft, place, prism, rbox, roundedPoly, sphere, type Section } from "../../robot/geo";
import type { PartKey } from "../../robot/materials";
import { MODEL } from "./flight";

/**
 * Procedural geometry of the survey quadcopter, in the quadruped's design
 * language and material slots (white shell panels over a graphite core, dark
 * actuators with machined rings, indigo covers, a mirror-black sensor face,
 * the same lidar puck — here slung under the nose on a gimbal, axis forward,
 * so it scans a plane across the track).
 *
 * Airframe frame (model units, drawn at DRONE_SCALE): origin at the centre
 * of the body, +X forward, +Y up, motors at (±MODEL.arm, ·, ±MODEL.arm).
 * Gimbal frame: origin on the gimbal's mount under the nose.
 */

const ROTOR_ARM = MODEL.arm;
const ROTOR_R = MODEL.rotor;

const HP = Math.PI / 2;

/** Gimbal mount, airframe frame. The scanner's optical centre hangs PUCK_DROP below it. */
export const GIMBAL = new THREE.Vector3(MODEL.scannerX, -0.04, 0);
/** Scanner optical centre, gimbal frame. */
export const SCANNER = new THREE.Vector3(0, MODEL.scannerY - GIMBAL.y, 0);
const PUCK_DROP = -SCANNER.y;
/** Rotor plane height, airframe frame. */
export const ROTOR_Y = 0.05;

function add(b: Bins, key: PartKey, ...geos: THREE.BufferGeometry[]) {
  let list = b.get(key);
  if (!list) b.set(key, (list = []));
  list.push(...geos);
}

/** Drum / ring with its axis along X spanning x0..x1. */
function drumX(r: number, x0: number, x1: number, seg: number, chamfer?: number) {
  return place(drum(r, x0, x1, seg, chamfer), 0, 0, 0, 0, 0, -HP);
}
function bandX(rIn: number, rOut: number, x0: number, x1: number, seg: number) {
  return place(band(rIn, rOut, x0, x1, seg), 0, 0, 0, 0, 0, -HP);
}
function drumZ(r: number, z0: number, z1: number, seg: number, chamfer?: number) {
  return place(drum(r, -z1, -z0, seg, chamfer), 0, 0, 0, -HP, 0, 0);
}

const UP = new THREE.Vector3(0, 1, 0);
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vOne = new THREE.Vector3(1, 1, 1);
const quat = new THREE.Quaternion();
const mtx = new THREE.Matrix4();

/** Straight tube between two points. */
function tube(a: readonly [number, number, number], b: readonly [number, number, number], r: number, seg: number) {
  vA.set(...a);
  vB.set(...b);
  const len = vA.distanceTo(vB);
  const g = cyl(r, r, len, seg);
  quat.setFromUnitVectors(UP, vB.clone().sub(vA).normalize());
  mtx.compose(vA.add(vB).multiplyScalar(0.5), quat, vOne);
  return g.applyMatrix4(mtx);
}

/** Hull outline, airframe frame: tapered tail, flat mid-section, chamfered nose. */
const HULL: readonly Section[] = [
  { x: -0.205, y: 0.008, w: 0.066, h: 0.04, c: 0.014 },
  { x: -0.165, y: 0, w: 0.15, h: 0.08, c: 0.028 },
  { x: 0.115, y: 0, w: 0.15, h: 0.08, c: 0.028 },
  { x: 0.17, y: -0.004, w: 0.116, h: 0.062, c: 0.024 },
];

function hullAt(x: number, inset: number): Section {
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
}

function hullSlice(x0: number, x1: number, inset = 0): Section[] {
  const out: Section[] = [hullAt(x0, inset)];
  for (const s of HULL) if (s.x > x0 + 1e-6 && s.x < x1 - 1e-6) out.push(hullAt(s.x, inset));
  out.push(hullAt(x1, inset));
  return out;
}

/** Everything rigid with the airframe: body, arms, motors, landing gear. */
export function buildAirframe(quality: FlankQuality): Bins {
  const b: Bins = new Map();
  const high = quality === "high";
  const seg = high ? 24 : 14;
  const thin = high ? 12 : 8;

  // Shell in three panels with dark seams (the core hull shows through the gaps).
  const seams = [-0.07, 0.062];
  const gap = 0.004;
  add(b, "shell", loft(hullSlice(-0.205, seams[0] - gap)));
  add(b, "shell", loft(hullSlice(seams[0] + gap, seams[1] - gap)));
  add(b, "shell", loft(hullSlice(seams[1] + gap, 0.17)));
  add(b, "inner", loft(hullSlice(-0.2, 0.166, 0.004)));

  // Battery pack: an indigo cover proud of the top, with the burgundy release tab.
  add(b, "panel", place(prism(roundedPoly([
    [-0.15, -0.048, 0.014],
    [0.035, -0.048, 0.014],
    [0.035, 0.048, 0.014],
    [-0.15, 0.048, 0.014],
  ]), 0.02, 0.004, 4), 0, 0.047, 0, HP, 0, 0));
  add(b, "accent", place(rbox(0.016, 0.004, 0.03, 0.0015, 1), -0.132, 0.0585, 0));
  // Positioning antenna on a short mast (a survey aircraft carries one).
  add(b, "steel", place(cyl(0.004, 0.005, 0.03, thin), -0.085, 0.07, 0));
  add(b, "shell", place(drum(0.026, 0.084, 0.096, seg, 0.004), -0.085, 0, 0));
  add(b, "joint", place(drum(0.027, 0.08, 0.084, seg, 0.001), -0.085, 0, 0));

  // Flank status strips (ice) and the belly plate.
  for (const s of [-1, 1]) add(b, "glow", place(rbox(0.07, 0.004, 0.003, 0.0012, 1), 0.0, 0.014, s * 0.0755));
  add(b, "core", place(rbox(0.3, 0.012, 0.1, 0.005, 2), -0.01, -0.041, 0));

  // Nose: the quadruped's mirror-black sensor face with its stereo pair and light line.
  add(b, "visor", place(rbox(0.008, 0.044, 0.094, 0.011, 2), 0.1705, -0.004, 0));
  for (const z of [-0.026, 0.026]) {
    add(b, "lens", place(drumX(0.0085, 0.173, 0.178, 16, 0.002), 0, -0.008, z));
    add(b, "steel", place(bandX(0.0085, 0.0115, 0.172, 0.176, 16), 0, -0.008, z));
  }
  add(b, "glow", place(rbox(0.003, 0.003, 0.052, 0.001, 1), 0.1755, 0.011, 0));
  // Tail light bar.
  add(b, "visor", place(rbox(0.006, 0.026, 0.05, 0.006, 2), -0.205, 0.008, 0));
  add(b, "glow", place(rbox(0.004, 0.005, 0.03, 0.0018, 1), -0.208, 0.01, 0));

  // Arms: carbon tube under a white shoulder fairing, motor pod at the tip.
  const reach = ROTOR_ARM * Math.SQRT2;
  for (const fx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const yaw = Math.atan2(-sz, fx); // rotation about Y taking +X onto the arm
      const at = (r: number): [number, number, number] => [fx * r * Math.SQRT1_2, 0.004, sz * r * Math.SQRT1_2];
      add(b, "core", tube(at(0.06), at(reach - 0.02), 0.0125, thin));
      add(b, "shell", place(rbox(0.15, 0.03, 0.04, 0.012, 2), ...at(0.148), 0, yaw, 0));
      add(b, "steel", place(bandX(0.0125, 0.016, -0.004, 0.004, thin), ...at(0.236), 0, yaw, 0));

      const mx = fx * ROTOR_ARM;
      const mz = sz * ROTOR_ARM;
      add(b, "joint", place(drum(0.034, -0.028, 0.034, seg, 0.004), mx, 0, mz));
      add(b, "steel", place(band(0.034, 0.0366, 0.02, 0.026, seg), mx, 0, mz));
      add(b, "panel", place(drum(0.03, -0.04, -0.028, seg, 0.004), mx, 0, mz));
      // Navigation lights under the pods: ice forward, burgundy aft.
      add(b, fx > 0 ? "glow" : "accent", place(drum(0.012, -0.046, -0.04, thin, 0.002), mx, 0, mz));
      // Rotor hub and spinner; the blades themselves are the blur disc.
      add(b, "steel", place(drum(0.012, 0.034, ROTOR_Y + 0.003, thin, 0.002), mx, 0, mz));
      add(b, "joint", place(drum(0.0085, ROTOR_Y + 0.003, ROTOR_Y + 0.011, thin, 0.003), mx, 0, mz));
    }
  }

  // Landing gear: two skids on splayed legs, clear of the scanner.
  const skidY = -0.178;
  for (const sz of [-1, 1]) {
    const z = sz * 0.132;
    add(b, "core", tube([0.02, -0.03, sz * 0.058], [0.035, skidY, z], 0.007, thin));
    add(b, "core", tube([-0.115, -0.03, sz * 0.058], [-0.13, skidY, z], 0.007, thin));
    add(b, "core", tube([-0.185, skidY, z], [0.1, skidY, z], 0.0085, thin));
    for (const x of [0.035, -0.13]) add(b, "steel", place(sphere(0.0115, thin, 8), x, skidY, z));
    add(b, "rubber", tube([-0.195, skidY, z], [-0.15, skidY, z], 0.0115, thin));
    add(b, "rubber", tube([0.065, skidY, z], [0.11, skidY, z], 0.0115, thin));
  }
  return b;
}

/** The stabilised scanner: yoke and the lidar puck lying on its side (gimbal frame). */
export function buildGimbal(quality: FlankQuality): Bins {
  const b: Bins = new Map();
  const seg = quality === "high" ? 28 : 16;
  const y = -PUCK_DROP;
  // Mount and yoke.
  add(b, "joint", drum(0.022, -0.012, 0.006, seg, 0.003));
  add(b, "core", place(rbox(0.024, 0.008, 0.112, 0.003, 1), 0, -0.012, 0));
  for (const s of [-1, 1]) {
    add(b, "core", place(rbox(0.022, PUCK_DROP, 0.006, 0.0025, 1), 0, -0.012 + y / 2 + 0.006, s * 0.053));
    add(b, "steel", place(drumZ(0.009, -0.003, 0.003, 12, 0.0015), 0, y, s * 0.057));
  }
  // Lidar puck, same sections as the one on the quadruped's head, axis along X:
  // base, black window with the glowing scan line, white cap.
  add(b, "joint", place(drumX(0.044, -0.04, -0.016, seg, 0.003), 0, y, 0));
  add(b, "steel", place(bandX(0.044, 0.0452, -0.018, -0.014, seg), 0, y, 0));
  add(b, "visor", place(drumX(0.042, -0.016, 0.018, seg, 0.001), 0, y, 0));
  add(b, "glow", place(bandX(0.0422, 0.0428, -0.0018, 0.0018, seg), 0, y, 0));
  add(b, "shell", place(drumX(0.044, 0.018, 0.031, seg, 0.004), 0, y, 0));
  return b;
}

/** One quad per rotor (the blur is drawn in the fragment shader). */
export function buildRotorDiscs() {
  const pos: number[] = [];
  const aC: number[] = [];
  const aDir: number[] = [];
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (const fx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const [cx, cz] of corners) {
        pos.push(fx * ROTOR_ARM + cx * ROTOR_R, ROTOR_Y, sz * ROTOR_ARM + cz * ROTOR_R);
        aC.push(cx, cz);
        // Diagonal pairs turn the same way.
        aDir.push(fx * sz);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aC", new THREE.Float32BufferAttribute(aC, 2));
  g.setAttribute("aDir", new THREE.Float32BufferAttribute(aDir, 1));
  return g;
}
