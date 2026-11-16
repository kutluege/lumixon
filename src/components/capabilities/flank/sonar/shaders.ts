/* GLSL for the sonar scene. ShaderMaterial gets three's prefix, so
   colorspace_fragment and cameraPosition are available. Every shader shares
   `sonarGlsl` (uniforms, dunes, the ping model). */
import { fadeGlsl, sonarGlsl } from "./glsl";

export const MAX_OBS = 10;

/* ------------------------------------------------------------------ seabed */

export const seabedVert = /* glsl */ `
  ${sonarGlsl}
  varying vec3 vP;

  void main() {
    vec3 p = position;
    p.y = duneH(p.xz);
    vP = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const seabedFrag = (high: boolean) => /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  #define MAXO ${MAX_OBS}
  #define SPOKE 0.5235988
  uniform vec3 uObs[MAXO];
  uniform vec3 uFeet[3];
  uniform vec3 uBaseCol;
  uniform vec3 uLit;
  uniform vec3 uIce;
  uniform vec3 uIndigo;
  uniform vec3 uAlert;
  uniform vec3 uKey;
  uniform float uCaust;
  varying vec3 vP;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  /* Current ripples in the sand: wavy crests, sharper than a sine. */
  float rippleH(vec2 p) {
    float w = p.x * 0.93 + p.y * 0.37;
    float ph = w * 17.0 + 1.7 * sin(p.y * 1.25 + 0.7 * sin(p.x * 0.8)) + 1.1 * sin(p.x * 0.55 - p.y * 0.4 + 1.3);
    float s = 0.5 + 0.5 * sin(ph);
    return s * s * (3.0 - 2.0 * s);
  }

  /* Light focused by the surface swell: a slow net of bright lines. */
  float caustic(vec2 uv, float t) {
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    vec2 i = p;
    float c = 1.0;
    const float inten = 0.005;
    for (int n = 0; n < ${high ? 4 : 3}; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= ${high ? "4.0" : "3.0"};
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.4);
  }

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }

  void main() {
    vec2 wp = vP.xz;

    // --- Sand: dunes + ripples + grain as a normal, lit by the key from above.
    const float e = 0.02;
    float h0 = rippleH(wp);
    float hx = (rippleH(wp + vec2(e, 0.0)) - h0) / e;
    float hz = (rippleH(wp + vec2(0.0, e)) - h0) / e;
    const float de = 0.12;
    float d0 = duneH(wp);
    float dx = (duneH(wp + vec2(de, 0.0)) - d0) / de;
    float dz = (duneH(wp + vec2(0.0, de)) - d0) / de;
    float g1 = vnoise(wp * 13.0);
    float g2 = ${high ? "vnoise(wp * 41.0)" : "g1"};
    vec3 n = normalize(vec3(-hx * 0.02 - dx + (g1 - 0.5) * 0.22, 1.0, -hz * 0.02 - dz + (g2 - 0.5) * 0.22));
    float diff = clamp(dot(n, uKey), 0.0, 1.0);
    float sky = n.y * 0.5 + 0.5;
    vec3 col = uBaseCol * (0.6 + 0.4 * sky) * (0.8 + 0.3 * g1 * g2 + 0.14 * g2) + uLit * diff * diff * 0.5;
    col += uLit * h0 * 0.035;

    float c = caustic(wp * 0.105 + vec2(0.13, 0.37), uCaust);
    col += (uIce * 0.11 + uIndigo * 0.08) * c * (0.35 + 0.65 * diff);

    vec2 rel = wp - uHead.xz;
    float r = length(rel);
    float r3 = length(vP - uHead);
    // Darker away from the work area, so the plot and the actors carry the frame.
    vec2 fc = wp - uFadeC;
    col *= mix(0.5, 1.0, exp(-dot(fc, fc) * 0.016));

    // --- Contact shade: rocks, tripod feet, the tripod itself, the swimmer overhead.
    float ao = 1.0;
    for (int i = 0; i < MAXO; i++) {
      vec3 f = uObs[i];
      if (f.z <= 0.0) continue;
      ao *= mix(0.32, 1.0, smoothstep(f.z * 0.6, f.z * 1.9, length(wp - f.xy)));
    }
    for (int i = 0; i < 3; i++) {
      ao *= mix(0.3, 1.0, smoothstep(uFeet[i].z * 0.7, uFeet[i].z * 2.8, length(wp - uFeet[i].xy)));
    }
    ao *= mix(0.7, 1.0, smoothstep(0.1, 1.1, r));
    vec2 dd = wp - uDiver.xz;
    float da = dot(dd, uDiverDir);
    float dc = dot(dd, vec2(-uDiverDir.y, uDiverDir.x));
    ao *= 1.0 - 0.34 * uDiverFade * exp(-(da * da) / 1.2 - (dc * dc) / 0.2);
    col *= ao;

    // --- Polar plot around the tripod: range rings, bearing spokes, 10° ticks on the rim.
    // One device pixel on the sand, in metres; widened on dense screens so the
    // line-work keeps its weight in CSS pixels.
    float px = length(fwidth(wp)) * 0.75 * (0.55 + 0.45 * uPR);
    float rr = r / RING_STEP;
    float inside = 1.0 - smoothstep(GRID_R + 0.02, GRID_R + 0.02 + px * 2.0, r);
    float ringLine = (1.0 - smoothstep(0.0, 1.3, abs(fract(rr - 0.5) - 0.5) * RING_STEP / px)) * step(0.5, rr);
    float ang = atan(rel.y, rel.x);
    float sd = abs(fract(ang / SPOKE - 0.5) - 0.5) * SPOKE * r;
    float spoke = (1.0 - smoothstep(0.0, 1.3, sd / px)) * smoothstep(0.6, 1.0, r);
    float td = abs(fract(ang / (SPOKE / 3.0) - 0.5) - 0.5) * (SPOKE / 3.0) * r;
    float tick = (1.0 - smoothstep(0.0, 1.3, td / px)) * step(abs(r - GRID_R + 0.11), 0.11);
    float rim = (1.0 - smoothstep(0.0, 1.6, abs(r - GRID_R) / px));
    float grid = (ringLine * 0.55 + spoke * 0.34 + tick * 0.6 + rim * 0.4) * inside;

    // --- Live pings: a sharp wavefront with a short wake; the plot glows where it has just been.
    float age = passAge(r3);
    float amp = pingAmp(r3);
    // Distance along the sand from here to the ring that just passed (the
    // sphere sweeps the sand fastest right under the head).
    float hh = uHead.y - vP.y;
    float rw = r3 + age * PING_V;
    float lag = sqrt(max(rw * rw - hh * hh, 0.0)) - r;
    float front = exp(-lag * 3.6) * amp * smoothstep(0.0, 1.5 * px, lag);
    float crest = exp(-lag * lag / (px * px * 2.2)) * amp;
    float wake = exp(-age * 1.15) * amp;
    // (Linear light on very dark sand: even half a percent reads as a veil, so
    // only the plot lines keep a wake; the sand gets the crest and a short tail.)
    col += uIce * grid * (0.2 + 0.5 * wake);
    col += uIce * (front * 0.07 + crest * 0.45);
    // The transducer lights the sand around the tripod when it fires.
    col += uIce * exp(-r * r * 0.8) * (0.03 + 0.09 * exp(-uPingA * 3.5));

    // --- AI layer on the sand under the swimmer.
    vec3 mark = mix(uIce, uAlert, uLockTint);
    float dl = length(dd);
    float w = max(px * 1.3, 0.012);
    float g = (dl - 0.62) / (w * 1.5);
    float ring1 = exp(-g * g);
    float spin = atan(dd.y, dd.x) + uT * 0.55;
    float dash = smoothstep(0.2, 0.28, abs(fract(spin / TAU * 8.0) - 0.5));
    g = (dl - 0.92 - 0.6 * (1.0 - uLock)) / w;
    float ring2 = exp(-g * g) * dash;
    float fill = exp(-dl * dl * 2.2);
    col += mark * (uLock * (ring1 * 0.95 + ring2 * 0.75 + fill * 0.17) + uCand * (1.0 - uLock) * ring1 * 0.4);

    // Measured bearing (tripod → target) and range (a short arc through the target): flash on a return.
    float meas = (uEcho * 0.6 + uLock * 0.1) * uTrack;
    float rd = max(length(uDiver.xz - uHead.xz), 0.001);
    vec2 bdir = (uDiver.xz - uHead.xz) / rd;
    float bl = segDist(wp, uHead.xz, uDiver.xz);
    float bline = (1.0 - smoothstep(0.0, 1.4, bl / px)) * smoothstep(0.6, 1.0, r) * smoothstep(0.62, 0.8, dl);
    float lat = abs(dot(rel, vec2(-bdir.y, bdir.x)));
    float arc = (1.0 - smoothstep(0.0, 1.4, abs(r - rd) / px)) * (1.0 - smoothstep(1.0, 1.5, lat)) * step(0.0, dot(rel, bdir)) * smoothstep(0.62, 0.8, dl);
    col += mark * (bline + arc) * meas;

    // Where the tracker expects the swimmer next: a small ring at the end of the predicted path.
    vec2 pp = wp - (uDiver.xz + uDiverDir * (PREDICT_GAP + PREDICT_LEN + 0.16));
    g = (length(pp) - 0.13) / w;
    col += uAlert * exp(-g * g) * uLock * uTrack * 0.8;

    gl_FragColor = vec4(col, sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------- returns cloud (seabed, clutter) */

export const cloudVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aRnd;
  attribute float aKind;
  uniform float uSize;
  varying float vLive;
  varying float vKind;
  varying float vRnd;
  varying float vNear;
  varying vec3 vP;

  void main() {
    vec3 p = position;
    float r3 = length(p - uHead);
    float age = passAge(r3);
    // Each ping repaints the picture; structure rings longer than sand.
    vLive = exp(-age * mix(3.6, 1.5, aKind)) * pingAmp(r3) * smoothstep(0.0, 0.05, age);
    vNear = 1.0 - smoothstep(5.0, 8.0, r3);
    vKind = aKind;
    vRnd = aRnd;
    vP = p;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.1);
    float s = uSize * uRes.y * 0.0012 * (11.5 / dist) * (0.7 + aRnd * 0.6) * (0.8 + vLive * 0.9);
    s *= mix(1.0, 1.2, aKind);
    gl_PointSize = clamp(s, 0.75 * uPR, uRes.y * 0.007);
    gl_Position = projectionMatrix * mv;
  }
`;

