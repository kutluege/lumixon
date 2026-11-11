import * as THREE from "three";
import type { HumanoidMaterials } from "../materials";
import { ball, body, cylX, cylY, Part, sec, torusX, torusY, xf, type Detail } from "./geo";

/**
 * Procedural humanoid rig (metres, feet on y = 0, facing +Z, right side = -X).
 *
 * Every rigid bone is one THREE.Group holding one merged mesh per material.
 * Limb bones share one frame convention: origin at the proximal joint, the
 * bone runs along -Y, X is the hinge axis and +Z the front of the limb (for a
 * hand: +Z is the back of the hand, fingers curl toward -Z).
 */

type K = keyof HumanoidMaterials;
type Sink = THREE.BufferGeometry[];

const PI = Math.PI;
const HP = PI / 2;

export const DIM = {
  hipY: 0.896,
  hipX: 0.092,
  /** Waist joint above the hip line (pelvis frame). */
  waist: 0.115,
  /** Shoulder joint, torso frame. */
  shoulderX: 0.19,
  shoulderY: 0.39,
  /** Head pivot, torso frame. */
  neckY: 0.5,
  upperArm: 0.285,
  foreArm: 0.255,
  thigh: 0.415,
  shin: 0.415,
  ankleY: 0.085,
  /** Light bar height above the head pivot. */
  eyeY: 0.108,
} as const;

/** Hands and head are drawn slightly over-size so they read at hero scale. */
const HAND_SCALE = 1.1;
const HEAD_SCALE = 1.07;

/** Pinch point between thumb and fingertips, forearm-twist frame relative to the wrist. */
export const GRIP = new THREE.Vector3(0, -0.095, -0.03).multiplyScalar(HAND_SCALE);

/**
 * Planted stance (root space): [|ankle x|, ankle z, toe-out]. The leg on the
 * imitating side steps slightly forward and out toward the demonstrator, the
 * other carries the weight.
 */
const STANCE = { lead: [0.112, 0.03, 0.22], rear: [0.1, -0.016, 0.05] } as const;

export type ArmRig = {
  sx: number;
  upper: THREE.Group;
  fore: THREE.Group;
  /** Distal forearm: pronation/supination about the forearm axis. */
  twist: THREE.Group;
  hand: THREE.Group;
  /** Four fingers (index → little), three flexion joints each. */
  fingers: THREE.Group[][];
  thumb: THREE.Group[];
  grip: THREE.Object3D;
};

export type LegRig = {
  sx: number;
  thigh: THREE.Group;
  shin: THREE.Group;
  foot: THREE.Group;
  /** Fixed ankle joint, root space. */
  ankle: THREE.Vector3;
};

export type HumanoidRig = {
  /** Model-space root; the caller parents it under the layout transform. */
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  /** Visor light bar: slides (yaw) ahead of the head, squashes to blink. */
  eye: THREE.Group;
  arms: { r: ArmRig; l: ArmRig };
  legs: { r: LegRig; l: LegRig };
  /** Imitating side: -1 = right hand (model -X), +1 = left hand (model +X). */
  side: 1 | -1;
  /** The arm that imitates / the arm that idles. */
  reach: ArmRig;
  rest: ArmRig;
  dispose: () => void;
};

type Ctx = { q: Detail; mats: HumanoidMaterials; sink: Sink };

function buildPelvis({ q, mats, sink }: Ctx) {
  const p = new Part<K>();
  const hips = body(
    [
      sec(-0.085, 0.034, 0.04),
      sec(-0.06, 0.076, 0.062),
      sec(-0.02, 0.112, 0.08),
      sec(0.035, 0.12, 0.085),
      sec(0.085, 0.104, 0.076),
      sec(0.118, 0.086, 0.068),
    ],
    3,
  );
  p.add("core", hips.solid(q));
  // Belt shell and a shield-shaped lower front plate.
  p.add("shell", hips.shell(q, 0.014, 0.092, 0.011, { rim: 0.014 }));
  p.add(
    "panel",
    hips.shell(q, -0.068, 0.002, 0.009, {
      arc: [-0.8, 0.8],
      rim: 0.012,
      trim: (u) => [0.55 * Math.abs(2 * u - 1) ** 1.6, 1],
    }),
  );
  // Hip actuators: housing, bearing ring, cover disc.
  for (const sx of [-1, 1]) {
    p.add("joint", cylX(0.054, 0.05, q.ps), xf(sx * 0.14, 0, 0));
    p.add("steel", torusX(0.05, 0.0045, q.ps), xf(sx * 0.165, 0, 0));
    p.add("shell", cylX(0.04, 0.008, q.ps), xf(sx * 0.167, 0, 0));
  }
  return p.bake(mats, sink);
}

