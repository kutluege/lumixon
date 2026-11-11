"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { SCAN_STILL, scanFront, type SceneLayout } from "../math";
import { floorFrag, floorVert } from "../shaders";
import { REFLECT_LAYER, stageOf } from "./stage";

type StageFloorProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
};

const HALF_PI = Math.PI / 2;
/** Strength of the mirror image in the deck (high quality only). */
const REFLECTION = 0.5;
/** Opacity of the cast shadows on the deck (high quality only). */
const SHADOW = 0.5;

function floorUniforms() {
  return {
    // Required by three's Reflector (unused on the low tier).
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uReflect: { value: REFLECTION },
    uBase: { value: new THREE.Color("#070912") },
    uSheen: { value: new THREE.Color("#6c71a8") },
    uIce: { value: new THREE.Color("#afc1d6") },
    uIndigo: { value: new THREE.Color("#8d92c4") },
    uCellA: { value: new THREE.Vector3() },
    uCellB: { value: new THREE.Vector3() },
    uScale: { value: 1 },
    uScan: { value: SCAN_STILL },
    uOpacity: { value: 0.92 },
  };
}

/**
 * The work-cell floor: a dark polished deck at y = 0 (flush with everything
 * the robots stand on) that grounds both robots and melts into the
 * point-cloud terrain at its rim; the cell boundary is inlaid as a light line.
 * - high: planar reflection of the robots (three's Reflector, 512² target,
 *   only objects on REFLECT_LAYER) and a soft shadow catcher.
 * - low: the same deck shader without reflection or shadow maps.
 */
export function StageFloor({ layout, quality, reduce }: StageFloorProps) {
  const camera = useThree((s) => s.camera);
  const time = useRef(0);
  const stage = stageOf(layout);
  const high = quality === "high";

  const geo = useMemo(() => new THREE.CircleGeometry(1, 96), []);
  useEffect(() => () => geo.dispose(), [geo]);

  const floor = useMemo(() => {
    const shader = { name: "StageFloor", uniforms: floorUniforms(), vertexShader: floorVert, fragmentShader: floorFrag };
    let mesh: THREE.Mesh;
    let dispose: () => void;
    if (high) {
      const reflector = new Reflector(geo, { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: 0.003, shader });
      (reflector.material as THREE.ShaderMaterial).defines = { USE_REFLECTION: "" };
      // The floor shader blurs the mirror by sampling the target's mip chain.
      const mirror = reflector.getRenderTarget().texture;
      mirror.generateMipmaps = true;
      mirror.minFilter = THREE.LinearMipmapLinearFilter;
      // The mirror is soft and faint, so refreshing it every other frame is invisible
      // and halves its cost. Static (on-demand) frames always refresh.
      const refresh = reflector.onBeforeRender;
      let frame = 0;
      reflector.onBeforeRender = function (renderer, scene, cam, geometry, material, group) {
        if (reflector.userData.still || frame++ % 2 === 0) refresh.call(this, renderer, scene, cam, geometry, material, group);
      };
      mesh = reflector;
      dispose = () => reflector.dispose();
    } else {
      const material = new THREE.ShaderMaterial(shader);
      mesh = new THREE.Mesh(geo, material);
      dispose = () => material.dispose();
    }
    const mat = mesh.material as THREE.ShaderMaterial;
    mat.transparent = true;
    mat.depthWrite = false;
    mesh.renderOrder = -4;
    mesh.rotation.x = -HALF_PI;
    return { mesh, mat, dispose };
  }, [geo, high]);
  useEffect(() => () => floor.dispose(), [floor]);

  // The mirror pass only sees what was tagged for it (the robots and the lights).
  useEffect(() => {
    if (floor.mesh instanceof Reflector) floor.mesh.getReflectionCamera(camera).layers.set(REFLECT_LAYER);
  }, [floor, camera]);

  useLayoutEffect(() => {
    const u = floor.mat.uniforms;
    u.uCellA.value.set(stage.cellA.x, stage.cellA.z, stage.cellA.r);
    u.uCellB.value.set(stage.cellB.x, stage.cellB.z, stage.cellB.r);
    u.uScale.value = stage.s;
    floor.mesh.position.set(stage.cx, 0, stage.cz);
    floor.mesh.scale.set(stage.radius, stage.radius, 1);
    floor.mesh.userData.still = reduce;
  }, [floor, stage, reduce]);

  // Shadow catcher: three's ShadowMaterial, patched to fade out with the deck's rim.
  const shadowMat = useMemo(() => {
    const m = new THREE.ShadowMaterial({ color: "#02030a", opacity: SHADOW, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vDeck;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDeck = position.xy;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vDeck;")
        .replace(
          "opacity * ( 1.0 - getShadowMask() )",
          "opacity * ( 1.0 - getShadowMask() ) * ( 1.0 - smoothstep( 0.5, 1.0, length( vDeck ) ) )",
        );
    };
    return m;
  }, []);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);

  useFrame((_, delta) => {
    if (!reduce) time.current += Math.min(delta, 0.05);
    floor.mat.uniforms.uScan.value = reduce ? SCAN_STILL : scanFront(time.current);
  });

  return (
    <group>
      <primitive object={floor.mesh} />
      {high ? (
        <mesh
          geometry={geo}
          material={shadowMat}
          rotation-x={-HALF_PI}
          position={[stage.cx, 0.0015, stage.cz]}
          scale={[stage.radius, stage.radius, 1]}
          renderOrder={-3}
          receiveShadow
        />
      ) : null}
    </group>
  );
}
