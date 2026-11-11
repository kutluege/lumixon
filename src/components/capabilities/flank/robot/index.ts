import * as THREE from "three";
import type { CreateQuadruped, FlankQuality, Quadruped, QuadrupedStyle } from "../contract";
import {
  buildAbduction,
  buildBody,
  buildHead,
  buildShank,
  buildThigh,
  bakeField,
  bakeTwin,
  HEAD_X,
  HEAD_Y,
  LIDAR,
  type Bins,
} from "./build";
import { bodyAt, footAt, HIP_OFF, HIP_X, HIP_Z, L1, L2, LEGS, solveLeg, type BodyPose } from "./gait";
import { makeFieldMaterials, makeTwinMaterials, type TwinMaterials } from "./materials";

export { GAIT, STEP, LEGS, footAt, bodyAt, legPhase, fract, HIP_Y, FOOT_R, type BodyPose, type LegDef } from "./gait";
export { FatLines } from "./fatlines";
export { glowBlend } from "./materials";

export type QuadrupedLeg = {
  abd: THREE.Group;
  thigh: THREE.Group;
  shank: THREE.Group;
  /** Empty at the foot centre (rides on the shank). */
  foot: THREE.Object3D;
};

/** The contract's rig plus handles the research scene uses for instrumentation. */
export type QuadrupedRig = Quadruped & {
  body: THREE.Group;
  head: THREE.Group;
  legs: QuadrupedLeg[];
  /** Twin only: overall brightness of shells and lines (ghost poses). */
  setFade(f: number): void;
  /** Twin only: height (model space) of the travelling scan band; < -1 hides it. */
  setScan(y: number): void;
};

/**
 * Build the quadruped. Walks toward +X; `update(t, stride)` poses body, head
 * and legs for absolute time and distance walked (stance feet stay planted in
 * world space as long as the caller moves `group` by `stride` along +X, or
 * scrolls the world backward by the same amount).
 */
export function buildQuadruped(opts: { style: QuadrupedStyle; quality: FlankQuality }): QuadrupedRig {
  const { style, quality } = opts;
  const trash: THREE.BufferGeometry[] = [];
  const field = style === "field" ? makeFieldMaterials(quality) : null;
  const twin: TwinMaterials | null = style === "twin" ? makeTwinMaterials(quality) : null;
  const bake = (parent: THREE.Object3D, b: Bins) => {
    if (field) bakeField(parent, b, field, trash);
    else if (twin) bakeTwin(parent, b, twin, trash);
    return parent;
  };

  const group = new THREE.Group();
  group.name = "quadruped";
  const body = new THREE.Group();
  body.rotation.order = "YXZ";
  group.add(body);
  bake(body, buildBody(quality));

  const head = new THREE.Group();
  head.rotation.order = "YXZ";
  head.position.set(HEAD_X, HEAD_Y, 0);
  body.add(head);
  bake(head, buildHead(quality));
  const sensor = new THREE.Object3D();
  sensor.name = "sensor";
  sensor.position.copy(LIDAR);
  head.add(sensor);

  const legs: QuadrupedLeg[] = LEGS.map((def) => {
    const abd = new THREE.Group();
    abd.position.set(def.fore * HIP_X, 0, def.side * HIP_Z);
    body.add(abd);
    bake(abd, buildAbduction(quality, def.fore, def.side));
    const thigh = new THREE.Group();
    thigh.position.set(0, 0, def.side * HIP_OFF);
    abd.add(thigh);
    bake(thigh, buildThigh(quality, def.side));
    const shank = new THREE.Group();
    shank.position.set(0, -L1, 0);
    thigh.add(shank);
    bake(shank, buildShank(quality));
    const foot = new THREE.Object3D();
    foot.position.set(0, -L2, 0);
    shank.add(foot);
    return { abd, thigh, shank, foot };
  });

  if (field) {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  // Scratch state (no per-frame allocation).
  const pose: BodyPose = { y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 };
  const foot = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const angles = new Float32Array(3);

  const update = (t: number, stride: number) => {
    bodyAt(stride, t, pose);
    body.position.set(0, pose.y, pose.z);
    body.rotation.set(pose.roll, pose.yaw, pose.pitch);
    body.updateMatrix();
    inv.copy(body.matrix).invert();

    // Head: cancels body pitch/roll (stabilised gimbal) and scans slowly.
    head.rotation.set(-pose.roll, -pose.yaw + 0.09 * Math.sin(t * 0.45) + 0.03 * Math.sin(t * 1.3), -pose.pitch + 0.025 * Math.sin(t * 0.6));

    for (let i = 0; i < LEGS.length; i++) {
      const def = LEGS[i];
      const leg = legs[i];
      footAt(def, stride, foot);
      foot.applyMatrix4(inv);
      solveLeg(def.side, foot.x - leg.abd.position.x, foot.y - leg.abd.position.y, foot.z - leg.abd.position.z, angles);
      leg.abd.rotation.x = angles[0];
      leg.thigh.rotation.z = angles[1];
      leg.shank.rotation.z = angles[2];
    }
  };

  const setFade = (f: number) => {
    if (!twin) return;
    twin.shell.uniforms.uOpacity.value = f;
    twin.lineMain.opacity = 0.85 * f;
    twin.lineMech.opacity = 0.8 * f;
    twin.lineHot.opacity = f;
    if (twin.glowMain) twin.glowMain.opacity = 0.09 * f;
    if (twin.hiddenMain) twin.hiddenMain.opacity = 0.13 * f;
    if (twin.hiddenMech) twin.hiddenMech.opacity = 0.1 * f;
  };
  const setScan = (y: number) => {
    if (twin) twin.shell.uniforms.uScan.value = y;
  };

  const dispose = () => {
    trash.forEach((g) => g.dispose());
    trash.length = 0;
    if (field) Object.values(field).forEach((m) => m.dispose());
    if (twin) twin.all.forEach((m) => m.dispose());
  };

  update(0, 0);
  return { group, sensor, update, dispose, body, head, legs, setFade, setScan };
}

export const createQuadruped: CreateQuadruped = (opts) => buildQuadruped(opts);
