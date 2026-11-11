"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SceneLayout } from "./math";

/** Radius of the arm's working circle in arm-local units (its part nests sit on it). */
const REACH = 1.45;

/**
 * Hairline floor markings inside the arm's cell, drawn just above the deck:
 * the working circle through the part nests with a bearing scale on its
 * outside, and a dashed keep-out ring around the base. (The cell boundary
 * itself is the light line inlaid by the floor shader; the learner draws its
 * own station ring.)
 */
export function GroundMarks({ layout }: { layout: SceneLayout }) {
  const { geo, mat, faintMat, faintGeo } = useMemo(() => {
    const strong: number[] = [];
    const faint: number[] = [];
    const ring = (r: number, out: number[], dashed: boolean, n: number) => {
      for (let i = 0; i < n; i++) {
        if (dashed && i % 2 === 1) continue;
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        out.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r);
      }
    };
    ring(REACH, faint, false, 160);
    ring(0.8, faint, true, 96);
    // Bearing ticks every 10°, longer every 30°
    for (let d = 0; d < 360; d += 10) {
      const a = (d * Math.PI) / 180;
      const r1 = REACH + (d % 30 === 0 ? 0.11 : 0.055);
      strong.push(Math.cos(a) * REACH, 0, Math.sin(a) * REACH, Math.cos(a) * r1, 0, Math.sin(a) * r1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(strong, 3));
    const faintGeo = new THREE.BufferGeometry();
    faintGeo.setAttribute("position", new THREE.Float32BufferAttribute(faint, 3));
    const base = { transparent: true, depthWrite: false, toneMapped: false } as const;
    const mat = new THREE.LineBasicMaterial({ ...base, color: "#afc1d6", opacity: 0.34 });
    const faintMat = new THREE.LineBasicMaterial({ ...base, color: "#8d92c4", opacity: 0.22 });
    return { geo, mat, faintGeo, faintMat };
  }, []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      faintGeo.dispose();
      faintMat.dispose();
    },
    [geo, mat, faintGeo, faintMat],
  );

  return (
    <group position={[layout.arm[0], 0.003, layout.arm[2]]} scale={layout.armScale}>
      <lineSegments geometry={geo} material={mat} renderOrder={-1} />
      <lineSegments geometry={faintGeo} material={faintMat} renderOrder={-1} />
    </group>
  );
}
