import * as THREE from "three";
import { ARM_DIM, ARM_STATIONS, armPose, demoGrip, demoPart } from "../math";
import { makeRobotMaterials, ROBOT_GLOW, ROBOT_GLOW_HOT, type RobotMaterials } from "../materials";
import {
  annulus,
  band,
  boltCircle,
  boneShape,
  corner,
  cyl,
  drum,
  Hose,
  Kit,
  lathe,
  place,
  prism,
  rbox,
  roundedPoly,
  roundedRect,
  tangentPoint,
  tube,
  type P2,
} from "./geo";

/**
 * Procedural 6-axis industrial manipulator, built imperatively (plain three.js,
 * no React) so each link bakes down to one welded mesh per material.
 *
 * Layout mirrors a real serial arm: cast base + slew ring, turret with the
 * lower arm cantilevered on its camera-side flank and the J1/J2 servo motors
 * opposite, dog-bone lower arm, elbow housing with the forearm axis offset
 * above the J3 axis and the J4–J6 motor pack behind it, rolling forearm with
 * a wrist fork, J5 knuckle, J6 flange and a two-finger parallel gripper with
 * an eye-in-hand camera. Dress-pack hoses flex across the shoulder and elbow.
 *
 * All dimensions that affect the tool point come from ARM_DIM, the same
 * constants the forward kinematics in math.ts uses.
 */

type MatKey = keyof RobotMaterials;
type Xf = (g: THREE.BufferGeometry) => THREE.BufferGeometry;

const HALF_PI = Math.PI / 2;
const { h1, a1, d1, l2, a3, l3, d6, tool } = ARM_DIM;

/** Lower arm: centre plane and thickness (it rides on the turret's -Z flank). */
const ARM_Z = -0.215;
const ARM_T = 0.14;
const ARM_OUT = ARM_Z - ARM_T / 2;
/** J4 roll joint position along the forearm axis, and J5 measured from it. */
const ROLL_Y = 0.4;
const WRIST_Y = l3 - ROLL_Y;
/** Tool centre point in the J6 (flange) frame. */
const TCP_Y = tool - d6;
/** Work piece: a turned billet, symmetric so it can be regripped either way up. */
const PART_R = 0.05;
const PART_H = 0.116;
/** Finger inner-face offset from the tool axis. */
const GRIP_CLOSED = PART_R + 0.0035;
const GRIP_OPEN = GRIP_CLOSED + 0.03;
/** The static base is turned so its front faces the work area (also the X axis of the TCP readout's base frame). */
export const BASE_YAW = -2.68;
const HOSE_R = 0.03;

export type ArmRig = {
  root: THREE.Group;
  /** Pose every joint, the gripper, the work piece, hoses and status lights for time t. */
  update: (t: number) => void;
  dispose: () => void;
};

/** Servo motor along +Y from y = 0: finned body, bright end cap, optional connector on the +X side (spun about Y). */
function motor(kit: Kit<MatKey>, r: number, len: number, seg: number, hi: boolean, xf: Xf, spin: number | null = null) {
  const prof: P2[] = [
    [0, 0],
    [r, 0],
  ];
  const pitch = hi ? 0.026 : 0.052;
  const groove = pitch * 0.45;
  const n = Math.max(1, Math.floor((len - 0.03) / pitch));
  for (let i = 0; i < n; i++) {
    const y = 0.015 + i * pitch;
    prof.push([r, y], [r - 0.011, y], [r - 0.011, y + groove], [r, y + groove]);
  }
  prof.push([r, len], [0, len]);
  kit.add("graphite", xf(lathe(prof, seg)));
  kit.add(
    "cover",
    xf(
      lathe(
        [
          [r * 0.93, len],
          [r * 0.93, len + 0.018],
          [r * 0.8, len + 0.03],
          [0, len + 0.03],
        ],
        seg,
      ),
    ),
  );
  if (spin !== null) {
    kit.add("joint", xf(place(place(rbox(0.05, 0.045, 0.055, 0.008), r + 0.008, len - 0.04, 0), 0, 0, 0, 0, spin)));
  }
}

