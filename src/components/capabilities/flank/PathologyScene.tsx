"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { flankForcedTime, type FlankSceneProps } from "./contract";
import { PathologyLights } from "./pathology/PathologyLights";
import { buildPathoWorld } from "./pathology/build";
import {
  clamp01,
  headPose,
  LOOP,
  smoothstep,
  T_CONTOUR0,
  T_CONTOUR1,
  T_FADE0,
  T_FADE1,
  T_LIFT0,
  T_LIFT1,
  T_LOCK0,
  T_LOCK1,
  T_REFINE0,
  T_REFINE1,
  Y_OVERLAY,
  type HeadPose,
} from "./pathology/model";
import { buildScanner } from "./pathology/scanner";

/** Clock value the scene opens on: mid-scan, a third of the analysis layer already built. */
const START_T = 5.6;
/** Reduced motion: the finished analysis, the flag bracket locked on. */
const STILL_T = 19.2;

/** Camera framing at a square panel (index 0) and at 3:2 (index 1); in between is interpolated. */
const LOOK = [new THREE.Vector3(0.29, 0.22, -0.39), new THREE.Vector3(0.07, 0.3, -0.46)] as const;
const YAW = [0.86, 0.34] as const;
const ELEV = [0.96, 0.78] as const;
/** Distance at a square panel and from 4:3 up (there the panel height sets the frame). */
const DIST = [7.3, 6.15] as const;

/**
 * Row 2, "digital pathology": whole-slide image analysis. A scan head rasters
 * over a glass slide carrying an H&E-stained tissue section; behind it the
 * image-pyramid tiles light up, nuclei are detected and marked, patch scores
 * resolve into a heatmap with a contour, and a bracket flags the suspicious
 * region. Then the layer fades and the next pass begins.
 */
export default function PathologyScene({ quality, reduce }: FlankSceneProps) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const clock = useRef(START_T);

  const world = useMemo(() => buildPathoWorld(quality), [quality]);
  useEffect(() => () => world.dispose(), [world]);

  const scanner = useMemo(() => buildScanner(quality), [quality]);
  useEffect(() => () => scanner.dispose(), [scanner]);

  // Key-light target: the middle of the slide.
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0.15, 0, -0.3);
    return o;
  }, []);

  // The solid scanner parts cast (high tier) the only shadow map, onto a catcher on the stage.
  useEffect(() => {
    const cast = quality === "high";
    scanner.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = cast && !(m.material as THREE.Material).transparent;
    });
    invalidate();
  }, [scanner, quality, invalidate]);

  const tmp = useMemo(
    () => ({
      res: new THREE.Vector2(),
      look: new THREE.Vector3(),
      pose: { x: 0, z: 0, retract: 1, lamp: 0 } as HeadPose,
    }),
    [],
  );

  useFrame((_, delta) => {
    const forced = flankForcedTime();
    if (!reduce && forced === null) clock.current += Math.min(delta, 0.05);
    const tAbs = forced ?? (reduce ? STILL_T : clock.current);
    const t = ((tAbs % LOOP) + LOOP) % LOOP;
    const u = world.uniforms;

    const pose = headPose(t, tmp.pose);
    scanner.update(pose);

    // Camera: more diagonal and further back on narrow panels so the whole slide and the
    // gantry stay in frame; a slow orbit drift keeps the glass reflections alive.
    const aspect = size.width / Math.max(1, size.height);
    const wide = THREE.MathUtils.clamp((aspect - 1.0) / 0.5, 0, 1);
    const drift = reduce ? 0 : 1;
    const yaw = THREE.MathUtils.lerp(YAW[0], YAW[1], wide) + drift * 0.045 * Math.sin(tAbs * 0.21);
    const elev = THREE.MathUtils.lerp(ELEV[0], ELEV[1], wide) + drift * 0.02 * Math.sin(tAbs * 0.16 + 1.3);
    // Taller-than-wide panels (not expected) back off so the slide still fits the width.
    const dist = THREE.MathUtils.lerp(DIST[0], DIST[1], Math.min(1, wide * 1.5)) * Math.max(1, 1 / aspect);
    tmp.look.lerpVectors(LOOK[0], LOOK[1], wide);
    const cam = camRef.current;
    if (cam) {
      const ce = Math.cos(elev);
      cam.position.set(tmp.look.x + Math.sin(yaw) * ce * dist, tmp.look.y + Math.sin(elev) * dist, tmp.look.z + Math.cos(yaw) * ce * dist);
      cam.lookAt(tmp.look);
      // The softbox reflected in the glass sits where this camera sees the middle of the slide.
      const sd = u.uStripDir.value;
      u.uStripC.value = -Math.sin(yaw) * ce * sd.x + Math.sin(elev) * sd.y - Math.cos(yaw) * ce * sd.z;
    }

    u.uT.value = t;
    u.uHead.value.set(pose.x, Y_OVERLAY, pose.z);
    u.uLamp.value = pose.lamp;
    u.uLayer.value = 1 - smoothstep(T_FADE0, T_FADE1, t);
    u.uRefine.value = smoothstep(T_REFINE0, T_REFINE1, t);
    u.uContour.value = clamp01((t - T_CONTOUR0) / (T_CONTOUR1 - T_CONTOUR0));
    u.uLock.value = clamp01((t - T_LOCK0) / (T_LOCK1 - T_LOCK0));
    u.uLift.value = smoothstep(T_LIFT0, T_LIFT1, t);
    world.setLift(u.uLift.value, u.uLayer.value);
    u.uFadeC.value.set(tmp.look.x, tmp.look.z);
    gl.getDrawingBufferSize(tmp.res);
    u.uRes.value.copy(tmp.res);
    u.uPR.value = gl.getPixelRatio();
    world.pulse.value = 0.5 + 0.5 * Math.sin(tAbs * 2.1);
  });

  // Reduced motion: the canvas renders on demand; ask for the still.
  useEffect(() => {
    if (reduce) invalidate();
  }, [reduce, invalidate, world, scanner, size]);

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={30} near={0.1} far={60} position={[2, 5, 5]} />
      <PathologyLights quality={quality} target={target} />
      <primitive object={target} />
      <primitive object={world.root} />
      <primitive object={scanner.group} />
    </>
  );
}
