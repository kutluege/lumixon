import * as THREE from "three";
import {
  armPose,
  armTool,
  clamp,
  demoGrip,
  demoRadius,
  HAND_HOME,
  IMIT_LAG,
  learnerTarget,
  smoothstep,
  type SceneLayout,
  type Vec3,
} from "../math";
import { DIM, GRIP, type ArmRig, type HumanoidRig, type LegRig } from "./build";

/** Spring state carried between frames (snapped on the first frame / reduced motion). */
export type MotionState = {
  /** Smoothed hand displacement from its home point, model space: drives every secondary motion. */
  lean: THREE.Vector3;
  /** Smoothed gaze direction, model space. */
  yaw: number;
  pitch: number;
  /** Light bar offset: the eyes arrive before the head does. */
  eye: number;
  /** 0 = watching the demonstrator, → 1 = checking its own hand. */
  look: number;
  /** Per-finger grasp (index → little, thumb): staggered so the hand closes like a wave. */
  grip: number[];
};

export const createMotionState = (): MotionState => ({
  lean: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  eye: 0,
  look: 0,
  grip: [0, 0, 0, 0, 0],
});

const L1 = DIM.upperArm;
const L2 = DIM.foreArm;
const EYE_HEIGHT = DIM.hipY + DIM.waist + DIM.neckY + DIM.eyeY;
/** Resting stance: weight over the leg away from the imitating hand, body a touch toward the demonstrator. */
const STANCE_SHIFT = 0.014;
const STANCE_TURN = 0.06;
/** The face never turns further than this (rad) from the viewer; the light bar covers the rest. */
const FACE_TURN = 0.5;
/** How much of the viewer's bearing the chest opens toward. */
const CHEST_OPEN = 0.22;
const MAX_LEAN = 0.3;
const MAX_TWIST = 1.5;
const MAX_SWING = 0.85;
const GRIP_RATE = [12, 10, 8.5, 7.5, 11];

/* Scratch (no per-frame allocation). */
const q6 = [0, 0, 0, 0, 0, 0];
const a3: Vec3 = [0, 0, 0];
const b3: Vec3 = [0, 0, 0];
const v = () => new THREE.Vector3();
const V = {
  tool: v(),
  tgtW: v(),
  tgtM: v(),
  home: v(),
  cam: v(),
  gaze: v(),
  tmp: v(),
  d: v(),
  dn: v(),
  p: v(),
  y: v(),
  z: v(),
  S: v(),
  T: v(),
  w: v(),
  pole: v(),
  dh: v(),
  xr: v(),
  hx: v(),
  hy: v(),
  hz: v(),
  hip: v(),
};
const M = new THREE.Matrix4();
const Q = {
  fore: new THREE.Quaternion(),
  want: new THREE.Quaternion(),
  rel: new THREE.Quaternion(),
  twist: new THREE.Quaternion(),
  swing: new THREE.Quaternion(),
  eff: new THREE.Quaternion(),
  id: new THREE.Quaternion(),
};
/** Frame time used by the springs of the update in progress (Infinity = snap to target). */
let stepDt = 0;
const k = (rate: number) => 1 - Math.exp(-stepDt * rate);

/** Result of the last two-bone solve. */
const ik = { mid: v(), end: v(), u: v(), f: v(), n: v() };

/** Compress a reach distance into (lo, hi): identity in the middle, asymptotic within `m` of either limit. */
function softReach(d: number, lo: number, hi: number, m: number) {
  if (d > hi - m) return hi - m * Math.exp(-(d - (hi - m)) / m);
  if (d < lo + m) return lo + m * Math.exp(-(lo + m - d) / m);
  return d;
}

/**
 * Analytic two-bone IK from S toward T. The bend plane is chosen by a pole
 * vector; the reach is soft-clamped so the joint never locks straight (no
 * pop at full extension) and never folds flat.
 */
function ik2(S: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, sign: number, lo: number, hi: number, m: number) {
  V.d.subVectors(T, S);
  const dist = V.d.length();
  if (dist > 1e-6) V.dn.copy(V.d).multiplyScalar(1 / dist);
  else V.dn.set(0, -1, 0);
  const L = softReach(dist, lo, hi, m);
  const a = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1));
  V.p.copy(pole).addScaledVector(V.dn, -pole.dot(V.dn));
  if (V.p.lengthSq() < 1e-8) {
    V.p.set(1, 0, 0).addScaledVector(V.dn, -V.dn.x);
    if (V.p.lengthSq() < 1e-8) V.p.set(0, 0, 1).addScaledVector(V.dn, -V.dn.z);
  }
  V.p.normalize();
  ik.u.copy(V.dn).multiplyScalar(Math.cos(a)).addScaledVector(V.p, Math.sin(a));
  ik.mid.copy(S).addScaledVector(ik.u, l1);
  ik.end.copy(S).addScaledVector(V.dn, L);
  ik.f.subVectors(ik.end, ik.mid).normalize();
  ik.n.crossVectors(V.dn, V.p).multiplyScalar(sign);
}

