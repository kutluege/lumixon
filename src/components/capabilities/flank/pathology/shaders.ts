/* GLSL for the pathology (whole-slide analysis) scene. Every material shares
   `pathoGlsl` (layout, scan raster, timeline) and the uniforms of
   `makePathoUniforms`. Colours are passed in display space (see `srgb` in
   build.ts) and blended as such, so no colorspace conversion is included. */
import { COLS, CYC, REGION, ROW_T, ROWS, SCAN, SLIDE, T_SCAN0, TILE } from "./model";

const n = (v: number, d = 4) => v.toFixed(d);

export const pathoGlsl = /* glsl */ `
  #define X0 ${n(SCAN.x0)}
  #define X1 ${n(SCAN.x1)}
  #define Z0 ${n(SCAN.z0)}
  #define Z1 ${n(SCAN.z1)}
  #define TILE ${n(TILE)}
  #define COLS ${n(COLS, 1)}
  #define ROWS ${n(ROWS, 1)}
  #define T_SCAN0 ${n(T_SCAN0)}
  #define ROW_T ${n(ROW_T)}
  #define CYC ${n(CYC)}
  #define TAU 6.2831853

  uniform float uT;       // loop time (s)
  uniform vec3 uHead;     // optical axis on the slide plane (x, y, z)
  uniform float uLamp;    // illumination 0..1
  uniform float uLayer;   // opacity of the whole AI layer
  uniform float uRefine;  // tileHeat scores -> smooth heatmap
  uniform float uContour; // contour trace progress
  uniform float uLock;    // flag bracket lock-on
  uniform vec2 uFadeC;    // centre of the world fade (x, z)
  uniform float uFadeR;   // radius of the world fade
  uniform vec2 uRes;      // drawing-buffer size in px
  uniform float uPR;      // pixel ratio
  uniform vec3 uStripDir; // softbox axis for the glass reflections
  uniform float uStripC;  // where the softbox sits for the current camera

  /** Loop time at which the scan line passes p (slide plane x, z). */
  float scanHit(vec2 p) {
    float row = clamp(floor((Z1 - p.y) / TILE), 0.0, ROWS - 1.0);
    float f = clamp((p.x - X0) / (X1 - X0), 0.0, 1.0);
    f = mix(f, 1.0 - f, mod(row, 2.0));
    return T_SCAN0 + row * CYC + f * ROW_T;
  }

  /** Loop time at which tile id (col, row) has been captured. */
  float tileHit(vec2 id) {
    float f = mix((id.x + 1.0) / COLS, (COLS - id.x) / COLS, mod(id.y, 2.0));
    return T_SCAN0 + id.y * CYC + f * ROW_T;
  }

  /** Light of the scan head falling on the slide plane. */
  float lampPool(vec2 p, float r) {
    vec2 d = p - uHead.xz;
    return uLamp * exp(-dot(d, d) / (r * r));
  }

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
`;

/** Fragment-only: soft vignette at the canvas edges, the world fade around the slide, and the slide's own rim fade. */
export const fadeGlsl = /* glsl */ `
  float edgeFade() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 e = min(uv, 1.0 - uv) * uRes / min(uRes.x, uRes.y);
    float v = smoothstep(0.012, 0.26, e.x) * smoothstep(0.012, 0.26, e.y);
    return v * v;
  }
  float worldFade(vec3 p) {
    vec2 d = (p.xz - uFadeC) * vec2(0.74, 1.3);
    float w = 1.0 - smoothstep(uFadeR * 0.3, uFadeR, length(d));
    return w * w * edgeFade();
  }
  // The slide itself is framed well inside the canvas and must not be eaten by the
  // stage vignette: it only fades in the last few percent, should a panel ever crop it.
  float rimFade() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 e = min(uv, 1.0 - uv) * uRes / min(uRes.x, uRes.y);
    return smoothstep(0.0, 0.05, e.x) * smoothstep(0.0, 0.05, e.y);
  }
`;

const planeVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vP;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vP = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/* ------------------------------------------------------------------- stage */

