/**
 * Field scene geometry shared by JS (point sampling, obstacle placement, the
 * robot's path) and GLSL (ground relief, map reveal). The world is a
 * treadmill: one tile FIELD_PERIOD metres long in x, repeated forever and
 * scrolled past the robot, which stays at x = 0 and only sways in z. Every
 * function here is periodic in x with that period, so the wrap is seamless.
 *
 * Coordinates: "tile" x in [0, FIELD_PERIOD) is where things live in the map;
 * "relative" x' = wrapX(x - s) is where they are drawn (robot at x' = 0).
 */

export const FIELD_PERIOD = 18;
/** Angular wavenumber of one tile: every periodic term is an integer multiple of it. */
export const FIELD_K = (2 * Math.PI) / FIELD_PERIOD;
const K = FIELD_K;

/** Walking speed (m/s). */
export const WALK_SPEED = 0.42;
/**
 * Range (m) of the quadruped's lidar: its part of the map is revealed inside
 * this radius. A ground-level sensor has a short horizon; the survey drone's
 * swath (see drone/flight.ts) reaches past it on both sides.
 */
export const LIDAR_RANGE = 2.8;
/** Lidar sweep rate (rad/s): one revolution every ~2.2 s. */
export const SWEEP_RATE = (2 * Math.PI) / 2.2;
/** Ground-hit distances of the lidar channels (m), drawn as rings on the ground. */
export const LIDAR_RINGS = [0.62, 0.88, 1.2, 1.6, 2.08, 2.64] as const;
/** Half-width of the flat walking corridor around the path (m). */
export const CORRIDOR = 0.75;

/** Lateral position of the robot's path at tile x. */
export function pathZ(x: number) {
  return 0.32 * Math.sin(K * x) + 0.14 * Math.sin(2 * K * x + 1.0);
}

/** d(pathZ)/dx. */
export function pathSlope(x: number) {
  return 0.32 * K * Math.cos(K * x) + 0.28 * K * Math.cos(2 * K * x + 1.0);
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Ground height at tile (x, z): flat corridor, relief beside it, a bank rising behind. */
export function terrainHeight(x: number, z: number) {
  const dz = z - pathZ(x);
  const m = smoothstep(CORRIDOR, CORRIDOR + 0.95, Math.abs(dz));
  const n =
    0.5 * Math.sin(3 * K * x + 1.7 * z + 0.4) * Math.sin(2 * K * x - 1.1 * z + 1.9) +
    0.3 * Math.sin(5 * K * x + 2.3 * z + 2.1) * Math.sin(7 * K * x - 0.6 * z) +
    0.16 * Math.sin(11 * K * x + 3.1 * z + 0.7);
  const bank = smoothstep(2.3, 5.0, -dz) * (0.42 + 0.18 * Math.sin(2 * K * x + 0.6));
  return m * 0.2 * (n + 0.35) + bank;
}

/** Relative x of a tile x (already offset by the walked distance). */
export function wrapX(x: number) {
  const p = FIELD_PERIOD;
  return ((((x + p / 2) % p) + p) % p) - p / 2;
}

/**
 * Shared GLSL for vertex and fragment stages: the same terrain and path, the
 * map-reveal model and the lidar beam. Every material that includes it shares
 * the uniforms of `makeFieldUniforms` (same objects, updated once per frame).
 */
export const fieldGlsl = /* glsl */ `
  #define FL ${FIELD_PERIOD.toFixed(1)}
  #define FK ${K.toFixed(10)}
  #define LIDAR_R ${LIDAR_RANGE.toFixed(3)}
  #define WALK_V ${WALK_SPEED.toFixed(3)}
  #define SWEEP_W ${SWEEP_RATE.toFixed(6)}
  #define TAU 6.2831853

  uniform float uS;        // distance walked, mod FL
  uniform float uPhase;    // lidar sweep angle, mod TAU
  uniform vec3 uSensor;    // sensor position (relative coords)
  uniform vec2 uFadeC;     // centre of the world fade (x', z)
  uniform float uFadeR;    // radius of the world fade
  uniform vec2 uRes;       // drawing-buffer size in px
  uniform float uPR;       // pixel ratio

  float fPath(float x) { return 0.32 * sin(FK * x) + 0.14 * sin(2.0 * FK * x + 1.0); }
  float wrapX(float x) { return mod(x + 0.5 * FL, FL) - 0.5 * FL; }

  float terrainH(float x, float z) {
    float dz = z - fPath(x);
    float m = smoothstep(${CORRIDOR.toFixed(2)}, ${(CORRIDOR + 0.95).toFixed(2)}, abs(dz));
    float n = 0.5 * sin(3.0 * FK * x + 1.7 * z + 0.4) * sin(2.0 * FK * x - 1.1 * z + 1.9)
            + 0.3 * sin(5.0 * FK * x + 2.3 * z + 2.1) * sin(7.0 * FK * x - 0.6 * z)
            + 0.16 * sin(11.0 * FK * x + 3.1 * z + 0.7);
    float bank = smoothstep(2.3, 5.0, -dz) * (0.42 + 0.18 * sin(2.0 * FK * x + 0.6));
    return m * 0.2 * (n + 0.35) + bank;
  }

  /**
   * Seconds since the lidar first hit a map point at relative x' = xr, tile
   * x = xw, lateral z (negative: not mapped yet). The point entered range
   * when the robot came within LIDAR_R of it, and was hit on the first sweep
   * after that. A pure function of position and the clock, so the map is
   * persistent without any per-point state.
   */
  float revealAge(float xr, float xw, float z) {
    float dz = z - fPath(xw);
    float e2 = LIDAR_R * LIDAR_R - dz * dz;
    if (e2 <= 0.0) return -1.0;
    float entry = sqrt(e2);
    float since = (entry - xr) / WALK_V;
    if (since < 0.0) return -1.0;
    float az = atan(dz, entry);
    float wait = mod(az - (uPhase - SWEEP_W * since), TAU) / SWEEP_W;
    return since - wait;
  }

  /** Seconds since the rotating beam last pointed at a point at (x, z) relative to the sensor. */
  float beamAge(vec2 rel) {
    return mod(uPhase - atan(rel.y, rel.x), TAU) / SWEEP_W;
  }
`;

/** Fragment-only: world fade around the robot times a soft vignette at the canvas edges. */
export const fadeGlsl = /* glsl */ `
  float fieldFade(vec3 p) {
    vec2 d = (p.xz - uFadeC) * vec2(0.8, 1.2);
    float w = 1.0 - smoothstep(uFadeR * 0.35, uFadeR, length(d));
    // Canvas edges: a wide, soft ramp on every side (fully transparent at the
    // border), measured against the short side so it holds at any aspect.
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 e = min(uv, 1.0 - uv) * uRes / min(uRes.x, uRes.y);
    float v = smoothstep(0.015, 0.3, e.x) * smoothstep(0.015, 0.3, e.y);
    return w * w * v * v;
  }
`;
