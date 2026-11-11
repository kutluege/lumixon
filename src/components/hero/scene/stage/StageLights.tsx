"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { SceneLayout } from "../math";
import { domeFrag, domeVert } from "../shaders";
import { stageOf } from "./stage";

type StageLightsProps = {
  layout: SceneLayout;
  quality: "high" | "low";
};

/**
 * Cinematic three-point rig, in camera terms (the camera sits front-left of
 * the robots):
 * - front key from slightly right of the camera: lights the learner's chest
 *   and face (it is turned toward the arm on its right) and the arm's front
 * - back key ("sun", from behind-right): the brightest light, wraps the top
 *   and right edges as a rim and casts the only shadow map, toward camera-left
 * - low indigo kicker from behind-left, burgundy bounce from the floor
 * plus an environment built for metal: a dark dome with a lit horizon band
 * and a handful of softboxes that give long, crisp highlights.
 */
export function StageLights({ layout, quality }: StageLightsProps) {
  const stage = stageOf(layout);
  const sun = useRef<THREE.DirectionalLight>(null);
  const high = quality === "high";

  // Fit the shadow frustum to the work cell (two robots + their shadows).
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    const { cx, cz, s, sun: dir } = stage;
    const d = 12 * s;
    const n = Math.hypot(dir[0], dir[1], dir[2]);
    l.position.set(cx + (dir[0] / n) * d, 0.9 * s + (dir[1] / n) * d, cz + (dir[2] / n) * d);
    // The target is not in the scene graph, so its world matrix is updated by hand.
    l.target.position.set(cx, 0.9 * s, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    const half = 3.7 * s;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 2 * s;
    cam.far = 24 * s;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.02 * s;
    l.shadow.radius = 3;
  }, [stage, high]);

  const dome = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVert,
        fragmentShader: domeFrag,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uZenith: { value: new THREE.Color("#1c1e38").multiplyScalar(0.35) },
          uHorizon: { value: new THREE.Color("#6c71a8").multiplyScalar(0.55) },
          uGround: { value: new THREE.Color("#2e0219").multiplyScalar(0.6) },
          uBand: { value: new THREE.Color("#afc1d6").multiplyScalar(0.55) },
        },
      }),
    [],
  );
  useEffect(() => () => dome.dispose(), [dome]);

  const { cellA: arm, s } = stage;

  return (
    <>
      <hemisphereLight args={["#b4c4d9", "#3d0c26", 0.5]} />
      <ambientLight intensity={0.18} color="#8d92c4" />
      {/* Front key, slightly right of the camera */}
      <directionalLight position={[2.5, 6.5, 7]} intensity={2.1} color="#e6edf5" />
      {/* Back key + rim; the only shadow caster (placed by the layout effect above) */}
      <directionalLight
        ref={sun}
        intensity={3.3}
        color="#c6d4e6"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
      />
      {/* Low indigo kicker from behind-left */}
      <directionalLight position={[-6, 1.6, -4.5]} intensity={1.5} color="#8d92c4" />
      {/* Burgundy bounce off the deck: the only warm tone in the frame */}
      <pointLight
        position={[arm.x - 1.2 * s, 0.35 * s, arm.z + 1.4 * s]}
        intensity={1.5 * s * s}
        distance={5 * s}
        decay={2}
        color="#7a2350"
      />

      <Environment resolution={high ? 256 : 128} frames={1}>
        <mesh scale={40} material={dome}>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
        {/* Overhead softbox */}
        <Lightformer form="rect" intensity={2.2} color="#d2dde9" position={[0, 7, 0]} scale={[11, 5, 1]} />
        {/* Long front-left strip: the streak along cylinders and shells */}
        <Lightformer form="rect" intensity={3} color="#e6edf5" position={[-6, 4, 6]} scale={[8, 1.2, 1]} />
        {/* Tall back-right strip: crisp rim on every edge facing away from the camera */}
        <Lightformer form="rect" intensity={4.2} color="#afc1d6" position={[7, 3, -5.5]} scale={[1.8, 9, 1]} />
        {/* Indigo wash from behind-left */}
        <Lightformer form="rect" intensity={2.1} color="#6c71a8" position={[-7.5, 1.5, -3]} scale={[4, 6, 1]} />
        {/* Thin low catch-light in front: a hairline across glossy black face plates and lenses */}
        <Lightformer form="rect" intensity={2.4} color="#e6edf5" position={[1.5, 1.1, 8]} scale={[6, 0.22, 1]} />
        {/* Burgundy glow from below */}
        <Lightformer form="ring" intensity={0.7} color="#7a2350" position={[0, -3, 5]} scale={4} />
      </Environment>
    </>
  );
}