export const stageVert = planeVert;

export const stageFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform vec3 uBase;
  uniform vec3 uPlate;
  uniform vec3 uIce;
  uniform vec3 uIndigo;
  uniform vec3 uGlow;
  uniform vec3 uWindow;
  uniform float uShadow;
  varying vec2 vUv;
  varying vec3 vP;

  float aaLine(float d, float w) { return 1.0 - smoothstep(0.0, w, abs(d)); }

  void main() {
    vec2 p = vP.xz;
    float px = max(fwidth(p.x), fwidth(p.y));

    // Anodised stage plate: fine brushing along x, a broad sheen from the key light.
    float brush = vnoise(p * vec2(6.0, 240.0)) * 0.6 + vnoise(p * vec2(19.0, 520.0)) * 0.4;
    vec3 col = mix(uBase, uPlate, 0.35 + 0.3 * brush);
    float sheen = exp(-pow((p.x * 0.42 + p.y * 0.9 + 0.2) / 1.5, 2.0));
    col += uIndigo * 0.07 * sheen * (0.6 + 0.8 * brush);
    // Work light pooled around the specimen.
    col += uIndigo * 0.075 * exp(-dot(p * vec2(0.5, 0.8), p * vec2(0.5, 0.8)));

    // Stage coordinate grid, faint, fading with distance from the specimen.
    vec2 gq = abs(fract(p * 2.0 + 0.5) - 0.5) / 2.0;
    float grid = aaLine(min(gq.x, gq.y), px * 1.1);
    col += uIndigo * 0.085 * grid * exp(-dot(p * vec2(0.45, 0.7), p * vec2(0.45, 0.7)));

    // Slide seat: a shallow milled pocket outlined around the slide.
    vec2 sh = vec2(${n(SLIDE.w / 2)}, ${n(SLIDE.d / 2)});
    float seat = sdRoundBox(p, sh + 0.045, 0.05);
    col *= 1.0 - 0.22 * smoothstep(0.012, -0.012, seat);
    col += uIce * 0.2 * aaLine(seat, px * 1.3);

    // Transmitted-light window under the specimen area.
    vec2 wc = vec2(${n((SCAN.x0 + SCAN.x1) / 2)}, 0.0);
    vec2 wh = vec2(${n((SCAN.x1 - SCAN.x0) / 2 + 0.05)}, ${n((SCAN.z1 - SCAN.z0) / 2 + 0.035)});
    float win = sdRoundBox(p - wc, wh, 0.035);
    float inWin = smoothstep(px, -px, win);
    float diff = 0.9 + 0.1 * vnoise(p * 70.0);
    col = mix(col, mix(uWindow, uGlow, 0.06 + 0.62 * lampPool(p, 0.24)) * diff, inWin * 0.94);
    col += uIce * 0.16 * aaLine(win, px * 1.3);
    // light spilling out of the window onto the plate
    col += uGlow * 0.1 * exp(-max(win, 0.0) * 9.0) * (1.0 - inWin);

    // Stage scales: one along the near edge, one along the label end.
    float nearZ = sh.y + 0.2;
    float tx = abs(fract(p.x * 10.0 + 0.5) - 0.5) / 10.0;
    float major = step(abs(fract(p.x * 2.0 + 0.5) - 0.5), 0.026);
    float lenX = mix(0.035, 0.075, major);
    float inX = step(abs(p.x), sh.x + 0.001) * step(nearZ, p.y) * step(p.y, nearZ + lenX);
    float ticks = aaLine(tx, px * 1.1) * inX;
    float leftX = -sh.x - 0.2;
    float tz = abs(fract(p.y * 10.0 + 0.5) - 0.5) / 10.0;
    float majorZ = step(abs(fract(p.y * 2.0 + 0.5) - 0.5), 0.026);
    float lenZ = mix(0.035, 0.075, majorZ);
    float inZ = step(abs(p.y), sh.y + 0.001) * step(p.x, leftX) * step(leftX - lenZ, p.x);
    ticks += aaLine(tz, px * 1.1) * inZ;
    col += uIce * 0.3 * ticks;
    // Live position of the optical axis on both scales.
    float cx = aaLine(p.x - uHead.x, px * 1.6) * step(nearZ - 0.03, p.y) * step(p.y, nearZ + 0.11);
    float cz = aaLine(p.y - uHead.z, px * 1.6) * step(p.x, leftX + 0.03) * step(leftX - 0.11, p.x);
    col += uIce * 0.95 * (cx + cz);

    // Contact shadows: the slide (offset away from the key light) and the scan head.
    float sSlide = sdRoundBox(p - vec2(0.03, -0.035), sh, 0.03);
    float occ = (1.0 - smoothstep(-0.02, 0.13, sSlide)) * 0.5 * (1.0 - inWin * 0.75);
    vec2 hd = (p - uHead.xz - vec2(0.1, -0.22)) / vec2(0.2, 0.28);
    occ = max(occ, uShadow * exp(-dot(hd, hd)) * (1.0 - inWin));
    col *= 1.0 - occ;

    gl_FragColor = vec4(col, worldFade(vP));
  }
