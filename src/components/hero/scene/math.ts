/**
 * Deterministic procedural terrain + scene layout for the hero.
 * Pure functions only, no three.js imports, so they stay cheap and testable.
 */

export type Vec3 = [number, number, number];

export type SceneLayout = {
  key: "wide" | "tall";
  /** Robot base position on its cleared pad (y is always 0). */
  arm: Vec3;
  armScale: number;
  /** Humanoid learner: feet position (y = 0), yaw (model faces +Z) and scale (model is in metres). */
  humanoid: Vec3;
  humanoidYaw: number;
  humanoidScale: number;
  /** Nominal camera pose (1440×900 wide / phone tall). The rig derives the live pose from the framing fields below. */
  cam: Vec3;
  target: Vec3;
  /** Terrain extents: [xMin, xMax, zMin, zMax]. */
  extent: [number, number, number, number];
  /**
   * Framing. The camera views the group along `yaw` / `pitch` (radians, pitch
   * positive = looking down) and keeps `focus`, the ground point at the centre
   * of the group, pinned on screen. Where, and how large, is solved by the rig:
   * the group (`fit` = half-width, `height`, world units) is fitted into the
   * free area beside / above the hero copy, measured from the DOM, and never
   * viewed from closer than `dist`.
   * `frame` is the window in viewport fractions: [left, right, top, feet line]
   * (left is only the fallback before the copy has been measured).
   * `aim`: preferred screen x of the group's centre (fraction of the width);
   * the group is slid from there only as far as the copy / right margin need.
   */
  focus: Vec3;
  dist: number;
  yaw: number;
  pitch: number;
  fit: number;
  height: number;
  frame: [number, number, number, number];
  aim: number;
};

export const LAYOUT_WIDE: SceneLayout = {
  key: "wide",
  // Screen order, left to right: learner, the arm's two part nests, arm base.
  // The learner stands left of and slightly behind the nests, turned toward
  // the arm but three-quarter open to the camera.
  arm: [5.45, 0, 0.3],
  armScale: 0.88,
  humanoid: [3.4, 0, -0.15],
  humanoidYaw: 0.45,
  humanoidScale: 1.2,
  cam: [3.13, 2.36, 12.02],
  target: [0.64, 0.87, 0.89],
  extent: [-26, 26, -26, 9],
  // Ground point at the centre of the whole work cell (its inlaid outline runs
  // from just left of the learner to well right of the arm base); `fit` covers it.
  focus: [4.88, 0, 0.15],
  dist: 7.2,
  // The group sits right of centre, beside the copy column: the camera looks
  // slightly left so its line of sight to the group stays close to head-on,
  // and a little more down than before so the deck, its outline and the
  // reflections read as a floor.
  yaw: -0.08,
  pitch: 0.16,
  fit: 2.15,
  height: 2.05,
  // Below the centred logo, beside the copy column; the deck outline may pass
  // under the right-edge ruler's column but stays below it.
  frame: [0.45, 0.95, 0.2, 0.75],
  aim: 0.64,
};

export const LAYOUT_TALL: SceneLayout = {
  key: "tall",
  arm: [0.47, 0, -0.6],
  armScale: 0.41,
  humanoid: [-0.485, 0, -0.81],
  humanoidYaw: 0.45,
  humanoidScale: 0.56,
  cam: [-0.23, 1.63, 7.21],
  target: [0.16, -0.52, -0.56],
  extent: [-11, 11, -26, 8],
  // Centred on the whole cell outline (it reaches further right than the arm),
  // so the inlaid line closes inside the frame on phones.
  focus: [0.17, 0, -0.7],
  dist: 4.8,
  yaw: 0.05,
  pitch: 0.27,
  // Half the cell outline's on-screen width (its near edge reads wider than the
  // plan's 1.4 units from this close), plus a little air either side.
  fit: 1.06,
  height: 0.95,
  frame: [0.035, 0.965, 0.14, 0.4],
  aim: 0.5,
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Quintic ease (zero velocity + acceleration at both ends), like a servo profile. */
export function smootherstep(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * f, y * f) * 2 - 1);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Height field: gentle rolling ground in the foreground rising into ridged
 * relief toward the horizon (reads like a DEM tile), with a flat area of
 * radius `flat` cleared around (padX, padZ) for the work cell.
 */
export function terrainHeight(x: number, z: number, padX: number, padZ: number, flat = 2.6) {
  const far = smoothstep(3, -24, z);
  const rolling = fbm(x * 0.11 + 7.3, z * 0.11 - 2.1) * (0.35 + 1.6 * far);
  const r = 1 - Math.abs(fbm(x * 0.045 - 4.2, z * 0.06 + 9.7, 4));
  const ridges = r * r * r * 3.8 * far * far;
  const h = rolling + ridges - 0.35 * far;
  const d = Math.hypot(x - padX, z - padZ);
  return h * smoothstep(flat, flat + 2.8, d);
}

