/* GLSL for the hero scene. ShaderMaterial gets three's prefix, so
   linearToOutputTexel (via colorspace_fragment) is available. */

export const terrainPointsVert = /* glsl */ `
  attribute float aRnd;
  uniform float uScan;
  uniform float uSize;
  uniform float uPR;
  uniform float uRange; // camera distance to the far edge of the tile
  varying float vH;
  varying float vFront;
  varying float vTrail;
  varying float vFade;
  varying float vRnd;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    float d = uScan - position.z;
    // Crisp leading edge inside a soft halo, then a long afterglow behind it.
    vFront = exp(-d * d * 9.0) * 0.7 + exp(-d * d * 1.3) * 0.3;
    vTrail = d > 0.0 ? exp(-d * 0.14) : 0.0;
    vH = position.y;
    vRnd = aRnd;
    // Full strength over the near half of the tile, gone at its far edge.
    vFade = (1.0 - smoothstep(uRange * 0.5, uRange * 1.04, dist)) * smoothstep(1.2, 3.6, dist);
    float s = uSize * uPR * (14.0 / max(dist, 0.1)) * (0.75 + aRnd * 0.5) * (1.0 + vFront * 0.6);
    gl_PointSize = clamp(s, 1.1 * uPR, 3.4 * uPR);
    gl_Position = projectionMatrix * mv;
  }
`;

export const terrainPointsFrag = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uIce;
  uniform vec3 uHot;
  uniform vec3 uDeep;
  uniform float uOpacity;
  varying float vH;
  varying float vFront;
  varying float vTrail;
  varying float vFade;
  varying float vRnd;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    if (r2 > 0.25) discard;
    float soft = 1.0 - smoothstep(0.06, 0.25, r2);

    float hN = clamp((vH + 0.6) / 4.5, 0.0, 1.0);
    vec3 col = mix(uLow, uHigh, hN);
    // Deep burgundy pools only in the lowest basins: a tonal accent, not a color.
    col = mix(col, uDeep, (1.0 - smoothstep(-0.8, 0.05, vH)) * 0.55);

    float f = fract(vH * 2.2);
    float contour = 1.0 - smoothstep(0.0, 0.07, min(f, 1.0 - f));

    float a = 0.3 + 0.14 * vRnd + contour * 0.3;
    col = mix(col, uIce, clamp(vTrail * 0.7 + contour * 0.22, 0.0, 1.0));
    a += vTrail * 0.28;
    col = mix(col, uHot, clamp(vFront * 1.15, 0.0, 1.0));
    a += vFront * 0.55;

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * soft * vFade * uOpacity);
    #include <colorspace_fragment>
  }
`;

export const profileVert = /* glsl */ `
  attribute float aMask;
  uniform float uScan;
  uniform float uRange;
  varying float vFade;
  varying float vTrail;
  varying float vFront;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    float d = uScan - position.z;
    vFront = exp(-d * d * 1.2);
    vTrail = d > 0.0 ? exp(-d * 0.2) : 0.0;
    // aMask clears the profiles off the work-cell floor.
    vFade = (1.0 - smoothstep(uRange * 0.45, uRange * 1.02, dist)) * smoothstep(1.5, 4.5, dist) * aMask;
    gl_Position = projectionMatrix * mv;
  }
