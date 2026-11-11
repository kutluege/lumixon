"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildArm } from "./arm/build";
import { TcpReadout } from "./arm/TcpReadout";
import { ARM_STATIONS, REDUCED_T, type SceneLayout } from "./math";
import { shadowFrag, shadowVert } from "./shaders";

type RobotArmProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
};

const HALF_PI = Math.PI / 2;

/**
 * 6-axis industrial manipulator (the demonstrator) and its small work cell:
 * it picks a turned billet from one nest, presents and rolls it for
 * inspection, places it on the other nest, retracts, then runs the trip back.
 *
 * The model is built procedurally in arm/build.ts (one welded mesh per
 * material per link) and posed here every frame from the taught program in
 * math.ts, which is also what the learner and the overlay read.
 */
export function RobotArm({ layout, quality, reduce }: RobotArmProps) {
  const time = useRef(0);
  const rig = useMemo(() => buildArm(quality), [quality]);

  // Blob contact shadow. The high tier also has real shadow maps (set up by the
  // stage), so there it only adds a soft occlusion core under the base and nests.
  const shadowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shadowVert,
        fragmentShader: shadowFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: quality === "high" ? 0.45 : 0.75 } },
      }),
    [quality],
  );

  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);

  useFrame((_, delta) => {
    if (!reduce) time.current += Math.min(delta, 0.05);
    rig.update(reduce ? REDUCED_T : time.current);
  });

  return (
    <group position={layout.arm} scale={layout.armScale}>
      {/* Contact shadow approximation: base + the two nest columns */}
      <mesh rotation-x={-HALF_PI} position-y={0.004} material={shadowMat}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      {ARM_STATIONS.map((s, i) => (
        <mesh key={i} rotation-x={-HALF_PI} position={[s[0], 0.005, s[2]]} material={shadowMat}>
          <planeGeometry args={[0.7, 0.7]} />
        </mesh>
      ))}
      <primitive object={rig.root} />
      {/* Live tool-centre-point readout (DOM tag over the canvas, tied to the tip) */}
      <TcpReadout layout={layout} reduce={reduce} clock={time} />
    </group>
  );
}
