import type { SceneLayout } from "../math";

/**
 * Staging geometry derived from the scene layout. Everything the robots bring
 * (bases, part nests, cables, feet) stands on y = 0, so the stage is a flush,
 * polished floor at y = 0 with the work cell inlaid into it as a light line.
 * Pure data, cached per layout; no three.js imports.
 */
export type Circle = { x: number; z: number; r: number };

export type Stage = {
  /** Staging scale relative to the wide layout (1 = wide). */
  s: number;
  /** Floor disc centre (x, z) and radius; it fades out over its outer half. */
  cx: number;
  cz: number;
  radius: number;
  /** Radius around the centre in which the terrain stays flat. */
  flat: number;
  /**
   * Work-cell outline: the convex hull of two circles, the arm's cell
   * (base, reach to its part nests) and the learner's station.
   */
  cellA: Circle;
  cellB: Circle;
  /**
   * Direction the shadow-casting back key arrives from: behind-right, so every
   * shadow falls toward the camera's left, away from the other robot (the
   * learner stands left of and slightly behind the arm).
   */
  sun: [number, number, number];
};

/** Objects on this layer are mirrored in the floor (high quality only). */
export const REFLECT_LAYER = 1;

const WIDE_ARM_SCALE = 0.88;
/** Arm-cell radius in arm-local units: covers the part nests (r ≈ 1.45) and their feet. */
const ARM_CELL = 1.74;
/** Learner-station radius in humanoid-local metres (just outside the learner's own r = 0.5 station ring). */
const LEARNER_CELL = 0.64;

const cache = new Map<string, Stage>();

export function stageOf(layout: SceneLayout): Stage {
  let st = cache.get(layout.key);
  if (!st) {
    const s = layout.armScale / WIDE_ARM_SCALE;
    const [ax, , az] = layout.arm;
    const [hx, , hz] = layout.humanoid;
    const radius = 4.6 * s;
    st = {
      s,
      // A third of the way toward the learner: the centre of the cell outline.
      cx: ax + (hx - ax) * 0.32,
      cz: az + (hz - az) * 0.32,
      radius,
      flat: Math.max(2.6, radius * 0.8),
      cellA: { x: ax, z: az, r: ARM_CELL * layout.armScale },
      cellB: { x: hx, z: hz, r: LEARNER_CELL * layout.humanoidScale },
      sun: [5, 7.5, -6],
    };
    cache.set(layout.key, st);
  }
  return st;
}
