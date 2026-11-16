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
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, y));
    col = mix(col, uGround, smoothstep(0.0, -0.35, y));
    col += uHorizon * 0.6 * exp(-y * y * 60.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Product-shot lighting in the site palette, framed for the pathology camera
 * (front, slightly right of the slide, looking down):
 * - cool key from above camera-left (the only shadow caster, high tier),
 * - ice rim from behind so the scanner's silhouette reads against the dark stage,
 * - indigo kicker from the right, a faint burgundy bounce off the stage,
 * plus the same softbox environment the quadruped is lit with.
 */
export function PathologyLights({ quality, target }: { quality: FlankQuality; target: THREE.Object3D }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const high = quality === "high";

  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.position.set(-2.4, 6, 4.0);
    l.target = target;
    const cam = l.shadow.camera;
    cam.left = -2.5;
    cam.right = 2.5;
    cam.top = 2.2;
    cam.bottom = -2.2;
    cam.near = 3;
    cam.far = 13;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.012;
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
          uZenith: { value: new THREE.Color("#1c1e38").multiplyScalar(0.35) },
          uHorizon: { value: new THREE.Color("#6c71a8").multiplyScalar(0.5) },
          uGround: { value: new THREE.Color("#2e0219").multiplyScalar(0.5) },
        },
      }),
    [],
  );
  useEffect(() => () => dome.dispose(), [dome]);

  return (
    <>
      <hemisphereLight args={["#b4c4d9", "#3d0c26", 0.55]} />
      <ambientLight intensity={0.16} color="#8d92c4" />
      <directionalLight ref={key} intensity={2.3} color="#e6edf5" castShadow={high} shadow-mapSize={[1024, 1024]} />
      {/* Rim from behind-left. */}
      <directionalLight position={[-4, 3.2, -4.5]} intensity={3.0} color="#c6d4e6" />
      {/* Indigo kicker from the right. */}
      <directionalLight position={[5, 1.4, -2]} intensity={1.4} color="#8d92c4" />
      {/* Burgundy bounce off the stage under the gantry: the only warm tone on the machine. */}
      <pointLight position={[0.6, 0.12, -0.75]} intensity={0.5} distance={1.5} decay={2} color="#7a2350" />

      <Environment resolution={high ? 256 : 128} frames={1}>
        <mesh scale={40} material={dome}>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
        <Lightformer form="rect" intensity={2.2} color="#d2dde9" position={[0, 7, 0]} scale={[11, 5, 1]} />
        <Lightformer form="rect" intensity={3} color="#e6edf5" position={[-6, 4, 6]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={4} color="#afc1d6" position={[-6, 3, -6]} scale={[1.8, 9, 1]} />
        <Lightformer form="rect" intensity={2} color="#6c71a8" position={[7.5, 1.5, -3]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={2.4} color="#e6edf5" position={[3, 1.1, 8]} scale={[6, 0.22, 1]} />
        <Lightformer form="ring" intensity={0.7} color="#7a2350" position={[0, -3, 5]} scale={4} />
      </Environment>
    </>
  );
}
