"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { CameraRig } from "./CameraRig";
import { GroundMarks } from "./GroundMarks";
import { Humanoid, type ImitationLink } from "./Humanoid";
import { Imitation } from "./Imitation";
import { LAYOUT_TALL, LAYOUT_WIDE } from "./math";
import { Orbits } from "./Orbits";
import { RobotArm } from "./RobotArm";
import { Atmosphere } from "./stage/Atmosphere";
import { REFLECT_LAYER } from "./stage/stage";
import { StageFloor } from "./stage/StageFloor";
import { StageLights } from "./stage/StageLights";
import { Terrain } from "./Terrain";

export type HeroSceneProps = {
  /** false → frameloop "never" (offscreen or tab hidden). */
  active: boolean;
  reduce: boolean;
  quality: "high" | "low";
  parallax: boolean;
  progress: MotionValue<number>;
  onReady: () => void;
};

/**
 * Two-zone hero (copy column on the left, robots beside it): landscape from md
 * up. Same query as the `hero-wide` variant in globals.css, so the scene layout
 * always matches the copy's arrangement; everything else stacks (tall layout).
 */
const HERO_WIDE_QUERY = "(min-width: 768px) and (min-aspect-ratio: 11/10)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(HERO_WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getWide = () => window.matchMedia(HERO_WIDE_QUERY).matches;
const getWideServer = () => true;

/** Solid, lit geometry: the only things that should cast / receive shadow maps. */
function isSolid(material: THREE.Material | THREE.Material[]) {
  const m = Array.isArray(material) ? material[0] : material;
  if (!m || m.transparent || !m.depthWrite) return false;
  return !(m as THREE.ShaderMaterial).isShaderMaterial;
}

function SceneContents({ reduce, quality, parallax, progress }: Omit<HeroSceneProps, "active" | "onReady">) {
  const wide = useSyncExternalStore(subscribeWide, getWide, getWideServer);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const layout = wide ? LAYOUT_WIDE : LAYOUT_TALL;
  const link = useMemo<ImitationLink>(() => ({ hand: new THREE.Vector3() }), []);
  const actors = useRef<THREE.Group>(null);

  // Staging hooks into the robots without touching their components: everything
  // under `actors` is mirrored in the floor, its solid meshes take part in the
  // shadow map, and every light also lights the mirror pass.
  useEffect(() => {
    const shadows = quality === "high";
    actors.current?.traverse((o) => {
      o.layers.enable(REFLECT_LAYER);
      const mesh = o as THREE.Mesh;
      if (shadows && mesh.isMesh && isSolid(mesh.material)) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(REFLECT_LAYER);
    });
    invalidate();
  }, [layout, quality, reduce, scene, invalidate]);

  return (
    <>
      <CameraRig layout={layout} progress={progress} reduce={reduce} parallax={parallax} />
      <StageLights layout={layout} quality={quality} />

      <Orbits reduce={reduce} quality={quality} />
      <Atmosphere layout={layout} quality={quality} reduce={reduce} />
      <StageFloor layout={layout} quality={quality} reduce={reduce} />
      <Terrain layout={layout} quality={quality} reduce={reduce} />
      <GroundMarks layout={layout} />

      <group ref={actors}>
        <RobotArm layout={layout} quality={quality} reduce={reduce} />
        <Humanoid layout={layout} quality={quality} reduce={reduce} link={link} />
        <Imitation layout={layout} quality={quality} reduce={reduce} link={link} />
      </group>
    </>
  );
}

export default function HeroScene({ active, reduce, quality, parallax, progress, onReady }: HeroSceneProps) {
  return (
    <Canvas
      aria-hidden
      dpr={quality === "high" ? [1, 1.75] : [1, 1.5]}
      frameloop={!active ? "never" : reduce ? "demand" : "always"}
      // Soft PCF shadow map on the high tier only (the low tier keeps the robots' blob shadows).
      shadows={quality === "high" ? "percentage" : false}
      gl={{
        antialias: quality === "high",
        alpha: true,
        stencil: false,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 34, near: 0.1, far: 240, position: LAYOUT_WIDE.cam }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // Filmic (ACES, R3F's default) with a touch more exposure for the dark set.
        gl.toneMappingExposure = 1.06;
        onReady();
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <SceneContents reduce={reduce} quality={quality} parallax={parallax} progress={progress} />
    </Canvas>
  );
}
