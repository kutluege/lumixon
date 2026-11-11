"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createMotionState, updateHumanoid } from "./humanoid/animate";
import { buildHumanoid } from "./humanoid/build";
import { blobFrag, blobVert } from "./humanoid/shaders";
import { HUMANOID_GLOW, makeHumanoidMaterials } from "./materials";
import { learnerSide, REDUCED_T, type SceneLayout } from "./math";

/** Shared between the learner and the retargeting overlay (world space). */
export type ImitationLink = {
  /** Pinch point of the learner's imitating hand. */
  hand: THREE.Vector3;
};

type HumanoidProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
  link: ImitationLink;
};

const HALF_PI = Math.PI / 2;

/**
 * The learner: a procedurally surfaced humanoid (humanoid/build.ts) that
 * watches the industrial arm and reproduces its tool path with the hand
 * nearer the arm after a short lag (humanoid/animate.ts): full-arm IK with a rolling
 * forearm and bending wrist, the torso and hips turning into the reach,
 * re-planted legs, a head that follows the demonstrator and glances back at
 * its own hand while keeping its face toward the camera, breathing, and fingers that close with the demonstrated grasp.
 */
export function Humanoid({ layout, quality, reduce, link }: HumanoidProps) {
  const time = useRef(0);
  const primed = useRef(false);
  const state = useRef(createMotionState());

  const mats = useMemo(() => makeHumanoidMaterials(quality), [quality]);
  // The hand nearer the demonstrator imitates; the rig (stance, arm roles) is mirrored to match.
  const side = learnerSide(layout);
  const rig = useMemo(() => buildHumanoid(mats, quality, side), [mats, quality, side]);

  const ground = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const shadow = (opacity: number) =>
      new THREE.ShaderMaterial({
        vertexShader: blobVert,
        fragmentShader: blobFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: opacity } },
      });
    // The high tier also gets real shadow maps from the stage, so the blobs only add contact darkening there.
    const k = quality === "high" ? 0.75 : 1;
    return { plane, body: shadow(0.55 * k), foot: shadow(0.55 * k), glow: new THREE.Color(HUMANOID_GLOW) };
  }, [quality]);

  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useEffect(
    () => () => {
      ground.plane.dispose();
      ground.body.dispose();
      ground.foot.dispose();
    },
    [ground],
  );

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    if (!reduce) time.current += dt;
    const t = reduce ? REDUCED_T : time.current;
    const snap = reduce || !primed.current;
    primed.current = true;
    const st = state.current;
    updateHumanoid(rig, st, t, dt, snap, !reduce, layout, camera.position, link.hand);
    // Light bar + status pill: slow breathing, brighter while the grasp is closed.
    const pulse = reduce ? 0.94 : 0.8 + 0.08 * Math.sin(t * 1.35) + 0.14 * st.grip[4];
    mats.glow.color.copy(ground.glow).multiplyScalar(pulse);
  });

  const { r, l } = rig.legs;

  return (
    <group position={layout.humanoid} rotation-y={layout.humanoidYaw} scale={layout.humanoidScale}>
      {/* Contact shadows: one soft body blob, a tighter one under each foot. */}
      <mesh geometry={ground.plane} material={ground.body} rotation-x={-HALF_PI} position={[0, 0.004, 0.03]} scale={[1.0, 0.86, 1]} />
      {[r, l].map((leg) => (
        <mesh
          key={leg.sx}
          geometry={ground.plane}
          material={ground.foot}
          rotation={[-HALF_PI, 0, leg.foot.rotation.y]}
          position={[leg.ankle.x, 0.006, leg.ankle.z + 0.04]}
          scale={[0.2, 0.36, 1]}
        />
      ))}
      <primitive object={rig.root} />
    </group>
  );
}
