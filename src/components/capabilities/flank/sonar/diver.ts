import * as THREE from "three";
import type { FlankQuality } from "../contract";
import { band, drum, join, lathe, place, plain, prism, rbox, roundedPoly, sphere, type P2 } from "../robot/geo";
import type { SonarUniforms } from "./glsl";
import { makeDepthOnly, makeDiverMaterials, type DiverKey } from "./materials";
import { KICK_W } from "./timeline";

/**
 * Procedural scuba diver, one bin set per rigid link (the same construction
 * as the quadruped). Model space: metres, swimming toward +X, back (tank) up
 * +Y, origin at the pelvis. Legs and arms trail toward -X; every limb joint
 * pitches about Z.
 */

type Bins = Map<DiverKey, THREE.BufferGeometry[]>;

function add(b: Bins, key: DiverKey, ...geos: THREE.BufferGeometry[]) {
  let list = b.get(key);
  if (!list) b.set(key, (list = []));
  list.push(...geos);
}

const HP = Math.PI / 2;

/** Smooth solid of revolution about +X from an (r, x) profile listed tail → head. */
function latheX(profile: readonly P2[], seg: number) {
  return place(lathe(profile, seg, false), 0, 0, 0, 0, 0, -HP);
}

/** Tapered limb segment trailing along -X from the joint at the origin, with rounded ends. */
function limb(len: number, r0: number, r1: number, seg: number, bulge = 1.05) {
  const pts: P2[] = [];
  const n = 3;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * HP;
    pts.push([Math.max(r0 * Math.sin(a), 0.0001), -r0 * 0.85 * Math.cos(a)]);
  }
  pts.push([((r0 + r1) / 2) * bulge, len * 0.42]);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * HP;
    pts.push([Math.max(r1 * Math.cos(a), 0.0001), len + r1 * 0.85 * Math.sin(a)]);
  }
  // Lathe axis +Y → -X.
  return place(lathe(pts, seg, false), 0, 0, 0, 0, 0, HP);
}

/** Flat plate in the XZ plane from an (x, z) outline, `t` thick. */
function plate(outline: readonly (readonly [number, number, number])[], t: number) {
  return place(prism(roundedPoly(outline), t, t * 0.3, 4), 0, 0, 0, HP, 0, 0);
}

/** Ring about the X axis (rectangular section) spanning x0..x1. */
function bandX(rIn: number, rOut: number, x0: number, x1: number, seg: number) {
  return place(band(rIn, rOut, x0, x1, seg), 0, 0, 0, 0, 0, -HP);
}

/* Proportions (m). */
const THIGH = 0.43;
const SHIN = 0.42;
const UPPER = 0.3;
const FORE = 0.27;
/** Torso thickness / width ratio. */
const FLAT = 0.7;
const HIP_Z = 0.09;
const SHOULDER = new THREE.Vector3(0.5, -0.01, 0.2);
const NECK = new THREE.Vector3(0.61, 0.01, 0);

