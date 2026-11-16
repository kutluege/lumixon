import * as THREE from "three";
import type { FlankQuality } from "../contract";
import { band, cyl, drum, join, lathe, place, plain, rbox } from "../robot/geo";
import { ICE_HOT, makeFieldMaterials, type PartKey } from "../robot/materials";
import { HEAD_Y } from "./timeline";

/**
 * The sonar node: a cylindrical transducer array on a seabed tripod, in the
 * quadruped's material family (pearl shell, graphite frame, indigo covers,
 * machined steel, one burgundy tab, ice status light). Model space: metres,
 * feet on y = 0, mast on the y axis; the acoustic centre is at y = HEAD_Y.
 */

type Bins = Map<PartKey, THREE.BufferGeometry[]>;

function add(b: Bins, key: PartKey, ...geos: THREE.BufferGeometry[]) {
  let list = b.get(key);
  if (!list) b.set(key, (list = []));
  list.push(...geos);
}

/** Foot pads: radius of the circle they stand on, and their bearing. */
export const FOOT_R = 0.66;
export const FOOT_PAD = 0.095;
export const FOOT_ANGLES = [0.35, 0.35 + (2 * Math.PI) / 3, 0.35 + (4 * Math.PI) / 3] as const;

const HUB_Y = 0.6;
/** Bottom and top of the transducer array. */
const ARR_Y0 = HEAD_Y - 0.15;
const ARR_Y1 = HEAD_Y + 0.15;
const ARR_R = 0.185;

