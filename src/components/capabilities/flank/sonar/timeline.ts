/**
 * Sonar scene timeline and layout: pure math, no three import (the static SVG
 * still reads the same numbers). Everything that moves is a function of the
 * loop time, so any moment can be rendered directly and the loop is seamless.
 *
 * World: metres, y up, seabed around y = 0. The sonar head stands right of
 * centre in the foreground; the diver swims in from the far side toward it.
 */

/** Loop length (s). The ping period divides it, so the pings wrap seamlessly. */
export const LOOP = 24;
/** Seconds between pings, and the (stylised) speed of the wavefront in m/s. */
export const PING_PERIOD = 2.4;
export const PING_SPEED = 3.2;
/** A wavefront has faded out completely at this range (m). */
export const PING_RANGE = 8.6;

/** Tripod position on the seabed and the height of the transducer's acoustic centre. */
export const BASE_X = 2.35;
export const BASE_Z = 0.95;
export const HEAD_Y = 1.1;

/** Polar plot drawn on the seabed around the tripod: ring spacing and outer radius (m). */
export const RING_STEP = 1.5;
export const GRID_R = 6;

/** Mooring (clump weight, chain, buoy) the fish school circles. */
export const MOOR_X = 2.5;
export const MOOR_Z = -4.0;

/**
 * Camera framing shared by the live scene and the static still: look-at point,
 * direction from the look-at toward the camera, distance and vertical fov.
 */
export const CAMERA = { look: [-0.7, 1.0, -0.75], dir: [0.2, 0.5, 1], dist: 12, fov: 30 } as const;
/** Reduced motion and the static still show this moment: locked, track drawn. */
export const STILL_T = 15.5;

export type V3 = { x: number; y: number; z: number };

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export function smooth(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function loopTime(t: number) {
  return ((t % LOOP) + LOOP) % LOOP;
}

/** Deterministic hash in [0, 1). */
export function hash1(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------------ seabed */

/** Dune coefficients, shared verbatim with the GLSL copy in glsl.ts. */
export const DUNE = { flat0: 0.9, flat1: 2.6 } as const;

/** Low-frequency relief of the seabed (the ripples are shader-only). Flat under the tripod. */
export function seabedH(x: number, z: number) {
  const flat = smooth(DUNE.flat0, DUNE.flat1, Math.hypot(x - BASE_X, z - BASE_Z));
  return (
    flat *
    (0.11 * Math.sin(0.55 * x + 0.5 * Math.sin(0.31 * z) + 1.0) * Math.sin(0.42 * z - 0.2 * x + 0.5) +
      0.05 * Math.sin(1.1 * x - 0.9 * z + 2.0))
  );
}

/* ------------------------------------------------------------------- diver */

/** Quadratic Bézier in the xz plane: enters far left, curves toward the protected (sonar) side. */
const P0 = [-4.25, -3.0] as const;
const P1 = [-1.5, -2.8] as const;
const P2 = [1.35, -0.75] as const;
/** Seconds to swim the whole curve. */
const SWIM_T = 23.5;
/** Flutter-kick angular rate (rad/s). */
export const KICK_W = 2 * Math.PI * 0.62;
/** Distance from the pelvis (the rig origin) to the middle of the swimmer, along the heading. */
export const DIVER_MID = -0.3;

/** Pelvis position of the diver at loop time `tl`. */
export function diverAt(tl: number, out: V3) {
  const u = clamp01(tl / SWIM_T);
  const a = (1 - u) * (1 - u);
  const b = 2 * u * (1 - u);
  const c = u * u;
  out.x = a * P0[0] + b * P1[0] + c * P2[0];
  out.z = a * P0[1] + b * P1[1] + c * P2[1];
  out.y = 1.62 - 0.32 * smooth(0.05, 0.95, u) + 0.045 * Math.sin(tl * 0.9);
  return out;
}

/** Unit heading in the xz plane at loop time `tl` (written to out.x / out.z; out.y = climb rate, m/s). */
export function diverDir(tl: number, out: V3) {
  const u = clamp01(tl / SWIM_T);
  const dx = 2 * (1 - u) * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]);
  const dz = 2 * (1 - u) * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1]);
  const l = Math.hypot(dx, dz) || 1;
  out.x = dx / l;
  out.z = dz / l;
  const h = 0.05;
  const y0 = 1.62 - 0.32 * smooth(0.05, 0.95, clamp01((tl - h) / SWIM_T)) + 0.045 * Math.sin((tl - h) * 0.9);
  const y1 = 1.62 - 0.32 * smooth(0.05, 0.95, clamp01((tl + h) / SWIM_T)) + 0.045 * Math.sin((tl + h) * 0.9);
  out.y = (y1 - y0) / (2 * h);
  return out;
}

