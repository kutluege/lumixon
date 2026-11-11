"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./math";
import { orbitFrag, orbitVert } from "./shaders";

type OrbitDef = {
  center: Vec3;
  radius: number;
  rotation: Vec3;
  opacity: number;
  dash: number;
  /** Visible window of the track (fraction of the circle) the satellite crosses. */
  sat?: { from: number; span: number; period: number; phase: number };
};

/* Very large, far circles whose tops graze the horizon: ground-track arcs. */
const ORBITS: OrbitDef[] = [
  {
    center: [0, -40, -62],
    radius: 47,
    rotation: [0.05, 0.22, 0.04],
    opacity: 0.3,
    dash: 0,
    sat: { from: 0.17, span: 0.16, period: 46, phase: 0.35 },
  },
  { center: [10, -52, -78], radius: 61, rotation: [-0.04, -0.3, -0.06], opacity: 0.18, dash: 0 },
  { center: [-8, -31, -56], radius: 38.5, rotation: [0, 0.5, 0.09], opacity: 0.22, dash: 220 },
];

const HORIZON = 3.0;

function Orbit({ def, reduce, segments }: { def: OrbitDef; reduce: boolean; segments: number }) {
  const satRef = useRef<THREE.Points>(null);
  const time = useRef(0);
  const world = useMemo(() => new THREE.Vector3(), []);

  const { geo, mat, satGeo, satMat, curve } = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, def.radius, def.radius, 0, Math.PI * 2, false, 0);
    const pts = curve.getSpacedPoints(segments);
    const pos = new Float32Array(pts.length * 3);
    const u = new Float32Array(pts.length);
    pts.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      u[i] = i / segments;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: orbitVert,
      fragmentShader: orbitFrag,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color("#8d92c4") },
        uHot: { value: new THREE.Color("#e6edf5") },
        uOpacity: { value: def.opacity },
        uDash: { value: def.dash },
        uSat: { value: -1 },
        uHorizon: { value: HORIZON },
      },
    });
    const satGeo = new THREE.BufferGeometry();
    satGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    const satMat = new THREE.PointsMaterial({
      color: "#e6edf5",
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { geo, mat, satGeo, satMat, curve };
  }, [def, segments]);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      satGeo.dispose();
      satMat.dispose();
    },
    [geo, mat, satGeo, satMat],
  );

  useFrame((_, delta) => {
    const s = def.sat;
    if (!s) return;
    if (!reduce) time.current += Math.min(delta, 0.05);
    const k = (time.current / s.period + s.phase) % 1;
    const u = s.from + k * s.span;
    mat.uniforms.uSat.value = u;
    const p = curve.getPoint(u);
    const attr = satGeo.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, p.x, p.y, 0);
    attr.needsUpdate = true;
    const pts = satRef.current;
    if (pts) {
      world.set(p.x, p.y, 0);
      pts.localToWorld(world);
      satMat.opacity = Math.min(1, Math.max(0, (world.y - HORIZON - 0.6) / 2.4)) * 0.85;
    }
  });

  return (
    <group position={def.center} rotation={def.rotation}>
      <lineLoop geometry={geo} material={mat} frustumCulled={false} />
      {def.sat ? <points ref={satRef} geometry={satGeo} material={satMat} frustumCulled={false} /> : null}
    </group>
  );
}

export function Orbits({ reduce, quality }: { reduce: boolean; quality: "high" | "low" }) {
  const segments = quality === "high" ? 720 : 360;
  return (
    <group>
      {ORBITS.map((def, i) => (
        <Orbit key={i} def={def} reduce={reduce} segments={segments} />
      ))}
    </group>
  );
}