/** Joint cover: chamfered cap with a recessed centre, an ice hairline ring and a bolt circle. Rises along +Y from y = 0. */
function hubCap(kit: Kit<MatKey>, R: number, h: number, seg: number, hi: boolean, xf: Xf) {
  kit.add(
    "cover",
    xf(
      lathe(
        [
          [R, 0],
          [R, h * 0.6],
          [R - 0.014, h],
          [R * 0.62, h],
          [R * 0.56, h * 0.7],
          [0, h * 0.7],
        ],
        seg,
      ),
    ),
  );
  kit.add("glow", xf(annulus(R * 0.35, R * 0.42, h * 0.7 + 0.0015, seg)));
  if (hi) kit.add("machined", xf(place(boltCircle(R > 0.13 ? 10 : 8, R * 0.775, R * 0.07, 0.006), 0, h, 0)));
}

export function buildArm(quality: "high" | "low"): ArmRig {
  const hi = quality === "high";
  const S = hi ? 48 : 28; // large turned parts
  const s = hi ? 24 : 14; // small turned parts
  const cs = hi ? 12 : 8; // curve segments of extruded outlines
  const mats = makeRobotMaterials(quality);
  const trash: THREE.BufferGeometry[] = [];
  const kit = new Kit<MatKey>();

  const root = new THREE.Group();

  /* ── Static base ── */
  const base = new THREE.Group();
  base.rotation.y = BASE_YAW;
  root.add(base);
  kit.add("graphite", place(prism(roundedRect(0.98, 0.98, 0.13), 0.044, 0.008, cs), 0, 0.022, 0, -HALF_PI));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.add("machined", place(drum(0.05, 0.044, 0.052, 16, 0.002), sx * 0.385, 0, sz * 0.385));
      kit.add("machined", place(cyl(0.03, 0.03, 0.024, 6), sx * 0.385, 0.064, sz * 0.385));
    }
  }
  kit.add(
    "shell",
    lathe(
      [
        [0, 0.04],
        [0.455, 0.04],
        [0.455, 0.064],
        [0.438, 0.082],
        [0.39, 0.09],
        [0.368, 0.112],
        [0.368, 0.224],
        [0.354, 0.238],
        [0.354, 0.262],
        [0.342, 0.274],
        [0, 0.274],
      ],
      S,
    ),
  );
  if (hi) kit.add("machined", place(boltCircle(12, 0.414, 0.016, 0.012), 0, 0.085, 0));
  kit.add("glow", place(cyl(0.3556, 0.3556, 0.008, S, true), 0, 0.25, 0));
  kit.add("joint", place(cyl(0.33, 0.33, 0.03, S, true), 0, 0.287, 0));
  // Rear connector box, sockets and two short floor cables into a trunking box close behind the base.
  kit.add("graphite", place(rbox(0.15, 0.13, 0.26, 0.02), -0.405, 0.165, 0));
  for (const z of [-0.078, 0, 0.078]) {
    kit.add("machined", place(cyl(0.024, 0.024, 0.05, 12), -0.5, 0.165, z, 0, 0, HALF_PI));
  }
  for (const z of [-0.078, 0.078]) {
    kit.add(
      "hose",
      tube(
        [
          [-0.52, 0.165, z],
          [-0.585, 0.158, z],
          [-0.645, 0.1, z * 1.1],
          [-0.69, 0.04, z * 1.2],
          [-0.76, 0.03, z * 1.25],
        ],
        0.02,
        hi ? 18 : 10,
        hi ? 8 : 6,
      ),
    );
  }
  kit.add("graphite", place(rbox(0.13, 0.06, 0.32, 0.015), -0.8, 0.03, 0));
  kit.bake(base, mats, trash);

  /* ── Work cell: two part nests on slim tooling columns ── */
  const cell = new THREE.Group();
  root.add(cell);
  for (const st of ARM_STATIONS) {
    const T = st[1] - PART_H / 2;
    const at: Xf = (g) => place(g, st[0], 0, st[2]);
    kit.add(
      "graphite",
      at(
        lathe(
          [
            [0, 0],
            [0.15, 0],
            [0.15, 0.016],
            [0.135, 0.03],
            [0.078, 0.042],
            [0.06, 0.085],
            [0.052, T - 0.3],
            [0.052, T - 0.29],
          ],
          s,
        ),
      ),
    );
    kit.add(
      "cover",
      at(
        lathe(
          [
            [0.05, T - 0.29],
            [0.057, T - 0.29],
            [0.057, T - 0.12],
            [0.07, T - 0.075],
            [0.07, T - 0.036],
          ],
          s,
        ),
      ),
    );
    kit.add(
      "machined",
      at(
        lathe(
          [
            [0.07, T - 0.036],
            [0.104, T - 0.03],
            [0.104, T - 0.004],
            [0.098, T + 0.004],
            [0.064, T + 0.004],
            [0.06, T],
            [0, T],
          ],
          s,
        ),
      ),
    );
    kit.add("glow", at(place(cyl(0.0712, 0.0712, 0.006, s, true), 0, T - 0.052, 0)));
  }
  kit.bake(cell, mats, trash);

  /* ── Work piece ── */
  const part = new THREE.Group();
  kit.add(
    "machined",
    lathe(
      [
        [0, -PART_H / 2],
        [PART_R - 0.004, -PART_H / 2],
        [PART_R, -PART_H / 2 + 0.004],
        [PART_R, PART_H / 2 - 0.004],
        [PART_R - 0.004, PART_H / 2],
        [0, PART_H / 2],
      ],
      s,
    ),
  );
  kit.add("accent", band(PART_R - 0.002, PART_R + 0.0012, -0.014, 0.014, s));
  kit.bake(part, mats, trash);
  // Parked on the first nest so scene-wide traversals (layers, shadow flags) see it before the first update.
  cell.add(part);

  /* ── J1: turret ── */
  const j1 = new THREE.Group();
  j1.position.y = h1;
  root.add(j1);
  kit.add(
    "graphite",
    lathe(
      [
        [0, 0],
        [0.345, 0],
        [0.345, 0.04],
        [0.33, 0.055],
        [0, 0.055],
      ],
      S,
    ),
  );
  if (hi) kit.add("machined", place(boltCircle(16, 0.3, 0.013, 0.01), 0, 0.055, 0));
  {
    // Side profile of the casting: a boot rising into the round shoulder head.
    const HEAD_R = 0.215;
    const front = tangentPoint(a1, d1, HEAD_R, 0.31, 0.05, -1);
    const rear = tangentPoint(a1, d1, HEAD_R, -0.2, 0.3, 1);
    const sh = new THREE.Shape();
    sh.moveTo(-0.27, 0.12);
    corner(sh, -0.27, 0.12, -0.27, 0.05, 0.31, 0.05, 0.035);
    corner(sh, -0.27, 0.05, 0.31, 0.05, front[0], front[1], 0.045);
    sh.absarc(a1, d1, HEAD_R, front[2], rear[2], false);
    corner(sh, rear[0], rear[1], -0.2, 0.3, -0.27, 0.2, 0.05);
    corner(sh, -0.2, 0.3, -0.27, 0.2, -0.27, 0.12, 0.03);
    sh.closePath();
    kit.add("shell", place(prism(sh, 0.3, 0.022, cs), 0, 0, 0.01));
  }
  // Shoulder seal toward the lower arm, J2 gearbox flange + servo on the far flank.
  kit.add("joint", place(cyl(0.19, 0.19, 0.012, S, true), a1, d1, -0.143, HALF_PI));
  kit.add(
    "graphite",
    place(
      lathe(
        [
          [0, 0],
          [0.165, 0],
          [0.165, 0.03],
          [0.152, 0.042],
          [0, 0.042],
        ],
        S,
      ),
      a1,
      d1,
      0.16,
      HALF_PI,
    ),
  );
  if (hi) kit.add("machined", place(place(boltCircle(10, 0.132, 0.011, 0.008), 0, 0.042, 0), a1, d1, 0.16, HALF_PI));
  motor(kit, 0.105, 0.165, S, hi, (g) => place(g, a1, d1, 0.202, HALF_PI), HALF_PI);
  // J1 servo standing at the rear of the turret.
  kit.add("graphite", place(drum(0.104, 0.25, 0.292, s, 0.008), -0.15, 0, 0.01));
  motor(kit, 0.088, 0.2, s, hi, (g) => place(g, -0.15, 0.29, 0.01), Math.PI);
  // Dress-pack outlet on the camera-side flank.
  kit.add("graphite", place(rbox(0.075, 0.1, 0.09, 0.012), -0.19, 0.2, -0.18));
  kit.add("joint", place(drum(0.04, 0, 0.05, 14, 0.004), -0.193, 0.24, ARM_Z, 0, 0, 0.3));
  kit.bake(j1, mats, trash);

  /* ── J2: lower arm ── */
  const j2 = new THREE.Group();
  j2.position.set(a1, d1, 0);
  j1.add(j2);
  kit.add("shell", place(prism(boneShape(0.205, 0.16, l2, 0.25, 0.2), ARM_T, 0.024, cs), 0, 0, ARM_Z));
  hubCap(kit, 0.15, 0.03, S, hi, (g) => place(g, 0, 0, ARM_OUT, -HALF_PI));
  hubCap(kit, 0.118, 0.026, S, hi, (g) => place(g, 0, l2, ARM_OUT, -HALF_PI));
  kit.add("graphite", place(prism(roundedRect(0.13, 0.44, 0.05, 0, 0.53), 0.012, 0.004, cs), 0, 0, ARM_OUT - 0.002));
  kit.add("accent", place(prism(roundedRect(0.012, 0.3, 0.006, -0.036, 0.53), 0.006, 0.002, cs), 0, 0, ARM_OUT - 0.0095));
  for (const y of [0.42, 0.74]) {
    kit.add("graphite", place(rbox(0.07, 0.05, 0.08, 0.01), -0.135, y, ARM_Z));
    kit.add("machined", place(band(HOSE_R + 0.001, HOSE_R + 0.009, -0.02, 0.02, 14), -0.165, y, ARM_Z));
  }
  kit.add("hose", place(cyl(HOSE_R, HOSE_R, 0.36, hi ? 10 : 8, true), -0.165, 0.58, ARM_Z));
  kit.bake(j2, mats, trash);

  /* ── J3: elbow housing + motor pack ── */
  const j3 = new THREE.Group();
  j3.position.y = l2;
  j2.add(j3);
  kit.add("shell", place(drum(0.165, -0.14, 0.14, S, 0.014), 0, 0, 0, HALF_PI));
  kit.add("joint", place(cyl(0.152, 0.152, 0.012, S, true), 0, 0, -0.143, HALF_PI));
  kit.add(
    "shell",
    prism(
      roundedPoly([
        [0.045, -0.15, 0.035],
        [0.045, 0.24, 0.07],
        [0.008, 0.395, 0.03],
        [-0.208, 0.395, 0.03],
        [-0.245, 0.24, 0.07],
        [-0.245, -0.15, 0.045],
      ]),
      0.25,
      0.022,
      cs,
    ),
  );
  // Roll-joint collar, hairline and seal on the forearm axis.
  kit.add(
    "graphite",
    place(
      lathe(
        [
          [0.1, 0.36],
          [0.122, 0.36],
          [0.122, 0.388],
          [0.114, 0.398],
          [0.1, 0.398],
        ],
        S,
      ),
      -a3,
      0,
      0,
    ),
  );
  kit.add("glow", place(cyl(0.1228, 0.1228, 0.004, S, true), -a3, 0.374, 0));
  kit.add("joint", place(cyl(0.103, 0.103, 0.02, S, true), -a3, 0.405, 0));
  // Satin access covers on both flanks, status light bar on top.
  for (const sz of [-1, 1]) {
    kit.add("cover", place(prism(roundedRect(0.15, 0.16, 0.025, -a3 - 0.005, 0.275), 0.01, 0.003, cs), 0, 0, sz * 0.127));
    if (hi) {
      for (const bx of [-1, 1]) {
        for (const by of [-1, 1]) {
          kit.add(
            "machined",
            place(cyl(0.008, 0.008, 0.006, 6), -a3 - 0.005 + bx * 0.057, 0.275 + by * 0.062, sz * 0.134, sz * HALF_PI),
          );
        }
      }
    }
  }
  kit.add("graphite", place(rbox(0.006, 0.17, 0.05, 0.003), -0.2445, 0.09, 0));
  kit.add("glow", place(rbox(0.008, 0.15, 0.03, 0.003), -0.247, 0.09, 0));
  // J3 servo on the far flank.
  kit.add(
    "graphite",
    place(
      lathe(
        [
          [0, 0],
          [0.125, 0],
          [0.125, 0.018],
          [0.115, 0.028],
          [0, 0.028],
        ],
        S,
      ),
      0,
      0,
      0.14,
      HALF_PI,
    ),
  );
  motor(kit, 0.085, 0.14, s, hi, (g) => place(g, 0, 0, 0.168, HALF_PI), Math.PI);
  // Wrist motor pack (J4/J5/J6) behind the elbow.
  kit.add("graphite", place(rbox(0.26, 0.03, 0.235, 0.01), -a3, -0.158, 0));
  for (const [mx, mz] of [
    [-0.178, -0.063],
    [-0.178, 0.063],
    [-0.062, 0],
  ]) {
    motor(kit, 0.054, 0.19, s, hi, (g) => place(g, mx, -0.17, mz, Math.PI));
  }
  // Dress-pack inlet on the camera-side flank.
  kit.add("graphite", place(rbox(0.07, 0.075, 0.05, 0.01), -0.195, -0.095, -0.143));
  kit.add("joint", place(drum(0.04, 0, 0.046, 14, 0.004), -0.195, -0.132, -0.15, Math.PI));
  kit.bake(j3, mats, trash);

  /* ── J4: rolling forearm + wrist fork ── */
  const j4 = new THREE.Group();
  j4.position.set(-a3, ROLL_Y, 0);
  j3.add(j4);
  kit.add(
    "shell",
    lathe(
      [
        [0.1, 0.005],
        [0.106, 0.012],
        [0.106, 0.05],
        [0.098, 0.064],
        [0.08, 0.33],
        [0.08, 0.36],
        [0, 0.36],
      ],
      S,
    ),
  );
  kit.add("accent", band(0.094, 0.1005, 0.074, 0.088, S));
  kit.add("machined", band(0.078, 0.0846, 0.3, 0.311, S));
  kit.add("shell", place(rbox(0.168, 0.07, 0.186, 0.026, hi ? 3 : 2), 0, 0.372, 0));
  {
    const prong = new THREE.Shape();
    prong.moveTo(-0.058, 0.345);
    prong.lineTo(0.058, 0.345);
    prong.lineTo(0.058, WRIST_Y);
    prong.absarc(0, WRIST_Y, 0.058, 0, Math.PI, false);
    prong.closePath();
    for (const sz of [-1, 1]) {
      kit.add("shell", place(prism(prong, 0.032, 0.007, cs), 0, 0, sz * 0.077));
      kit.add(
        "cover",
        place(
          lathe(
            [
              [0.04, 0],
              [0.04, 0.006],
              [0.034, 0.012],
              [0, 0.012],
            ],
            s,
          ),
          0,
          WRIST_Y,
          sz * 0.093,
          sz * HALF_PI,
        ),
      );
    }
  }
  kit.bake(j4, mats, trash);

  /* ── J5: wrist knuckle ── */
  const j5 = new THREE.Group();
  j5.position.y = WRIST_Y;
  j4.add(j5);
  kit.add("graphite", place(drum(0.055, -0.06, 0.06, s, 0.008), 0, 0, 0, HALF_PI));
  kit.add(
    "graphite",
    lathe(
      [
        [0.05, 0],
        [0.05, 0.092],
        [0.045, 0.102],
        [0, 0.102],
      ],
      s,
    ),
  );
  kit.add("joint", place(cyl(0.043, 0.043, 0.02, s, true), 0, 0.111, 0));
  kit.bake(j5, mats, trash);

  /* ── J6: flange, gripper body, eye-in-hand camera ── */
  const j6 = new THREE.Group();
  j6.position.y = d6;
  j5.add(j6);
  kit.add(
    "machined",
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.052, 0.002],
        [0.052, 0.014],
        [0.05, 0.016],
        [0, 0.016],
      ],
      s,
    ),
  );
  kit.add("accent", band(0.045, 0.0545, 0.016, 0.026, s));
  kit.add(
    "graphite",
    lathe(
      [
        [0, 0.026],
        [0.058, 0.026],
        [0.058, 0.04],
        [0.054, 0.044],
        [0, 0.044],
      ],
      s,
    ),
  );
  kit.add("led", place(cyl(0.0588, 0.0588, 0.006, s, true), 0, 0.033, 0));
  kit.add("cover", place(rbox(0.23, 0.068, 0.092, 0.014, hi ? 3 : 2), 0, 0.078, 0));
  kit.add("graphite", place(rbox(0.218, 0.012, 0.05, 0.004), 0, 0.115, 0));
  if (hi) {
    for (const bx of [-1, 1]) {
      kit.add("machined", place(cyl(0.007, 0.007, 0.005, 6), bx * 0.085, 0.078, -0.0475, -HALF_PI));
      kit.add("machined", place(cyl(0.007, 0.007, 0.005, 6), bx * 0.085, 0.078, 0.0475, HALF_PI));
    }
  }
  kit.add("graphite", place(rbox(0.07, 0.054, 0.042, 0.008), 0, 0.08, -0.064));
  kit.add("machined", place(band(0.013, 0.021, 0.104, 0.117, 16), 0, 0, -0.07));
  kit.add("lens", place(drum(0.0135, 0.104, 0.1155, 16, 0.002), 0, 0, -0.07));
  kit.bake(j6, mats, trash);

  /* ── Fingers: built once (inner face at x = 0, reaching +X), mirrored by a half turn ── */
  const fingerR = new THREE.Group();
  kit.add("graphite", place(rbox(0.04, 0.03, 0.058, 0.005), 0.006, 0.134, 0));
  kit.add(
    "machined",
    prism(
      roundedPoly([
        [0, 0.142, 0],
        [0.032, 0.142, 0.008],
        [0.032, 0.196, 0.016],
        [0.015, 0.276, 0.007],
        [0, 0.276, 0],
      ]),
      0.04,
      0.004,
      cs,
    ),
  );
  kit.add("joint", place(rbox(0.005, 0.058, 0.03, 0.002), -0.001, 0.243, 0));
  kit.bake(fingerR, mats, trash);
  const fingerL = fingerR.clone();
  fingerL.rotation.y = Math.PI;
  j6.add(fingerR, fingerL);

  /* ── Perception frustum from the camera along the tool axis ── */
  const frustumGeo = new THREE.BufferGeometry();
  {
    const oy = 0.116;
    const oz = -0.07;
    const far = 0.62;
    const w = 0.2;
    const d = 0.15;
    const c = [
      [w, oy + far, oz + d],
      [-w, oy + far, oz + d],
      [-w, oy + far, oz - d],
      [w, oy + far, oz - d],
    ];
    const pts: number[] = [];
    for (const p of c) pts.push(0, oy, oz, p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) {
      const a = c[i];
      const b = c[(i + 1) % 4];
      pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    frustumGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
  const frustumMat = new THREE.LineBasicMaterial({
    color: ROBOT_GLOW,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    toneMapped: false,
  });
  j6.add(new THREE.LineSegments(frustumGeo, frustumMat));

  /* ── Dress-pack hoses across the shoulder (in the turret frame) and the elbow (in the lower-arm frame) ── */
  const hoseSegs = hi ? 22 : 12;
  const hoseSides = hi ? 10 : 6;
  const shoulderHose = new Hose(mats.hose, HOSE_R, hoseSegs, hoseSides);
  const elbowHose = new Hose(mats.hose, HOSE_R, hoseSegs, hoseSides);
  j1.add(shoulderHose.mesh);
  j2.add(elbowHose.mesh);

  /* ── Per-frame state (no allocation) ── */
  const q = [0, 0, 0, 0, 0, 0];
  const cGlow = new THREE.Color(ROBOT_GLOW);
  const cHot = new THREE.Color(ROBOT_GLOW_HOT);
  let slot = -2;

  const update = (t: number) => {
    armPose(t, q);
    j1.rotation.y = q[0];
    j2.rotation.z = q[1];
    j3.rotation.z = q[2];
    j4.rotation.y = q[3];
    j5.rotation.z = q[4];
    j6.rotation.y = q[5];

    // Gripper + work piece hand-over (the arm is at rest on the nest whenever this flips).
    const grip = demoGrip(t);
    const gap = GRIP_OPEN + (GRIP_CLOSED - GRIP_OPEN) * grip;
    fingerR.position.x = gap;
    fingerL.position.x = -gap;
    const now = demoPart(t);
    if (now !== slot) {
      slot = now;
      if (now < 0) {
        j6.add(part);
        part.position.set(0, TCP_Y, 0);
      } else {
        const st = ARM_STATIONS[now];
        cell.add(part);
        part.position.set(st[0], st[1], st[2]);
      }
    }

    // Shoulder hose: turret outlet → lower clamp on the lower arm.
    const c2 = Math.cos(q[1]);
    const s2 = Math.sin(q[1]);
    const sx = a1 - 0.165 * c2 - 0.4 * s2;
    const sy = d1 - 0.165 * s2 + 0.4 * c2;
    shoulderHose.set(
      -0.2, 0.285, ARM_Z,
      -0.29, 0.58, ARM_Z,
      sx + 0.2 * s2, sy - 0.2 * c2, ARM_Z,
      sx, sy, ARM_Z,
    );

    // Elbow hose: upper clamp → inlet behind the elbow housing.
    const c3 = Math.cos(q[2]);
    const s3 = Math.sin(q[2]);
    const ex = -0.195 * c3 + 0.178 * s3;
    const ey = l2 - 0.195 * s3 - 0.178 * c3;
    elbowHose.set(
      -0.165, 0.76, ARM_Z,
      -0.19, 0.98, ARM_Z,
      ex + 0.24 * s3, ey - 0.24 * c3, -0.15,
      ex, ey, -0.15,
    );

    // Status lights: slow breathing ring/bar, gripper ring brightens as the jaws close.
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.1);
    mats.glow.color.copy(cGlow).lerp(cHot, 0.15 + 0.45 * breathe).multiplyScalar(0.62 + 0.38 * breathe);
    mats.led.color.copy(cGlow).lerp(cHot, grip).multiplyScalar(0.3 + 0.7 * grip);
    mats.lens.emissiveIntensity = 0.3 + 0.5 * (1 - grip) * (0.6 + 0.4 * Math.sin(t * 5.3));
    frustumMat.opacity = 0.06 + 0.16 * (1 - grip);
  };

  const dispose = () => {
    trash.forEach((g) => g.dispose());
    shoulderHose.geometry.dispose();
    elbowHose.geometry.dispose();
    frustumGeo.dispose();
    frustumMat.dispose();
    Object.values(mats).forEach((m) => m.dispose());
  };

  return { root, update, dispose };
}
