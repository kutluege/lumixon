import * as THREE from "three";
import { BASE_X, BASE_Z, DUNE, GRID_R, HEAD_Y, PING_PERIOD, PING_RANGE, PING_SPEED, PREDICT_GAP, PREDICT_LEN, RING_STEP } from "./timeline";

/** Uniforms shared (by reference) by every sonar material; written once per frame. */
export function makeSonarUniforms() {
  return {
    /** Loop time (s) and a wrapped absolute time for drift that must not restart with the loop. */
    uT: { value: 0 },
    uTime: { value: 0 },
    /** Age of the newest ping (s). */
    uPingA: { value: 0 },
    /** Acoustic centre of the transducer. */
    uHead: { value: new THREE.Vector3(BASE_X, HEAD_Y, BASE_Z) },
    uFadeC: { value: new THREE.Vector2() },
    uFadeR: { value: 9.5 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPR: { value: 1 },
    /** Middle of the swimmer, its unit heading (xz) and its opacity. */
    uDiver: { value: new THREE.Vector3() },
    uDiverDir: { value: new THREE.Vector2(1, 0) },
    uDiverFade: { value: 0 },
    /** AI layer state, see SonarState. */
    uCand: { value: 0 },
    uLock: { value: 0 },
    uLockTint: { value: 0 },
    uTrack: { value: 0 },
    uReveal: { value: 0 },
    uEcho: { value: 0 },
  };
}

export type SonarUniforms = ReturnType<typeof makeSonarUniforms>;

const n = (v: number, d = 3) => v.toFixed(d);

/** Shared by vertex and fragment stages: uniforms, the dune relief and the ping model. */
export const sonarGlsl = /* glsl */ `
  #define PING_P ${n(PING_PERIOD)}
  #define PING_V ${n(PING_SPEED)}
  #define PING_R ${n(PING_RANGE)}
  #define RING_STEP ${n(RING_STEP)}
  #define GRID_R ${n(GRID_R)}
  #define PREDICT_GAP ${n(PREDICT_GAP)}
  #define PREDICT_LEN ${n(PREDICT_LEN)}
  #define TAU 6.2831853

  uniform float uT;
  uniform float uTime;
  uniform float uPingA;
  uniform vec3 uHead;
  uniform vec2 uFadeC;
  uniform float uFadeR;
  uniform vec2 uRes;
  uniform float uPR;
  uniform vec3 uDiver;
  uniform vec2 uDiverDir;
  uniform float uDiverFade;
  uniform float uCand;
  uniform float uLock;
  uniform float uLockTint;
  uniform float uTrack;
  uniform float uReveal;
  uniform float uEcho;

  /* Low-frequency seabed relief; flat under the tripod. Mirrors seabedH() in timeline.ts. */
  float duneH(vec2 p) {
    float calm = smoothstep(${n(DUNE.flat0, 2)}, ${n(DUNE.flat1, 2)}, length(p - vec2(${n(BASE_X)}, ${n(BASE_Z)})));
    return calm * (0.11 * sin(0.55 * p.x + 0.5 * sin(0.31 * p.y) + 1.0) * sin(0.42 * p.y - 0.2 * p.x + 0.5)
                 + 0.05 * sin(1.1 * p.x - 0.9 * p.y + 2.0));
  }

  /* Seconds since a wavefront last passed a point at distance r from the transducer. */
  float passAge(float r) { return mod(uPingA - r / PING_V, PING_P); }

  /* Strength of a wavefront at radius r: swells out of the head, dies with range. */
  float pingAmp(float r) { return smoothstep(0.2, 0.9, r) * (1.0 - smoothstep(PING_R * 0.5, PING_R, r)); }
`;

/**
 * Fragment-only fades. The environment melts into the page (world fade around
 * the work area times a wide canvas-edge vignette); solid actors only soften
 * right at the canvas edge.
 */
export const fadeGlsl = /* glsl */ `
  vec2 sonarEdge() {
    vec2 uv = gl_FragCoord.xy / uRes;
    return min(uv, 1.0 - uv) * uRes / min(uRes.x, uRes.y);
  }
  float sonarWorld(vec3 p) {
    vec2 d = (p.xz - uFadeC) * vec2(0.8, 1.1);
    float w = 1.0 - smoothstep(uFadeR * 0.35, uFadeR, length(d));
    return w * w;
  }
  float sonarFade(vec3 p) {
    vec2 e = sonarEdge();
    float v = smoothstep(0.015, 0.25, e.x) * smoothstep(0.015, 0.25, e.y);
    return sonarWorld(p) * v * v;
  }
  float solidFade(vec3 p) {
    vec2 e = sonarEdge();
    return sonarWorld(p) * smoothstep(0.0, 0.12, e.x) * smoothstep(0.0, 0.12, e.y);
  }
`;
