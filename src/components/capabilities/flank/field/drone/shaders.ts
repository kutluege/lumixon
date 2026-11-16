/* GLSL for the survey drone's instrumentation: rotor blur, scan plane and
   ray, its trajectory / keyframes in the air and the inter-robot links.
   Everything shares `fieldGlsl` + `droneGlsl` and their uniforms. */
import { fadeGlsl, fieldGlsl } from "../terrain";
import { AIR_NODE_SPACING, droneGlsl, LINK_SPACING } from "./flight";

/**
 * Screen-space-width lines without a line library: each vertex is pushed
 * sideways (in pixels) from its point on the line.
 */
const fatGlsl = /* glsl */ `
  /** Scale for pixel sizes: follows the panel height, clamped per pixel ratio. */
  float pxScale() { return clamp(uRes.y / 650.0, 0.6 * uPR, 1.6 * uPR); }

  vec4 fat(vec3 p, vec3 dir, float side, float px) {
    vec4 a = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vec4 b = projectionMatrix * viewMatrix * vec4(p + dir, 1.0);
    vec2 d = (b.xy / b.w - a.xy / a.w) * uRes;
    float l = length(d);
    d = l > 1e-4 ? d / l : vec2(1.0, 0.0);
    a.xy += vec2(-d.y, d.x) * side * px * pxScale() / uRes * 2.0 * a.w;
    return a;
  }
`;

/** Where the scan plane meets the terrain at lateral z (relative coords). */
const scanGlsl = /* glsl */ `
  vec3 scanHit(float z) {
    float h = max(terrainH(SCAN_XR + uS, z), 0.0);
    return vec3(SCAN_XR - SCAN_TAN * h, h + 0.012, z);
  }
`;

/* ------------------------------------------------------------ rotor blur */

export const rotorVert = /* glsl */ `
  attribute vec2 aC;
  attribute float aDir;
  varying vec2 vC;
  varying float vDir;
  void main() {
    vC = aC;
    vDir = aDir;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const rotorFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uSpin;
  uniform float uOpacity;
  varying vec2 vC;
  varying float vDir;
  void main() {
    float r = length(vC);
    if (r > 1.0) discard;
    // A spinning two-blade prop as the eye sees it: a faint disc, a brighter
    // tip ring, and two soft smears that drift slowly (the strobing of a
    // real prop), never individual blades at aliasing speed.
    float th = atan(vC.y, vC.x) - uSpin * vDir;
    float smear = pow(0.5 + 0.5 * cos(2.0 * th), 3.0);
    float disc = smoothstep(0.07, 0.16, r) * (1.0 - smoothstep(0.93, 1.0, r));
    float tip = smoothstep(0.84, 0.95, r) * (1.0 - smoothstep(0.96, 1.0, r));
    float a = disc * (0.07 + 0.2 * smear * (0.35 + 0.65 * r)) + tip * (0.16 + 0.12 * smear);
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------- scan plane */

export const scanFanVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${scanGlsl}
  attribute float aLat;
  attribute float aEnd;
  varying float vLat;
  varying float vEnd;
  varying vec3 vP;
  void main() {
    vec3 p = mix(uDrone, scanHit(uDroneC.z + aLat * SWATH), aEnd);
    vLat = aLat;
    vEnd = aEnd;
    vP = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const scanFanFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vLat;
  varying float vEnd;
  varying vec3 vP;
  void main() {
    float e = clamp(1.0 - vLat * vLat, 0.0, 1.0);
    float a = (0.3 + 0.7 * vEnd * vEnd) * e * uOpacity;
    // The fan starts in clear air above the map: only the canvas-edge part of the fade applies near the apex.
    gl_FragColor = vec4(uColor, a * mix(1.0, fieldFade(vP), vEnd));
    #include <colorspace_fragment>
  }
`;

/** The measuring ray: from the scanner to the sweeping spot on the scan line. */
export const scanRayVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fatGlsl}
  ${scanGlsl}
  attribute float aEnd;
  attribute float aSide;
  uniform float uWidth;
  uniform float uDot;
  varying float vEnd;
  varying float vSide;
  varying vec3 vP;
  void main() {
    vec3 hit = scanHit(uSpotZ);
    vec3 p = mix(uDrone, hit, aEnd);
    vEnd = aEnd;
    vSide = aSide;
    vP = p;
    gl_PointSize = uDot * pxScale();
    gl_Position = uDot > 0.0 ? projectionMatrix * viewMatrix * vec4(p, 1.0) : fat(p, hit - uDrone, aSide, uWidth);
  }
`;

export const scanRayFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vEnd;
  varying float vSide;
  varying vec3 vP;
  void main() {
    float s = abs(vSide);
    float a = (exp(-s * s * 9.0) + 0.25 * (1.0 - s)) * (0.35 + 0.65 * vEnd) * uOpacity;
    gl_FragColor = vec4(uColor, a * mix(1.0, fieldFade(vP), vEnd));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------- trajectory in the air + track */

export const airTrailVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fatGlsl}
  attribute float aX;
  attribute float aSide;
  uniform float uWidth;
  varying float vSide;
  varying float vX;
  varying vec3 vP;
  void main() {
    float s = uS + aX;
    vec3 p = dronePos(s);
    vec3 q = dronePos(s + 0.05);
    vSide = aSide;
    vX = aX;
    vP = p;
    gl_Position = fat(p, q - p, aSide, uWidth);
  }
`;

