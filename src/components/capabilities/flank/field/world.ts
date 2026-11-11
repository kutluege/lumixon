import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FlankQuality } from "../contract";
import { fadeGlsl, fieldGlsl, FIELD_PERIOD, pathZ, terrainHeight, wrapX } from "./terrain";

/** Uniforms shared (by reference) by every field material; written once per frame. */
export function makeFieldUniforms() {
  return {
    uS: { value: 0 },
    uPhase: { value: 0 },
    uSensor: { value: new THREE.Vector3(0, 0.55, 0) },
    uFadeC: { value: new THREE.Vector2() },
    uFadeR: { value: 5.2 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPR: { value: 1 },
    uTime: { value: 0 },
  };
}

export type FieldUniforms = ReturnType<typeof makeFieldUniforms>;

/** Obstacle footprints in tile coordinates (x, z, radius): occupancy cells and ground AO. */
export const MAX_FOOTPRINTS = 12;

export type FieldObstacles = {
  root: THREE.Group;
  /** Each anchor sits at its tile x; the scene sets position.x = wrapX(tileX - s). */
  anchors: { obj: THREE.Object3D; tileX: number }[];
  footprints: THREE.Vector3[];
  /** Surface samples for the point-cloud map (tile coordinates, pushed off the surface). */
  samples: { pos: Float32Array; count: number };
  dispose(): void;
};

/**
 * Patches a lit material so it melts into the section background like the
 * rest of the scene (world fade around the robot + canvas-edge vignette).
 */
function withFade<T extends THREE.MeshStandardMaterial>(mat: T, u: FieldUniforms): T {
  mat.transparent = true;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFieldW;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvFieldW = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vFieldW;\n${fieldGlsl}\n${fadeGlsl}`)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= fieldFade(vFieldW);");
  };
  mat.customProgramCacheKey = () => "field-fade";
  return mat;
}

function rng(seed: number) {
  let k = seed;
  return () => {
    k = (k * 16807) % 2147483647;
    return k / 2147483647;
  };
}

/** Faceted boulder: an icosphere pushed around by a deterministic hash (shared corners stay shared). */
function rockGeometry(seed: number, detail: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h =
      Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 - seed * 0.7) * Math.sin(v.z * 3.3 + seed * 1.3) * 0.22 +
      Math.sin(v.x * 7.3 + v.z * 5.1 + seed * 2.1) * 0.05;
    v.multiplyScalar(1 + h);
    // Flatter underside so it sits in the ground.
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Area-weighted surface samples of a mesh, transformed by `matrix`, pushed `lift` along the normal. */
function sampleSurface(
  geo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  count: number,
  lift: number,
  rand: () => number,
  out: number[],
  minY = -0.02,
) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position as THREE.BufferAttribute;
  const tris = p.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const areas = new Float32Array(tris);
  let total = 0;
  const world: THREE.Vector3[] = [];
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(p, t * 3).applyMatrix4(matrix);
    b.fromBufferAttribute(p, t * 3 + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(p, t * 3 + 2).applyMatrix4(matrix);
    world.push(a.clone(), b.clone(), c.clone());
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    total += n.crossVectors(e1, e2).length() * 0.5;
    areas[t] = total;
  }
  for (let i = 0; i < count; i++) {
    const r = rand() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areas[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const A = world[lo * 3];
    const B = world[lo * 3 + 1];
    const C = world[lo * 3 + 2];
    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    e1.subVectors(B, A);
    e2.subVectors(C, A);
    n.crossVectors(e1, e2).normalize();
    const x = A.x + e1.x * u + e2.x * v + n.x * lift;
    const y = A.y + e1.y * u + e2.y * v + n.y * lift;
    const z = A.z + e1.z * u + e2.z * v + n.z * lift;
    if (y < minY) continue;
    out.push(x, y, z);
  }
  if (src !== geo) src.dispose();
}

/**
 * The real-world clutter the lidar reveals, laid out along one tile: boulders,
 * a pipe run on supports, a stack of crates and a broken wall with a doorway
 * the robot walks through. Everything big stays on the far side of the path
 * (away from the camera) so it never hides the robot.
 */
export function buildObstacles(quality: FlankQuality, u: FieldUniforms): FieldObstacles {
  const high = quality === "high";
  const density = high ? 520 : 200; // samples per m² of surface
  const root = new THREE.Group();
  const anchors: FieldObstacles["anchors"] = [];
  const footprints: THREE.Vector3[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const pts: number[] = [];
  const rand = rng(4242);

  const mats = {
    rock: withFade(new THREE.MeshStandardMaterial({ color: "#2c3149", roughness: 0.86, metalness: 0.06, flatShading: true }), u),
    concrete: withFade(new THREE.MeshStandardMaterial({ color: "#343a55", roughness: 0.9, metalness: 0.04 }), u),
    steel: withFade(new THREE.MeshStandardMaterial({ color: "#6b7590", roughness: 0.32, metalness: 0.85 }), u),
    graphite: withFade(new THREE.MeshStandardMaterial({ color: "#252a38", roughness: 0.5, metalness: 0.6 }), u),
    crate: withFade(new THREE.MeshStandardMaterial({ color: "#2a2f4f", roughness: 0.55, metalness: 0.3 }), u),
  };

  const m4 = new THREE.Matrix4();
  const tmpObj = new THREE.Object3D();

  /** Adds one mesh to `anchor` and samples its surface into the map (tile coordinates). */
  const part = (
    anchor: THREE.Group,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    sampleScale = 1,
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    anchor.add(mesh);
    if (!geos.includes(geo)) geos.push(geo);
    // Surface area estimate from the bounding box, good enough for a sample budget.
    tmpObj.position.set(anchor.position.x + pos[0], anchor.position.y + pos[1], anchor.position.z + pos[2]);
    tmpObj.rotation.set(...rot);
    tmpObj.scale.set(...scale);
    tmpObj.updateMatrix();
    m4.copy(tmpObj.matrix);
    geo.computeBoundingBox();
    const s = new THREE.Vector3();
    geo.boundingBox!.getSize(s).multiply(tmpObj.scale);
    const area = 2 * (s.x * s.y + s.y * s.z + s.x * s.z);
    sampleSurface(geo, m4, Math.round(area * density * sampleScale), 0.012, rand, pts);
    return mesh;
  };

  const anchorAt = (tileX: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(tileX, 0, z);
    root.add(g);
    anchors.push({ obj: g, tileX });
    return g;
  };

  // --- Boulders (two clusters + a lone stone on the near side) ---
  const rockGeos = [rockGeometry(1.3, high ? 2 : 1), rockGeometry(4.1, high ? 2 : 1), rockGeometry(7.7, 1)];
  const rocks: [number, number, number, number, number, number][] = [
    // tileX, dz from path, sx, sy, sz, geo index
    [1.6, -1.55, 0.42, 0.3, 0.36, 0],
    [2.15, -1.9, 0.24, 0.2, 0.26, 1],
    [1.15, -1.25, 0.15, 0.11, 0.14, 2],
    [16.3, 1.35, 0.17, 0.12, 0.15, 1],
    [16.9, -2.3, 0.48, 0.36, 0.42, 2],
    [17.5, -1.7, 0.2, 0.15, 0.22, 0],
    [8.9, 1.5, 0.12, 0.09, 0.11, 0],
  ];
  rocks.forEach(([x, dz, sx, sy, sz, gi], i) => {
    const z = pathZ(x) + dz;
    const a = anchorAt(x, z);
    const y = terrainHeight(x, z) + sy * 0.32;
    part(a, rockGeos[gi], mats.rock, [0, y, 0], [0, i * 1.7, 0], [sx, sy, sz]);
    footprints.push(new THREE.Vector3(x, z, Math.max(sx, sz) * 1.05));
  });

  // --- Pipe run on supports, far side ---
  {
    const x0 = 4.2;
    const len = 4.4;
    const z = pathZ(x0 + len / 2) - 1.75;
    const a = anchorAt(x0 + len / 2, z);
    const pipe = new THREE.CylinderGeometry(1, 1, 1, high ? 20 : 12, 1, true);
    const post = new RoundedBoxGeometry(1, 1, 1, 2, 0.15);
    const base = terrainHeight(x0 + len / 2, z);
    part(a, pipe, mats.steel, [0, base + 0.36, 0], [0, 0, Math.PI / 2], [0.075, len, 0.075]);
    part(a, pipe, mats.steel, [0, base + 0.2, -0.17], [0, 0, Math.PI / 2], [0.055, len, 0.055]);
    for (let k = 0; k < 4; k++) {
      const px = -len / 2 + 0.35 + k * ((len - 0.7) / 3);
      part(a, post, mats.graphite, [px, base + 0.2, -0.08], [0, 0, 0], [0.06, 0.4 + 0.12, 0.06], 0.6);
      part(a, post, mats.graphite, [px, base + 0.43, -0.08], [0, 0, 0], [0.07, 0.035, 0.36], 0.6);
    }
    for (let k = 0; k < 3; k++) footprints.push(new THREE.Vector3(x0 + 0.5 + k * 1.7, z - 0.08, 0.32));
    geos.push(pipe, post);
  }

  // --- Crate stack, far side ---
  {
    const x = 10.6;
    const z = pathZ(x) - 1.45;
    const a = anchorAt(x, z);
    const box = new RoundedBoxGeometry(1, 1, 1, 3, 0.04);
    const y = terrainHeight(x, z);
    part(a, box, mats.crate, [0, y + 0.24, 0], [0, 0.12, 0], [0.5, 0.48, 0.5]);
    part(a, box, mats.crate, [0.08, y + 0.24, -0.58], [0, -0.08, 0], [0.5, 0.48, 0.5]);
    part(a, box, mats.crate, [0.05, y + 0.69, -0.28], [0, 0.35, 0], [0.42, 0.42, 0.42]);
    part(a, box, mats.crate, [-0.6, y + 0.15, 0.2], [0, 0.6, 0], [0.32, 0.3, 0.32]);
    footprints.push(new THREE.Vector3(x, z - 0.2, 0.62));
    footprints.push(new THREE.Vector3(x - 0.6, z + 0.2, 0.26));
    geos.push(box);
  }

  // --- Broken wall across the path: the far wing and its door jamb still
  // stand, the near side has collapsed into low rubble (never hides the robot) ---
  {
    const x = 13.6;
    const zc = pathZ(x);
    const a = anchorAt(x, zc);
    const slab = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
    const door = 0.6; // half-width of the opening
    const t = 0.16; // wall thickness
    part(a, slab, mats.concrete, [0, 0.42, -door - 0.7], [0, 0, 0], [t, 1.04, 1.4]);
    part(a, slab, mats.concrete, [0, 0.24, -door - 1.75], [0, 0, 0], [t, 0.68, 0.7]);
    part(a, slab, mats.graphite, [0, 0.45, -door - 0.03], [0, 0, 0], [t + 0.04, 1.1, 0.07], 0.7);
    part(a, slab, mats.concrete, [0.02, 0.06, door + 0.25], [0.1, 0.3, 0.12], [t, 0.2, 0.5]);
    part(a, slab, mats.concrete, [0.32, 0.0, door + 0.5], [0.05, 1.1, -0.12], [0.12, 0.12, 0.34]);
    footprints.push(new THREE.Vector3(x, zc - door - 0.45, 0.4));
    footprints.push(new THREE.Vector3(x, zc - door - 1.2, 0.4));
    footprints.push(new THREE.Vector3(x, zc - door - 1.9, 0.34));
    footprints.push(new THREE.Vector3(x + 0.15, zc + door + 0.35, 0.28));
    geos.push(slab);
  }

  return {
    root,
    anchors,
    footprints: footprints.slice(0, MAX_FOOTPRINTS),
    samples: { pos: new Float32Array(pts), count: pts.length / 3 },
    dispose() {
      for (const g of new Set(geos)) g.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}

/**
 * Ground samples for the map: a jittered raster over one tile (rows read as
 * scan lines), denser near the path, skipping the inside of obstacles.
 */
export function sampleGround(quality: FlankQuality, footprints: THREE.Vector3[]) {
  const high = quality === "high";
  const step = high ? 0.06 : 0.1;
  const z0 = -5.2;
  const z1 = 3.4;
  const rand = rng(1337);
  const cols = Math.round(FIELD_PERIOD / step);
  const rows = Math.round((z1 - z0) / step);
  const pos: number[] = [];
  const rnd: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5 + (rand() - 0.5) * 0.9) * step;
      const z = z0 + (r + 0.5 + (rand() - 0.5) * 0.35) * step;
      const k = rand();
      const dz = Math.abs(z - pathZ(x));
      // Thin the cloud far from the path (it fades out there anyway).
      if (dz > 2.2 && rand() > 0.75) continue;
      let inside = false;
      for (const f of footprints) {
        const dx = wrapX(x - f.x);
        const dzz = z - f.y;
        if (dx * dx + dzz * dzz < f.z * f.z * 0.55) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      pos.push(x, terrainHeight(x, z) + 0.018, z);
      rnd.push(k);
    }
  }
  return { pos: new Float32Array(pos), rnd: new Float32Array(rnd) };
}