/** Cylinder of radius r between two points. */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, seg: number) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = cyl(r, r, d.length(), seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  const m = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

function buildNode(quality: FlankQuality): Bins {
  const b: Bins = new Map();
  const high = quality === "high";
  const seg = high ? 40 : 20;
  const tube = high ? 12 : 8;

  // --- Tripod ----------------------------------------------------------------
  const feet = FOOT_ANGLES.map((a) => new THREE.Vector3(Math.cos(a) * FOOT_R, 0, Math.sin(a) * FOOT_R));
  feet.forEach((f, i) => {
    const out = f.clone().setY(0).normalize();
    const top = out.clone().multiplyScalar(0.105).setY(HUB_Y - 0.03);
    const ankle = f.clone().setY(0.06);
    // Pad, ankle ball, leg (pearl tube with dark sleeves and a steel ring at each end).
    add(b, "joint", place(drum(FOOT_PAD, 0, 0.024, tube * 2, 0.006), f.x, 0, f.z));
    add(b, "steel", place(drum(FOOT_PAD * 0.55, 0.024, 0.036, tube * 2, 0.004), f.x, 0, f.z));
    add(b, "joint", place(plain(new THREE.SphereGeometry(0.036, tube, 8)), ankle.x, ankle.y, ankle.z));
    const dir = new THREE.Vector3().subVectors(top, ankle);
    const len = dir.length();
    dir.normalize();
    const at = (s: number) => ankle.clone().addScaledVector(dir, s);
    add(b, "shell", strut(at(0.1), at(len - 0.09), 0.027, tube));
    add(b, "joint", strut(at(0.02), at(0.1), 0.031, tube), strut(at(len - 0.09), at(len), 0.031, tube));
    add(b, "steel", strut(at(0.1), at(0.112), 0.034, tube), strut(at(len - 0.102), at(len - 0.09), 0.034, tube));
    // Spreader bars between neighbouring legs, a third of the way up.
    const next = feet[(i + 1) % feet.length];
    const nOut = next.clone().setY(0).normalize();
    const nTop = nOut.clone().multiplyScalar(0.105).setY(HUB_Y - 0.03);
    const nAnkle = next.clone().setY(0.06);
    const nDir = new THREE.Vector3().subVectors(nTop, nAnkle).normalize();
    add(b, "steel", strut(at(0.26), nAnkle.clone().addScaledVector(nDir, 0.26), 0.01, 6));
  });

  // Hub and mast.
  add(b, "core", drum(0.125, HUB_Y - 0.06, HUB_Y + 0.02, seg, 0.012));
  add(b, "steel", band(0.118, 0.13, HUB_Y - 0.026, HUB_Y - 0.014, seg));
  add(b, "joint", drum(0.052, HUB_Y + 0.02, ARR_Y0 - 0.09, tube * 2, 0.004));
  add(b, "steel", band(0.05, 0.058, HUB_Y + 0.06, HUB_Y + 0.072, tube * 2), band(0.05, 0.058, ARR_Y0 - 0.125, ARR_Y0 - 0.113, tube * 2));

  // Electronics bottle slung under the hub, with a burgundy end cap tab.
  add(b, "panel", place(drum(0.062, -0.17, 0.17, tube * 2, 0.012), 0, HUB_Y - 0.15, 0, 0, 0.5, Math.PI / 2));
  add(
    b,
    "steel",
    place(band(0.06, 0.067, -0.185, -0.165, tube * 2), 0, HUB_Y - 0.15, 0, 0, 0.5, Math.PI / 2),
    place(band(0.06, 0.067, 0.165, 0.185, tube * 2), 0, HUB_Y - 0.15, 0, 0, 0.5, Math.PI / 2),
  );
  add(b, "joint", place(rbox(0.05, 0.1, 0.05, 0.012, 1), 0, HUB_Y - 0.085, 0));

  // --- Transducer head -------------------------------------------------------
  // Flared pearl collar up to the array.
  add(
    b,
    "shell",
    lathe(
      [
        [0.058, ARR_Y0 - 0.09],
        [0.075, ARR_Y0 - 0.085],
        [0.17, ARR_Y0 - 0.035],
        [ARR_R + 0.012, ARR_Y0 - 0.03],
        [ARR_R + 0.012, ARR_Y0 - 0.006],
        [0.058, ARR_Y0 - 0.006],
      ],
      seg,
    ),
  );
  // Indigo cover band and the ice status ring under the array.
  add(b, "glow", band(ARR_R - 0.004, ARR_R + 0.006, ARR_Y0 - 0.006, ARR_Y0 + 0.004, seg));
  // The array itself: a mirror-black acoustic window behind pearl staves.
  add(b, "visor", drum(ARR_R - 0.004, ARR_Y0 + 0.004, ARR_Y1 - 0.004, seg, 0.002));
  const staves = high ? 20 : 14;
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * Math.PI * 2;
    add(
      b,
      "shell",
      place(rbox(0.014, ARR_Y1 - ARR_Y0 - 0.03, 0.02, 0.005, 1), Math.cos(a) * ARR_R, HEAD_Y, -Math.sin(a) * ARR_R, 0, a + Math.PI / 2, 0),
    );
  }
  add(b, "panel", band(ARR_R - 0.002, ARR_R + 0.009, HEAD_Y - 0.022, HEAD_Y + 0.022, seg));
  add(b, "glow", band(ARR_R - 0.004, ARR_R + 0.006, ARR_Y1 - 0.004, ARR_Y1 + 0.006, seg));
  // Pearl cap, burgundy ring, lifting eye.
  add(
    b,
    "shell",
    lathe(
      [
        [0.0001, ARR_Y1 + 0.006],
        [ARR_R + 0.012, ARR_Y1 + 0.006],
        [ARR_R + 0.012, ARR_Y1 + 0.034],
        [ARR_R - 0.02, ARR_Y1 + 0.07],
        [0.09, ARR_Y1 + 0.094],
        [0.0001, ARR_Y1 + 0.1],
      ],
      seg,
    ),
  );
  add(b, "accent", band(0.07, 0.092, ARR_Y1 + 0.092, ARR_Y1 + 0.102, seg));
  add(b, "joint", drum(0.04, ARR_Y1 + 0.098, ARR_Y1 + 0.115, tube * 2, 0.004));
  add(b, "steel", place(plain(new THREE.TorusGeometry(0.03, 0.007, 6, tube * 2)), 0, ARR_Y1 + 0.142, 0));

  // --- Cable to shore, lying on the sand --------------------------------------
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, HUB_Y - 0.2, 0.06),
    new THREE.Vector3(0.2, 0.2, 0.32),
    new THREE.Vector3(0.45, 0.02, 0.75),
    new THREE.Vector3(0.95, 0.018, 1.4),
    new THREE.Vector3(1.2, 0.018, 2.4),
    new THREE.Vector3(1.9, 0.018, 3.3),
    new THREE.Vector3(2.2, 0.018, 4.6),
  ]);
  add(b, "rubber", plain(new THREE.TubeGeometry(cable, high ? 48 : 24, 0.014, 6, false)));
  return b;
}

export type SonarNode = {
  group: THREE.Group;
  /** Brightness of the status rings: 0 idle … 1 at the instant of a ping. */
  setPulse(k: number): void;
  dispose(): void;
};

export function buildSonarNode(quality: FlankQuality): SonarNode {
  const mats = makeFieldMaterials(quality);
  const group = new THREE.Group();
  group.name = "sonar-node";
  const geos: THREE.BufferGeometry[] = [];
  for (const [key, list] of buildNode(quality)) {
    const geo = join(list);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mats[key]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glow = mats.glow as THREE.MeshBasicMaterial;
  const hot = new THREE.Color(ICE_HOT);
  return {
    group,
    setPulse(k) {
      glow.color.copy(hot).multiplyScalar(0.3 + 1.1 * k);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      new Set(Object.values(mats)).forEach((m) => m.dispose());
    },
  };
}
