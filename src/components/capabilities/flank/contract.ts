/**
 * Shared contract for the capability-row animations ("flank" scenes). Each
 * capability row hosts one large scene beside its copy:
 *
 *   robot/**     + ResearchScene.tsx   the quadruped rig and its wireframe digital twin (robotics inset)
 *   field/**     + FieldScene.tsx      the same rig in the field, building a lidar map (robotics)
 *   pathology/** + PathologyScene.tsx  whole-slide scan and analysis (healthcare)
 *   sonar/**     + SonarScene.tsx      seabed sonar detecting a diver (SONAR)
 *   FlankStage.tsx                     the DOM frame, <Canvas> host, lazy mount, pausing, fallbacks
 *
 * Add to this file, do not rename: every scene is built against it.
 */
import type * as THREE from "three";

export type FlankQuality = "high" | "low";

/**
 * Props every scene receives. A scene is the CONTENT of a react-three-fiber
 * <Canvas> (the stage owns the Canvas element). It brings its own camera
 * (makeDefault), lights, environment and motion, on a transparent background.
 */
export type FlankSceneProps = {
  quality: FlankQuality;
  /** prefers-reduced-motion: render one well-composed still; the Canvas runs frameloop="demand". */
  reduce: boolean;
};

/** "twin" = wireframe / blueprint digital twin, "field" = solid, lit, real machine. */
export type QuadrupedStyle = "twin" | "field";

/**
 * The same four-legged robot, used by both scenes so the pair reads as one
 * system in two states. Model space: metres, feet on y = 0, body centred on
 * the origin in x/z, walking direction +X, about 1.0 long and 0.6 tall.
 */
export type Quadruped = {
  group: THREE.Group;
  /** Empty object at the lidar / sensor head; scenes attach beams or scan fans to it. */
  sensor: THREE.Object3D;
  /**
   * Pose the rig for absolute time `t` (seconds). `stride` is the distance
   * walked so far in metres (drives gait phase so feet do not slide);
   * the scene moves `group` itself. Must not allocate.
   */
  update(t: number, stride: number): void;
  dispose(): void;
};

export type CreateQuadruped = (opts: { style: QuadrupedStyle; quality: FlankQuality }) => Quadruped;

/**
 * Every scene the capability rows can host. "research" / "field" are the
 * quadruped pair (robotics), "pathology" the whole-slide analysis scene
 * (healthcare), "sonar" the underwater diver-detection scene.
 */
export type FlankKind = "research" | "field" | "pathology" | "sonar";

/**
 * Development aid: when `globalThis.__FLANK_T` is a number, a scene renders
 * that absolute time (seconds) instead of advancing its own clock, so a
 * specific moment of the loop can be screenshotted. Always `null` in production.
 */
export function flankForcedTime(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const t = (globalThis as { __FLANK_T?: unknown }).__FLANK_T;
  return typeof t === "number" && Number.isFinite(t) ? t : null;
}