`;

/* ------------------------------------------------------------------- glass */

export const glassVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Thin-glass look without a transmission pass: fresnel, a studio strip reflection, light-piping edges. */
export const glassFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform vec3 uTint;
  uniform vec3 uEdgeCol;
  uniform float uFace;
  uniform float uEdge;
  uniform float uStrip;
  uniform float uStripOff;
  varying vec3 vN;
  varying vec3 vW;

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float back = gl_FrontFacing ? 0.0 : 1.0;
    N = mix(N, -N, back);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
    vec3 R = reflect(-V, N);
    float top = smoothstep(0.8, 0.97, abs(vN.y));
    // A long softbox reflected in the flat faces: a soft diagonal band that slides with the camera.
    float s = dot(R, uStripDir) - uStripC - uStripOff;
    float strip = exp(-s * s / 0.0022) + 0.4 * exp(-(s - 0.1) * (s - 0.1) / 0.0005);
    float aFace = uFace + fres * 0.55 + strip * uStrip;
    // Sides and bevels carry the light piped through the glass.
    float sky = 0.55 + 0.45 * N.y;
    float pool = lampPool(vW.xz, 0.55);
    float aEdge = uEdge * sky * (1.0 + 0.9 * pool) + strip * 0.25;
    float a = mix(aEdge, aFace, top);
    a *= mix(1.0, 0.4, back);
    // The underside never shows.
    a *= step(-0.5, vN.y);
    vec3 col = mix(uEdgeCol, uTint, top);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * rimFade());
  }
`;

/* ------------------------------------------------------------- label end */

export const labelVert = planeVert;