/** The swimmer is on stage between these loop times (fades in, fades out). */
export const DIVER_IN = [1.0, 3.4] as const;
export const DIVER_OUT = [19.7, 22.2] as const;

export function diverFade(tl: number) {
  return smooth(DIVER_IN[0], DIVER_IN[1], tl) * (1 - smooth(DIVER_OUT[0], DIVER_OUT[1], tl));
}

/* -------------------------------------------------------------- detections */

export type Detection = {
  /** Loop time at which the wavefront reaches the diver. */
  tau: number;
  /** Middle of the swimmer at that moment. */
  x: number;
  y: number;
  z: number;
  /** Range from the transducer (m). */
  range: number;
};

/** A return counts while the swimmer is solidly on stage. */
const DETECT_FROM = 3.2;
const DETECT_TO = 19.9;

function solveDetections(): Detection[] {
  const out: Detection[] = [];
  const p: V3 = { x: 0, y: 0, z: 0 };
  const d: V3 = { x: 0, y: 0, z: 0 };
  const pings = Math.round(LOOP / PING_PERIOD);
  for (let k = 0; k < pings; k++) {
    // Fixed point of tau = emit + range(tau) / speed (the diver is much slower than the wave).
    let tau = k * PING_PERIOD + 1;
    let range = 0;
    for (let i = 0; i < 16; i++) {
      diverAt(tau, p);
      diverDir(tau, d);
      const x = p.x + d.x * DIVER_MID - BASE_X;
      const y = p.y - HEAD_Y;
      const z = p.z + d.z * DIVER_MID - BASE_Z;
      range = Math.hypot(x, y, z);
      tau = k * PING_PERIOD + range / PING_SPEED;
    }
    if (tau < DETECT_FROM || tau > DETECT_TO) continue;
    diverAt(tau, p);
    diverDir(tau, d);
    out.push({ tau, x: p.x + d.x * DIVER_MID, y: p.y, z: p.z + d.z * DIVER_MID, range });
  }
  return out;
}

/** Every return from the diver in one loop, in order. */
export const DETECTIONS: readonly Detection[] = solveDetections();
/** The anomaly lock is declared on this return (the third). */
export const LOCK_INDEX = 2;
export const T_FIRST = DETECTIONS[0].tau;
export const T_LOCK = DETECTIONS[LOCK_INDEX].tau;
/** The track is drawn along the swum path from the first return until the swimmer leaves. */
export const TRACK_T0 = T_FIRST;
export const TRACK_T1 = DIVER_OUT[1];
/** Look-ahead of the predicted path (m). */
export const PREDICT_LEN = 2.3;
/** The predicted path starts this far ahead of the middle of the swimmer (m). */
export const PREDICT_GAP = 1.15;

export type SonarState = {
  tl: number;
  /** Age of the newest ping (s). */
  pingAge: number;
  /** Pelvis, middle of the swimmer and unit heading (xz). */
  pelvis: V3;
  mid: V3;
  dir: V3;
  fade: number;
  /** 0 → 1 once the first return has come in (candidate target). */
  cand: number;
  /** 0 → 1 at the third return, back to 0 as the swimmer leaves. */
  lock: number;
  /** Colour of the AI layer: ice (0) → alert (1); stays 1 through the fade-out. */
  lockTint: number;
  /** Seconds since the lock (negative before). */
  sinceLock: number;
  /** Opacity of the track layer. */
  track: number;
  /** The track is revealed up to this loop time (jumps per return, then follows live). */
  reveal: number;
  /** 1 at a return, decaying: flashes the range / bearing measurement. */
  echo: number;
};