function buildTorso({ q, mats, sink }: Ctx) {
  const p = new Part<K>();
  const B = body(
    [
      sec(-0.014, 0.083, 0.067),
      sec(0.05, 0.086, 0.07),
      sec(0.12, 0.1, 0.08),
      sec(0.2, 0.13, 0.098),
      sec(0.3, 0.15, 0.112),
      sec(0.4, 0.142, 0.1),
      sec(0.447, 0.106, 0.076),
      sec(0.468, 0.046, 0.044),
    ],
    3,
  );
  p.add("core", B.solid(q));

  // Waist bearing + flexible bellows rings.
  p.add("steel", B.shell(q, -0.01, 0.012, 0.006, { rim: 0.008, k: 2, rows: 1 }));
  for (const y of [0.036, 0.064, 0.092]) {
    p.add("joint", B.shell(q, y - 0.008, y + 0.008, 0.0045, { rim: 0.007, k: 2, rows: 1 }));
  }
  // Abdomen plate.
  p.add(
    "panel",
    B.shell(q, 0.04, 0.142, 0.012, {
      arc: [-0.85, 0.85],
      rim: 0.013,
      trim: (u) => {
        const e = Math.abs(2 * u - 1);
        return [0.3 * e ** 1.5, 1 - 0.12 * e * e];
      },
    }),
  );
  // Chest: lower plate with a chevron hem, upper plate with a fuller pectoral line.
  p.add(
    "shell",
    B.shell(q, 0.156, 0.262, 0.013, {
      arc: [-1.18, 1.18],
      rim: 0.015,
      trim: (u) => [0.24 * Math.abs(2 * u - 1) ** 1.4, 1],
    }),
  );
  for (const sx of [-1, 1]) {
    p.add(
      "shell",
      B.shell(q, 0.272, 0.446, 0.014, {
        arc: sx < 0 ? [-1.2, -0.016] : [0.016, 1.2],
        rim: 0.016,
        k: 7,
        mod: (s, f) => {
          s.rz += 0.012 * Math.sin(PI * Math.min(1, f * 1.3));
        },
      }),
    );
  }
  // Back shell + power pack.
  p.add("shell", B.shell(q, 0.15, 0.446, 0.011, { arc: [PI - 1.22, PI + 1.22], rim: 0.014 }));
  p.add(
    "panel",
    B.shell(q, 0.19, 0.4, 0.03, {
      arc: [PI - 0.62, PI + 0.62],
      rim: 0.022,
      trim: (u) => {
        const e = (2 * u - 1) ** 2;
        return [0.15 * e, 1 - 0.15 * e];
      },
    }),
  );
  // Status light in the sternum channel between the pectoral plates.
  const v = B.at(0.385, 0, 0.004, new THREE.Vector3());
  p.add("glow", new THREE.CapsuleGeometry(0.0035, 0.034, 3, 8), xf(0, 0.385, v.z));

  // Shoulder actuators.
  for (const sx of [-1, 1]) {
    p.add("joint", cylX(0.05, 0.075, q.ps), xf(sx * 0.158, DIM.shoulderY, 0));
    p.add("steel", torusX(0.05, 0.0045, q.ps), xf(sx * 0.197, DIM.shoulderY, 0));
  }
  // Collar + articulated neck.
  p.add("accent", torusY(0.05, 0.0055, q.ps), xf(0, 0.462, 0, 0, 0, 0, 1, 1, 0.92));
  p.add("joint", cylY(0.037, 0.032, 0.08, q.ps), xf(0, 0.487, 0));
  for (const y of [0.478, 0.497]) p.add("gun", torusY(0.0355, 0.0035, q.ps), xf(0, y, 0));
  return p.bake(mats, sink);
}