/** Frosted, painted label end with an abstract 2D matrix code and a colour band. No glyphs. */
export const labelFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uBand;
  uniform vec3 uCode; // centre x, centre z, cell size
  varying vec2 vUv;
  varying vec3 vP;

  void main() {
    vec2 p = vP.xz;
    float grain = vnoise(p * 260.0) * 0.5 + vnoise(p * 90.0) * 0.5;
    // Lit from the upper left like the rest of the scene.
    vec3 col = uPaper * (0.86 + 0.12 * grain) * (0.9 + 0.1 * vUv.y);
    col += vec3(0.05) * lampPool(p, 0.6);

    // Colour band along the outer edge.
    col = mix(col, uBand, smoothstep(0.115, 0.105, vUv.x) * 0.9);

    // Matrix code: 12 x 12 modules, solid L finder on two sides, clock track on the others.
    const float N = 12.0;
    vec2 q = (p - uCode.xy) / uCode.z + N * 0.5;
    vec2 id = floor(q);
    vec2 f = fract(q);
    float inCode = step(0.0, q.x) * step(q.x, N) * step(0.0, q.y) * step(q.y, N);
    float finder = max(step(id.x, 0.5), step(N - 1.5, id.y));
    float clock = max(step(N - 1.5, id.x) * mod(id.y, 2.0), step(id.y, 0.5) * mod(id.x + 1.0, 2.0));
    float bit = step(0.52, hash21(id + 7.0));
    float on = max(finder, max(clock, bit * step(0.5, id.x) * step(id.x, N - 1.5) * step(0.5, id.y) * step(id.y, N - 1.5)));
    vec2 fw = fwidth(q);
    float cellAA = smoothstep(0.0, fw.x * 1.2, min(f.x, 1.0 - f.x) + 0.04) * smoothstep(0.0, fw.y * 1.2, min(f.y, 1.0 - f.y) + 0.04);
    col = mix(col, uInk, inCode * on * cellAA * 0.9);

    // Two registration marks beside the code.
    vec2 m = abs(p - vec2(uCode.x, uCode.y + uCode.z * 9.2)) - vec2(uCode.z * 6.0, uCode.z * 0.42);
    col = mix(col, uInk, (1.0 - smoothstep(-0.002, 0.002, max(m.x, m.y))) * 0.55);

    // Rounded corners of the paint, following the slide.
    float edge = smoothstep(0.0, 0.006, min(min(vUv.x, 1.0 - vUv.x) * 0.66, min(vUv.y, 1.0 - vUv.y) * 0.94));
    gl_FragColor = vec4(col, 0.95 * edge * rimFade());
  }
`;

/* ------------------------------------------------------------------ tissue */

export const tissueVert = planeVert;

/**
 * The H&E section. Field texture: R = outline distance, G = lumen distance,
 * B = model score (drives the hypercellular look of the focus), A = stain tone.
 */
export const tissueFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform sampler2D uField;
  uniform vec3 uEosin;
  uniform vec3 uEosinLight;
  uniform vec3 uHema;
  uniform vec3 uLumen;
  uniform float uAmbient;
  uniform float uDetail;
  varying vec2 vUv;
  varying vec3 vP;

  void main() {
    vec4 F = texture2D(uField, vUv);
    float sd = (F.r - 0.5) * 0.25;
    float w = max(fwidth(sd) * 0.8, 0.0006);
    float m = smoothstep(w, -w, sd);
    if (m < 0.004) discard;
    float ls = (F.g - 0.5) * 0.125;
    float lw = max(fwidth(ls) * 0.8, 0.0005);
    float lumen = smoothstep(lw, -lw, ls);
    float epi = smoothstep(0.03, 0.002, ls) * (1.0 - lumen);
    float h = F.b;
    float tone = F.a;
    vec2 p = vP.xz;

    // Collagen: fibres running roughly along the section, waving with the flow.
    float flow = 0.06 * sin(2.4 * p.x + 0.8) + 0.045 * sin(3.7 * p.y - 1.1);
    vec2 fp = vec2(p.x, p.y + 0.022 * sin(p.x * 8.0 + p.y * 5.0) + 0.011 * sin(p.x * 21.0 - p.y * 13.0 + 1.7));
    float n1 = vnoise(vec2(fp.x * 30.0 + flow * 120.0, fp.y * 62.0 + fp.x * 14.0));
    float n2 = uDetail > 0.5 ? vnoise(p * 150.0 + n1 * 3.0) : n1;
    vec3 col = mix(uEosinLight, uEosin, clamp(tone * 0.85 + (n1 - 0.45) * 0.9, 0.0, 1.0));
    // Retraction clefts between fibre bundles: paler, thinner.
    float gaps = smoothstep(0.6, 0.86, vnoise(vec2(fp.x * 19.0 + flow * 90.0, fp.y * 47.0 - fp.x * 8.0) + 3.7));
    float body = 0.95 - gaps * 0.42 * (1.0 - h);
    col = mix(col, uEosinLight * 1.06, gaps * 0.55);

    // Epithelium around the lumens, and the hypercellular focus: more hematoxylin.
    col = mix(col, uHema, epi * 0.5);
    float dense = smoothstep(0.12, 0.8, h);
    col = mix(col, mix(uEosin, uHema, 0.72), dense * (0.5 + 0.35 * n2));
    // Nuclei too small to instance: a violet stipple.
    float sp = smoothstep(0.7, 0.92, vnoise(p * 230.0 + 11.0));
    col = mix(col, uHema, sp * (0.22 + 0.4 * dense) * uDetail);

    // The cut edge is a little denser and darker.
    col *= 1.0 - 0.2 * smoothstep(-0.022, 0.0, sd);

    // Lumens are clear glass with a trace of secretion.
    float a = mix(body, 0.62, lumen);
    col = mix(col, uLumen, lumen * 0.92);

    col *= uAmbient + 0.5 * lampPool(p, 0.24);
    // Once the region is flagged, the rest of the section steps back.
    col *= 1.0 - 0.15 * uLock * uLayer * (1.0 - smoothstep(0.06, 0.45, h));
    gl_FragColor = vec4(col, a * m * rimFade());
  }
`;