export const cloudFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uHot;
  uniform float uOpacity;
  varying float vLive;
  varying float vKind;
  varying float vRnd;
  varying float vNear;
  varying vec3 vP;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    if (r2 > 0.25) discard;
    float soft = 1.0 - smoothstep(0.08, 0.25, r2);
    float strength = mix(0.25 + 0.75 * vRnd * vRnd, 0.3 + 0.5 * vRnd * vRnd, vKind);
    vec3 col = mix(uLow, uHigh, clamp(vLive * 1.4 + vKind * 0.5, 0.0, 1.0));
    col = mix(col, uHot, vLive * vLive * 0.6);
    float a = mix(0.1, 0.2, vKind) * (0.5 + 0.5 * vRnd) * vNear + vLive * strength * 0.75;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * soft * uOpacity * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------ wavefront in the water volume */

export const domeVert = /* glsl */ `
  ${sonarGlsl}
  uniform float uR;
  varying vec3 vP;
  varying vec3 vN;

  void main() {
    vN = normalize(position);
    vP = uHead + position * uR;
    gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
  }
`;

export const domeFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform float uR;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vP;
  varying vec3 vN;

  void main() {
    if (vP.y < duneH(vP.xz) + 0.02) discard;
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vP);
    float f = 1.0 - abs(dot(n, v));
    // Only the silhouette of the shell shows: a thin arc through the water.
    float rim = pow(f, 9.0) * smoothstep(0.5, 0.8, f);
    // Below the head the shell thins out, so it never fogs the sand it sweeps.
    float upper = smoothstep(-0.55, 0.05, n.y);
    float a = rim * upper * pingAmp(uR) * uOpacity;
    gl_FragColor = vec4(uColor, a * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* -------------------------------------------------------- track on the sand */

export const trackVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aTime;
  attribute float aSide;
  varying float vTime;
  varying float vSide;
  varying vec3 vP;

  void main() {
    vTime = aTime;
    vSide = aSide;
    vP = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

export const trackFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uIce;
  uniform vec3 uAlert;
  uniform float uDash;
  varying float vTime;
  varying float vSide;
  varying vec3 vP;

  void main() {
    float old = uReveal - vTime;
    if (old < 0.0) discard;
    float s = abs(vSide);
    float core = 1.0 - smoothstep(0.3, 0.95, s);
    float dot_ = smoothstep(0.2, 0.3, abs(fract(vTime * uDash) - 0.5));
    float a = core * dot_ * (0.7 + 0.3 * exp(-old * 0.25)) * smoothstep(0.0, 0.25, old);
    vec3 col = mix(uIce, uAlert, uLockTint);
    gl_FragColor = vec4(col, a * uTrack * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* Predicted path: a marching dashed ribbon ahead of the swimmer, built from the uniforms. */
export const predictVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aS;
  attribute float aSide;
  uniform float uWidth;
  varying float vS;
  varying float vSide;
  varying vec3 vP;

  void main() {
    vec2 nr = vec2(-uDiverDir.y, uDiverDir.x);
    vec2 g = uDiver.xz + uDiverDir * (PREDICT_GAP + aS * PREDICT_LEN) + nr * aSide * uWidth;
    vec3 p = vec3(g.x, duneH(g) + 0.035, g.y);
    vS = aS;
    vSide = aSide;
    vP = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const predictFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uAlert;
  varying float vS;
  varying float vSide;
  varying vec3 vP;

  void main() {
    float s = abs(vSide);
    float core = 1.0 - smoothstep(0.3, 0.95, s);
    float dash = smoothstep(0.24, 0.3, abs(fract(vS * 6.0 - uT * 0.7) - 0.5));
    float a = core * dash * (1.0 - 0.55 * vS) * smoothstep(0.0, 0.06, vS);
    gl_FragColor = vec4(uAlert, a * uLock * uTrack * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------ returns from the swimmer: plot nodes + echoes */

export const nodeVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aTau;
  attribute float aKind;
  uniform float uSize;
  varying float vAge;
  varying float vKind;
  varying vec3 vP;

  void main() {
    float age = uT - aTau;
    if (age < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vAge = age;
    vKind = aKind;
    vP = position;
    vec4 mv = viewMatrix * vec4(position, 1.0);
    float k = clamp(uRes.y / 650.0, 0.6 * uPR, 1.6 * uPR);
    // 0: plot node on the sand (pops, then stays). 1: echo ring in the water (expands, fades).
    float size = aKind < 0.5 ? uSize * (1.0 + 1.5 * exp(-age * 3.0)) : uSize * (1.3 + 5.5 * (1.0 - exp(-age * 1.7)));
    gl_PointSize = size * k * clamp(13.0 / max(-mv.z, 0.1), 0.6, 1.5);
    gl_Position = projectionMatrix * mv;
  }
`;

export const nodeFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uIce;
  uniform vec3 uAlert;
  uniform vec3 uHot;
  varying float vAge;
  varying float vKind;
  varying vec3 vP;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    float born = exp(-vAge * 2.5);
    vec3 col = mix(mix(uIce, uAlert, uLockTint), uHot, born * 0.8);
    float a;
    if (vKind < 0.5) {
      float ring = smoothstep(0.5, 0.42, r) * smoothstep(0.26, 0.34, r);
      float pip = 1.0 - smoothstep(0.1, 0.17, r);
      a = (ring * (0.6 + 0.4 * born) + pip) * (0.55 + 0.45 * exp(-vAge * 0.2)) * uTrack;
    } else {
      float life = clamp(1.0 - vAge / 1.5, 0.0, 1.0);
      float ring = smoothstep(0.5, 0.47, r) * smoothstep(0.4, 0.45, r);
      a = ring * life * life * 0.9;
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* -------------------------------- lock: bracket reticle + stalk to the sand */

export const reticleVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const reticleFrag = /* glsl */ `
  uniform vec2 uSize;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCorner;
  uniform float uPR;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 d = uSize * 0.5 - abs(p);
    float px = max(fwidth(p.x), fwidth(p.y));
    float lw = max(px * 1.1 * uPR, 0.011);
    float inset = lw * 2.0;
    float ex = 1.0 - smoothstep(lw * 0.45, lw, abs(d.x - inset));
    float ey = 1.0 - smoothstep(lw * 0.45, lw, abs(d.y - inset));
    // Corner brackets.
    float bx = ex * step(d.y, uCorner) * step(inset - lw, d.y);
    float by = ey * step(d.x, uCorner) * step(inset - lw, d.x);
    // Short ticks at the middle of each edge, pointing in.
    float tk = 0.11;
    float tx = (1.0 - smoothstep(lw * 0.45, lw, abs(p.x))) * step(inset, d.y) * step(d.y, inset + tk);
    float ty = (1.0 - smoothstep(lw * 0.45, lw, abs(p.y))) * step(inset, d.x) * step(d.x, inset + tk);
    float a = max(max(bx, by), max(tx, ty) * 0.8);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

export const stalkVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aEnd;
  attribute float aSide;
  uniform float uWidth;
  varying float vEnd;
  varying float vSide;
  varying float vLen;
  void main() {
    vec3 top = uDiver - vec3(0.0, 0.32, 0.0);
    vec3 bot = vec3(uDiver.x, duneH(uDiver.xz) + 0.03, uDiver.z);
    vec3 p = mix(top, bot, aEnd);
    // A ribbon that always faces the camera.
    vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), cameraPosition - p));
    p += side * aSide * uWidth;
    vEnd = aEnd;
    vSide = aSide;
    vLen = top.y - bot.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const stalkFrag = /* glsl */ `
  ${sonarGlsl}
  uniform vec3 uIce;
  uniform vec3 uAlert;
  varying float vEnd;
  varying float vSide;
  varying float vLen;
  void main() {
    float dash = smoothstep(0.3, 0.38, abs(fract(vEnd * vLen * 7.0) - 0.5) + 0.12);
    float core = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
    float a = dash * core * (0.45 + 0.55 * vEnd) * max(uLock * 0.9, uCand * 0.35);
    gl_FragColor = vec4(mix(uIce, uAlert, uLockTint), a);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------- fish: quiet "normal" ticks */

export const tickVert = /* glsl */ `
  ${sonarGlsl}
  uniform float uSize;
  varying float vA;
  varying vec3 vP;

  void main() {
    float r3 = length(position - uHead);
    float age = passAge(r3);
    vA = exp(-age * 2.3) * pingAmp(r3) * smoothstep(0.0, 0.05, age);
    vP = position;
    vec4 mv = viewMatrix * vec4(position, 1.0);
    float k = clamp(uRes.y / 650.0, 0.6 * uPR, 1.6 * uPR);
    gl_PointSize = uSize * k * (1.0 + 0.5 * vA) * clamp(13.0 / max(-mv.z, 0.1), 0.6, 1.5);
    gl_Position = projectionMatrix * mv;
  }
`;

export const tickFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  varying vec3 vP;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    // A thin ring broken on the diagonals: four small arcs.
    float ring = smoothstep(0.5, 0.45, r) * smoothstep(0.34, 0.39, r);
    float gap = smoothstep(0.1, 0.2, abs(abs(c.x) - abs(c.y)) / max(r, 0.001));
    float a = ring * gap * vA * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * solidFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------ marine snow */

export const snowVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aRnd;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxSize;
  uniform float uSize;
  varying float vA;
  varying float vBlur;
  varying vec3 vP;

  void main() {
    // Slow drift with the current and a slower sinking, wrapped inside the box.
    vec3 p = position;
    p.x += uTime * (0.035 + 0.03 * aRnd);
    p.y -= uTime * (0.012 + 0.016 * aRnd);
    p.z += uTime * 0.01;
    p = mod(p - uBoxMin, uBoxSize) + uBoxMin;
    p.x += 0.05 * sin(uTime * 0.6 + aRnd * 40.0);
    p.y += 0.03 * sin(uTime * 0.45 + aRnd * 71.0);
    // Soft edges of the box in height so nothing pops at the wrap.
    float hy = (p.y - uBoxMin.y) / uBoxSize.y;
    float wrap = smoothstep(0.0, 0.12, hy) * smoothstep(1.0, 0.85, hy);
    float r3 = length(p - uHead);
    float age = passAge(r3);
    // Particles glint as the wavefront passes through them: the ping made visible in the volume.
    float glint = exp(-age * 4.5) * pingAmp(r3) * smoothstep(0.0, 0.04, age);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.1);
    // Close to the lens: larger and softer.
    float nearK = smoothstep(9.0, 3.5, dist);
    vBlur = nearK;
    vA = wrap * (0.3 + 0.6 * aRnd + glint * 1.4) * (1.0 - 0.6 * nearK);
    vP = p;
    float s = uSize * uRes.y * 0.0012 * (11.5 / dist) * (0.6 + 0.9 * aRnd) * (1.0 + glint * 0.5 + nearK * 1.8);
    gl_PointSize = clamp(s, 0.75 * uPR, uRes.y * 0.02);
    gl_Position = projectionMatrix * mv;
  }
`;

export const snowFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  varying float vBlur;
  varying vec3 vP;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float soft = mix(1.0 - smoothstep(0.3, 1.0, r), (1.0 - r) * (1.0 - r), vBlur);
    gl_FragColor = vec4(uColor, soft * vA * uOpacity * sonarFade(vP));
    #include <colorspace_fragment>
  }
`;

/* ----------------------------------------------------------------- bubbles */

export const bubbleVert = /* glsl */ `
  ${sonarGlsl}
  attribute float aLife;
  attribute float aRnd;
  uniform float uSize;
  varying float vA;
  varying vec3 vP;

  void main() {
    vP = position;
    vA = smoothstep(0.0, 0.06, aLife) * (1.0 - smoothstep(0.55, 1.0, aLife));
    vec4 mv = viewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 0.1);
    float s = uSize * uRes.y * 0.0012 * (11.5 / dist) * (0.55 + 0.7 * aRnd) * (0.7 + 0.9 * aLife);
    gl_PointSize = aLife <= 0.0 ? 0.0 : clamp(s, 1.5 * uPR, uRes.y * 0.02);
    gl_Position = aLife <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  }
`;

export const bubbleFrag = /* glsl */ `
  ${sonarGlsl}
  ${fadeGlsl}
  uniform vec3 uColor;
  varying float vA;
  varying vec3 vP;

  void main() {
    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float r = length(c);
    if (r > 1.0) discard;
    float rim = smoothstep(0.55, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
    float glint = 1.0 - smoothstep(0.0, 0.3, length(c - vec2(-0.32, -0.34)));
    float a = (rim * 0.75 + glint * 0.9 + 0.08) * vA * uDiverFade;
    gl_FragColor = vec4(uColor, a * solidFade(vP));
    #include <colorspace_fragment>
  }
`;