function buildHead({ q, mats, sink }: Ctx) {
  const p = new Part<K>();
  const H = body(
    [
      sec(-0.012, 0.034, 0.04, { z: 0.004 }),
      sec(0.015, 0.058, 0.07, { z: 0.004, rb: 0.064 }),
      sec(0.055, 0.073, 0.089, { rb: 0.082 }),
      sec(0.105, 0.079, 0.095, { rb: 0.09 }),
      sec(0.155, 0.077, 0.092, { rb: 0.09 }),
      sec(0.198, 0.063, 0.076, { rb: 0.076 }),
      sec(0.223, 0.036, 0.044, { rb: 0.046 }),
      sec(0.232, 0.006, 0.008),
    ],
    2.4,
  );
  p.add("shell", H.solid(q));
  // Wrap-around visor, narrowing toward the temples.
  p.add(
    "visor",
    H.shell(q, 0.03, 0.182, 0.004, {
      arc: [-1.22, 1.22],
      rim: 0.008,
      k: 7,
      trim: (u) => {
        const e = Math.abs(2 * u - 1) ** 2.2;
        return [0.28 * e, 1 - 0.2 * e];
      },
    }),
  );
  // Dark jaw insert under the visor, indigo panel on the back of the skull.
  p.add("core", H.shell(q, -0.008, 0.025, 0.003, { arc: [-1.0, 1.0], rim: 0.006, k: 3 }));
  p.add(
    "panel",
    H.shell(q, 0.045, 0.17, 0.004, {
      arc: [PI - 0.9, PI + 0.9],
      rim: 0.007,
      trim: (u) => {
        const e = (2 * u - 1) ** 2;
        return [0.2 * e, 1 - 0.2 * e];
      },
    }),
  );
  // Ear pods: actuator housing, bearing ring, burgundy cap.
  for (const sx of [-1, 1]) {
    p.add("joint", cylX(0.028, 0.016, q.ps), xf(sx * 0.079, 0.105, -0.006));
    p.add("steel", torusX(0.028, 0.003, q.ps), xf(sx * 0.087, 0.105, -0.006));
    p.add("accent", cylX(0.013, 0.004, q.ps), xf(sx * 0.088, 0.105, -0.006));
  }
  const head = p.bake(mats, sink);

  const e = new Part<K>();
  e.add(
    "glow",
    H.shell(q, DIM.eyeY - 0.008, DIM.eyeY + 0.008, 0.0072, {
      arc: [-0.56, 0.56],
      rim: 0.003,
      k: 2,
      rows: 2,
      // rounded ends
      trim: (u) => {
        const e = Math.max(0, (Math.abs(2 * u - 1) - 0.86) / 0.14);
        const r = Math.sqrt(Math.max(0, 1 - e * e));
        return [0.5 - 0.5 * r, 0.5 + 0.5 * r];
      },
    }),
    xf(0, -DIM.eyeY, 0),
  );
  const eye = e.bake(mats, sink);
  eye.position.y = DIM.eyeY;
  head.add(eye);
  return { head, eye };
}

type FingerGeo = { prox: THREE.BufferGeometry; mid: THREE.BufferGeometry; dist: THREE.BufferGeometry; th0: THREE.BufferGeometry; th1: THREE.BufferGeometry };
const FINGER = { prox: 0.04, mid: 0.027, dist: 0.022, th0: 0.038, th1: 0.03 } as const;

function fingerGeometry(q: Detail, sink: Sink): FingerGeo {
  const cap = q.hi ? 3 : 2;
  const rad = q.hi ? 8 : 6;
  const phalanx = (len: number, r: number) => {
    const g = new THREE.CapsuleGeometry(r, len - r, cap, rad).translate(0, -len / 2, 0);
    g.deleteAttribute("uv");
    sink.push(g);
    return g;
  };
  return {
    prox: phalanx(FINGER.prox, 0.0085),
    mid: phalanx(FINGER.mid, 0.0078),
    dist: phalanx(FINGER.dist, 0.0072),
    th0: phalanx(FINGER.th0, 0.0095),
    th1: phalanx(FINGER.th1, 0.0085),
  };
}