export const airTrailFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uCore;
  uniform vec3 uGlow;
  uniform float uLength;
  uniform float uOpacity;
  varying float vSide;
  varying float vX;
  varying vec3 vP;
  void main() {
    float s = abs(vSide);
    float core = exp(-s * s * 9.0);
    float glow = (1.0 - s) * (1.0 - s);
    // Detached from the airframe at its head, fading out at its tail.
    float along = smoothstep(-uLength, -uLength * 0.4, vX) * smoothstep(-0.2, -0.75, vX);
    float a = (core * 0.95 + glow * 0.3) * along * uOpacity;
    gl_FragColor = vec4(mix(uGlow, uCore, core), a * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

/** Drone keyframes: the same sprite as the quadruped's (see nodeFrag), on the air trajectory. */
export const airNodeVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fatGlsl}
  attribute float aK;
  uniform float uSize;
  varying float vAge;
  varying vec3 vP;
  void main() {
    float back = mod(uS, ${AIR_NODE_SPACING.toFixed(3)}) + aK * ${AIR_NODE_SPACING.toFixed(3)};
    vec3 p = dronePos(uS - back);
    vAge = back / WALK_V;
    vP = p;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float pop = 1.0 + 1.2 * exp(-vAge * 3.0);
    gl_PointSize = uSize * pxScale() * pop * clamp(5.0 / max(-mv.z, 0.1), 0.6, 1.4);
    gl_Position = projectionMatrix * mv;
  }
`;

/* ------------------------------------------------------ inter-robot links */

/**
 * aK < 0: the live link between the two sensor heads. aK >= 0: constraint k
 * of the fused pose graph, between the quadruped's keyframe on the ground
 * and the drone's keyframe of the same moment in the air.
 */
export const linkVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fatGlsl}
  attribute float aK;
  attribute float aEnd;
  attribute float aSide;
  uniform float uWidth;
  varying float vT;
  varying float vLen;
  varying float vBack;
  varying float vLive;
  varying float vSide;
  varying vec3 vP;
  void main() {
    vec3 a;
    vec3 b;
    if (aK < 0.0) {
      a = uSensor;
      b = uDrone;
      vBack = 0.0;
      vLive = 1.0;
    } else {
      vBack = mod(uS, ${LINK_SPACING.toFixed(3)}) + aK * ${LINK_SPACING.toFixed(3)};
      float s = uS - vBack;
      a = vec3(-vBack, 0.03, fPath(s));
      b = dronePos(s);
      vLive = 0.0;
    }
    vec3 p = mix(a, b, aEnd);
    vT = aEnd;
    vLen = length(b - a);
    vSide = aSide;
    vP = p;
    gl_Position = fat(p, b - a, aSide, uWidth * mix(1.0, 1.25, vLive));
  }
`;

export const linkFrag = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uOpacity;
  uniform float uCount;
  varying float vT;
  varying float vLen;
  varying float vBack;
  varying float vLive;
  varying float vSide;
  varying vec3 vP;
  void main() {
    float s = abs(vSide);
    float core = exp(-s * s * mix(9.0, 5.0, vLive));
    float d = vT * vLen;
    vec3 col = uColor;
    float a;
    if (vLive > 0.5) {
      // Dashed carrier, a bright packet travelling along it, both ends clear of the housings.
      float dash = 1.0 - smoothstep(0.24, 0.3, abs(fract(d / 0.1) - 0.5));
      float ends = smoothstep(0.0, 0.1, d) * smoothstep(0.0, 0.12, vLen - d);
      float pk = (vT - uPulse) * vLen;
      float pulse = uPulse < 0.0 ? 0.0 : exp(-pk * pk / 0.014) * sin(3.14159 * clamp(uPulse, 0.0, 1.0));
      float glow = (1.0 - s) * (1.0 - s);
      a = (dash * (0.9 * core + 0.12 * glow) + 0.1 * glow + pulse * (core + 0.6 * glow)) * ends;
      col = mix(uColor, uHot, clamp(0.35 * core + pulse * 1.5, 0.0, 1.0));
    } else {
      // A constraint settles into the graph behind the robots and fades with distance.
      float span = uCount * ${LINK_SPACING.toFixed(3)};
      float born = smoothstep(0.4, 0.85, vBack);
      float fresh = exp(-max(vBack - 0.6, 0.0) * 1.4);
      float dash = 1.0 - smoothstep(0.26, 0.34, abs(fract(d / 0.07) - 0.5));
      a = (dash * core + 0.08 * (1.0 - s)) * born * (0.62 + 0.38 * fresh) * (1.0 - smoothstep(span * 0.45, span * 0.95, vBack));
      col = mix(uColor, uHot, fresh * 0.6);
    }
    a *= uOpacity;
    if (a < 0.004) discard;
    // In the air the link is not part of the ground map: fade with the canvas edge / world fade of its ground end only loosely.
    gl_FragColor = vec4(col, a * mix(fieldFade(vP), 1.0, vLive));
    #include <colorspace_fragment>
  }
`;
