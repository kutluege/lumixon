/* GLSL for the learner + imitation overlay. ShaderMaterial gets three's
   prefix, so colorspace_fragment is available. Widths are in CSS pixels. */

/* Soft contact shadow on a unit plane. */
export const blobVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const blobFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.0) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

/*
 * Screen-space ribbon along a closed, time-parameterised path (aU ∈ [0,1] is
 * the cycle phase at which the path passes that vertex). A comet rides at
 * uPhase: bright rounded head, long fading tail, faint line for the rest.
 */
export const ribbonVert = /* glsl */ `
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aU;
  uniform vec2 uRes;
  uniform float uPhase;
  uniform float uTail;
  uniform float uFront;
  uniform float uWidth;
  uniform float uHeadWidth;
  varying float vU;
  varying float vSide;

  void main() {
    mat4 pm = projectionMatrix * modelViewMatrix;
    vec4 c = pm * vec4(position, 1.0);
    vec4 p = pm * vec4(aPrev, 1.0);
    vec4 n = pm * vec4(aNext, 1.0);
    vec2 dir = (n.xy / n.w - p.xy / p.w) * uRes;
    float len = length(dir);
    dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
    // Same envelope on both sides of the head, so the width never pops as the head passes a vertex.
    float age = fract(uPhase - aU);
    float head = max(exp(-age * uTail), exp(-(1.0 - age) * uFront));
    float w = uWidth + (uHeadWidth - uWidth) * head;
    c.xy += vec2(-dir.y, dir.x) * aSide * w * 2.0 / uRes * c.w;
    vU = aU;
    vSide = aSide;
    gl_Position = c;
  }
`;

export const ribbonFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uTailColor;
  uniform vec3 uRestColor;
  uniform float uPhase;
  uniform float uTail;
  uniform float uFront;
  uniform float uBase;
  uniform float uOpacity;
  varying float vU;
  varying float vSide;

  void main() {
    float age = fract(uPhase - vU);
    float head = max(exp(-age * uTail), exp(-(1.0 - age) * uFront));
    float prof = smoothstep(1.0, 0.25, abs(vSide));
    vec3 col = mix(uRestColor, uTailColor, smoothstep(0.0, 0.1, head));
    col = mix(col, uColor, smoothstep(0.08, 0.45, head));
    col = mix(col, uHot, pow(head, 5.0));
    float a = (uBase + (1.0 - uBase) * head) * prof * uOpacity;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

/*
 * Demonstration → learner beam: a quadratic Bezier (uA → uC → uB, world
 * space) evaluated in the vertex shader, so moving it costs three uniforms.
 * Light pulses travel from the demonstrator (u = 0) to the learner (u = 1).
 */
const beamPulse = /* glsl */ `
  float beamPulse(float u, float t) {
    float s = 0.0;
    for (int k = 0; k < 3; k++) {
      float d = fract(t * 0.42 + float(k) / 3.0) - u;
      s += d > 0.0 ? exp(-d * 15.0) : exp(d * 110.0);
    }
    return min(s, 1.0);
  }
`;

export const beamVert = /* glsl */ `
  attribute float aU;
  attribute float aSide;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec2 uRes;
  uniform float uWidth;
  uniform float uTime;
  varying float vU;
  varying float vSide;
  ${beamPulse}

  void main() {
    float s = 1.0 - aU;
    vec3 P = s * s * uA + 2.0 * s * aU * uC + aU * aU * uB;
    vec3 T = 2.0 * s * (uC - uA) + 2.0 * aU * (uB - uC);
    mat4 pm = projectionMatrix * viewMatrix;
    vec4 c = pm * vec4(P, 1.0);
    vec4 d = pm * vec4(P + T * 0.02, 1.0);
    vec2 dir = (d.xy / d.w - c.xy / c.w) * uRes;
    float len = length(dir);
    dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
    float w = uWidth * (1.0 + 1.5 * beamPulse(aU, uTime));
    c.xy += vec2(-dir.y, dir.x) * aSide * w * 2.0 / uRes * c.w;
    vU = aU;
    vSide = aSide;
    gl_Position = c;
  }
`;

export const beamFrag = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uHot;
  uniform float uTime;
  uniform float uBase;
  uniform float uOpacity;
  varying float vU;
  varying float vSide;
  ${beamPulse}

  void main() {
    float pulse = beamPulse(vU, uTime);
    float fade = smoothstep(0.0, 0.12, vU) * smoothstep(1.0, 0.9, vU);
    float prof = smoothstep(1.0, 0.25, abs(vSide));
    vec3 col = mix(mix(uColorA, uColorB, vU), uHot, pulse * pulse);
    float a = (uBase + (1.0 - uBase) * pulse) * fade * prof * uOpacity;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

/* End-point markers: soft core + halo, optional thin reticle ring (aRing = radius, 0 = none). */
export const markVert = /* glsl */ `
  attribute float aSize;
  attribute float aRing;
  attribute vec3 aColor;
  uniform float uPR;
  varying float vRing;
  varying vec3 vColor;
  void main() {
    vRing = aRing;
    vColor = aColor;
    gl_PointSize = aSize * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const markFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vRing;
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-r * r * 26.0);
    float halo = exp(-r * r * 5.0) * 0.3;
    float ring = vRing > 0.0 ? (1.0 - smoothstep(0.0, 0.07, abs(r - vRing))) * 0.45 : 0.0;
    float a = (core + halo + ring) * smoothstep(1.0, 0.82, r) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.8), a);
    #include <colorspace_fragment>
  }
`;