function buildTorso(seg: number): Bins {
  const b: Bins = new Map();
  const torso = latheX(
    [
      [0.0001, -0.14],
      [0.09, -0.13],
      [0.15, -0.075],
      [0.168, 0.0],
      [0.152, 0.14],
      [0.162, 0.3],
      [0.186, 0.44],
      [0.176, 0.53],
      [0.12, 0.59],
      [0.066, 0.63],
      [0.06, 0.7],
      [0.0001, 0.7],
    ],
    seg,
  );
  torso.scale(1, FLAT, 1);
  add(b, "suit", torso);
  // Indigo yoke over the shoulders, weight belt, chest strap.
  const yoke = bandX(0.176, 0.192, 0.4, 0.55, seg);
  yoke.scale(1, FLAT, 1);
  add(b, "pad", yoke);
  const belt = bandX(0.15, 0.172, 0.05, 0.1, seg);
  belt.scale(1, FLAT, 1);
  add(b, "dark", belt);
  for (const s of [-1, 1]) {
    add(b, "steel", place(rbox(0.07, 0.045, 0.03, 0.008, 1), 0.075, -0.01, s * 0.165));
    // Ice piping along each flank.
    add(b, "trim", place(rbox(0.26, 0.022, 0.014, 0.006, 1), 0.24, 0.02, s * 0.156));
  }

  // Backplate / wing, then the tank lying along the spine.
  add(b, "dark", place(rbox(0.5, 0.05, 0.3, 0.024, 2), 0.24, 0.128, 0));
  const tankY = 0.245;
  const tankX = -0.1;
  add(
    b,
    "tank",
    place(
      latheX(
        [
          [0.0001, 0.0],
          [0.05, 0.004],
          [0.084, 0.03],
          [0.096, 0.075],
          [0.096, 0.52],
          [0.082, 0.575],
          [0.045, 0.61],
          [0.03, 0.62],
        ],
        seg,
      ),
      tankX,
      tankY,
      0,
    ),
  );
  add(b, "dark", place(bandX(0.094, 0.103, 0.012, 0.1, seg), tankX, tankY, 0));
  add(b, "dark", place(bandX(0.095, 0.101, 0.2, 0.235, seg), tankX, tankY, 0), place(bandX(0.095, 0.101, 0.44, 0.475, seg), tankX, tankY, 0));
  add(b, "pad", place(bandX(0.0955, 0.099, 0.3, 0.375, seg), tankX, tankY, 0));
  // Valve, first stage and the hose to the regulator.
  add(b, "steel", place(bandX(0.0, 0.03, 0.62, 0.67, 12), tankX, tankY, 0));
  add(b, "steel", place(rbox(0.05, 0.055, 0.07, 0.012, 1), tankX + 0.675, tankY - 0.01, 0));
  add(b, "dark", place(drum(0.022, -0.03, 0.03, 10), tankX + 0.675, tankY - 0.005, 0.06, HP, 0, 0));
  const hose = new THREE.CatmullRomCurve3([
    new THREE.Vector3(tankX + 0.68, tankY - 0.01, 0.035),
    new THREE.Vector3(0.66, 0.2, 0.15),
    new THREE.Vector3(0.74, 0.07, 0.19),
    new THREE.Vector3(0.8, -0.05, 0.12),
    new THREE.Vector3(0.79, -0.1, 0.03),
  ]);
  add(b, "dark", plain(new THREE.TubeGeometry(hose, 14, 0.012, 6, false)));
  return b;
}

function buildHead(seg: number): Bins {
  const b: Bins = new Map();
  // Head frame: origin at the neck, crown toward +X, face toward -Y.
  const hood = sphere(0.118, seg, Math.max(8, seg - 4));
  hood.scale(1.1, 1, 0.94);
  add(b, "suit", place(hood, 0.125, 0.012, 0));
  // Mask: indigo frame, black glass proud of it, strap around the hood.
  add(b, "pad", place(rbox(0.1, 0.05, 0.18, 0.018, 2), 0.15, -0.088, 0));
  add(b, "glass", place(rbox(0.074, 0.03, 0.15, 0.012, 2), 0.152, -0.108, 0));
  add(b, "dark", place(band(0.108, 0.121, -0.014, 0.014, seg), 0.15, 0.012, 0, 0, 0, -HP));
  // Regulator second stage in front of the mouth.
  add(b, "dark", place(drum(0.043, 0, 0.05, 12), 0.062, -0.155, 0));
  add(b, "steel", place(drum(0.026, 0, 0.012, 12), 0.062, -0.166, 0));
  return b;
}

function buildUpperArm(seg: number, side: number): Bins {
  const b: Bins = new Map();
  add(b, "pad", limb(UPPER, 0.062, 0.05, seg));
  add(b, "trim", place(rbox(UPPER * 0.7, 0.014, 0.01, 0.004, 1), -UPPER * 0.5, 0.02, side * 0.054));
  return b;
}

