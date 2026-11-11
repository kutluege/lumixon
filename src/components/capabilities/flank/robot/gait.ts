/**
 * Kinematic layout and trot gait of the quadruped. Pure functions over
 * numbers / caller-owned outputs, so the scenes can also sample the gait
 * (predicted footfalls, centre-of-mass trace) without touching the rig.
 *
 * Model space: metres, +X forward, +Y up, +Z to the robot's right, feet on y = 0.
 */

/** Hip pitch axis height when standing. */
export const HIP_Y = 0.4;
/** Hip (abduction axis) positions along the body. */
export const HIP_X = 0.27;
/** Lateral position of the abduction axis. */
export const HIP_Z = 0.085;
/** Outboard offset from the abduction axis to the leg plane. */
export const HIP_OFF = 0.065;
/** Thigh and shank lengths. */
export const L1 = 0.21;
export const L2 = 0.22;
/** Rubber foot radius (foot centre sits this high when planted). */
export const FOOT_R = 0.022;

export const GAIT = {
  /** Distance walked per full gait cycle (m). */
  cycle: 0.44,
  /** Fraction of the cycle a foot is on the ground. */
  duty: 0.58,
  /** Swing apex height above the ground (m). */
  lift: 0.07,
} as const;

/** Step length = distance a stance foot travels under the body. */
export const STEP = GAIT.cycle * GAIT.duty;

export type LegId = "FL" | "FR" | "RL" | "RR";

export type LegDef = {
  id: LegId;
  /** +1 front, -1 rear. */
  fore: 1 | -1;
  /** +1 right (+Z), -1 left. */
  side: 1 | -1;
  /** Gait phase offset (trot: diagonal pairs in phase). */
  phase: number;
  /** Neutral foothold. */
  x0: number;
  z0: number;
};

const LEG_Z = HIP_Z + HIP_OFF;

export const LEGS: readonly LegDef[] = [
  { id: "FL", fore: 1, side: -1, phase: 0, x0: HIP_X + 0.012, z0: -LEG_Z },
  { id: "FR", fore: 1, side: 1, phase: 0.5, x0: HIP_X + 0.012, z0: LEG_Z },
  { id: "RL", fore: -1, side: -1, phase: 0.5, x0: -HIP_X - 0.008, z0: -LEG_Z },
  { id: "RR", fore: -1, side: 1, phase: 0, x0: -HIP_X - 0.008, z0: LEG_Z },
];

const TAU = Math.PI * 2;

export function fract(x: number) {
  return x - Math.floor(x);
}

/** Leg phase in [0, 1): [0, duty) stance, [duty, 1) swing. */
export function legPhase(leg: LegDef, stride: number) {
  return fract(stride / GAIT.cycle + leg.phase);
}

export type Vec3Like = { x: number; y: number; z: number };

/**
 * Foot centre in model space for a given distance walked. During stance the
 * foot moves back exactly as fast as the body moves forward (planted in the
 * world); the swing is velocity-continuous at lift-off and touch-down.
 * Returns the swing progress (0 while in stance).
 */
export function footAt(leg: LegDef, stride: number, out: Vec3Like) {
  const { cycle: C, duty, lift } = GAIT;
  const p = legPhase(leg, stride);
  out.z = leg.z0;
  if (p < duty) {
    out.x = leg.x0 + STEP / 2 - (p / duty) * STEP;
    out.y = FOOT_R;
    return 0;
  }
  const u = (p - duty) / (1 - duty);
  // World-space swing: smooth (zero end velocity) advance of one full cycle.
  const adv = u - Math.sin(TAU * u) / TAU;
  out.x = leg.x0 - STEP / 2 + C * adv - (1 - duty) * C * u;
  // Lift: quick off the ground, gentle set-down (skewed bell, zero end velocity).
  const v = Math.pow(u, 0.82);
  const bell = 0.5 - 0.5 * Math.cos(TAU * v);
  out.y = FOOT_R + lift * bell;
  // Feet tuck in a touch mid-swing.
  out.z = leg.z0 - leg.side * 0.012 * bell;
  return u;
}

export type BodyPose = { y: number; z: number; pitch: number; roll: number; yaw: number };

/**
 * Body bob (dips just after each diagonal pair lands), a little pitch, roll
 * toward the stance diagonal, lateral weight shift and breathing.
 */
export function bodyAt(stride: number, t: number, out: BodyPose) {
  const g = stride / GAIT.cycle;
  // Touch-downs at phase = duty (pair A) and duty + 0.5 (pair B).
  const land = TAU * 2 * (g - GAIT.duty - 0.06);
  out.y = HIP_Y - 0.007 * Math.cos(land) + 0.0025 * Math.sin(t * 1.7);
  out.pitch = 0.012 * Math.sin(land + 0.9) + 0.006 * Math.sin(t * 0.9);
  out.roll = 0.018 * Math.sin(TAU * g + 0.6);
  out.z = 0.006 * Math.sin(TAU * g + 0.6);
  out.yaw = 0.01 * Math.sin(TAU * g + 2.2);
  return out;
}

/**
 * Analytic 3-DOF leg IK. (dx, dy, dz) is the foot centre relative to the
 * abduction axis origin, in the body frame. Writes [abduction about X,
 * hip pitch about Z, knee about Z] into `out` (knees point backward).
 */
export function solveLeg(side: number, dx: number, dy: number, dz: number, out: Float32Array | number[], o = 0) {
  const off = side * HIP_OFF;
  // Abduction: rotate the leg plane (offset `off` from the axis) onto the foot.
  const r2 = dy * dy + dz * dz;
  const fy = -Math.sqrt(Math.max(1e-6, r2 - off * off));
  // Angles measured from straight down (no wrap-around near ±π).
  const abd = Math.atan2(-dz, -dy) - Math.atan2(-off, -fy);
  // Sagittal 2-bone solve in the leg plane.
  const maxD = L1 + L2 - 1e-4;
  const minD = Math.abs(L1 - L2) + 0.02;
  let D = Math.sqrt(dx * dx + fy * fy);
  D = Math.min(maxD, Math.max(minD, D));
  const gamma = Math.atan2(dx, -fy);
  const cosA = (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D);
  const cosB = (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2);
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const beta = Math.acos(Math.min(1, Math.max(-1, cosB)));
  out[o] = abd;
  out[o + 1] = gamma - alpha;
  out[o + 2] = Math.PI - beta;
}