/* ------------------------------------------------------------------ nuclei */

const instanceHead = /* glsl */ `
  attribute vec2 aPos;
  attribute vec3 aShape;
  attribute vec4 aMeta;
  uniform float uY;
  varying vec2 vQ;
  varying vec3 vP;

  /** World units covered by one device pixel at the instance centre. */
  float unitsPerPx(vec3 centre) {
    vec4 mv = viewMatrix * vec4(centre, 1.0);
    return max(-mv.z, 0.1) / (0.5 * uRes.y * projectionMatrix[1][1]);
  }
  vec3 oriented(vec2 q, vec2 hsz, float rot) {
    float c = cos(rot);
    float s = sin(rot);
    vec2 l = q * hsz;
    return vec3(aPos.x + c * l.x - s * l.y, uY, aPos.y + s * l.x + c * l.y);
  }
`;

export const nucleiVert = /* glsl */ `
  ${pathoGlsl}
  ${instanceHead}
  varying float vCls;
  varying float vSeed;
  varying float vHeat;

  void main() {
    vec3 centre = vec3(aPos.x, uY, aPos.y);
    vHeat = aMeta.w;
    // Never thinner than ~1.3 px across, so the stipple survives on small panels.
    float minR = 0.65 * unitsPerPx(centre);
    vec2 hsz = max(aShape.xy, vec2(minR)) * 1.3;
    vec3 p = oriented(position.xz, hsz, aShape.z);
    vQ = position.xz * 1.3;
    vP = p;
    vCls = aMeta.y;
    vSeed = aMeta.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const nucleiFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform vec3 uHema;
  uniform vec3 uHemaDark;
  uniform float uAmbient;
  varying vec2 vQ;
  varying vec3 vP;
  varying float vCls;
  varying float vSeed;
  varying float vHeat;

  void main() {
    float r = length(vQ);
    float aa = fwidth(r);
    float a = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r);
    if (a < 0.01) discard;
    // Atypical nuclei are darker (hyperchromatic); all have a paler centre.
    vec3 col = mix(uHema, uHemaDark, 0.25 + 0.6 * vCls + 0.3 * (vSeed - 0.5));
    col *= 0.82 + 0.3 * smoothstep(0.2, 1.0, r);
    col *= uAmbient + 0.5 * lampPool(vP.xz, 0.24);
    col *= 1.0 - 0.12 * uLock * uLayer * (1.0 - smoothstep(0.06, 0.45, vHeat));
    gl_FragColor = vec4(col, a * (0.82 + 0.14 * vCls) * rimFade());
  }
`;

/* ----------------------------------------------------------------- markers */