/* ───────────── Robot kinematics + taught program ─────────────
   Chain: J1 yaw (Y) → J2 shoulder pitch (Z) → J3 elbow pitch (Z) →
   J4 forearm roll (Y) → J5 wrist pitch (Z) → J6 flange roll (Y) → TCP.
   The arm plane is the turret's local XY plane, reaching toward +X.
   ARM_DIM (arm-local units) is the single source of truth shared by the
   rendered arm (arm/build.ts) and the forward kinematics below. */
export const ARM_DIM = {
  /** J1 flange height above the floor. */
  h1: 0.3,
  /** Shoulder axis offset ahead of the J1 axis / height above the J1 flange. */
  a1: 0.16,
  d1: 0.52,
  /** Shoulder → elbow. */
  l2: 1.05,
  /** Forearm axis offset above the elbow axis / elbow → wrist centre along it. */
  a3: 0.1,
  l3: 0.95,
  /** Wrist centre → flange face / wrist centre → tool centre point (between the finger pads). */
  d6: 0.12,
  tool: 0.36,
} as const;

/* Each key: [q1 base yaw, q2 shoulder, q3 elbow, q4 forearm roll,
              tool pitch (absolute, in arm plane), q6 flange roll]          */
export type ArmKey = readonly [number, number, number, number, number, number];

/** Part nests the arm works between: base yaw, radius from the J1 axis, TCP height above the floor. */
const ARM_NESTS = [
  { yaw: -2.38, r: 1.45, y: 0.96 },
  { yaw: -2.98, r: 1.45, y: 1.08 },
] as const;
type ArmNest = (typeof ARM_NESTS)[number];

/** Nest tool points in arm-local coordinates (the part's centre while it rests there). */
export const ARM_STATIONS: readonly Vec3[] = ARM_NESTS.map(
  (s): Vec3 => [s.r * Math.cos(s.yaw), s.y, -s.r * Math.sin(s.yaw)],
);

/** Taught point → key: analytic elbow-up IK for a TCP at (r, y) in the arm plane with the tool at `pitch`. */
function armKey(yaw: number, r: number, y: number, pitch: number, q4 = 0, q6 = 0): ArmKey {
  const { h1, a1, d1, l2, a3, l3, tool } = ARM_DIM;
  const wx = r + tool * Math.sin(pitch);
  const wy = y - h1 - tool * Math.cos(pitch);
  const dx = wx - a1;
  const dy = wy - d1;
  const dist = Math.hypot(dx, dy);
  const fore = Math.hypot(a3, l3);
  const q2 = Math.atan2(-dx, dy) + Math.acos(clamp((l2 * l2 + dist * dist - fore * fore) / (2 * l2 * dist), -1, 1));
  const ex = a1 - Math.sin(q2) * l2;
  const ey = d1 + Math.cos(q2) * l2;
  const q23 = Math.atan2(-(wx - ex), wy - ey) - Math.atan2(a3, l3);
  return [yaw, q2, q23 - q2, q4, pitch, q6];
}

export const ARM_MOVE = 1.5; // nominal seconds for a transit between stations
export const ARM_DWELL = 0.95; // nominal seconds stopped over a part while the gripper works

type ArmStep = {
  key: ArmKey;
  /** Seconds travelling INTO this key. */
  move: number;
  /** Dwell after arriving. Negative = the next move starts early, so the key is flown through as a blended via point. */
  hold: number;
  /** Gripper command on arrival (1 close / 0 open) and the nest it happens at. */
  grip?: 0 | 1;
  nest?: 0 | 1;
};

const TOOL_DOWN = -Math.PI;
const NEST_CLEAR = 0.32;
const over = (s: ArmNest): ArmKey => armKey(s.yaw, s.r, s.y + NEST_CLEAR, TOOL_DOWN);
const onto = (s: ArmNest): ArmKey => armKey(s.yaw, s.r, s.y, TOOL_DOWN);
const ARM_READY = armKey(-2.68, 0.95, 1.72, -2.35);
const [NEST_A, NEST_B] = ARM_NESTS;

/* Demonstration program, worked in front of the arm (toward the viewer):
   grasp at A → lift → present + roll the part (inspect) → place at B →
   retract to the ready pose, then the mirrored return trip B → A. */