function buildArm(sx: number, { q, mats, sink }: Ctx, fg: FingerGeo): ArmRig {
  // Upper arm: ball joint under a pauldron cap, sleeve panel, burgundy band.
  const up = new Part<K>();
  up.add("joint", ball(0.05, q.ps));
  const out = sx * HP;
  // Deltoid cap: open toward the torso, hem dipping to a point on the outside.
  const D = body(
    [
      sec(0.067, 0.012, 0.014),
      sec(0.058, 0.037, 0.041),
      sec(0.034, 0.057, 0.061),
      sec(-0.012, 0.064, 0.067),
      sec(-0.056, 0.058, 0.06),
      sec(-0.088, 0.05, 0.052),
    ],
    2.7,
  );
  up.add(
    "shell",
    D.shell(q, -0.088, 0.067, 0, {
      arc: [out - 2.15, out + 2.15],
      rim: 0.012,
      k: 7,
      trim: (u) => [0.42 * (2 * u - 1) ** 2, 1],
    }),
  );
  const U = body([sec(0, 0.04, 0.04), sec(-0.1, 0.041, 0.043), sec(-0.22, 0.036, 0.038), sec(-DIM.upperArm, 0.033, 0.034)], 2.4);
  up.add("core", U.solid(q));
  up.add(
    "shell",
    U.shell(q, -0.228, -0.098, 0.009, {
      arc: [out - 2.65, out + 2.65],
      rim: 0.011,
      mod: (s, f) => {
        s.rz += 0.005 * Math.sin(PI * f);
      },
    }),
  );
  up.add("accent", torusY(0.0405, 0.003, q.ps), xf(0, -0.247, 0));
  const upper = up.bake(mats, sink);

  // Forearm: elbow actuator on the hinge axis, proximal shell.
  const fo = new Part<K>();
  fo.add("joint", cylX(0.039, 0.084, q.ps));
  for (const s of [-1, 1]) {
    fo.add("steel", torusX(0.034, 0.004, q.ps), xf(s * 0.043, 0, 0));
    fo.add("shell", cylX(0.026, 0.007, q.ps), xf(s * 0.0455, 0, 0));
  }
  const Fa = body(
    [
      sec(-0.012, 0.035, 0.037),
      sec(-0.08, 0.038, 0.041),
      sec(-0.17, 0.033, 0.034),
      sec(-0.238, 0.027, 0.028),
      sec(-DIM.foreArm, 0.025, 0.025),
    ],
    2.4,
  );
  fo.add("core", Fa.solid(q));
  fo.add("shell", Fa.shell(q, -0.128, -0.042, 0.008, { arc: [-2.6, 2.6], rim: 0.01 }));
  const fore = fo.bake(mats, sink);

  // Distal forearm rolls with the wrist: indigo gauntlet + wrist bearing.
  const tw = new Part<K>();
  tw.add("panel", Fa.shell(q, -0.228, -0.142, 0.007, { arc: [-2.6, 2.6], rim: 0.009 }));
  tw.add("steel", torusY(0.029, 0.0038, q.ps), xf(0, -0.243, 0));
  // Light strip along the back of the gauntlet.
  const gl = Fa.at(-0.185, 0, 0.0085, new THREE.Vector3());
  tw.add("glow", new THREE.CapsuleGeometry(0.0026, 0.05, 3, 8), xf(0, -0.185, gl.z));
  const twist = tw.bake(mats, sink);
  fore.add(twist);

  // Hand: wrist ball, palm, back-of-hand plate.
  const ha = new Part<K>();
  ha.add("joint", ball(0.021, q.ps), xf(0, -0.002, 0));
  const P = body(
    [
      sec(-0.012, 0.024, 0.012),
      sec(-0.032, 0.038, 0.0135),
      sec(-0.07, 0.042, 0.0135),
      sec(-0.1, 0.041, 0.012),
      sec(-0.109, 0.034, 0.008),
    ],
    4,
  );
  ha.add("core", P.solid(q));
  ha.add("shell", P.shell(q, -0.098, -0.028, 0.004, { arc: [-1.1, 1.1], rim: 0.005, k: 4 }));
  const hand = ha.bake(mats, sink);
  hand.position.y = -DIM.foreArm;
  hand.scale.setScalar(HAND_SCALE);
  twist.add(hand);

  const link = (geo: THREE.BufferGeometry, y: number) => {
    const g = new THREE.Group();
    g.position.y = y;
    g.add(new THREE.Mesh(geo, mats.gun));
    return g;
  };
  const fingers: THREE.Group[][] = [];
  const scale = [0.93, 1, 0.94, 0.8];
  for (let i = 0; i < 4; i++) {
    const side = -sx * (1.5 - i); // index sits on the thumb side
    const base = new THREE.Group();
    base.position.set(side * 0.0205, -0.106 + Math.abs(1 - i) * -0.0025, 0);
    base.rotation.z = side * 0.045;
    base.scale.setScalar(scale[i]);
    const a = link(fg.prox, 0);
    const b = link(fg.mid, -FINGER.prox);
    const c = link(fg.dist, -FINGER.mid);
    b.add(c);
    a.add(b);
    base.add(a);
    hand.add(base);
    fingers.push([a, b, c]);
  }
  const t0 = link(fg.th0, 0);
  t0.position.set(-sx * 0.036, -0.04, -0.01);
  const t1 = link(fg.th1, -FINGER.th0);
  t0.add(t1);
  hand.add(t0);

  const grip = new THREE.Object3D();
  grip.position.copy(GRIP).divideScalar(HAND_SCALE);
  hand.add(grip);

  return { sx, upper, fore, twist, hand, fingers, thumb: [t0, t1], grip };
}