export const markerVert = /* glsl */ `
  ${pathoGlsl}
  ${instanceHead}
  uniform float uRing;
  varying float vAge;
  varying float vCls;
  varying float vRing;
  varying float vSeed;

  void main() {
    // Detection lags the scan line by the model's latency, a little different per cell.
    float age = uT - scanHit(aPos) - (0.22 + aMeta.x * 0.5);
    float ring = aMeta.z * uRing;
    if (age < 0.0 || uLayer <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 centre = vec3(aPos.x, uY, aPos.y);
    float upp = unitsPerPx(centre);
    float pop = 1.0 + 1.5 * exp(-age * 6.0);
    float rr = max(aShape.x, aShape.y);
    float radius = ring > 0.5 ? max(rr * 1.5, 2.7 * upp) : max(rr * 0.5, 1.2 * upp);
    radius *= pop;
    vec3 p = centre + vec3(position.x, 0.0, position.z) * radius;
    vQ = position.xz;
    vP = p;
    vAge = age;
    vCls = aMeta.y;
    vRing = ring;
    vSeed = aMeta.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const markerFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform vec3 uIce;
  uniform vec3 uHot;
  uniform vec3 uAlert;
  varying vec2 vQ;
  varying vec3 vP;
  varying float vAge;
  varying float vCls;
  varying float vRing;
  varying float vSeed;

  void main() {
    float r = length(vQ);
    float aa = fwidth(r);
    float disc = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r);
    float shape = disc;
    if (vRing > 0.5) {
      float w = clamp(aa * 1.25, 0.1, 0.45);
      shape = disc * smoothstep(1.0 - w - aa * 1.5, 1.0 - w, r);
    }
    if (shape < 0.01) discard;
    float born = exp(-vAge * 3.5);
    // Typical cells settle to ice; atypical ones keep a warm tag.
    vec3 settled = mix(uIce, uAlert, vCls);
    vec3 col = mix(settled, uHot, born);
    float a = mix(0.85, 0.95, vCls) + born * 0.4;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * shape * uLayer * rimFade());
  }
`;

/* ----------------------------------------------------------------- overlay */

/** Score colours (indigo -> burgundy -> warm highlight) and premultiplied compositing helpers. */
const rampGlsl = /* glsl */ `
  uniform vec3 uHeat0;
  uniform vec3 uHeat1;
  uniform vec3 uHeat2;
  vec3 ramp(float h) {
    vec3 c = mix(uHeat0, uHeat1, smoothstep(0.05, 0.6, h));
    return mix(c, uHeat2, smoothstep(0.66, 1.0, h));
  }

  void over(inout vec4 acc, vec3 c, float a) {
    acc.rgb = acc.rgb * (1.0 - a) + c * a;
    acc.a = acc.a * (1.0 - a) + a;
  }
  void glow(inout vec4 acc, vec3 c, float a) {
    acc.rgb += c * a;
    acc.a = min(1.0, acc.a + a * 0.55);
  }
`;

export const overlayVert = planeVert;

/**
 * The analysis layer on the slide plane: pyramid tiles captured behind the scan
 * line, patch-level scores, the refined heatmap with its contour, the flag
 * bracket and the live field of view. Output is premultiplied (fills composite
 * "over", line-work adds light).
 */