/** Bone frame: -Y along the segment, X = hinge axis. */
function frame(out: THREE.Quaternion, along: THREE.Vector3, hinge: THREE.Vector3) {
  V.y.copy(along).negate();
  V.z.crossVectors(hinge, V.y);
  M.makeBasis(hinge, V.y, V.z);
  out.setFromRotationMatrix(M);
}

const solveArm = (S: THREE.Vector3, W: THREE.Vector3, pole: THREE.Vector3) =>
  ik2(S, W, L1, L2, pole, 1, 0.1, (L1 + L2) * 0.985, 0.03);

function placeArm(arm: ArmRig, S: THREE.Vector3) {
  arm.upper.position.copy(S);
  frame(arm.upper.quaternion, ik.u, ik.n);
  arm.fore.position.copy(ik.mid);
  frame(arm.fore.quaternion, ik.f, ik.n);
}

/**
 * Bring the hand's pinch point to T (torso space) with the hand oriented as
 * `want` as far as the wrist allows: the residual between forearm and hand is
 * split into forearm roll (twist) and a limited wrist bend (swing), and the
 * wrist target is re-solved so the pinch point still lands on T.
 */
function reachArm(arm: ArmRig, S: THREE.Vector3, T: THREE.Vector3, pole: THREE.Vector3, want: THREE.Quaternion) {
  Q.eff.copy(want);
  for (let it = 0; it < 5; it++) {
    V.w.copy(GRIP).applyQuaternion(Q.eff);
    V.w.subVectors(T, V.w);
    solveArm(S, V.w, pole);
    frame(Q.fore, ik.f, ik.n);
    Q.rel.copy(Q.fore).invert().multiply(want);
    if (Q.rel.w < 0) Q.rel.set(-Q.rel.x, -Q.rel.y, -Q.rel.z, -Q.rel.w);
    const ang = clamp(2 * Math.atan2(Q.rel.y, Q.rel.w), -MAX_TWIST, MAX_TWIST);
    Q.twist.set(0, Math.sin(ang / 2), 0, Math.cos(ang / 2));
    Q.swing.copy(Q.twist).invert().multiply(Q.rel);
    const sa = 2 * Math.acos(clamp(Math.abs(Q.swing.w), 0, 1));
    if (sa > MAX_SWING) Q.swing.slerp(Q.id, 1 - MAX_SWING / sa);
    Q.eff.copy(Q.fore).multiply(Q.twist).multiply(Q.swing);
  }
  placeArm(arm, S);
  arm.twist.quaternion.copy(Q.twist);
  arm.hand.quaternion.copy(Q.swing);
}

/** Idle arm: wrist placed directly, fixed forearm roll and a hint of wrist flexion. */
function restArm(arm: ArmRig, S: THREE.Vector3, W: THREE.Vector3, pole: THREE.Vector3, roll: number, flex: number) {
  solveArm(S, W, pole);
  placeArm(arm, S);
  arm.twist.quaternion.set(0, Math.sin(roll / 2), 0, Math.cos(roll / 2));
  arm.hand.quaternion.set(Math.sin(flex / 2), 0, 0, Math.cos(flex / 2));
}

/** Feet stay planted: each leg is re-solved from the (moving) hip to its fixed ankle. */
function plantLeg(leg: LegRig, pelvis: THREE.Group) {
  V.hip.set(leg.sx * DIM.hipX, 0, 0).applyMatrix4(pelvis.matrix);
  V.pole.set(leg.sx * 0.1, 0, 1);
  ik2(V.hip, leg.ankle, DIM.thigh, DIM.shin, V.pole, -1, 0.3, (DIM.thigh + DIM.shin) * 0.995, 0.008);
  leg.thigh.position.copy(V.hip);
  frame(leg.thigh.quaternion, ik.u, ik.n);
  leg.shin.position.copy(ik.mid);
  frame(leg.shin.quaternion, ik.f, ik.n);
}