const ARM_PROGRAM: readonly ArmStep[] = [
  { key: onto(NEST_A), move: 0.95, hold: ARM_DWELL, grip: 1, nest: 0 },
  { key: over(NEST_A), move: 0.85, hold: -0.3 },
  { key: armKey(-2.55, 1.22, 1.9, -2.0, 0.4, -0.9), move: ARM_MOVE, hold: 0.15 },
  { key: armKey(-2.72, 1.2, 1.94, -2.25, -0.35, 0.85), move: 1.4, hold: 0.2 },
  { key: over(NEST_B), move: ARM_MOVE, hold: -0.28 },
  { key: onto(NEST_B), move: 0.95, hold: 0.8, grip: 0, nest: 1 },
  { key: over(NEST_B), move: 0.8, hold: -0.3 },
  { key: ARM_READY, move: 1.25, hold: 0.7 },
  { key: over(NEST_B), move: 1.25, hold: -0.28 },
  { key: onto(NEST_B), move: 0.95, hold: ARM_DWELL, grip: 1, nest: 1 },
  { key: over(NEST_B), move: 0.85, hold: -0.3 },
  { key: armKey(-2.78, 1.2, 1.94, -2.25, -0.4, 0.9), move: ARM_MOVE, hold: 0.15 },
  { key: armKey(-2.6, 1.22, 1.9, -2.0, 0.35, -0.85), move: 1.4, hold: 0.2 },
  { key: over(NEST_A), move: ARM_MOVE, hold: -0.28 },
  { key: onto(NEST_A), move: 0.95, hold: 0.8, grip: 0, nest: 0 },
  { key: over(NEST_A), move: 0.8, hold: -0.3 },
  { key: ARM_READY, move: 1.25, hold: 0.7 },
  { key: over(NEST_A), move: 1.25, hold: -0.28 },
];

export const ARM_KEYS: readonly ArmKey[] = ARM_PROGRAM.map((s) => s.key);

/* Timeline: phase 0 is the arrival at key 0, so the move into key 0 is the
   last one of the cycle and no move straddles the loop point. */
const ARM_T0: number[] = [];
const ARM_T1: number[] = [];
export const ARM_CYCLE = (() => {
  const n = ARM_PROGRAM.length;
  let clock = ARM_PROGRAM[0].hold;
  for (let i = 1; i <= n; i++) {
    const m = i % n;
    ARM_T0[m] = clock;
    ARM_T1[m] = clock + ARM_PROGRAM[m].move;
    clock = ARM_T1[m] + (m === 0 ? 0 : ARM_PROGRAM[m].hold);
  }
  return clock;
})();
/** Frozen time used for the reduced-motion still: part held up mid-inspection, learner following. */
export const REDUCED_T = ARM_T1[2] + ARM_PROGRAM[2].hold + ARM_PROGRAM[3].move * 0.5;

/** Follow-through after a stop: a small damped overshoot that starts with zero value and velocity. */
function armSettle(tau: number) {
  const rise = 1 - Math.exp(-tau / 0.06);
  return Math.sin(tau * 13) * Math.exp(-tau / 0.2) * rise * rise;
}

/**
 * Joint angles at time t. Every move is a quintic (servo-like) ramp of its
 * key delta; overlapping ramps blend through via points without stopping,
 * stops get a slight settle. Periodic in ARM_CYCLE and C1 everywhere.
 */
export function armPose(t: number, out: number[]) {
  const n = ARM_PROGRAM.length;
  const ph = ((t % ARM_CYCLE) + ARM_CYCLE) % ARM_CYCLE;
  const k0 = ARM_KEYS[0];
  for (let j = 0; j < 6; j++) out[j] = k0[j];
  for (let i = 1; i <= n; i++) {
    const m = i % n;
    const step = ARM_PROGRAM[m];
    let w = smootherstep((ph - ARM_T0[m]) / step.move);
    if (step.hold > 0) {
      // Time since this stop was last reached (possibly in the previous cycle).
      const tau = ph >= ARM_T1[m] ? ph - ARM_T1[m] : ph - ARM_T1[m] + ARM_CYCLE;
      w += armSettle(tau) * (step.nest === undefined ? 0.08 : 0.02);
    }
    if (w === 0) continue;
    const a = ARM_KEYS[i - 1];
    const b = ARM_KEYS[m];
    for (let j = 0; j < 6; j++) out[j] += (b[j] - a[j]) * w;
  }
  // Wrist pitch keeps the tool at the commanded absolute pitch.
  out[4] = out[4] - out[1] - out[2];
  return out;
}