export const overlayFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  uniform sampler2D uField;
  uniform sampler2D uTiles;
  uniform vec3 uIce;
  uniform vec3 uHot;
  uniform vec4 uHotBox; // centre x, z, half size x, z
  uniform float uLift;  // the flagged region is lifted off the slide as a chip
  uniform float uPulse;
  varying vec2 vUv;
  varying vec3 vP;

  ${rampGlsl}

  void main() {
    vec2 p = vP.xz;
    vec4 F = texture2D(uField, vUv);
    vec4 acc = vec4(0.0);

    // ---- tiles ----
    vec2 q = vec2(p.x - X0, Z1 - p.y) / TILE;
    vec2 id = floor(q);
    vec2 f = fract(q);
    float inGrid = step(0.0, q.x) * step(q.x, COLS) * step(0.0, q.y) * step(q.y, ROWS);
    vec4 tl = texture2D(uTiles, (id + 0.5) / vec2(COLS, ROWS));
    float isTile = step(0.5, tl.r) * inGrid;
    float age = uT - tileHit(id);
    float born = step(0.0, age);
    float flash = exp(-max(age, 0.0) * 2.4) * born;
    float pxq = max(fwidth(q.x), fwidth(q.y));
    vec2 e = min(f, 1.0 - f);
    float d = min(e.x, e.y) - 0.06;
    float outline = 1.0 - smoothstep(0.0, pxq * 1.25, abs(d));
    float inside = smoothstep(-pxq, pxq, d);
    float corner = 1.0 - smoothstep(0.26, 0.3, max(e.x, e.y));
    float score = tl.g;

    // patch-level score: each tile is classified shortly after capture
    float inferred = smoothstep(0.25, 0.75, age);
    float tileHeat = isTile * inferred * inside * smoothstep(0.06, 0.42, score) * (1.0 - uRefine);
    over(acc, ramp(score * 0.92), tileHeat * (0.3 + 0.32 * score));

    // refined heatmap
    float h = F.b;
    float ha = smoothstep(0.05, 0.7, h) * 0.8 * uRefine * (0.92 + 0.08 * uPulse) * (1.0 - 0.6 * uLift);
    over(acc, ramp(h), ha);

    // the lifted chip leaves a darker cut-out behind
    vec2 cut = abs(p - uHotBox.xy) - (uHotBox.zw + 0.04);
    over(acc, vec3(0.03, 0.035, 0.08), smoothstep(0.004, -0.004, max(cut.x, cut.y)) * 0.42 * uLift);

    // pyramid: flagged tiles are re-read one level down (2 x 2 children)
    vec2 e2 = abs(f - 0.5);
    float sub = (1.0 - smoothstep(0.0, pxq * 1.1, min(e2.x, e2.y))) * inside;
    glow(acc, uIce, isTile * born * sub * smoothstep(0.16, 0.3, score) * uRefine * 0.2);

    // tile frames: bright on capture, then a quiet grid with firmer corners
    float frame = outline * ((0.2 + 0.3 * corner) * (1.0 - 0.45 * uRefine) + 0.8 * flash);
    glow(acc, mix(uIce, uHot, flash), isTile * born * (frame + inside * flash * 0.2));

    // contour of the suspicious region, traced around its centre
    float hw = max(fwidth(h), 1e-4);
    float iso = 1.0 - smoothstep(0.6, 1.5, abs(h - 0.5) / hw);
    float ang = atan(p.y - uHotBox.y, p.x - uHotBox.x) / TAU + 0.5;
    float drawn = smoothstep(0.0, 0.03, uContour * 1.03 - ang);
    glow(acc, uHeat2, iso * drawn * 0.95);
    float iso2 = 1.0 - smoothstep(0.5, 1.3, abs(h - 0.22) / hw);
    glow(acc, uHeat1, iso2 * drawn * 0.4 * uRefine);

    // flag bracket: closes in on the region and locks
    float lk = 1.0 - (1.0 - uLock) * (1.0 - uLock);
    vec2 hr = (uHotBox.zw + 0.04) * mix(1.55, 1.0, lk);
    vec2 rel = p - uHotBox.xy;
    vec2 dd = abs(rel) - hr;
    float rsd = max(dd.x, dd.y);
    float pxp = max(fwidth(p.x), fwidth(p.y));
    float edge = 1.0 - smoothstep(pxp * 0.6, pxp * 1.7, abs(rsd));
    vec2 fromCorner = hr - abs(rel);
    float cornerOnly = 1.0 - smoothstep(0.062, 0.066, max(fromCorner.x, fromCorner.y));
    float bracket = edge * cornerOnly;
    // reticle ticks at the middle of each side, pointing outwards
    float tk = 0.0;
    tk += (1.0 - smoothstep(pxp * 0.6, pxp * 1.7, abs(rel.y))) * step(0.012, dd.x) * step(dd.x, 0.05);
    tk += (1.0 - smoothstep(pxp * 0.6, pxp * 1.7, abs(rel.x))) * step(0.012, dd.y) * step(dd.y, 0.05);
    glow(acc, uHot, (bracket + tk * 0.7) * smoothstep(0.0, 0.35, uLock) * (0.82 + 0.18 * uPulse) * (1.0 - 0.6 * uLift));

    // live field of view under the objective
    vec2 fd = abs(p - uHead.xz) - vec2(TILE * 0.5);
    float fsd = max(fd.x, fd.y);
    float fov = 1.0 - smoothstep(pxp * 0.5, pxp * 1.8, abs(fsd));
    float fill = smoothstep(pxp, -pxp, fsd);
    vec4 live = vec4(uHot * (fov * 0.95 + fill * 0.13) * uLamp, (fov * 0.5 + fill * 0.05) * uLamp);

    acc *= uLayer;
    acc += live;
    gl_FragColor = acc * rimFade();
  }