function buildForearm(seg: number, side: number): Bins {
  const b: Bins = new Map();
  add(b, "suit", limb(FORE, 0.05, 0.038, seg));
  const hand = sphere(0.045, 8, 6);
  hand.scale(1.5, 0.6, 1);
  add(b, "dark", place(hand, -FORE - 0.05, 0, 0));
  // Dive computer on the wrist.
  add(b, "steel", place(rbox(0.04, 0.02, 0.04, 0.006, 1), -FORE + 0.05, 0.035, side * 0.012));
  return b;
}

function buildThigh(seg: number, side: number): Bins {
  const b: Bins = new Map();
  add(b, "suit", limb(THIGH, 0.088, 0.064, seg));
  add(b, "trim", place(rbox(THIGH * 0.7, 0.016, 0.012, 0.005, 1), -THIGH * 0.5, 0.025, side * 0.073));
  return b;
}

function buildShin(seg: number, side: number): Bins {
  const b: Bins = new Map();
  add(b, "suit", limb(SHIN, 0.062, 0.044, seg, 1.12));
  // Knee pad on the front (ventral) of the joint, piping down the outside.
  const pad = sphere(0.058, 8, 6);
  pad.scale(1.2, 0.7, 1);
  add(b, "pad", place(pad, -0.02, -0.03, 0));
  add(b, "trim", place(rbox(SHIN * 0.6, 0.014, 0.01, 0.004, 1), -SHIN * 0.5, 0.02, side * 0.05));
  return b;
}

/** Foot pocket and the stiff half of the blade (ankle frame). */
const FIN_HINGE = 0.37;
function buildFinRoot(): Bins {
  const b: Bins = new Map();
  add(b, "dark", place(rbox(0.22, 0.075, 0.1, 0.03, 2), -0.08, 0, 0));
  add(
    b,
    "fin",
    plate(
      [
        [-0.12, -0.05, 0.01],
        [-FIN_HINGE, -0.098, 0.004],
        [-FIN_HINGE, 0.098, 0.004],
        [-0.12, 0.05, 0.01],
      ],
      0.016,
    ),
  );
  for (const s of [-1, 1]) {
    // Side rails: the bright edges that make the fins read at a distance.
    const rail = rbox(0.255, 0.024, 0.014, 0.005, 1);
    add(b, "trim", place(rail, -0.245, 0, s * 0.077, 0, s * 0.19, 0));
  }
  return b;
}

/** Flexible tip of the blade (hinge frame). */
function buildFinTip(): Bins {
  const b: Bins = new Map();
  add(
    b,
    "fin",
    plate(
      [
        [0.004, -0.098, 0.004],
        [-0.23, -0.122, 0.05],
        [-0.26, 0, 0.12],
        [-0.23, 0.122, 0.05],
        [0.004, 0.098, 0.004],
      ],
      0.012,
    ),
  );
  for (const s of [-1, 1]) {
    add(b, "trim", place(rbox(0.21, 0.02, 0.012, 0.005, 1), -0.11, 0, s * 0.107, 0, s * 0.1, 0));
  }
  add(b, "dark", place(rbox(0.17, 0.016, 0.012, 0.004, 1), -0.1, 0, 0));
  return b;
}

type Leg = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group; tip: THREE.Group; phase: number };
type Arm = { shoulder: THREE.Group; elbow: THREE.Group; side: number };

export type DiverRig = {
  /** Positioned and yawed by the scene; pelvis at the origin. */
  group: THREE.Group;
  /** Pose the swimmer for absolute time `t`; `pitch` is the climb angle of the path. Must not allocate. */
  update(t: number, pitch: number): void;
  dispose(): void;
};