/* Gripper events: a ramp starting shortly after the arm has come to rest on a nest. */
const GRIP_RAMP = 0.34;
const GRIP_EVENTS = ARM_PROGRAM.flatMap((s, m) =>
  s.grip === undefined ? [] : [{ t: (ARM_T1[m] % ARM_CYCLE) + (s.grip ? 0.38 : 0.3), to: s.grip, nest: s.nest ?? 0 }],
).sort((a, b) => a.t - b.t);

/** Latest gripper event at or before phase ph (wrapping to the last one of the previous cycle). */
function gripEvent(ph: number) {
  let e = GRIP_EVENTS[GRIP_EVENTS.length - 1];
  for (let i = 0; i < GRIP_EVENTS.length; i++) if (ph >= GRIP_EVENTS[i].t) e = GRIP_EVENTS[i];
  return e;
}

/**
 * Where the work piece is at time t: the index into ARM_STATIONS it rests on,
 * or -1 while it is clamped in the gripper (from fully closed to first release).
 */
export function demoPart(t: number) {
  const ph = ((t % ARM_CYCLE) + ARM_CYCLE) % ARM_CYCLE;
  const e = gripEvent(ph);
  const since = ph >= e.t ? ph - e.t : ph - e.t + ARM_CYCLE;
  return e.to === 1 && since >= GRIP_RAMP ? -1 : e.nest;
}

/* ───────────── Imitation (demonstration → policy) ───────────── */

/** Learner follows the demonstrated end-effector path after this lag (s). */
export const IMIT_LAG = 0.6;
/** Upper bound of the demo path (arm-local units) → learner hand path (metres) scale. */
export const IMIT_GAIN = 0.36;
/** Radius (metres, learner model space) the demonstrated path is fitted into around HAND_HOME. */
export const IMIT_REACH = 0.185;
/**
 * Neutral point of the imitating hand, model space (metres, +Z forward): the
 * centre of its comfortable workspace. Given for the right hand (-X); mirrored
 * in X when the left hand imitates (see learnerSide / handHome).
 */
export const HAND_HOME: Vec3 = [-0.34, 1.17, 0.38];

/**
 * Forward kinematics of the arm's tool centre point (between the finger pads)
 * in ARM-LOCAL space (origin at the base centre on the floor, unscaled).
 * Mirrors the rendered chain: J1 yaw about Y, J2/J3/J5 pitch about Z,
 * J4 roll about the forearm axis, forearm axis offset a3 above the elbow.
 */
export function armToolLocal(q: readonly number[], out: Vec3): Vec3 {
  const { h1, a1, d1, l2, a3, l3, tool } = ARM_DIM;
  const [q1, q2, q3, q4, q5] = q;
  const q23 = q2 + q3;
  const c23 = Math.cos(q23);
  const s23 = Math.sin(q23);
  // Tool vector in the forearm-roll (J4) frame, then the wrist centre offset in the elbow frame.
  const vz = tool * Math.sin(q5) * Math.sin(q4);
  const fx = -a3 - tool * Math.sin(q5) * Math.cos(q4);
  const fy = l3 + tool * Math.cos(q5);
  const tx = a1 - Math.sin(q2) * l2 + fx * c23 - fy * s23;
  const ty = d1 + Math.cos(q2) * l2 + fx * s23 + fy * c23;
  const c1 = Math.cos(q1);
  const s1 = Math.sin(q1);
  out[0] = tx * c1 + vz * s1;
  out[1] = h1 + ty;
  out[2] = -tx * s1 + vz * c1;
  return out;
}

/** Forward kinematics of the arm's tool centre point in WORLD space. */
export function armTool(q: readonly number[], layout: SceneLayout, out: Vec3): Vec3 {
  armToolLocal(q, out);
  const s = layout.armScale;
  out[0] = layout.arm[0] + s * out[0];
  out[1] = layout.arm[1] + s * out[1];
  out[2] = layout.arm[2] + s * out[2];
  return out;
}

/* The demonstration is only ever read through armPose/armTool (sampled over
   one cycle), so the retargeting follows whatever program the arm runs. */
type DemoExtent = { center: Vec3; radius: number; side: 1 | -1 };
const extents = new WeakMap<SceneLayout, DemoExtent>();
const DEMO_SAMPLES = 240;
function demoExtent(layout: SceneLayout): DemoExtent {
  let e = extents.get(layout);
  if (!e) {
    const p: Vec3 = [0, 0, 0];
    const q = [0, 0, 0, 0, 0, 0];
    const lo: Vec3 = [Infinity, Infinity, Infinity];
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < DEMO_SAMPLES; i++) {
      armTool(armPose((i / DEMO_SAMPLES) * ARM_CYCLE, q), layout, p);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], p[k]);
        hi[k] = Math.max(hi[k], p[k]);
      }
    }
    const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let radius = 0;
    for (let i = 0; i < DEMO_SAMPLES; i++) {
      armTool(armPose((i / DEMO_SAMPLES) * ARM_CYCLE, q), layout, p);
      radius = Math.max(radius, Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]));
    }
    // Which side of the learner the demonstration happens on (learner-local X of its centre).
    const lx =
      (center[0] - layout.humanoid[0]) * Math.cos(layout.humanoidYaw) -
      (center[2] - layout.humanoid[2]) * Math.sin(layout.humanoidYaw);
    e = { center, radius, side: lx > 0 ? 1 : -1 };
    extents.set(layout, e);
  }
  return e;
}

