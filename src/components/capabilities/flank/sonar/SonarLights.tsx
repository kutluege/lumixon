"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { FlankQuality } from "../contract";

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const domeFrag = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  varying vec3 vDir;
  void main() {
    float y = vDir.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.8, y));
    col = mix(col, uGround, smoothstep(0.0, -0.35, y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Underwater lighting in the page palette, framed for the sonar camera (in
 * front of and above the scene):
 * - cool key straight down from the surface, a little toward the camera (the
 *   only shadow caster, high tier, framed on the tripod),
 * - strong ice rim from behind so the swimmer and the tripod separate from the navy,
 * - indigo fill from the open-water side, a faint burgundy bounce at the tripod,
 * plus a softbox environment (bright overhead: the surface) for the pearl
 * clear-coat and the steel.
 */
export function SonarLights({ quality, target }: { quality: FlankQuality; target: THREE.Object3D }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const high = quality === "high";

  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.position.copy(target.position).add(new THREE.Vector3(-2.6, 8, 3.2));
    l.target = target;
    const cam = l.shadow.camera;
    cam.left = -1.7;
    cam.right = 1.7;
    cam.top = 1.7;
    cam.bottom = -1.7;
    cam.near = 4;
    cam.far = 13;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.015;
    l.shadow.radius = 5;
  }, [target, high]);

  const dome = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVert,
        fragmentShader: domeFrag,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uZenith: { value: new THREE.Color("#6c71a8").multiplyScalar(0.55) },
          uHorizon: { value: new THREE.Color("#2a3058").multiplyScalar(0.6) },
          uGround: { value: new THREE.Color("#141830").multiplyScalar(0.5) },
        },
      }),
    [],
  );
  useEffect(() => () => dome.dispose(), [dome]);

  return (
    <>
      <hemisphereLight args={["#b4c4d9", "#1b1f3a", 0.7]} />
      <ambientLight intensity={0.2} color="#8d92c4" />
      <directionalLight ref={key} intensity={2.4} color="#e6edf5" castShadow={high} shadow-mapSize={[1024, 1024]} />
      {/* Rim from behind (camera looks toward -z). */}
      <directionalLight position={[-3.5, 4.5, -8]} intensity={3.0} color="#c6d4e6" />
      {/* Indigo fill from the open-water side. */}
      <directionalLight position={[-7, 2, 3]} intensity={1.2} color="#8d92c4" />
      {/* Burgundy bounce low at the tripod: the only warm tone on the machine. */}
      <pointLight position={[target.position.x - 0.5, 0.15, target.position.z + 0.5]} intensity={0.7} distance={1.6} decay={2} color="#7a2350" />

      <Environment resolution={high ? 256 : 128} frames={1}>
        <mesh scale={40} material={dome}>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
        <Lightformer form="rect" intensity={2.4} color="#d2dde9" position={[0, 8, 0]} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={3} color="#e6edf5" position={[-6, 4, 6]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={4} color="#afc1d6" position={[-5, 3, -7]} scale={[2, 9, 1]} />
        <Lightformer form="rect" intensity={2} color="#6c71a8" position={[8, 1.5, -2]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#e6edf5" position={[3, 1.2, 8]} scale={[6, 0.25, 1]} />
        <Lightformer form="ring" intensity={0.7} color="#7a2350" position={[0, -3, 5]} scale={4} />
      </Environment>
    </>
  );
}
