"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { FlankSceneProps } from "./contract";
import {
  bodyAt,
  buildQuadruped,
  FatLines,
  footAt,
  fract,
  GAIT,
  LEGS,
  STEP,
  type BodyPose,
  glowBlend,
  type QuadrupedRig,
} from "./robot";

/**
 * Left flank, "research": the quadruped's digital twin walking on a scrolling
 * simulation grid (treadmill: the robot stays put, the world slides back by
 * the distance walked). Instrumentation: predicted swing arcs to planned
 * footholds, footprint history with touch-down ripples, centre-of-mass plumb
 * line and ground track inside the support polygon, joint axes on the near
 * legs, a faint ghost of a future pose and a training curve converging on a
 * floating panel behind the robot. All additive line-work on a transparent
 * canvas; no text (labels are DOM).
 */

const SPEED = 0.46; // m/s
const C = GAIT.cycle;
const DUTY = GAIT.duty;
/** Still frame for reduced motion: near fore leg mid-swing, curve fully drawn. */
const STILL_T = ((0.29 * C) / SPEED) as number;

const ICE = new THREE.Color("#e6edf5");
const ICE_DIM = new THREE.Color("#afc1d6");
const INDIGO = new THREE.Color("#8d92c4");
const ROSE = new THREE.Color("#c4497f");
const LILAC = new THREE.Color("#b9bdf2");

/* ───────────── Camera ───────────── */

const FOV = 27;
/** View direction (from target toward camera): front-right, slightly above. */
const VIEW = new THREE.Vector3(0.5, 0.36, 0.9).normalize();
const TARGET = new THREE.Vector3(0.16, 0.36, -0.02);
/** Half extents of what must stay in frame (robot + arcs ahead + chart behind). */
const HALF_H = 0.56;
/** Narrow panels crop the far end of the planned arcs rather than shrink the robot. */
const halfW = (aspect: number) => 0.84 + 0.16 * THREE.MathUtils.clamp((aspect - 0.9) / 0.7, 0, 1);

/** Camera basis (fixed orientation; only the distance follows the aspect). */
const CAM_R = new THREE.Vector3().crossVectors(VIEW.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
const CAM_U = new THREE.Vector3().crossVectors(CAM_R, VIEW.clone().negate()).normalize();
const CAM_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(CAM_R, CAM_U, VIEW));

/** Training panel: upper left of the frame, set back behind the robot, facing the camera. */
const CHART_W = 0.44;
const CHART_H = 0.2;
const CHART_AT = TARGET.clone()
  .addScaledVector(CAM_R, -0.86)
  .addScaledVector(CAM_U, 0.27)
  .addScaledVector(VIEW, -0.55);

function fitDistance(aspect: number) {
  const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const th = tv * aspect;
  return Math.max(halfW(aspect) / th, HALF_H / tv);
}

/* ───────────── Simulation grid ───────────── */

const gridVert = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const gridFrag = /* glsl */ `
uniform float uOffset;
uniform vec3 uMinor;
uniform vec3 uMajor;
uniform vec3 uPool;
uniform float uMinorK;
varying vec2 vW;
float grid(vec2 p, float s, float w) {
  vec2 g = abs(fract(p / s - 0.5) - 0.5) * s;
  vec2 fw = max(fwidth(p), vec2(1e-5));
  vec2 l = 1.0 - smoothstep(vec2(0.0), fw * w, g);
  return max(l.x, l.y);
}
void main() {
  vec2 p = vW + vec2(uOffset, 0.0);
  float minor = grid(p, 0.1, 1.0);
  float major = grid(p, 0.5, 1.4);
  // Elliptical falloff: the grid dissolves into the panel background.
  vec2 q = (vW - vec2(0.1, 0.0)) / vec2(1.9, 1.05);
  float r = length(q);
  float fade = 1.0 - smoothstep(0.25, 1.0, r);
  float pool = exp(-dot(q, q) * 9.0);
  vec3 c = uMinor * minor * uMinorK + uMajor * major * 0.3 + uPool * pool * 0.16;
  gl_FragColor = vec4(c * fade, 1.0);
}
`;

/* ───────────── Training curve data ───────────── */

const CURVE_N = 96;

