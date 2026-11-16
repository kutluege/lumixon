/* GLSL for the field (SLAM) scene. ShaderMaterial gets three's prefix, so
   colorspace_fragment is available. All share `fieldGlsl` (terrain, path,
   map-reveal model, beam) and its uniforms. */
import { droneGlsl, ROTOR_ARM } from "./drone/flight";
import { MAX_FOOTPRINTS } from "./world";
import { fadeGlsl, fieldGlsl, LIDAR_RINGS } from "./terrain";

const ringsGlsl = `float RINGS[${LIDAR_RINGS.length}] = float[](${LIDAR_RINGS.map((r) => r.toFixed(3)).join(", ")});`;

/* ------------------------------------------------------------------ ground */

export const groundVert = /* glsl */ `
  ${fieldGlsl}
  uniform float uSnap;
  varying vec3 vP;
  varying vec3 vN;
  varying float vXw;

  void main() {
    // The grid is pinned to the world (it scrolls by less than one cell, then
    // snaps back by exactly one), so the relief never swims across vertices.
    float xr = position.x - uSnap;
    float z = position.z;
    float xw = xr + uS;
    float h = terrainH(xw, z);
    const float e = 0.05;
    float hx = terrainH(xw + e, z) - terrainH(xw - e, z);
    float hz = terrainH(xw, z + e) - terrainH(xw, z - e);
    vN = normalize(vec3(-hx, 2.0 * e, -hz));
    vP = vec3(xr, h, z);
    vXw = xw;
    gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
  }
`;

