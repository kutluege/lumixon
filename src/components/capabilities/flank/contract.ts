/**
 * Shared contract for the "research → field" flank animations in the
 * capabilities section. Three owners build against this file:
 *
 *   robot/**  + ResearchScene.tsx   the quadruped rig and the left (research / digital twin) scene
 *   field/**  + FieldScene.tsx      the right (field / SLAM) scene, consuming the same rig
 *   FlankStage.tsx + section layout the DOM slots, <Canvas> hosts, lazy mount, pausing, fallbacks
 *
 * Change this file only by agreement of the orchestrator; add, do not rename.
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