/** Deterministic noisy loss and its exponential moving average, u in [0, 1]. */
function makeCurve() {
  const raw = new Float32Array(CURVE_N);
  const ema = new Float32Array(CURVE_N);
  let e = 0;
  for (let i = 0; i < CURVE_N; i++) {
    const u = i / (CURVE_N - 1);
    const base = 0.1 + 0.78 * Math.exp(-4.6 * u) + 0.05 * Math.exp(-((u - 0.22) ** 2) / 0.004);
    const noise =
      (Math.sin(i * 2.17) * 0.55 + Math.sin(i * 5.31 + 1.3) * 0.3 + Math.sin(i * 11.7 + 0.4) * 0.15) *
      (0.03 + 0.09 * Math.exp(-3 * u));
    raw[i] = Math.min(0.98, Math.max(0.03, base + noise));
    e = i === 0 ? raw[0] : e + (raw[i] - e) * 0.22;
    ema[i] = e;
  }
  return { raw, ema };
}

/* ───────────── Instruments ───────────── */

const FOOT_PAST = 3;
/** Support polygon edges (leg indices into LEGS: FL, FR, RL, RR); -1 = unused. */
const PERIM = [0, 1, 1, 3, 3, 2, 2, 0];
const DIAG = [0, 3, 1, 2, -1, -1, -1, -1];
type Instruments = ReturnType<typeof buildInstruments>;

/** Width of the panel-edge fade, as a fraction of the panel's short side. */
const EDGE_FADE = 0.2;

/**
 * Ground-plane elements fade to nothing before any canvas edge (the panel is
 * borderless, so nothing may end on a hard cut). The fade is measured in
 * drawing-buffer pixels against the short side, so it holds at any aspect
 * and size. Works for any material by wrapping the fragment main().
 */
function edgeFade<M extends THREE.Material>(m: M, viewport: { value: THREE.Vector2 }): M {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uViewport = viewport;
    shader.fragmentShader =
      shader.fragmentShader.replace(/void\s+main\s*\(\s*\)/, "void flankMain()") +
      `
uniform vec2 uViewport;
void main() {
  flankMain();
  vec2 px = gl_FragCoord.xy;
  float edge = min(min(px.x, uViewport.x - px.x), min(px.y, uViewport.y - px.y));
  float w = max(1.0, min(uViewport.x, uViewport.y) * ${EDGE_FADE.toFixed(3)});
  float k = smoothstep(0.0, 1.0, clamp(edge / w, 0.0, 1.0));
  gl_FragColor.a *= k * k;
}
`;
  };
  m.customProgramCacheKey = () => "flank-edge-fade";
  return m;
}

