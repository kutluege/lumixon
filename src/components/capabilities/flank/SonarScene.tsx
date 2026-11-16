"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { flankForcedTime, type FlankSceneProps } from "./contract";
import { buildSonarWorld } from "./sonar/build";
import { SonarLights } from "./sonar/SonarLights";
import { CAMERA, LOOP, makeState, sonarState, STILL_T } from "./sonar/timeline";

/** Clock value the scene opens on: the swimmer is just entering, the first return is a second away. */
const START_T = 3.4;

/** Camera framing: look-at point, viewing direction (from the look-at toward the camera), distance. */
const LOOK = new THREE.Vector3(...CAMERA.look);
const VIEW_DIR = new THREE.Vector3(...CAMERA.dir).normalize();
const VIEW_DIST = CAMERA.dist;
const UP = new THREE.Vector3(0, 1, 0);
/** Framing offsets blended in as the panel narrows from 4:3 to square. */
const NARROW = { swing: 0.27, lift: 0.07, dist: 1.06, lookX: 0.1, lookY: -0.4, lookZ: 0.07 } as const;

/**
 * Harbour-protection sonar: a transducer node on a seabed tripod pings the
 * water column; fish come back as quiet "normal" ticks, an approaching diver
 * comes back as returns that build a track, and on the third return the
 * diver is locked as an anomaly (bracket, ring on the sand, predicted path).
 * The whole scene is a pure function of the clock, see sonar/timeline.ts.
 */
export default function SonarScene({ quality, reduce }: FlankSceneProps) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const clock = useRef(START_T);

  const world = useMemo(() => buildSonarWorld(quality), [quality]);
  useEffect(() => () => world.dispose(), [world]);

  const tmp = useMemo(() => ({ state: makeState(), res: new THREE.Vector2(), look: new THREE.Vector3(), dir: new THREE.Vector3() }), []);

  useFrame((_, delta) => {
    if (!reduce) clock.current += Math.min(delta, 0.05);
    const forced = flankForcedTime();
    const t = forced ?? (reduce ? STILL_T : clock.current);
    const s = sonarState(t, tmp.state);
    const u = world.uniforms;

    // Camera: a slow drift around the scene (one sway per loop, so it wraps
    // seamlessly). The approach runs across a wide panel; on a narrow (square)
    // one the camera swings round to look more along it and a little more
    // from above, so the swimmer and the tripod stack diagonally and keep
    // their size instead of the whole scene shrinking to fit the width.
    const aspect = size.width / Math.max(1, size.height);
    const narrow = THREE.MathUtils.clamp((1.34 - aspect) / 0.34, 0, 1);
    const sway = Math.sin((t / LOOP) * Math.PI * 2);
    tmp.look.set(LOOK.x + 0.12 * sway + NARROW.lookX * narrow, LOOK.y + NARROW.lookY * narrow, LOOK.z + NARROW.lookZ * narrow);
    const cam = camRef.current;
    if (cam) {
      tmp.dir.copy(VIEW_DIR);
      tmp.dir.y += NARROW.lift * narrow;
      tmp.dir.normalize().applyAxisAngle(UP, 0.045 * sway + NARROW.swing * narrow);
      cam.position
        .copy(tmp.dir)
        .multiplyScalar(VIEW_DIST * THREE.MathUtils.lerp(1, NARROW.dist, narrow) * Math.max(1, 1 / aspect))
        .add(tmp.look);
      cam.lookAt(tmp.look);
      cam.updateMatrixWorld();
      world.update(t, s, cam, narrow);
    }

    u.uFadeC.value.set(tmp.look.x, tmp.look.z + 0.4);
    gl.getDrawingBufferSize(tmp.res);
    u.uRes.value.copy(tmp.res);
    u.uPR.value = gl.getPixelRatio();
  });

  // Reduced motion: the canvas renders on demand; ask for the still.
  useEffect(() => {
    if (reduce) invalidate();
  }, [reduce, invalidate, world]);

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={CAMERA.fov} near={0.5} far={80} position={[2, 6, 11]} />
      <SonarLights quality={quality} target={world.node} />
      <primitive object={world.root} />
    </>
  );
}