function buildLeg(sx: number, lead: boolean, { q, mats, sink }: Ctx): LegRig {
  // Thigh: front/outer shell with a raked top edge, indigo hamstring panel.
  const th = new Part<K>();
  th.add("joint", ball(0.057, q.ps));
  const T = body(
    [
      sec(0.02, 0.05, 0.055),
      sec(-0.04, 0.06, 0.066),
      sec(-0.14, 0.061, 0.067),
      sec(-0.27, 0.051, 0.055),
      sec(-0.38, 0.043, 0.047),
      sec(-DIM.thigh, 0.04, 0.043),
    ],
    2.6,
  );
  th.add("core", T.solid(q));
  const c = sx * 0.45;
  th.add(
    "shell",
    T.shell(q, -0.35, -0.062, 0.011, {
      arc: [c - 1.45, c + 1.45],
      rim: 0.013,
      trim: (u) => {
        const outer = sx > 0 ? u : 1 - u;
        const e = Math.abs(2 * u - 1);
        return [0.2 * e * e, 1 - 0.3 * (1 - outer) ** 1.5];
      },
    }),
  );
  th.add("panel", T.shell(q, -0.31, -0.085, 0.008, { arc: [PI - 1.0, PI + 1.0], rim: 0.011 }));
  const thigh = th.bake(mats, sink);

  // Shin: knee actuator + cap, shin guard, indigo calf.
  const sh = new Part<K>();
  sh.add("joint", cylX(0.045, 0.1, q.ps));
  for (const s of [-1, 1]) {
    sh.add("steel", torusX(0.04, 0.0045, q.ps), xf(s * 0.051, 0, 0));
    sh.add("shell", cylX(0.031, 0.008, q.ps), xf(s * 0.054, 0, 0));
  }
  const S = body(
    [
      sec(-0.015, 0.041, 0.045),
      sec(-0.1, 0.046, 0.047, { rb: 0.058 }),
      sec(-0.2, 0.04, 0.042, { rb: 0.05 }),
      sec(-0.32, 0.032, 0.034, { rb: 0.037 }),
      sec(-0.4, 0.028, 0.03),
      sec(-DIM.shin, 0.026, 0.028),
    ],
    2.6,
  );
  sh.add("core", S.solid(q));
  const cap = body([sec(-0.06, 0.044, 0.05), sec(0, 0.05, 0.058), sec(0.055, 0.044, 0.052)], 2.6);
  sh.add(
    "shell",
    cap.shell(q, -0.058, 0.053, 0.008, {
      arc: [-0.9, 0.9],
      rim: 0.012,
      k: 4,
      trim: (u) => {
        const e = (2 * u - 1) ** 2;
        return [0.3 * e, 1 - 0.3 * e];
      },
    }),
  );
  sh.add(
    "shell",
    S.shell(q, -0.365, -0.085, 0.01, {
      arc: [-1.3, 1.3],
      rim: 0.012,
      trim: (u) => [0, 1 - 0.18 * (2 * u - 1) ** 2],
    }),
  );
  sh.add("panel", S.shell(q, -0.3, -0.06, 0.008, { arc: [PI - 1.1, PI + 1.1], rim: 0.011 }));
  sh.add("steel", torusY(0.031, 0.004, q.ps), xf(0, -0.39, 0));
  const shin = sh.bake(mats, sink);

  // Foot: lofted along +Z (toe), flat dark sole, white instep cover.
  const fo = new Part<K>();
  fo.add("joint", ball(0.033, q.ps));
  const F = body(
    [
      sec(-0.075, 0.022, 0.012, { rb: 0.022 }),
      sec(-0.055, 0.04, 0.02, { rb: 0.05 }),
      sec(-0.01, 0.046, 0.02, { rb: 0.066 }),
      sec(0.05, 0.05, 0.02, { rb: 0.05 }),
      sec(0.11, 0.05, 0.02, { rb: 0.032 }),
      sec(0.155, 0.043, 0.018, { rb: 0.022 }),
      sec(0.172, 0.02, 0.01, { rb: 0.01 }),
    ],
    3.2,
  );
  // Loft +Y → foot +Z, loft -Z (rb) → up, loft +Z (rz) → the sole on y = 0.
  const lay = () => xf(0, -DIM.ankleY + 0.02, 0, HP, 0, 0);
  fo.add("core", F.solid(q), lay());
  fo.add("shell", F.shell(q, -0.035, 0.15, 0.006, { arc: [PI - 1.2, PI + 1.2], rim: 0.01 }), lay());
  const foot = fo.bake(mats, sink);
  const [ax, az, toe] = lead ? STANCE.lead : STANCE.rear;
  const ankle = new THREE.Vector3(sx * ax, DIM.ankleY, az);
  foot.position.copy(ankle);
  foot.rotation.y = sx * toe;

  return { sx, thigh, shin, foot, ankle };
}

