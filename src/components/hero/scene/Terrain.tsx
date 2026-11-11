"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SCAN_STILL, scanFront, smoothstep, terrainHeight, type SceneLayout } from "./math";
import { profileFrag, profileVert, terrainPointsFrag, terrainPointsVert } from "./shaders";
import { stageOf } from "./stage/stage";

type TerrainProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
};

/**
 * LiDAR / DEM-style terrain: a raster-ordered point cloud (rows read as scan
 * lines) plus sparse hairline cross-section profiles, both lit by a pushbroom
 * scan front. The cloud thins out to nothing over the work-cell floor so the
 * robots stand on a clean deck.
 */
export function Terrain({ layout, quality, reduce }: TerrainProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const time = useRef(0);
  const stage = stageOf(layout);

  const { pointsGeo, profileGeo } = useMemo(() => {
    const [x0, x1, z0, z1] = layout.extent;
    const { cx, cz, radius, flat } = stage;
    const height = (x: number, z: number) => terrainHeight(x, z, cx, cz, flat);
    /** 0 on the deck, 1 outside it. */
    const offDeck = (x: number, z: number) => smoothstep(radius * 0.5, radius * 0.95, Math.hypot(x - cx, z - cz));

    const cols = quality === "low" ? 120 : 300;
    const rows = quality === "low" ? 150 : 190;
    const dx = (x1 - x0) / (cols - 1);
    const dz = (z1 - z0) / (rows - 1);

    const pos = new Float32Array(cols * rows * 3);
    const rnd = new Float32Array(cols * rows);
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Free along the row, tight across it: the cloud keeps a raster order.
        const x = x0 + c * dx + (rand() - 0.5) * dx * 0.85;
        const z = z0 + r * dz + (rand() - 0.5) * dz * 0.45;
        const k = rand();
        if (rand() > offDeck(x, z)) continue;
        pos[n * 3] = x;
        pos[n * 3 + 1] = height(x, z);
        pos[n * 3 + 2] = z;
        rnd[n] = k;
        n++;
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, n * 3), 3));
    pg.setAttribute("aRnd", new THREE.BufferAttribute(rnd.slice(0, n), 1));

    // Cross-section profiles every ~1.45 units of depth.
    const step = quality === "low" ? 0.32 : 0.26;
    const profileZ: number[] = [];
    for (let z = z0 + 2; z < z1 - 0.5; z += 1.45) profileZ.push(z);
    const segs = Math.floor((x1 - x0) / step);
    const lp = new Float32Array(profileZ.length * segs * 6);
    const lm = new Float32Array(profileZ.length * segs * 2);
    let j = 0;
    for (const z of profileZ) {
      let px = x0;
      let py = height(px, z) + 0.01;
      let pm = offDeck(px, z);
      for (let s = 1; s <= segs; s++) {
        const nx = x0 + s * step;
        const ny = height(nx, z) + 0.01;
        const nm = offDeck(nx, z);
        lp.set([px, py, z, nx, ny, z], j * 6);
        lm[j * 2] = pm;
        lm[j * 2 + 1] = nm;
        j++;
        px = nx;
        py = ny;
        pm = nm;
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    lg.setAttribute("aMask", new THREE.BufferAttribute(lm, 1));
    return { pointsGeo: pg, profileGeo: lg };
  }, [layout, quality, stage]);

  const pointsMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: terrainPointsVert,
        fragmentShader: terrainPointsFrag,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uScan: { value: SCAN_STILL },
          uRange: { value: 38 },
          uSize: { value: 1.55 },
          uPR: { value: 1 },
          uOpacity: { value: 1 },
          uLow: { value: new THREE.Color("#5a5f96") },
          uHigh: { value: new THREE.Color("#b4c6dc") },
          uIce: { value: new THREE.Color("#afc1d6") },
          uHot: { value: new THREE.Color("#e6edf5") },
          uDeep: { value: new THREE.Color("#a3466f") },
        },
      }),
    [],
  );

  const profileMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: profileVert,
        fragmentShader: profileFrag,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uScan: { value: SCAN_STILL },
          uRange: { value: 38 },
          uColor: { value: new THREE.Color("#8d92c4") },
          uOpacity: { value: 0.3 },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      pointsGeo.dispose();
      profileGeo.dispose();
    },
    [pointsGeo, profileGeo],
  );
  useEffect(
    () => () => {
      pointsMat.dispose();
      profileMat.dispose();
    },
    [pointsMat, profileMat],
  );

  useFrame((state, delta) => {
    if (!reduce) time.current += Math.min(delta, 0.05);
    const scan = reduce ? SCAN_STILL : scanFront(time.current);
    // The camera backs off on narrow viewports: fade relative to how far the tile reaches from it.
    const range = Math.max(24, state.camera.position.z - layout.extent[2]);
    pointsMat.uniforms.uScan.value = scan;
    pointsMat.uniforms.uRange.value = range;
    pointsMat.uniforms.uPR.value = dpr;
    profileMat.uniforms.uScan.value = scan;
    profileMat.uniforms.uRange.value = range;
  });

  // Sits a hair above the floor. renderOrder goes on the leaves (a group's own
  // renderOrder would sort its children ahead of everything else, floor included).
  return (
    <group position-y={0.008}>
      <points geometry={pointsGeo} material={pointsMat} frustumCulled={false} renderOrder={-2} />
      <lineSegments geometry={profileGeo} material={profileMat} frustumCulled={false} renderOrder={-2} />
    </group>
  );
}
