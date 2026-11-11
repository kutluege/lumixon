"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneLayout } from "../math";
import { glowFrag, glowVert, motesFrag, motesVert } from "../shaders";
import { stageOf } from "./stage";

type AtmosphereProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
};

/**
 * Restrained air around the work cell:
 * - a soft haze halo behind the robots (one additive billboard), so the dark
 *   indigo arm separates from the indigo sky and the rim light has something
 *   to sit against;
 * - a few dust motes drifting through the lit volume, animated on the GPU.
 */
export function Atmosphere({ layout, quality, reduce }: AtmosphereProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const time = useRef(0);
  const stage = stageOf(layout);
  const count = quality === "high" ? 64 : 30;

  const glow = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: new THREE.Vector2(7.6 * stage.s, 4.8 * stage.s) },
        uInner: { value: new THREE.Color("#afc1d6") },
        uOuter: { value: new THREE.Color("#6c71a8") },
        uOpacity: { value: 0.18 },
      },
    });
    return { geo, mat };
  }, [stage]);

  const motes = useMemo(() => {
    // Volume around the stage centre, in world units (the shader animates world-scale offsets).
    const bx = 3.4 * stage.s;
    const by = 3.3 * stage.s;
    const bz = 2.5 * stage.s;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    let k = 90210;
    const rand = () => {
      k = (k * 16807) % 2147483647;
      return k / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 2 * bx;
      pos[i * 3 + 1] = rand() * by;
      pos[i * 3 + 2] = (rand() - 0.5) * 2 * bz;
      for (let j = 0; j < 4; j++) seed[i * 4 + j] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: motesVert,
      fragmentShader: motesFrag,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: 1 },
        uScale: { value: stage.s },
        uHeight: { value: by },
        uColor: { value: new THREE.Color("#d2dde9") },
        uOpacity: { value: 0.34 },
      },
    });
    return { geo, mat };
  }, [count, stage]);

  useEffect(
    () => () => {
      glow.geo.dispose();
      glow.mat.dispose();
    },
    [glow],
  );
  useEffect(
    () => () => {
      motes.geo.dispose();
      motes.mat.dispose();
    },
    [motes],
  );

  useFrame((_, delta) => {
    if (!reduce) time.current += Math.min(delta, 0.05);
    motes.mat.uniforms.uTime.value = time.current;
    motes.mat.uniforms.uPR.value = dpr;
  });

  return (
    <group>
      <mesh
        geometry={glow.geo}
        material={glow.mat}
        position={[stage.cx, 1.2 * stage.s, stage.cz - 2.4 * stage.s]}
        frustumCulled={false}
        renderOrder={-5}
      />
      <points
        geometry={motes.geo}
        material={motes.mat}
        position={[stage.cx, 0.05 * stage.s, stage.cz]}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
}