export const groundFrag = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  ${fadeGlsl}
  #define MAXF ${MAX_FOOTPRINTS}
  #define CELL 0.25
  uniform vec3 uObs[MAXF];
  uniform vec3 uBase;
  uniform vec3 uLit;
  uniform vec3 uIce;
  uniform vec3 uIndigo;
  uniform vec3 uAerial;
  uniform vec3 uWine;
  uniform vec3 uKey;
  uniform float uLive;
  uniform float uShadow;
  varying vec3 vP;
  varying vec3 vN;
  varying float vXw;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    ${ringsGlsl}
    vec2 wp = vec2(vXw, vP.z);
    // Gravel: two octaves of value noise as a bump on the normal and the albedo.
    float g1 = vnoise(wp * 9.0);
    float g2 = vnoise(wp * 31.0);
    vec3 n = normalize(vN + vec3(g1 - 0.5, 0.0, g2 - 0.5) * 0.35);
    float diff = clamp(dot(n, uKey), 0.0, 1.0);
    float sky = n.y * 0.5 + 0.5;
    vec3 col = uBase * (0.6 + 0.4 * sky) * (0.8 + 0.35 * g1 * g2 + 0.15 * g2) + uLit * diff * diff * 0.4;

    vec2 rel = vP.xz - uSensor.xz;
    float r = length(rel);
    // Work-light pool around the robot.
    col += uIndigo * 0.06 * exp(-r * r * 0.5);
    // Darker away from the robot, so the lit work area and the map carry the frame.
    col *= mix(0.55, 1.0, exp(-r * r * 0.06));

    // Obstacle contact occlusion + occupancy cells.
    vec2 cell = (floor(wp / CELL) + 0.5) * CELL;
    float ao = 1.0;
    float occ = 0.0;
    for (int i = 0; i < MAXF; i++) {
      vec3 f = uObs[i];
      if (f.z <= 0.0) continue;
      float dist = length(vec2(wrapX(wp.x - f.x), wp.y - f.y));
      ao *= mix(0.35, 1.0, smoothstep(f.z * 0.55, f.z * 1.8, dist));
      float dc = length(vec2(wrapX(cell.x - f.x), cell.y - f.y));
      occ = max(occ, 1.0 - smoothstep(f.z * 0.95, f.z * 1.05, dc));
    }
    col *= ao;

    // Soft shadow of the drone: four rotor discs and the airframe, wide
    // penumbra from its altitude, nudged along the key light.
    {
      vec2 q = vP.xz - (uDroneC.xz + vec2(0.16, -0.3));
      float cy = cos(uDroneC.w);
      float sy = sin(uDroneC.w);
      q = vec2(cy * q.x - sy * q.y, sy * q.x + cy * q.y);
      vec2 a = abs(q) - vec2(${ROTOR_ARM.toFixed(3)});
      float sh = exp(-dot(a, a) / 0.036) * 0.85 + exp(-dot(q, q) / 0.03) * 0.75;
      col *= 1.0 - uShadow * clamp(sh, 0.0, 1.0);
    }

    // The map, where either sensor has already been: a faint occupancy grid
    // near the path, occupied cells in burgundy.
    float ageD = droneAge(vP.x, vXw, vP.y, vP.z);
    float mappedD = smoothstep(0.0, 0.5, ageD);
    float mapped = max(smoothstep(0.0, 0.5, revealAge(vP.x, vXw, vP.z)), mappedD);
    vec2 gw = abs(fract(wp / CELL - 0.5) - 0.5) / fwidth(wp / CELL);
    float line = 1.0 - min(min(gw.x, gw.y), 1.0);
    float near = 1.0 - smoothstep(0.35, 1.0, abs(vP.z - fPath(vXw)));
    // Known free space reads a shade lighter than the unexplored ground ahead.
    col += uIndigo * mapped * (0.022 + line * 0.03 * near);
    vec2 cf = abs(fract(wp / CELL) - 0.5);
    float edge = 1.0 - smoothstep(0.38, 0.45, max(cf.x, cf.y));
    col = mix(col, uWine, occ * mapped * (0.12 + 0.3 * (1.0 - edge)));

    // Live lidar: channel rings on the ground and the sweep wedge.
    float inR = 1.0 - smoothstep(LIDAR_R * 0.82, LIDAR_R, r);
    float ba = beamAge(rel);
    float head = exp(-ba * 2.4);
    float wedge = exp(-ba * 4.0) * smoothstep(0.0, 0.025, ba);
    float rings = 0.0;
    float w = max(0.006, fwidth(r) * 0.9);
    for (int i = 0; i < ${LIDAR_RINGS.length}; i++) {
      float d = (r - RINGS[i]) / w;
      rings += exp(-d * d);
    }
    col += uIce * (rings * 0.55 * head * head + wedge * 0.045) * inR * uLive;

    // Live drone scan: the line where its scan plane meets the terrain (crisp
    // core, soft halo, a short afterglow behind it) and the sweeping spot.
    float lead = SCAN_XR - SCAN_TAN * max(vP.y, 0.0);
    float dxl = vP.x - lead;
    float lat = abs(vP.z - uDroneC.z) / SWATH;
    float inSw = 1.0 - smoothstep(0.72, 1.0, lat);
    float lw = max(0.008, fwidth(vP.x) * 1.1);
    float core = exp(-dxl * dxl / (lw * lw));
    float halo = exp(-dxl * dxl / 0.006);
    float after = smoothstep(-0.7, 0.0, dxl) * step(dxl, 0.0);
    vec2 sp = vec2(dxl, vP.z - uSpotZ);
    float spot = exp(-dot(sp, sp) / 0.012) + 0.35 * exp(-dot(sp, sp) / 0.09);
    col += (uAerial * (core * 0.6 + halo * 0.16 + after * after * 0.07) * inSw + uIce * spot * 0.55) * uLive;
    // Ground only the drone has surveyed reads a shade more violet.
    col += uAerial * mappedD * 0.034;

    gl_FragColor = vec4(col, fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

/* -------------------------------------------------------------- map cloud */

export const cloudVert = /* glsl */ `
  ${fieldGlsl}
  ${droneGlsl}
  attribute float aRnd;
  attribute float aKind;
  attribute float aSrc;
  uniform float uSize;
  varying float vFlash;
  varying float vLive;
  varying float vKind;
  varying float vSrc;
  varying float vRnd;
  varying vec3 vP;

  void main() {
    float xr = wrapX(position.x - uS);
    vec3 p = vec3(xr, position.y, position.z);
    // Two sources, one map: each point belongs to the sensor that can see it.
    bool aerial = aSrc > 0.5;
    float age = aerial ? droneAge(xr, position.x, position.y, position.z) : revealAge(xr, position.x, position.z);
    if (age < 0.0) {
      // Not mapped yet: off-screen, no fragments.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    if (aerial) {
      float dz = (p.z - uSpotZ) / 0.32;
      vLive = exp(-dz * dz) * exp(-age * 1.6);
      vFlash = exp(-age * 1.9);
    } else {
      vec2 rel = p.xz - uSensor.xz;
      float inR = 1.0 - smoothstep(LIDAR_R * 0.8, LIDAR_R, length(rel));
      vLive = exp(-beamAge(rel) * 3.0) * inR;
      vFlash = exp(-age * 1.5);
    }
    vKind = aKind;
    vSrc = aSrc;
    vRnd = aRnd;
    vP = p;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.1);
    // Sized against the panel height, so the cloud keeps its texture from phone to desktop.
    float s = uSize * uRes.y * 0.0012 * (4.5 / dist) * (0.75 + aRnd * 0.5) * (1.0 + vFlash * 1.3 + vLive * 0.5);
    s *= mix(1.0, 1.2, aKind);
    gl_PointSize = clamp(s, 0.75 * uPR, uRes.y * 0.007);
    gl_Position = projectionMatrix * mv;
  }
`;

export const cloudFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uObj;
  uniform vec3 uAirLow;
  uniform vec3 uAirHigh;
  uniform vec3 uAirObj;
  uniform vec3 uHot;
  uniform vec3 uAirHot;
  uniform vec3 uWine;
  uniform float uOpacity;
  varying float vFlash;
  varying float vLive;
  varying float vKind;
  varying float vSrc;
  varying float vRnd;
  varying vec3 vP;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    if (r2 > 0.25) discard;
    float soft = 1.0 - smoothstep(0.08, 0.25, r2);

    // Quadruped lidar: ice family, darker in the hollows. Drone scanner:
    // indigo family, so the two contributions stay tellable inside one cloud.
    float hgt = smoothstep(-0.22, 0.5, vP.y);
    vec3 col = mix(mix(uLow, uHigh, hgt), mix(uAirLow, uAirHigh, hgt), vSrc);
    col = mix(col, mix(uObj, uAirObj, vSrc), vKind);
    float a = mix(0.42 + 0.2 * vRnd, 0.7 + 0.2 * vRnd, vKind);
    vec3 hot = mix(uHot, uAirHot, vSrc);

    // Obstacle returns flash burgundy on first contact, then cool down.
    vec3 flashCol = mix(hot, uWine * 1.6, vKind * smoothstep(0.85, 0.35, vFlash) * 0.8);
    col = mix(col, flashCol, clamp(vFlash * 1.2, 0.0, 1.0));
    a += vFlash * 0.6;
    col = mix(col, hot, vLive * 0.7);
    a += vLive * 0.35;

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * soft * uOpacity * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------- lidar fan */

export const fanVert = /* glsl */ `
  ${fieldGlsl}
  attribute float aEl;
  attribute float aEnd;
  attribute float aLag;
  uniform float uSpread;
  uniform float uDot;
  varying float vEnd;
  varying float vLag;
  varying vec3 vP;

  void main() {
    float th = uPhase - aLag * uSpread;
    float ce = cos(aEl);
    float se = sin(aEl);
    vec3 dir = vec3(ce * cos(th), se, ce * sin(th));
    // Down-looking channels stop on the (flat) corridor floor, the others at range.
    float len = se < -0.01 ? min(LIDAR_R, uSensor.y / -se) : LIDAR_R * 0.8;
    vec3 p = uSensor + dir * len * aEnd;
    p.y = max(p.y, 0.012);
    vEnd = aEnd;
    vLag = aLag;
    vP = p;
    gl_PointSize = uDot * clamp(uRes.y / 650.0, 0.6 * uPR, 1.6 * uPR);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const fanFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vEnd;
  varying float vLag;
  varying vec3 vP;

  void main() {
    float lag = 1.0 - vLag;
    float a = (0.15 + 0.85 * vEnd * vEnd) * lag * lag * uOpacity;
    gl_FragColor = vec4(uColor, a * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

export const fanDotFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vP;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (exp(-r * r * 9.0) + 0.35 * exp(-r * r * 2.5)) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------- trajectory + pose graph */

export const trailVert = /* glsl */ `
  ${fieldGlsl}
  attribute float aX;
  attribute float aSide;
  uniform float uWidth;
  varying float vSide;
  varying float vX;
  varying vec3 vP;

  void main() {
    float xw = aX + uS;
    float z = fPath(xw);
    float sl = (fPath(xw + 0.01) - fPath(xw - 0.01)) / 0.02;
    vec2 nr = normalize(vec2(-sl, 1.0));
    vec3 p = vec3(aX, 0.016, z) + vec3(nr.x, 0.0, nr.y) * aSide * uWidth;
    vSide = aSide;
    vX = aX;
    vP = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const trailFrag = /* glsl */ `
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
    float core = exp(-s * s * 14.0);
    float glow = (1.0 - s) * (1.0 - s);
    float along = smoothstep(-uLength, -uLength * 0.35, vX) * smoothstep(0.05, -0.35, vX);
    vec3 col = mix(uGlow, uCore, core);
    float a = (core * 0.95 + glow * 0.28) * along * uOpacity;
    gl_FragColor = vec4(col, a * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

export const nodeVert = /* glsl */ `
  ${fieldGlsl}
  attribute float aK;
  uniform float uSpacing;
  uniform float uSize;
  varying float vAge;
  varying vec3 vP;

  void main() {
    float off = mod(uS, uSpacing);
    float xr = -off - aK * uSpacing;
    float xw = xr + uS;
    vec3 p = vec3(xr, 0.02, fPath(xw));
    vAge = (off + aK * uSpacing) / WALK_V;
    vP = p;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float pop = 1.0 + 1.4 * exp(-vAge * 3.0);
    gl_PointSize = uSize * clamp(uRes.y / 650.0, 0.6 * uPR, 1.6 * uPR) * pop * clamp(5.0 / max(-mv.z, 0.1), 0.6, 1.4);
    gl_Position = projectionMatrix * mv;
  }
`;

export const nodeFrag = /* glsl */ `
  ${fieldGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uCount;
  uniform float uSpacing;
  uniform float uOpacity;
  varying float vAge;
  varying vec3 vP;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    float ring = smoothstep(0.5, 0.42, r) * smoothstep(0.26, 0.34, r);
    float pip = 1.0 - smoothstep(0.1, 0.17, r);
    float born = exp(-vAge * 2.5);
    float a = (ring * (0.55 + 0.45 * born) + pip) * uOpacity;
    // Fade by distance travelled (continuous), not by index, so nothing pops when a keyframe is added.
    float back = vAge * WALK_V / uSpacing;
    a *= smoothstep(uCount, uCount * 0.45, back) * smoothstep(0.0, 0.08, vAge);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uHot, born), a * fieldFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------ contact blob */

export const blobVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const blobFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.8) * uOpacity;
    gl_FragColor = vec4(0.008, 0.01, 0.025, a);
  }
`;
