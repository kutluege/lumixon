/**
 * Flight of the survey drone, shared by JS (the rig, the scan raster) and
 * GLSL (its trajectory, pose graph and part of the map). The drone holds
 * formation on the quadruped: a fixed lead along the path, weaving slowly
 * across it so its downward scanner covers a wider swath than the
 * quadruped's lidar. Lateral position and altitude are periodic functions of
 * the distance walked (integer harmonics of the tile), so the trajectory is a
 * fixed curve in the tile and any moment can be rendered from (t, s) alone.
 *
 * Coordinates as in ../terrain: "relative" x' has the quadruped at 0.
 */
import { FIELD_K, FIELD_PERIOD, pathSlope, pathZ, WALK_SPEED } from "../terrain";

const K = FIELD_K;

/** The drone flies this far ahead of the quadruped (m). */
export const DRONE_LEAD = 0.8;
/** Cruise altitude of the airframe centre above the corridor floor (m). */
export const DRONE_ALT = 1.6;
/** The airframe is modelled at 1:1 and drawn at this scale (a large survey aircraft, the quadruped's equal in the frame). */
export const DRONE_SCALE = 1.25;
/** Airframe dimensions in model units: motors at (+-arm, +-arm) in x/z, rotor radius, scanner optical centre under the nose. */
export const MODEL = { arm: 0.27, rotor: 0.2, scannerX: 0.09, scannerY: -0.105 } as const;
/** Scanner optical centre relative to the airframe centre, in metres (nominal attitude). */
export const SCANNER_DX = MODEL.scannerX * DRONE_SCALE;
export const SCANNER_DY = MODEL.scannerY * DRONE_SCALE;
/** Relative x' of the scan line on the corridor floor: the scan plane looks down and a little ahead. */
export const SCAN_XR = DRONE_LEAD + SCANNER_DX + 0.3;
/** Slope of the scan plane: how far the line retreats per metre of height above the floor. */
export const SCAN_TAN = (SCAN_XR - DRONE_LEAD - SCANNER_DX) / (DRONE_ALT + SCANNER_DY);
/** Motor offset and rotor radius in metres (for the ground shadow). */
export const ROTOR_ARM = MODEL.arm * DRONE_SCALE;
export const ROTOR_R = MODEL.rotor * DRONE_SCALE;
/** Half-width of the drone's swath on the ground (m). */
export const SWATH = 3.3;
/** Trajectory length drawn behind the drone (m). */
export const AIR_TRAIL = 5.6;
/** Spacing of the drone's keyframes (same as the quadruped's) and of inter-robot constraints (m). */
export const AIR_NODE_SPACING = 0.75;
export const AIR_NODES = 8;
export const LINK_SPACING = 2.25;
export const LINKS = 3;

/* Lateral weave: follows half of the path's sway, sits a little to the far
   side and crosses the path with two slow harmonics. */
const Z_FOLLOW = 0.5;
const Z_CENTRE = -0.45;
const Z_A = 0.45;
const Z_B = 0.1;
const PH_A = 0.6;
const PH_B = 2.1;
const Y_A = 0.04;
const PH_Y = 1.3;
/* It climbs a little to cross the tallest clutter (crate stack, wall): a smooth bump centred on CLIMB_AT. */
const CLIMB = 0.16;
const CLIMB_AT = 11.5;

if (FIELD_PERIOD % LINK_SPACING !== 0 || FIELD_PERIOD % AIR_NODE_SPACING !== 0) {
  throw new Error("drone keyframe spacings must divide the field tile");
}

/** Lateral position of the drone when the quadruped has walked `s`. */
export function droneZ(s: number) {
  return Z_FOLLOW * pathZ(s + DRONE_LEAD) + Z_CENTRE + Z_A * Math.sin(3 * K * s + PH_A) + Z_B * Math.sin(5 * K * s + PH_B);
}

/** d(droneZ)/ds. */
export function droneZSlope(s: number) {
  return Z_FOLLOW * pathSlope(s + DRONE_LEAD) + 3 * K * Z_A * Math.cos(3 * K * s + PH_A) + 5 * K * Z_B * Math.cos(5 * K * s + PH_B);
}

/** Altitude of the airframe centre when the quadruped has walked `s` (slow drift; the bob is time based). */
export function droneY(s: number) {
  const c = 0.5 + 0.5 * Math.cos(K * (s - CLIMB_AT));
  return DRONE_ALT + Y_A * Math.sin(2 * K * s + PH_Y) + CLIMB * c * c * c * c;
}

export type DroneState = {
  /** Airframe centre, relative coordinates. */
  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
  yaw: number;
  /** Lateral position (z) of the scanner's sweeping spot on the scan line. */
  spot: number;
  /** Position of the data pulse on the live link (0 = quadruped, 1 = drone), or -1 when idle. */
  pulse: number;
};