export function buildDiver(quality: FlankQuality, u: SonarUniforms): DiverRig {
  const high = quality === "high";
  const seg = high ? 18 : 10;
  const mats = makeDiverMaterials(quality, u);
  const depthOnly = makeDepthOnly();
  const trash: THREE.BufferGeometry[] = [];

  const bake = (parent: THREE.Object3D, b: Bins) => {
    for (const [key, list] of b) {
      const geo = join(list);
      trash.push(geo);
      const pre = new THREE.Mesh(geo, depthOnly);
      pre.renderOrder = 5;
      parent.add(pre);
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.renderOrder = 6;
      parent.add(mesh);
    }
    return parent;
  };

  const group = new THREE.Group();
  group.name = "diver";
  const body = new THREE.Group();
  body.rotation.order = "YXZ";
  group.add(body);
  bake(body, buildTorso(seg));

  const head = new THREE.Group();
  head.rotation.order = "YXZ";
  head.position.copy(NECK);
  body.add(head);
  bake(head, buildHead(seg));

  const limbSeg = high ? 12 : 8;
  const arms: Arm[] = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(SHOULDER.x, SHOULDER.y, side * SHOULDER.z);
    body.add(shoulder);
    bake(shoulder, buildUpperArm(limbSeg, side));
    const elbow = new THREE.Group();
    elbow.position.set(-UPPER, 0, 0);
    shoulder.add(elbow);
    bake(elbow, buildForearm(limbSeg, side));
    return { shoulder, elbow, side };
  });

  const legs: Leg[] = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(-0.07, -0.005, side * HIP_Z);
    body.add(hip);
    bake(hip, buildThigh(limbSeg, side));
    const knee = new THREE.Group();
    knee.position.set(-THIGH, 0, 0);
    hip.add(knee);
    bake(knee, buildShin(limbSeg, side));
    const ankle = new THREE.Group();
    ankle.position.set(-SHIN, 0, 0);
    knee.add(ankle);
    bake(ankle, buildFinRoot());
    const tip = new THREE.Group();
    tip.position.set(-FIN_HINGE, 0, 0);
    ankle.add(tip);
    bake(tip, buildFinTip());
    return { hip, knee, ankle, tip, phase: side > 0 ? 0 : Math.PI };
  });

  const update = (t: number, pitch: number) => {
    const ph = t * KICK_W;
    // The trunk answers the kick: a little roll and yaw, a slow breathing heave.
    body.rotation.set(0.075 * Math.sin(ph), 0.035 * Math.sin(ph + 0.6), pitch + 0.05 + 0.02 * Math.sin(t * 0.7));

    // Looking ahead (neck extended), scanning slowly.
    head.rotation.set(0.05 * Math.sin(t * 0.4 + 1), 0.14 * Math.sin(t * 0.33), 0.62 + 0.05 * Math.sin(t * 0.5));

    for (const leg of legs) {
      const p = ph + leg.phase;
      // Flutter kick. Positive hip angle = leg down. The knee folds on the
      // recovery and whips straight through the down-stroke; the blade lags
      // the foot, its tip further still.
      leg.hip.rotation.z = -0.06 + 0.25 * Math.sin(p);
      leg.knee.rotation.z = -(0.14 + 0.42 * (0.5 + 0.5 * Math.cos(p + 1.87)));
      leg.ankle.rotation.z = 0.2 - 0.22 * Math.cos(p);
      leg.tip.rotation.z = -0.24 * Math.cos(p - 0.6);
      // A hint of splay so the two fins never coincide in silhouette.
      leg.hip.rotation.y = (leg.phase > 0 ? -1 : 1) * 0.07;
    }

    for (const arm of arms) {
      // Relaxed at the sides, slightly open, forearms hanging a little.
      const sway = Math.sin(ph * 0.5 + arm.side);
      arm.shoulder.rotation.set(0, arm.side * (0.26 + 0.03 * sway), 0.16 + 0.05 * sway);
      arm.elbow.rotation.z = 0.24 + 0.06 * Math.sin(ph * 0.5 + arm.side + 1);
      arm.elbow.rotation.y = -arm.side * 0.25;
    }
  };

  const dispose = () => {
    trash.forEach((g) => g.dispose());
    trash.length = 0;
    Object.values(mats).forEach((m) => m.dispose());
    depthOnly.dispose();
  };

  update(0, 0);
  return { group, update, dispose };
}