`;

/* -------------------------------------------------------------- light cone */

export const beamVert = /* glsl */ `
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vH;
  void main() {
    float a = mix(0.9, 0.25, vH) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

/* -------------------------------------------- region-of-interest chip */

export const CHIP_PAD = 0.045;

export const chipVert = planeVert;

/**
 * The flagged region, extracted: a thin glass chip that lifts off the slide
 * carrying the heatmap, its contour and the lock bracket.
 */
export const chipFrag = /* glsl */ `
  ${pathoGlsl}
  ${fadeGlsl}
  ${rampGlsl}
  uniform sampler2D uField;
  uniform vec3 uIce;
  uniform vec3 uHot;
  uniform vec3 uPlate;
  uniform vec4 uHotBox;
  uniform float uLift;
  uniform float uPulse;
  varying vec2 vUv;
  varying vec3 vP;

  void main() {
    vec2 p = vP.xz;
    vec2 fuv = vec2((p.x - ${n(REGION.x0)}) / ${n(REGION.x1 - REGION.x0)}, (p.y - ${n(REGION.z0)}) / ${n(REGION.z1 - REGION.z0)});
    float h = texture2D(uField, fuv).b;
    vec4 acc = vec4(0.0);
    vec2 rel = p - uHotBox.xy;
    vec2 hr = uHotBox.zw + ${n(CHIP_PAD)};
    float px = max(fwidth(p.x), fwidth(p.y));
    float sd = sdRoundBox(rel, hr, 0.012);
    float plate = smoothstep(px, -px, sd);

    over(acc, uPlate, plate * 0.5);
    over(acc, ramp(h), smoothstep(0.08, 0.8, h) * 0.9 * (0.9 + 0.1 * uPulse));
    float hw = max(fwidth(h), 1e-4);
    glow(acc, uHeat2, (1.0 - smoothstep(0.6, 1.6, abs(h - 0.5) / hw)) * 0.95);
    glow(acc, uHeat1, (1.0 - smoothstep(0.5, 1.3, abs(h - 0.22) / hw)) * 0.45);

    // plate edge, firm corners, reticle ticks
    float line = 1.0 - smoothstep(px * 0.5, px * 1.6, abs(sd));
    vec2 fromCorner = hr - abs(rel);
    float corner = 1.0 - smoothstep(0.058, 0.062, max(fromCorner.x, fromCorner.y));
    glow(acc, uIce, line * 0.35);
    glow(acc, uHot, line * corner * 0.9);
    float cross = (1.0 - smoothstep(px * 0.5, px * 1.5, abs(rel.x))) * step(abs(rel.y), 0.022)
                + (1.0 - smoothstep(px * 0.5, px * 1.5, abs(rel.y))) * step(abs(rel.x), 0.022);
    glow(acc, uHot, cross * 0.55);

    gl_FragColor = acc * smoothstep(0.0, 0.25, uLift) * uLayer * rimFade();
  }
`;

/** Leader lines from the slide up to the chip's corners. */
export const postVert = /* glsl */ `
  attribute float aSide;
  uniform vec2 uRes;
  uniform float uPR;
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // a ribbon of constant width on screen
    gl_Position.x += aSide * 0.8 * uPR / uRes.x * 2.0 * gl_Position.w;
  }
`;

export const postFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vH;
  void main() {
    gl_FragColor = vec4(uColor, (0.2 + 0.8 * vH) * uOpacity);
  }
`;
