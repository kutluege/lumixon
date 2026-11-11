"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { FlankSceneProps } from "./contract";
import { createQuadruped } from "./robot";
import { FieldLights } from "./field/FieldLights";
import { buildFieldWorld } from "./field/build";
import { pathSlope, pathZ, SWEEP_RATE, WALK_SPEED, FIELD_PERIOD, wrapX } from "./field/terrain";

/** Clock value the scene opens on (and freezes at under reduced motion): a map already half built. */
const START_T = 15;
const STILL_T = 21.3;

/** Camera framing: look-at point relative to the robot and the viewing direction. */
const LOOK = new THREE.Vector3(-0.5, 0.2, -0.3);
const VIEW_DIR = new THREE.Vector3(1.5, 2.1, 3.3).normalize();
const VIEW_DIST = 5.4;

/**
 * Right flank, "field": the real machine. The quadruped walks a treadmill
 * world (uneven ground, boulders, a pipe run, crates, a broken wall with a
 * doorway) while its spinning lidar builds a point-cloud map behind it and
 * its trajectory / pose graph is drawn on the ground.

 */
export default function FieldScene({ quality, reduce }: FlankSceneProps) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const clock = useRef(START_T);

  const robot = useMemo(() => createQuadruped({ style: "field", quality }), [quality]);
  useEffect(() => () => robot.dispose(), [robot]);

  const world = useMemo(() => buildFieldWorld(quality), [quality]);
  useEffect(() => () => world.dispose(), [world]);

  // Solid robot parts cast (high tier) the only shadow map, onto a catcher under it.
  useEffect(() => {
    const cast = quality === "high";
    robot.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = cast && !(m.material as THREE.Material).transparent;
    });
    invalidate();
  }, [robot, quality, invalidate]);

  const tmp = useMemo(() => ({ sensor: new THREE.Vector3(), res: new THREE.Vector2(), look: new THREE.Vector3() }), []);

  useFrame((_, delta) => {
    if (!reduce) clock.current += Math.min(delta, 0.05);
    const t = reduce ? STILL_T : clock.current;
    const s = t * WALK_SPEED;
    const sMod = ((s % FIELD_PERIOD) + FIELD_PERIOD) % FIELD_PERIOD;
    const z = pathZ(sMod);
    const u = world.uniforms;

    // Robot: stays at x = 0, follows the path laterally, faces along it.
    robot.group.position.set(0, 0, z);
    robot.group.rotation.set(0, -Math.atan(pathSlope(sMod)), 0);
    robot.update(t, s);
    robot.group.updateMatrixWorld(true);
    robot.sensor.getWorldPosition(tmp.sensor);

    // Camera: follows the sway softly; backs off on narrow panels so the map still fits.
    // Wide panels keep the robot right of centre (the map trails left); narrow ones centre it.
    const aspect = size.width / Math.max(1, size.height);
    const wide = THREE.MathUtils.clamp((aspect - 1.0) / 0.6, 0, 1);
    tmp.look.set(THREE.MathUtils.lerp(0.25, LOOK.x, wide), LOOK.y, LOOK.z + z * 0.75);
    const cam = camRef.current;
    if (cam) {
      cam.position
        .copy(VIEW_DIR)
        .multiplyScalar(VIEW_DIST * Math.pow(Math.max(1, 1.3 / aspect), 0.6))
        .add(tmp.look);
      cam.lookAt(tmp.look);
    }

    u.uS.value = sMod;
    u.uPhase.value = (t * SWEEP_RATE) % (Math.PI * 2);
    u.uSensor.value.copy(tmp.sensor);
    u.uFadeC.value.set(tmp.look.x - 0.2, z * 0.9);
    gl.getDrawingBufferSize(tmp.res);
    u.uRes.value.copy(tmp.res);
    u.uPR.value = gl.getPixelRatio();
    world.update(sMod, z);
    for (const a of world.anchors) a.obj.position.x = wrapX(a.tileX - sMod);

  });

  // Reduced motion: the canvas renders on demand; ask for the still.
  useEffect(() => {
    if (reduce) invalidate();
  }, [reduce, invalidate, world, robot]);

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={30} near={0.1} far={60} position={[2, 2, 4]} />
      <FieldLights quality={quality} robot={robot.group} />
      <primitive object={world.root} />
      <primitive object={robot.group} />
    </>
  );
}