function buildInstruments(quality: FlankSceneProps["quality"], rig: QuadrupedRig) {
  const high = quality === "high";
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  /** Drawing-buffer size, written by the scene every frame. */
  const viewport = { value: new THREE.Vector2(1, 1) };

  // Grid floor.
  const gridMat = glowBlend(new THREE.ShaderMaterial({
    vertexShader: gridVert,
    fragmentShader: gridFrag,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uOffset: { value: 0 },
      uMinor: { value: INDIGO.clone() },
      uMajor: { value: ICE_DIM.clone() },
      uPool: { value: INDIGO.clone() },
      uMinorK: { value: high ? 0.17 : 0.12 },
    },
  }));
  const gridGeo = new THREE.PlaneGeometry(4.4, 2.6);
  gridGeo.rotateX(-Math.PI / 2);
  edgeFade(gridMat, viewport);
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.position.set(0.1, 0, 0);
  grid.renderOrder = 0;
  root.add(grid);
  disposables.push(gridMat, gridGeo);

  // Footprints: past touch-downs, planned next foothold, touch-down ripple.
  const perLeg = FOOT_PAST + 2;
  const ringGeo = new THREE.RingGeometry(0.021, 0.027, high ? 40 : 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = glowBlend(new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  edgeFade(ringMat, viewport);
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, LEGS.length * perLeg);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.setColorAt(0, ICE);
  rings.frustumCulled = false;
  rings.renderOrder = 1;
  root.add(rings);
  disposables.push(ringGeo, ringMat, rings);

  // Predicted swing arcs (one gait cycle ahead per leg).
  const ARC_N = high ? 44 : 26;
  const arcs = new FatLines(LEGS.length * ARC_N, { width: high ? 1.6 : 1.4 });
  edgeFade(arcs.material, viewport);
  arcs.object.renderOrder = 1;
  root.add(arcs.object);
  disposables.push(arcs);

  // Centre of mass: plumb line, ground track, support polygon.
  const TRACK_N = high ? 40 : 24;
  const com = new FatLines(TRACK_N + 6 + 12, { width: high ? 1.3 : 1.2 });
  edgeFade(com.material, viewport);
  com.object.renderOrder = 1;
  root.add(com.object);
  disposables.push(com);
  const dotGeo = new THREE.CircleGeometry(0.011, 20);
  dotGeo.rotateX(-Math.PI / 2);
  const dotMat = glowBlend(new THREE.MeshBasicMaterial({
    color: ROSE,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  edgeFade(dotMat, viewport);
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.renderOrder = 1;
  root.add(dot);
  disposables.push(dotGeo, dotMat);

  // Joint axes on the near (right, +Z) legs: the hip pitch and knee axes stick
  // out of the leg with a rotation arrow that turns with the link.
  const ARC = high ? 18 : 10;
  LEGS.forEach((def, i) => {
    if (def.side < 0) return;
    const leg = rig.legs[i];
    for (const [holder, r] of [
      [leg.thigh, 0.03],
      [leg.shank, 0.024],
    ] as const) {
      const a = new FatLines(ARC + 3, { width: high ? 1.2 : 1.1 });
      const z = 0.068;
      let k = 0;
      a.set(k++, 0, 0, 0.03, 0, 0, z + 0.03, LILAC.r, LILAC.g, LILAC.b, 0.1, 0.85);
      const a0 = -Math.PI / 2 + 0.5;
      const span = Math.PI * 1.45;
      for (let j = 0; j < ARC; j++) {
        const t0 = a0 + (j / ARC) * span;
        const t1 = a0 + ((j + 1) / ARC) * span;
        const kk = 0.25 + 0.6 * (j / ARC);
        a.set(k++, Math.cos(t0) * r, Math.sin(t0) * r, z, Math.cos(t1) * r, Math.sin(t1) * r, z, LILAC.r, LILAC.g, LILAC.b, kk, kk + 0.6 / ARC);
      }
      // Arrow head at the end of the arc (tangent direction = increasing angle).
      const te = a0 + span;
      const ex = Math.cos(te) * r;
      const ey = Math.sin(te) * r;
      const tx = -Math.sin(te);
      const ty = Math.cos(te);
      const h = 0.009;
      a.set(k++, ex, ey, z, ex - tx * h + Math.cos(te) * h * 0.6, ey - ty * h + Math.sin(te) * h * 0.6, z, LILAC.r, LILAC.g, LILAC.b, 0.85, 0.85);
      a.set(k++, ex, ey, z, ex - tx * h - Math.cos(te) * h * 0.6, ey - ty * h - Math.sin(te) * h * 0.6, z, LILAC.r, LILAC.g, LILAC.b, 0.85, 0.85);
      a.commit(k);
      a.object.renderOrder = 4;
      holder.add(a.object);
      disposables.push(a);
    }
  });

  // Training panel: floating chart behind the robot, facing the camera.
  const chart = new THREE.Group();
  chart.position.copy(CHART_AT);
  chart.quaternion.copy(CAM_Q);
  root.add(chart);
  const CW = CHART_W;
  const CH = CHART_H;
  const frame = new FatLines(16, { width: 1.1 });
  {
    let k = 0;
    // Axes.
    frame.set(k++, 0, 0, 0, CW, 0, 0, INDIGO.r, INDIGO.g, INDIGO.b, 0.7, 0.35);
    frame.set(k++, 0, 0, 0, 0, CH, 0, INDIGO.r, INDIGO.g, INDIGO.b, 0.7, 0.3);
    // Ticks along x.
    for (let i = 1; i <= 5; i++) {
      const x = (i / 5) * CW;
      frame.set(k++, x, 0, 0, x, -0.012, 0, INDIGO.r, INDIGO.g, INDIGO.b, 0.5, 0.5);
    }
    // Faint horizontal guides.
    for (let i = 1; i <= 3; i++) {
      const y = (i / 3) * CH;
      frame.set(k++, 0, y, 0, CW, y, 0, INDIGO.r, INDIGO.g, INDIGO.b, 0.14, 0.04);
    }
    // Converged level (dashed).
    const yc = 0.1 * CH;
    for (let i = 0; i < 6; i++) {
      const x0 = CW * (0.42 + i * 0.1);
      frame.set(k++, x0, yc, 0, x0 + CW * 0.05, yc, 0, ROSE.r, ROSE.g, ROSE.b, 0.55, 0.55);
    }
    frame.commit(k);
  }
  frame.object.renderOrder = 1;
  chart.add(frame.object);
  disposables.push(frame);
  const curve = makeCurve();
  const rawLine = new FatLines(CURVE_N - 1, { width: 1 });
  const emaLine = new FatLines(CURVE_N - 1, { width: high ? 1.8 : 1.6 });
  rawLine.object.renderOrder = 1;
  emaLine.object.renderOrder = 1;
  chart.add(rawLine.object, emaLine.object);
  disposables.push(rawLine, emaLine);
  const headGeo = new THREE.CircleGeometry(0.009, 20);
  const headMat = glowBlend(new THREE.MeshBasicMaterial({
    color: ICE,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  const head = new THREE.Mesh(headGeo, headMat);
  head.renderOrder = 1;
  chart.add(head);
  disposables.push(headGeo, headMat);

  // Scratch.
  const f = { x: 0, y: 0, z: 0 };
  const pose: BodyPose = { y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 };
  const past: BodyPose = { y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const stanceX = new Float32Array(4);
  const stanceZ = new Float32Array(4);
  const stance = [false, false, false, false];

  const setRing = (i: number, x: number, z: number, s: number, color: THREE.Color, k: number) => {
    m4.compose(v.set(x, 0.002, z), q, sc.set(s, 1, s));
    rings.setMatrixAt(i, m4);
    rings.setColorAt(i, tmpC.copy(color).multiplyScalar(Math.max(0, k)));
  };

  const update = (t: number, stride: number, chartT: number) => {
    gridMat.uniforms.uOffset.value = stride;

    // Footprints and arcs.
    let seg = 0;
    for (let li = 0; li < LEGS.length; li++) {
      const def = LEGS[li];
      const g = stride / C + def.phase;
      const n0 = Math.floor(g);
      const p = g - n0;
      const base = li * perLeg;
      // Touch-down n lands at world x = (n - phase) C + x0 + STEP / 2; shown relative to the robot.
      const land0 = (n0 - def.phase) * C + def.x0 + STEP / 2 - stride;
      for (let k = 0; k < FOOT_PAST; k++) {
        const x = land0 - k * C;
        const behind = THREE.MathUtils.smoothstep(x, -1.5, -0.35);
        const planted = k === 0 && p < DUTY;
        setRing(base + k, x, def.z0, planted ? 1.15 : 0.9, planted ? ICE : INDIGO, planted ? 1 : 0.75 * behind);
      }
      // Planned foothold: brightens as the swing heads for it.
      const swingU = p < DUTY ? 0 : (p - DUTY) / (1 - DUTY);
      setRing(base + FOOT_PAST, land0 + C, def.z0, 1.25, ICE_DIM, 0.35 + 0.65 * swingU);
      // Ripple on touch-down.
      const rip = Math.min(1, (p * C) / 0.12);
      setRing(base + FOOT_PAST + 1, land0, def.z0, 1 + rip * 2.6, ICE, (1 - rip) * 0.8);

      stance[li] = p < DUTY;
      stanceX[li] = land0;
      stanceZ[li] = def.z0;

      // Swing arc: sample one cycle ahead, keep the swing portion only.
      for (let j = 0; j < ARC_N - 1; j++) {
        const s0 = stride + (j / (ARC_N - 1)) * C;
        const s1 = stride + ((j + 1) / (ARC_N - 1)) * C;
        const u0 = footAt(def, s0, f);
        const ax = f.x + (s0 - stride);
        const ay = f.y;
        const az = f.z;
        const u1 = footAt(def, s1, f);
        if (u0 === 0 && u1 === 0) continue;
        const k0 = 1 - j / (ARC_N - 1);
        const k1 = 1 - (j + 1) / (ARC_N - 1);
        arcs.set(seg++, ax, ay, az, f.x + (s1 - stride), f.y, f.z, ICE_DIM.r, ICE_DIM.g, ICE_DIM.b, 0.25 + 0.75 * k0, 0.25 + 0.75 * k1);
      }
    }
    arcs.commit(seg);
    rings.instanceMatrix.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;

    // Centre of mass: plumb line, ground dot, ground track behind.
    bodyAt(stride, t, pose);
    const comX = -0.02;
    let c = 0;
    const plumbTop = pose.y + 0.02;
    const dashes = 6;
    for (let i = 0; i < dashes; i++) {
      const y0 = plumbTop * (1 - i / dashes);
      const y1 = plumbTop * (1 - (i + 0.55) / dashes);
      com.set(c++, comX, y0, pose.z * 3, comX, y1, pose.z * 3, ROSE.r, ROSE.g, ROSE.b, 0.65, 0.65);
    }
    dot.position.set(comX, 0.003, pose.z * 3);
    // Lateral sway is a few millimetres: drawn ×3 so it reads at panel scale.
    let zPrev = pose.z * 3;
    for (let i = 0; i < TRACK_N; i++) {
      const a = i / TRACK_N;
      const b = (i + 1) / TRACK_N;
      const zb = bodyAt(stride - b * 0.95, t, past).z * 3;
      com.set(c++, comX - a * 0.95, 0.003, zPrev, comX - b * 0.95, 0.003, zb, ROSE.r, ROSE.g, ROSE.b, 0.7 * (1 - a), 0.7 * (1 - b));
      zPrev = zb;
    }
    // Support polygon: perimeter when all feet are down, else the stance diagonal.
    const all = stance[0] && stance[1] && stance[2] && stance[3];
    for (let e = 0; e < 4; e++) {
      const ia = all ? PERIM[e * 2] : DIAG[e * 2];
      const ib = all ? PERIM[e * 2 + 1] : DIAG[e * 2 + 1];
      if (ia < 0 || !stance[ia] || !stance[ib]) continue;
      com.set(c++, stanceX[ia], 0.003, stanceZ[ia], stanceX[ib], 0.003, stanceZ[ib], ICE_DIM.r, ICE_DIM.g, ICE_DIM.b, 0.5, 0.5);
    }
    com.commit(c);

    // Training curve: draw over ~7 s, hold, fade, restart.
    const period = 10;
    const ct = fract(chartT / period) * period;
    const prog = Math.min(1, ct / 7);
    const fade = ct < 9.2 ? 1 : 1 - (ct - 9.2) / 0.8;
    const drawn = prog * (CURVE_N - 1);
    const nSeg = Math.floor(drawn);
    for (let i = 0; i < CURVE_N - 1; i++) {
      const x0 = (i / (CURVE_N - 1)) * CW;
      const x1 = ((i + 1) / (CURVE_N - 1)) * CW;
      let r1 = curve.raw[i + 1];
      let e1 = curve.ema[i + 1];
      let xe = x1;
      if (i === nSeg) {
        const w = drawn - nSeg;
        r1 = curve.raw[i] + (r1 - curve.raw[i]) * w;
        e1 = curve.ema[i] + (e1 - curve.ema[i]) * w;
        xe = x0 + (x1 - x0) * w;
      }
      rawLine.set(i, x0, curve.raw[i] * CH, 0.001, xe, r1 * CH, 0.001, INDIGO.r, INDIGO.g, INDIGO.b, 0.55 * fade, 0.55 * fade);
      emaLine.set(i, x0, curve.ema[i] * CH, 0.002, xe, e1 * CH, 0.002, ICE.r, ICE.g, ICE.b, fade, fade);
    }
    const shown = Math.min(CURVE_N - 1, nSeg + 1);
    rawLine.commit(shown);
    emaLine.commit(shown);
    {
      const i = Math.min(CURVE_N - 2, nSeg);
      const w = Math.min(1, drawn - i);
      const y = curve.ema[i] + (curve.ema[i + 1] - curve.ema[i]) * w;
      head.position.set(((i + w) / (CURVE_N - 1)) * CW, y * CH, 0.003);
      headMat.opacity = fade;
    }
  };

  const dispose = () => disposables.forEach((d) => d.dispose());
  return { root, update, dispose, viewport };
}

/* ───────────── Scene ───────────── */

export default function ResearchScene({ quality, reduce }: FlankSceneProps) {
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useRef<THREE.PerspectiveCamera>(null);

  const rig = useMemo(() => buildQuadruped({ style: "twin", quality }), [quality]);
  const inst: Instruments = useMemo(() => buildInstruments(quality, rig), [quality, rig]);

  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => () => inst.dispose(), [inst]);

  // Frame the robot and its instrumentation for the panel's aspect ratio.
  useLayoutEffect(() => {
    const cam = camera.current;
    if (!cam) return;
    const aspect = size.width / Math.max(1, size.height);
    const d = fitDistance(aspect);
    cam.position.copy(TARGET).addScaledVector(VIEW, d);
    cam.lookAt(TARGET);
    cam.updateMatrixWorld();
    invalidate();
  }, [size.width, size.height, invalidate]);

  const clock = useRef(0);
  useEffect(() => {
    if (reduce) invalidate();
  }, [reduce, invalidate, rig]);

  useFrame(({ gl }, delta) => {
    gl.getDrawingBufferSize(inst.viewport.value);
    if (!reduce) clock.current += Math.min(delta, 0.05);
    const t = reduce ? STILL_T : clock.current;
    const stride = t * SPEED;
    rig.update(t, stride);
    // Scan band sweeps up the twin every few seconds.
    const sc = fract(t / 4.2);
    rig.setScan(sc < 0.5 ? -0.05 + sc * 1.6 : -10);
    inst.update(t, stride, reduce ? 8.5 : t);
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.05} far={30} />
      <primitive object={inst.root} />
      <primitive object={rig.group} />
    </>
  );
}