function curl(arm: ArmRig, grip: readonly number[] | null, relaxed: number) {
  for (let i = 0; i < arm.fingers.length; i++) {
    const c = grip ? grip[i] : relaxed;
    const f = arm.fingers[i];
    f[0].rotation.x = 0.14 + 0.95 * c;
    f[1].rotation.x = 0.18 + 1.05 * c;
    f[2].rotation.x = 0.12 + 0.6 * c;
  }
  const c = grip ? grip[4] : relaxed;
  // Thumb: splayed to its side (Z), then opposed under the palm (Y), then flexed (X).
  arm.thumb[0].rotation.set(0.15 + 0.4 * c, -arm.sx * (0.4 + 0.5 * c), -arm.sx * 0.55);
  arm.thumb[1].rotation.x = 0.15 + 0.55 * c;
}

/**
 * Pose the whole rig for time t.
 *  - imitating arm (rig.reach, the one nearer the demonstrator): IK to the
 *    retargeted, lagged demonstration point (learnerTarget);
 *  - torso / pelvis / other arm: follow and counter the reach with a slight delay;
 *  - head: watches the demonstrator's tool and glances at the own hand whenever
 *    the demonstrator pauses, but stays turned toward `viewer` (world): it turns
 *    at most FACE_TURN away and the visor's light bar slides the rest of the way;
 *  - legs: re-planted under the shifting pelvis; fingers: lagged demonstrated grip.
 * Everything lateral is mirrored by rig.side. Writes the world position of the
 * imitating hand's pinch point to `handOut`.
 */