export function makeDroneState(): DroneState {
  return { x: DRONE_LEAD, y: DRONE_ALT, z: 0, roll: 0, pitch: 0, yaw: 0, spot: 0, pulse: -1 };
}

const fract = (x: number) => x - Math.floor(x);

/**
 * Pose of the drone at absolute time `t` after the quadruped has walked `s`
 * (any representative of s modulo the tile). Pure; writes into `out`.
 */
export function droneAt(t: number, s: number, out: DroneState) {
  const slope = droneZSlope(s);
  const vz = WALK_SPEED * slope;
  // Station keeping: small surge and bob on top of the planned track.
  const surge = 0.035 * Math.sin(0.83 * t + 0.4);
  const surgeV = 0.035 * 0.83 * Math.cos(0.83 * t + 0.4);
  out.x = DRONE_LEAD + surge;
  out.y = droneY(s) + 0.028 * Math.sin(1.9 * t) + 0.012 * Math.sin(3.3 * t + 1.1);
  out.z = droneZ(s);
  // Attitude follows the motion: banks into the lateral drift, nose down for
  // forward flight, noses along its own track.
  out.roll = 0.34 * vz + 0.012 * Math.sin(2.7 * t + 0.5);
  out.pitch = -0.06 - 1.1 * surgeV + 0.01 * Math.sin(1.3 * t + 0.2);
  out.yaw = -0.55 * Math.atan(slope) + 0.025 * Math.sin(0.5 * t + 1.0);
  out.spot = out.z + SPOT_BIAS + SPOT_REACH * Math.sin(t * SPOT_RATE);
  // Two exchanges per inter-robot constraint: up to the drone, then back down.
  const ph = fract(s / LINK_SPACING);
  out.pulse = ph < 0.2 ? ph / 0.2 : ph >= 0.5 && ph < 0.7 ? 1 - (ph - 0.5) / 0.2 : -1;
  return out;
}

/**
 * The sweeping spot: centre offset from the drone (toward the far side, where
 * the swath is in view), reach either side of it (m) and angular rate (rad/s).
 */
const SPOT_BIAS = -0.35;
const SPOT_REACH = 1.75;
const SPOT_RATE = 1.6;

/**
 * GLSL mirror, appended to `fieldGlsl`. Shares the uniforms of
 * `makeFieldUniforms` (uDrone, uDroneC, uSpotZ, uPulse).
 */
export const droneGlsl = /* glsl */ `
  #define D_LEAD ${DRONE_LEAD.toFixed(4)}
  #define SCAN_XR ${SCAN_XR.toFixed(4)}
  #define SCAN_TAN ${SCAN_TAN.toFixed(5)}
  #define SWATH ${SWATH.toFixed(3)}

  uniform vec3 uDrone;     // scanner optical centre (relative coords)
  uniform vec4 uDroneC;    // airframe centre (relative coords) and yaw
  uniform float uSpotZ;    // lateral position of the sweeping spot
  uniform float uPulse;    // live-link pulse position, -1 when idle

  float dZ(float s) {
    return ${Z_FOLLOW.toFixed(2)} * fPath(s + D_LEAD) + (${Z_CENTRE.toFixed(3)})
      + ${Z_A.toFixed(3)} * sin(3.0 * FK * s + ${PH_A.toFixed(2)}) + ${Z_B.toFixed(3)} * sin(5.0 * FK * s + ${PH_B.toFixed(2)});
  }
  float dY(float s) {
    float c = 0.5 + 0.5 * cos(FK * (s - ${CLIMB_AT.toFixed(2)}));
    c *= c;
    return ${DRONE_ALT.toFixed(3)} + ${Y_A.toFixed(3)} * sin(2.0 * FK * s + ${PH_Y.toFixed(2)}) + ${CLIMB.toFixed(3)} * c * c;
  }

  /** Planned position of the airframe (relative coords) when the quadruped had walked s (uS = now). */
  vec3 dronePos(float s) { return vec3(s - uS + D_LEAD, dY(s), dZ(s)); }

  /**
   * Seconds since the drone's scan line passed over a map point at relative
   * x' = xr, tile x = xw, height y, lateral z (negative: not scanned). The
   * scan plane leans forward from the scanner, so it reaches the top of a
   * tall thing a little after the ground in front of it.
   */
  float droneAge(float xr, float xw, float y, float z) {
    float lead = SCAN_XR - SCAN_TAN * max(y, 0.0);
    float since = (lead - xr) / WALK_V;
    if (since < 0.0) return -1.0;
    float lat = z - dZ(xw - lead);
    if (abs(lat) > SWATH) return -1.0;
    return since;
  }
`;