export function makeState(): SonarState {
  return {
    tl: 0,
    pingAge: 0,
    pelvis: { x: 0, y: 0, z: 0 },
    mid: { x: 0, y: 0, z: 0 },
    dir: { x: 1, y: 0, z: 0 },
    fade: 0,
    cand: 0,
    lock: 0,
    lockTint: 0,
    sinceLock: -1,
    track: 0,
    reveal: 0,
    echo: 0,
  };
}

/** Everything the scene needs for absolute time `t`. Does not allocate. */
export function sonarState(t: number, s: SonarState) {
  const tl = loopTime(t);
  s.tl = tl;
  s.pingAge = tl % PING_PERIOD;
  diverAt(tl, s.pelvis);
  diverDir(tl, s.dir);
  s.mid.x = s.pelvis.x + s.dir.x * DIVER_MID;
  s.mid.y = s.pelvis.y;
  s.mid.z = s.pelvis.z + s.dir.z * DIVER_MID;
  s.fade = diverFade(tl);

  let last = -1;
  for (let i = 0; i < DETECTIONS.length; i++) if (DETECTIONS[i].tau <= tl) last = i;
  const leaving = 1 - smooth(DIVER_OUT[0], DIVER_OUT[0] + 1.7, tl);
  s.cand = smooth(T_FIRST, T_FIRST + 0.35, tl) * leaving;
  s.lock = smooth(T_LOCK, T_LOCK + 0.45, tl) * leaving;
  s.lockTint = smooth(T_LOCK, T_LOCK + 0.45, tl);
  s.sinceLock = tl - T_LOCK;
  s.track = smooth(T_FIRST, T_FIRST + 0.3, tl) * (1 - smooth(DIVER_OUT[0] + 0.3, DIVER_OUT[1] + 0.5, tl));
  // Before the lock the track only grows when a return comes in; after it, the tracker follows live.
  const stepped = last >= 0 ? DETECTIONS[last].tau : TRACK_T0;
  s.reveal = stepped + (tl - stepped) * smooth(T_LOCK, T_LOCK + 0.8, tl);
  s.echo = last >= 0 ? Math.exp(-(tl - DETECTIONS[last].tau) * 1.25) : 0;
  return s;
}

/* -------------------------------------------------------------------- fish */

export const FISH_MAX = 18;
const W = (2 * Math.PI) / LOOP;

/** Position of fish `i` at absolute time `t`: a loose school circling the mooring line. */
export function fishAt(i: number, t: number, out: V3) {
  const lag = (hash1(i * 3.1 + 0.5) - 0.5) * 1.5;
  const a = W * t + lag;
  const rx = 0.9 + (hash1(i * 5.3 + 1.1) - 0.5) * 0.5;
  const rz = 0.95 + (hash1(i * 7.7 + 2.3) - 0.5) * 0.6;
  out.x = MOOR_X - 0.55 + rx * Math.cos(a) + 0.06 * Math.sin(W * 5 * t + i * 2.4);
  out.z = MOOR_Z + 0.2 + rz * Math.sin(a) + 0.06 * Math.cos(W * 4 * t + i * 1.7);
  out.y = 1.8 + (hash1(i * 9.9 + 3.7) - 0.5) * 1.0 + 0.12 * Math.sin(2 * a + 1 + i * 0.4) + 0.03 * Math.sin(W * 6 * t + i);
  return out;
}

/* ----------------------------------------------------------------- bubbles */

/** The diver exhales every BREATH seconds: a burst of bubbles rising from the regulator. */
export const BREATH = 3.3;
export const BUBBLES_PER_BREATH = 9;
export const BUBBLE_LIFE = 3.0;