export function updateHumanoid(
  rig: HumanoidRig,
  st: MotionState,
  t: number,
  dt: number,
  snap: boolean,
  live: boolean,
  layout: SceneLayout,
  viewer: THREE.Vector3 | null,
  handOut: THREE.Vector3,
) {
  // Exponential smoothing factor for this frame (1 = snap).
  stepDt = snap ? Infinity : dt;
  const side = rig.side;
  const root = rig.root;
  root.updateWorldMatrix(true, false);

  // Demonstrator tool (now) and how fast it is moving, in path radii per second.
  armTool(armPose(t - 0.12, q6), layout, b3);
  armTool(armPose(t, q6), layout, a3);
  const speed = Math.hypot(a3[0] - b3[0], a3[1] - b3[1], a3[2] - b3[2]) / (0.12 * Math.max(1e-3, demoRadius(layout)));
  root.worldToLocal(V.tool.set(a3[0], a3[1], a3[2]));

  // Learner target (lagged, retargeted) in world and model space.
  learnerTarget(t, layout, a3);
  V.tgtW.set(a3[0], a3[1], a3[2]);
  root.worldToLocal(V.tgtM.copy(V.tgtW));
  V.home.set(side * Math.abs(HAND_HOME[0]), HAND_HOME[1], HAND_HOME[2]);
  V.tmp.subVectors(V.tgtM, V.home).clampLength(0, MAX_LEAN);
  st.lean.lerp(V.tmp, k(4.5));
  const lean = st.lean;

  const breath = live ? Math.sin(t * 1.35) : 0;
  const sway = live ? Math.sin(t * 0.47) : 0;
  const drift = live ? Math.sin(t * 0.29 + 1.1) : 0;

  // Bearing of the viewer in the model frame (0 = straight ahead).
  let camYaw = 0;
  if (viewer) {
    root.worldToLocal(V.cam.copy(viewer));
    camYaw = clamp(Math.atan2(V.cam.x, V.cam.z), -1.1, 1.1);
  }

  // Gaze: the demonstrator while it moves, the own hand while it rests.
  st.look += ((1 - smoothstep(0.03, 0.3, speed)) * 0.6 - st.look) * k(2.4);
  V.gaze.copy(V.tool).lerp(V.tgtM, st.look);
  const gx = V.gaze.x;
  const gy = V.gaze.y - EYE_HEIGHT;
  const gz = V.gaze.z - 0.03;
  const yawRaw = clamp(Math.atan2(gx, gz), -1.5, 1.5);
  // Soft limit around the viewer: the face follows its target part of the way and saturates at FACE_TURN.
  const yawT = viewer ? camYaw + FACE_TURN * Math.tanh(yawRaw - camYaw) : yawRaw;
  const pitchT = clamp(Math.atan2(gy, Math.hypot(gx, gz)), -0.5, 0.35);
  st.yaw += (yawT - st.yaw) * k(4.2);
  st.pitch += (pitchT - st.pitch) * k(4.2);
  // The light bar leans toward what is being watched, but stays well inside the visor as seen by the viewer.
  st.eye += (clamp((yawRaw - st.yaw) * 0.35, -0.14, 0.14) - st.eye) * k(9);

  // Pelvis: weight rests away from the imitating side, shifts toward the reach, hips counterbalance a forward reach.
  const rest = -side * STANCE_SHIFT;
  const px = rest + sway * 0.012 + lean.x * 0.12;
  const pz = drift * 0.007 - lean.z * 0.1;
  const py = breath * 0.0015 - 0.002 - Math.abs(px - rest) * 0.12 - Math.max(0, -lean.y) * 0.06;
  // Body turn: a touch toward the demonstrator, the chest opened toward the viewer, then into the reach
  // (across the body, or the imitating shoulder driven forward).
  const turn =
    side * STANCE_TURN +
    clamp(camYaw, -0.6, 0.6) * CHEST_OPEN +
    0.18 * (st.yaw - camYaw) +
    lean.x * 0.7 -
    side * lean.z * 0.6;
  const pyaw = turn * 0.35;
  rig.pelvis.position.set(px, DIM.hipY + py, pz);
  rig.pelvis.rotation.set(0, pyaw, (px - rest) * 0.8 - side * 0.012, "YXZ");

  // Torso: leans into the reach, the imitating shoulder rises with the hand, plus breathing.
  const tyaw = turn - pyaw;
  const tpitch = 0.03 + lean.z * 0.4 - lean.y * 0.14 + breath * 0.011;
  const troll = side * (lean.y * 0.3 + 0.02) + sway * 0.01 - (px - rest) * 0.8;
  rig.torso.rotation.set(tpitch, tyaw, troll, "YXZ");

  // Head: stabilised against the torso so the gaze stays on its target.
  rig.head.rotation.set(
    clamp(-st.pitch - tpitch, -0.5, 0.65),
    clamp(st.yaw - tyaw - pyaw, -1.15, 1.15),
    -troll * 0.7,
    "YXZ",
  );
  rig.eye.rotation.y = st.eye;
  const blink = (t + 2.6) % 5.3;
  rig.eye.scale.y = live && blink < 0.14 ? Math.max(0.1, 1 - Math.sin((blink / 0.14) * Math.PI)) : 1;

  rig.torso.updateWorldMatrix(true, false);

  // Imitating arm: pinch point onto the retargeted demonstration point.
  const A = rig.reach;
  rig.torso.worldToLocal(V.T.copy(V.tgtW));
  V.S.set(side * DIM.shoulderX, DIM.shoulderY, 0);
  V.dh.subVectors(V.T, V.S).normalize();
  V.S.addScaledVector(V.dh, 0.016);
  V.S.y += breath * 0.004;
  // Wanted hand pose: fingers forward-and-down like the demonstrator's tool (slightly inward, thumb
  // side raised), eased toward the reach direction.
  V.hy.set(-side * 0.2, -0.72, 0.62).normalize().lerp(V.dh, 0.45).normalize().negate();
  V.xr.set(1, -side * 0.3, 0);
  V.hx.copy(V.xr).addScaledVector(V.hy, -V.xr.dot(V.hy)).normalize();
  V.hz.crossVectors(V.hx, V.hy);
  M.makeBasis(V.hx, V.hy, V.hz);
  Q.want.setFromRotationMatrix(M);
  // Elbow: down, out and back; swings outward as the hand rises past the shoulder.
  const high = smoothstep(-0.12, 0.12, V.T.y - DIM.shoulderY);
  V.pole.set(side * (0.4 + 0.6 * high), -1 + 0.8 * high, -0.5);
  reachArm(A, V.S, V.T, V.pole, Q.want);

  // Other arm: relaxed at the side, drifting against the reach.
  const B = rig.rest;
  V.S.set(-side * DIM.shoulderX, DIM.shoulderY + breath * 0.004, 0);
  V.w.set(
    -side * 0.238 + sway * 0.006,
    -0.105 + breath * 0.005,
    0.07 + drift * 0.012 - lean.z * 0.22 + side * lean.x * 0.1,
  );
  V.pole.set(-side * 0.35, -0.15, -1);
  restArm(B, V.S, V.w, V.pole, -side * 0.85, 0.12);

  // Legs.
  plantLeg(rig.legs.r, rig.pelvis);
  plantLeg(rig.legs.l, rig.pelvis);

  // Fingers: the demonstrated grasp, after the same lag.
  const g = clamp(demoGrip(t - IMIT_LAG), 0, 1);
  for (let i = 0; i < 5; i++) st.grip[i] += (g - st.grip[i]) * k(GRIP_RATE[i]);
  curl(A, st.grip, 0);
  curl(B, null, 0.3 + breath * 0.02);

  A.grip.updateWorldMatrix(true, false);
  handOut.setFromMatrixPosition(A.grip.matrixWorld);
}
