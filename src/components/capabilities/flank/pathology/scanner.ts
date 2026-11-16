import * as THREE from "three";
import type { FlankQuality } from "../contract";
import { band, cyl, drum, join, lathe, place, rbox } from "../robot/geo";
import { glowBlend, ICE_HOT, makeFieldMaterials, type PartKey } from "../robot/materials";
import { rowZ, SCAN, SLIDE, TILE, Y_OVERLAY, type HeadPose } from "./model";
import { beamFrag, beamVert } from "./shaders";

/** Linear rail behind the slide (the fast axis rides on it). */
const RAIL_Z = -0.82;
const RAIL_Y = 0.5;
const RAIL_CX = (SCAN.x0 + SCAN.x1) / 2 - 0.1;
const RAIL_LEN = 3.0;
/** Ram carrying the scan head out over the slide (the slow axis slides through the carriage). */
const ARM_Y = 0.69;
const RAM_LEN = rowZ(0) - RAIL_Z + 0.14;
/** Front lens height when in focus, and how far the objective retracts when parked. */
const TIP_Y = 0.235;
const RETRACT = 0.055;

type Bins = Partial<Record<PartKey, THREE.BufferGeometry[]>>;

function bake(parent: THREE.Object3D, bins: Bins, mats: Record<PartKey, THREE.Material>, trash: THREE.BufferGeometry[]) {
  (Object.keys(bins) as PartKey[]).forEach((k) => {
    const parts = bins[k];
    if (!parts || parts.length === 0) return;
    const g = join(parts);
    trash.push(g);
    const mesh = new THREE.Mesh(g, mats[k]);
    mesh.name = k;
    parent.add(mesh);
  });
}

const push = (bins: Bins, key: PartKey, g: THREE.BufferGeometry) => {
  (bins[key] ??= []).push(g);
};

export type Scanner = {
  group: THREE.Group;
  /** Pose the gantry for a head pose. Must not allocate. */
  update(pose: HeadPose): void;
  dispose(): void;
};

/**
 * The slide scanner: a linear rail behind the slide, a carriage with a
 * ram that slides through it, and the scan head with its objective (white shell, dark
 * joints, steel, one indigo and one burgundy band: the quadruped's materials).
 * Everything stays behind or above the specimen as seen from the camera, so
 * the tissue and the analysis layer are never hidden for long.
 */