`;

export const profileFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vTrail;
  varying float vFront;

  void main() {
    float a = uOpacity * (0.45 + vTrail * 0.7 + vFront * 1.6) * vFade;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

export const orbitVert = /* glsl */ `
  attribute float aU;
  varying float vU;
  varying float vY;

  void main() {
    vU = aU;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const orbitFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uOpacity;
  uniform float uDash;
  uniform float uSat;
  uniform float uHorizon;
  varying float vU;
  varying float vY;

  void main() {
    float a = uOpacity * smoothstep(uHorizon, uHorizon + 3.0, vY);
    if (uDash > 0.0) a *= step(0.55, fract(vU * uDash));
    float du = uSat - vU;
    float trail = (du >= 0.0 && uSat > 0.0) ? exp(-du * 140.0) : 0.0;
    vec3 col = mix(uColor, uHot, trail);
    a += trail * 0.55 * smoothstep(uHorizon, uHorizon + 3.0, vY);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export const shadowFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.2) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

export const shadowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* Pose-estimation keypoints: hairline ring + centre dot, constant pixel size. */
export const keypointVert = /* glsl */ `
  attribute float aHot;
  uniform float uSize;
  uniform float uPR;
  varying float vHot;
  void main() {
    vHot = aHot;
    gl_PointSize = uSize * uPR * (1.0 + aHot * 0.45);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const keypointFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  uniform float uOpacity;
  varying float vHot;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float ring = smoothstep(0.5, 0.4, r) * smoothstep(0.24, 0.34, r);
    float dot = 1.0 - smoothstep(0.08, 0.16, r);
    float a = (ring * 0.75 + dot) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uHotColor, vHot), a);
    #include <colorspace_fragment>
  }
`;

/* Periodic path with a comet head at the current phase (aU in [0,1)). */
export const pathVert = /* glsl */ `
  attribute float aU;
  varying float vU;
  void main() {
    vU = aU;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const pathFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uBase;
  uniform float uTail;
  varying float vU;
  void main() {
    float d = fract(uPhase - vU);
    float head = exp(-d * uTail);
    float dash = step(0.5, fract(vU * 140.0));
    float a = uOpacity * (uBase * dash + head);
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

/* Retargeting link: dashes flowing from demonstrator (u=0) to learner (u=1). */
export const linkFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying float vU;
  void main() {
    float dash = step(0.5, fract(vU * 18.0 - uTime * 1.6));
    float fade = smoothstep(0.0, 0.1, vU) * smoothstep(1.0, 0.86, vU);
    gl_FragColor = vec4(uColor, uOpacity * dash * fade);
    #include <colorspace_fragment>
  }
`;

/* ───────────── Staging ───────────── */

/* Work-cell floor: a dark polished deck at y = 0 (unit disc, scaled by the
   mesh) that fades out radially into the terrain. The work cell is inlaid as a
   light line (convex hull of two circles). Optional planar reflection via
   three's Reflector. */
export const floorVert = /* glsl */ `
  #ifdef USE_REFLECTION
    uniform mat4 textureMatrix;
    varying vec4 vRefl;
  #endif
  varying vec3 vWorld;
  varying vec2 vLocal;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vLocal = position.xy;
    #ifdef USE_REFLECTION
      vRefl = textureMatrix * vec4(position, 1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const floorFrag = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uSheen;
  uniform vec3 uIce;
  uniform vec3 uIndigo;
  uniform vec3 uCellA; // work cell, arm end: x, z, radius
  uniform vec3 uCellB; // work cell, learner end
  uniform float uScale;
  uniform float uScan;
  uniform float uOpacity;
  #ifdef USE_REFLECTION
    uniform sampler2D tDiffuse;
    uniform float uReflect;
    varying vec4 vRefl;
  #endif
  varying vec3 vWorld;
  varying vec2 vLocal;

  // Anti-aliased hairline at every integer of v; fades out once it gets too dense.
  float seam(float v) {
    float w = fwidth(v);
    float l = 1.0 - smoothstep(0.0, 1.5 * w, abs(fract(v - 0.5) - 0.5));
    return l * (1.0 - smoothstep(0.1, 0.4, w));
  }

  // Signed distance to the work cell (hull of two circles), negative inside.
  float sdCell(vec2 p) {
    vec2 ab = uCellB.xy - uCellA.xy;
    float h = length(ab);
    vec2 u = ab / h;
    vec2 q = p - uCellA.xy;
    vec2 l = vec2(abs(q.x * u.y - q.y * u.x), dot(q, u));
    float b = (uCellA.z - uCellB.z) / h;
    float a = sqrt(max(1.0 - b * b, 0.0));
    float k = dot(l, vec2(-b, a));
    if (k < 0.0) return length(l) - uCellA.z;
    if (k > a * h) return length(l - vec2(0.0, h)) - uCellB.z;
    return dot(l, vec2(a, b)) - uCellA.z;
  }

  void main() {
    float rn = length(vLocal);
    float edge = 1.0 - smoothstep(0.5, 1.0, rn);

    vec2 p = vWorld.xz;
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);

    // Wide-layout units; < 0 inside the cell.
    float d = sdCell(p) / uScale;
    float aa = fwidth(d) * 1.2 + 0.004;
    float inside = 1.0 - smoothstep(-aa, aa, d);

    // Deck: near-black base (the inlaid pad a touch deeper than the apron),
    // horizon haze picked up at grazing angles, a pool of key light.
    vec3 col = uBase * mix(1.7, 1.0, inside);
    col += uSheen * fres * mix(0.55, 0.45, inside);
    col += uIce * 0.03 * exp(-rn * rn * 6.0);

    // Deck-plate seams: fine every 0.5, bold every 2 units; fainter on the apron.
    vec2 g = p / (0.5 * uScale);
    float fine = max(seam(g.x), seam(g.y));
    float bold = max(seam(g.x * 0.25), seam(g.y * 0.25));
    col += uIndigo * (fine * 0.03 + bold * 0.06) * mix(0.4, 1.0, inside);

    // Cell boundary: inlaid light line, its glow, and an inner hairline.
    float line = 1.0 - smoothstep(0.0, aa * 1.2 + 0.006, abs(d));
    float hair = 1.0 - smoothstep(0.0, aa, abs(d + 0.085));
    col += uIce * (line * 0.7 + hair * 0.1 + exp(-abs(d) * 6.0) * 0.11);

    // The terrain's pushbroom scan front crossing the deck.
    float ds = (uScan - vWorld.z) / uScale;
    col += uIce * (exp(-ds * ds * 30.0) * 0.22 + (ds > 0.0 ? exp(-ds * 1.1) * 0.03 : 0.0));

    #ifdef USE_REFLECTION
      // Soft mirror image: blurred through the target's mip chain (no tap ghosting)
      // and smeared along the view direction like a polished floor.
      vec2 uv = vRefl.xy / vRefl.w;
      vec2 k = vec2(0.006, 0.016);
      vec3 refl = textureLod(tDiffuse, uv, 1.5).rgb * 0.3;
      refl += textureLod(tDiffuse, uv + vec2(0.0, k.y), 2.5).rgb * 0.2;
      refl += textureLod(tDiffuse, uv - vec2(0.0, k.y), 2.5).rgb * 0.2;
      refl += textureLod(tDiffuse, uv + vec2(k.x, 0.0), 2.5).rgb * 0.15;
      refl += textureLod(tDiffuse, uv - vec2(k.x, 0.0), 2.5).rgb * 0.15;
      #if defined( TONE_MAPPING )
        refl = toneMapping(refl);
      #endif
      // Full on the inlaid pad, dying out across the apron, so the mirror
      // never smears under the hero copy.
      float reach = 1.0 - smoothstep(0.0, 1.8, d);
      col += refl * uReflect * reach * mix(0.55, 1.0, smoothstep(0.08, 0.3, fres));
    #endif

    gl_FragColor = vec4(col, uOpacity * edge * mix(0.88, 1.0, inside));
    #include <colorspace_fragment>
  }
`;

/* Camera-facing haze halo behind the robots: separates dark silhouettes from the sky. */
export const glowVert = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

export const glowFrag = /* glsl */ `
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length((vUv - 0.5) * 2.0);
    float g = exp(-r * r * 3.4);
    float a = g * (1.0 - smoothstep(0.7, 1.0, r)) * uOpacity;
    gl_FragColor = vec4(mix(uOuter, uInner, g), a);
    #include <colorspace_fragment>
  }
`;

/* Dust motes drifting through the lit volume; animated entirely on the GPU.
   aSeed: phase, rise speed, size, twinkle rate (all 0..1). */
export const motesVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uPR;
  uniform float uScale;
  uniform float uHeight;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.016 + 0.03 * aSeed.y) * uScale, uHeight);
    p.x += sin(uTime * 0.11 + aSeed.x * 6.2832) * 0.24 * uScale;
    p.z += cos(uTime * 0.09 + aSeed.x * 4.1) * 0.24 * uScale;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    float h = p.y / uHeight;
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.4 + aSeed.w) + aSeed.x * 20.0);
    vA = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.7, 1.0, h)) * twinkle * smoothstep(1.5, 4.0, dist);
    gl_PointSize = clamp(uPR * (1.3 + aSeed.z * 2.2) * 9.0 / max(dist, 0.1), 1.0, 4.5 * uPR);
    gl_Position = projectionMatrix * mv;
  }
`;

export const motesFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float soft = 1.0 - smoothstep(0.02, 0.25, dot(c, c));
    gl_FragColor = vec4(uColor, soft * vA * uOpacity);
    #include <colorspace_fragment>
  }
`;

/* Environment dome (rendered once into the reflection cube): dark zenith,
   lit horizon band, faint warm ground, so metal reads a horizon line. */
export const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const domeFrag = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uBand;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, h));
    col = mix(col, uGround, 1.0 - smoothstep(-0.3, 0.0, h));
    col += uBand * exp(-h * h * 80.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;