export function buildHumanoid(mats: HumanoidMaterials, quality: "high" | "low", side: 1 | -1 = -1): HumanoidRig {
  const q: Detail = quality === "high" ? { seg: 28, rows: 8, ps: 24, hi: true } : { seg: 16, rows: 5, ps: 14, hi: false };
  const sink: Sink = [];
  const ctx: Ctx = { q, mats, sink };

  const root = new THREE.Group();
  const pelvis = buildPelvis(ctx);
  pelvis.position.y = DIM.hipY;
  root.add(pelvis);

  const torso = buildTorso(ctx);
  torso.position.y = DIM.waist;
  pelvis.add(torso);

  const { head, eye } = buildHead(ctx);
  head.position.y = DIM.neckY;
  head.scale.setScalar(HEAD_SCALE);
  torso.add(head);

  const fg = fingerGeometry(q, sink);
  const arms = { r: buildArm(-1, ctx, fg), l: buildArm(1, ctx, fg) };
  torso.add(arms.r.upper, arms.r.fore, arms.l.upper, arms.l.fore);

  const legs = { r: buildLeg(-1, side < 0, ctx), l: buildLeg(1, side > 0, ctx) };
  root.add(legs.r.thigh, legs.r.shin, legs.r.foot, legs.l.thigh, legs.l.shin, legs.l.foot);

  return {
    root,
    pelvis,
    torso,
    head,
    eye,
    arms,
    legs,
    side,
    reach: side < 0 ? arms.r : arms.l,
    rest: side < 0 ? arms.l : arms.r,
    dispose: () => sink.forEach((g) => g.dispose()),
  };
}