/** Centre of the demonstrated tool path's bounds over one cycle (world). */
export function demoCenter(layout: SceneLayout): Vec3 {
  return demoExtent(layout).center;
}

/** Largest distance of the demonstrated tool path from demoCenter (world). */
export function demoRadius(layout: SceneLayout): number {
  return demoExtent(layout).radius;
}

/**
 * The hand that imitates is the one nearer the demonstrator: +1 = left hand
 * (model +X), -1 = right hand (model -X). Derived from where the demonstrated
 * path lies in the learner's own frame, so it follows any placement.
 */
export function learnerSide(layout: SceneLayout): 1 | -1 {
  return demoExtent(layout).side;
}

/** HAND_HOME for the imitating hand of this layout, model space. */
export function handHome(layout: SceneLayout, out: Vec3): Vec3 {
  out[0] = learnerSide(layout) * Math.abs(HAND_HOME[0]);
  out[1] = HAND_HOME[1];
  out[2] = HAND_HOME[2];
  return out;
}

/**
 * World → world scale of the retargeting: the whole demonstrated path is
 * fitted inside the learner's comfortable reach, never amplified past IMIT_GAIN.
 */
export function imitationGain(layout: SceneLayout): number {
  const fit = (IMIT_REACH * layout.humanoidScale) / Math.max(1e-6, demoRadius(layout));
  return Math.min((IMIT_GAIN * layout.humanoidScale) / layout.armScale, fit);
}

/** Humanoid model-space point → world. */
export function humanoidToWorld(layout: SceneLayout, p: Vec3, out: Vec3): Vec3 {
  const s = layout.humanoidScale;
  const c = Math.cos(layout.humanoidYaw);
  const n = Math.sin(layout.humanoidYaw);
  out[0] = layout.humanoid[0] + s * (p[0] * c + p[2] * n);
  out[1] = layout.humanoid[1] + s * p[1];
  out[2] = layout.humanoid[2] + s * (-p[0] * n + p[2] * c);
  return out;
}

const tmpQ = [0, 0, 0, 0, 0, 0];
const tmpP: Vec3 = [0, 0, 0];
const tmpH: Vec3 = [0, 0, 0];
const tmpHome: Vec3 = [0, 0, 0];
/**
 * Retargeting: the demonstrated tool displacement (world-aligned, so the copy
 * reads 1:1 from the camera) scaled into the learner's reach, lagged.
 */
export function learnerTarget(t: number, layout: SceneLayout, out: Vec3): Vec3 {
  armTool(armPose(t - IMIT_LAG, tmpQ), layout, tmpP);
  const c = demoCenter(layout);
  humanoidToWorld(layout, handHome(layout, tmpHome), tmpH);
  const g = imitationGain(layout);
  out[0] = tmpH[0] + (tmpP[0] - c[0]) * g;
  out[1] = tmpH[1] + (tmpP[1] - c[1]) * g;
  out[2] = tmpH[2] + (tmpP[2] - c[2]) * g;
  return out;
}

/** Grasp state of the demonstration (0 open → 1 closed): closes on each pick, opens on each place. */
export function demoGrip(t: number) {
  const ph = ((t % ARM_CYCLE) + ARM_CYCLE) % ARM_CYCLE;
  const e = gripEvent(ph);
  const k = smoothstep(0, GRIP_RAMP, ph >= e.t ? ph - e.t : ph - e.t + ARM_CYCLE);
  return e.to === 1 ? k : 1 - k;
}

/* ───────────── Scan sweep ─────────────
   A pushbroom-style front travels from the horizon toward the viewer. */
export const SCAN_FROM = -26;
export const SCAN_SPEED = 4.1; // units / s
export const SCAN_PERIOD = 11;
export const SCAN_STILL = -60; // reduced-motion still: the front is parked beyond the tile (a frozen sweep reads as a stray band)

export function scanFront(t: number) {
  const c = t % SCAN_PERIOD;
  return SCAN_FROM + c * SCAN_SPEED;
}