export function buildScanner(quality: FlankQuality): Scanner {
  const high = quality === "high";
  const seg = high ? 40 : 20;
  const mats = makeFieldMaterials(quality);
  const trash: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  group.name = "scanner";

  // --- static: rail, posts, slide holder -------------------------------
  {
    const b: Bins = {};
    push(b, "core", place(rbox(RAIL_LEN, 0.11, 0.12, 0.014), RAIL_CX, RAIL_Y, RAIL_Z));
    // guide ways: one on top, one on the front face
    push(b, "steel", place(cyl(0.013, 0.013, RAIL_LEN - 0.14, 12), RAIL_CX, RAIL_Y + 0.062, RAIL_Z, 0, 0, Math.PI / 2));
    push(b, "steel", place(cyl(0.011, 0.011, RAIL_LEN - 0.14, 12), RAIL_CX, RAIL_Y + 0.005, RAIL_Z + 0.064, 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
      const x = RAIL_CX + s * (RAIL_LEN / 2 - 0.02);
      push(b, "shell", place(rbox(0.12, 0.2, 0.2, 0.024, 3), x, RAIL_Y + 0.005, RAIL_Z));
      push(b, "core", place(rbox(0.085, RAIL_Y - 0.1, 0.085, 0.012), x, (RAIL_Y - 0.1) / 2 + 0.01, RAIL_Z));
      push(b, "joint", place(rbox(0.26, 0.03, 0.26, 0.012), x, 0.015, RAIL_Z));
      push(b, "steel", place(drum(0.05, 0.03, 0.045, 20, 0.004), x, 0, RAIL_Z));
    }
    // slide holder: end stop, a fence along the far edge, two locating pins on the near edge
    const hw = SLIDE.w / 2;
    const hd = SLIDE.d / 2;
    push(b, "joint", place(rbox(0.07, 0.07, 0.46, 0.014), -hw - 0.05, 0.035, 0));
    push(b, "core", place(rbox(1.9, 0.06, 0.05, 0.012), 0.25, 0.03, -hd - 0.04));
    for (const x of [-0.98, 1.06]) {
      push(b, "steel", place(drum(0.03, 0, 0.068, 20, 0.006), x, 0, hd + 0.034));
      push(b, "joint", place(drum(0.045, 0, 0.014, 20, 0.003), x, 0, hd + 0.034));
    }
    bake(group, b, mats, trash);
  }

  // --- carriage on the rail (moves in x) --------------------------------
  const carriage = new THREE.Group();
  group.add(carriage);
  {
    const b: Bins = {};
    push(b, "shell", place(rbox(0.36, 0.24, 0.25, 0.034, 4), 0, RAIL_Y + 0.005, RAIL_Z));
    push(b, "panel", place(rbox(0.25, 0.12, 0.014, 0.006), 0, RAIL_Y + 0.005, RAIL_Z + 0.123));
    push(b, "accent", place(rbox(0.25, 0.012, 0.016, 0.004), 0, RAIL_Y - 0.075, RAIL_Z + 0.123));
    push(b, "glow", place(rbox(0.045, 0.011, 0.016, 0.004), 0.085, RAIL_Y + 0.085, RAIL_Z + 0.121));
    // saddle the ram slides through
    push(b, "joint", place(rbox(0.18, 0.125, 0.3, 0.02), 0, ARM_Y - 0.008, RAIL_Z));
    bake(carriage, b, mats, trash);
  }

  // --- ram + scan head (move in x and z) ---------------------------------
  const head = new THREE.Group();
  group.add(head);
  {
    const b: Bins = {};
    // the ram, its guide way and rear end cap: nothing ever reaches in front of the head
    push(b, "core", place(rbox(0.074, 0.07, RAM_LEN, 0.012), 0, ARM_Y, -RAM_LEN / 2));
    push(b, "steel", place(cyl(0.011, 0.011, RAM_LEN - 0.16, 12), 0, ARM_Y + 0.04, -RAM_LEN / 2 - 0.03, Math.PI / 2, 0, 0));
    push(b, "shell", place(rbox(0.096, 0.096, 0.035, 0.014), 0, ARM_Y + 0.004, -RAM_LEN));
    push(b, "shell", place(rbox(0.25, 0.17, 0.24, 0.034, 4), 0, ARM_Y - 0.02, 0));
    for (const s of [-1, 1]) push(b, "panel", place(rbox(0.012, 0.09, 0.15, 0.005), s * 0.125, ARM_Y - 0.03, 0));
    push(b, "glow", place(rbox(0.045, 0.011, 0.014, 0.004), 0.06, ARM_Y + 0.02, 0.117));
    push(b, "accent", place(rbox(0.045, 0.011, 0.014, 0.004), -0.06, ARM_Y + 0.02, 0.117));
    push(b, "joint", place(drum(0.108, ARM_Y - 0.155, ARM_Y - 0.1, seg, 0.007), 0, 0, 0));
    bake(head, b, mats, trash);
  }

  // --- objective (focus travel in y) -------------------------------------
  const objective = new THREE.Group();
  head.add(objective);
  {
    const b: Bins = {};
    const y = TIP_Y;
    // nose cone and front element mount
    push(
      b,
      "steel",
      lathe(
        [
          [0, y],
          [0.03, y],
          [0.038, y + 0.01],
          [0.074, y + 0.078],
          [0, y + 0.078],
        ],
        seg,
      ),
    );
    push(b, "lens", place(drum(0.026, y - 0.002, y + 0.002, seg, 0.001), 0, 0, 0));
    // knurled correction collar, magnification colour band, spacer ring
    push(b, "joint", drum(0.085, y + 0.078, y + 0.112, seg, 0.005));
    push(b, "accent", drum(0.081, y + 0.112, y + 0.132, seg, 0.002));
    push(b, "steel", drum(0.085, y + 0.132, y + 0.145, seg, 0.003));
    // barrel
    push(b, "shell", drum(0.09, y + 0.145, y + 0.29, seg, 0.01));
    push(b, "panel", band(0.089, 0.0922, y + 0.2, y + 0.226, seg));
    push(b, "joint", drum(0.094, y + 0.29, y + 0.37, seg, 0.005));
    bake(objective, b, mats, trash);
  }

  // --- illumination: the field of view lit from the front lens ------------
  const beamGeo = new THREE.BufferGeometry();
  {
    const hb = TILE / 2;
    const ht = 0.022;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const pos: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const c = corners[(i + 1) % 4];
      pos.push(a[0] * hb, 0, a[1] * hb, c[0] * hb, 0, c[1] * hb, c[0] * ht, 1, c[1] * ht);
      pos.push(a[0] * hb, 0, a[1] * hb, c[0] * ht, 1, c[1] * ht, a[0] * ht, 1, a[1] * ht);
    }
    beamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  }
  const beamMat = glowBlend(
    new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: { uColor: { value: new THREE.Color(ICE_HOT).convertLinearToSRGB() }, uOpacity: { value: 0 } },
    }),
  );
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  beam.renderOrder = 7;
  group.add(beam);

  return {
    group,
    update(pose) {
      carriage.position.x = pose.x;
      head.position.set(pose.x, 0, pose.z);
      const lift = pose.retract * RETRACT;
      objective.position.y = lift;
      beam.position.set(pose.x, Y_OVERLAY, pose.z);
      beam.scale.y = TIP_Y + lift - Y_OVERLAY;
      beam.visible = pose.lamp > 0.004;
      beamMat.uniforms.uOpacity.value = 0.2 * pose.lamp;
    },
    dispose() {
      trash.forEach((g) => g.dispose());
      beamGeo.dispose();
      beamMat.dispose();
      new Set(Object.values(mats)).forEach((m) => m.dispose());
    },
  };
}
