import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FlankQuality } from "../contract";
import { join, lathe, place, prism, roundedPoly } from "../robot/geo";
import { glowBlend } from "../robot/materials";
import { buildDiver } from "./diver";
import { makeSonarUniforms, type SonarUniforms } from "./glsl";
import { buildSonarNode, FOOT_ANGLES, FOOT_PAD, FOOT_R } from "./head";
import { ALERT, ICE, ICE_HOT, INDIGO, withFade } from "./materials";
import {
  bubbleFrag,
  bubbleVert,
  cloudFrag,
  cloudVert,
  domeFrag,
  domeVert,
  MAX_OBS,
  nodeFrag,
  nodeVert,
  predictFrag,
  predictVert,
  reticleFrag,
  reticleVert,
  seabedFrag,
  seabedVert,
  snowFrag,
  snowVert,
  stalkFrag,
  stalkVert,
  tickFrag,
  tickVert,
  trackFrag,
  trackVert,
} from "./shaders";
import {
  BASE_X,
  BASE_Z,
  BREATH,
  BUBBLE_LIFE,
  BUBBLES_PER_BREATH,
  DETECTIONS,
  DIVER_IN,
  DIVER_MID,
  DIVER_OUT,
  diverAt,
  diverDir,
  FISH_MAX,
  fishAt,
  hash1,
  MOOR_X,
  MOOR_Z,
  PING_PERIOD,
  PING_SPEED,
  seabedH,
  smooth,
  TRACK_T0,
  TRACK_T1,
  type SonarState,
  type V3,
} from "./timeline";

const C = (hex: string) => new THREE.Color(hex);

function rng(seed: number) {
  let k = seed;
  return () => {
    k = (k * 16807) % 2147483647;
    return k / 2147483647;
  };
}

function shader(u: SonarUniforms, vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform>, opts: THREE.ShaderMaterialParameters = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    ...opts,
    uniforms: { ...u, ...extra },
  });
}

/** Flat grid in the xz plane; the vertex shader lifts it onto the dunes. */
function gridGeometry(x0: number, x1: number, z0: number, z1: number, step: number) {
  const nx = Math.round((x1 - x0) / step) + 1;
  const nz = Math.round((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3;
      pos[k] = x0 + i * step;
      pos[k + 2] = z0 + j * step;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let n = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], n);
      n += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Faceted boulder: an icosphere pushed around by a deterministic hash, flat underneath. */
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
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Area-weighted surface samples of a mesh, transformed by `matrix`, pushed `lift` along the normal. */
function sampleSurface(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, count: number, lift: number, rand: () => number, out: number[]) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position as THREE.BufferAttribute;
  const tris = p.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const areas = new Float32Array(tris);
  const world: THREE.Vector3[] = [];
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(p, t * 3).applyMatrix4(matrix);
    b.fromBufferAttribute(p, t * 3 + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(p, t * 3 + 2).applyMatrix4(matrix);
    world.push(a.clone(), b.clone(), c.clone());
    total += nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).length() * 0.5;
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
    let s = rand();
    let v = rand();
    if (s + v > 1) {
      s = 1 - s;
      v = 1 - v;
    }
    e1.subVectors(world[lo * 3 + 1], A);
    e2.subVectors(world[lo * 3 + 2], A);
    nrm.crossVectors(e1, e2).normalize();
    const y = A.y + e1.y * s + e2.y * v + nrm.y * lift;
    if (y < 0.0) continue;
    out.push(A.x + e1.x * s + e2.x * v + nrm.x * lift, y, A.z + e1.z * s + e2.z * v + nrm.z * lift);
  }
  if (src !== geo) src.dispose();
}

/** Boulders: x, z, sx, sy, sz, geometry index. Kept clear of the swimmer's track and the tripod. */
const ROCKS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-3.25, 1.35, 0.56, 0.4, 0.46, 0],
  [-2.55, 1.85, 0.3, 0.22, 0.3, 1],
  [-3.95, 0.8, 0.2, 0.15, 0.18, 2],
  [-0.2, 2.6, 0.3, 0.2, 0.27, 1],
  [4.35, -2.3, 0.44, 0.32, 0.4, 2],
  [4.95, -1.75, 0.2, 0.15, 0.2, 0],
  [-4.9, -1.0, 0.24, 0.17, 0.22, 1],
  [1.0, 3.3, 0.2, 0.14, 0.18, 2],
];

/** Mooring chain: link pitch (m) and the height it is drawn to (it fades out toward the surface). */
const LINK = 0.108;
const CHAIN_TOP = 5.2;

const DIVER_SCALE = 1.12;
/** Shift of the fish school on a square panel (m). */
const FISH_NARROW_X = -1.45;
const FISH_NARROW_Z = -0.3;

export type SonarWorld = ReturnType<typeof buildSonarWorld>;

/**
 * Everything in the sonar scene except the lights and the camera, built
 * imperatively once per quality tier. Per frame the scene calls `update`;
 * nothing allocates after construction.
 */
export function buildSonarWorld(quality: FlankQuality) {
  const high = quality === "high";
  const u = makeSonarUniforms();
  const root = new THREE.Group();
  root.name = "sonar-world";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const instanced: THREE.InstancedMesh[] = [];
  const rand = rng(90210);
  const keep = <T extends THREE.Object3D>(obj: T, order: number) => {
    obj.frustumCulled = false;
    obj.renderOrder = order;
    root.add(obj);
    return obj;
  };

  // --- Sensor and target (lit solids) -------------------------------------
  const node = buildSonarNode(quality);
  node.group.position.set(BASE_X, 0, BASE_Z);
  root.add(node.group);
  const diver = buildDiver(quality, u);
  diver.group.rotation.order = "YXZ";
  // A touch larger than life: the swimmer is the subject and must read at phone size.
  diver.group.scale.setScalar(DIVER_SCALE);
  root.add(diver.group);

  // --- Static clutter: boulders and a mooring (lit, melting into the page) --
  const lit = {
    rock: withFade(new THREE.MeshStandardMaterial({ color: "#2c3149", roughness: 0.86, metalness: 0.06, flatShading: true }), u, "world"),
    concrete: withFade(new THREE.MeshStandardMaterial({ color: "#343a55", roughness: 0.9, metalness: 0.04 }), u, "world"),
    steel: withFade(new THREE.MeshStandardMaterial({ color: "#6b7590", roughness: 0.34, metalness: 0.85 }), u, "world"),
    fish: withFade(new THREE.MeshStandardMaterial({ color: "#8f96c9", roughness: 0.34, metalness: 0.55, emissive: C("#4e5283"), emissiveIntensity: 0.25 }), u, "solid"),
  };
  mats.push(...Object.values(lit));

  const footprints: THREE.Vector3[] = [];
  const objPts: number[] = [];
  const density = high ? 240 : 110;
  const tmp = new THREE.Object3D();
  const solid = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number], sample = 1) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    root.add(mesh);
    if (sample > 0) {
      tmp.position.set(...pos);
      tmp.rotation.set(...rot);
      tmp.scale.set(...scale);
      tmp.updateMatrix();
      geo.computeBoundingBox();
      const s = new THREE.Vector3();
      geo.boundingBox!.getSize(s).multiply(tmp.scale);
      const area = 2 * (s.x * s.y + s.y * s.z + s.x * s.z);
      sampleSurface(geo, tmp.matrix, Math.round(area * density * sample), 0.014, rand, objPts);
    }
    return mesh;
  };

  const rockGeos = [rockGeometry(1.3, high ? 2 : 1), rockGeometry(4.1, high ? 2 : 1), rockGeometry(7.7, 1)];
  geos.push(...rockGeos);
  ROCKS.forEach(([x, z, sx, sy, sz, gi], i) => {
    solid(rockGeos[gi], lit.rock, [x, seabedH(x, z) + sy * 0.3, z], [0, i * 1.7, 0], [sx, sy, sz]);
    footprints.push(new THREE.Vector3(x, z, Math.max(sx, sz) * 1.05));
  });

  // Mooring: clump weight, shackle, and a chain rising out of frame.
  const sway = new THREE.Group();
  {
    const y0 = seabedH(MOOR_X, MOOR_Z);
    const block = new RoundedBoxGeometry(1, 1, 1, 3, 0.06);
    geos.push(block);
    solid(block, lit.concrete, [MOOR_X, y0 + 0.17, MOOR_Z], [0, 0.4, 0], [0.74, 0.4, 0.74]);
    solid(block, lit.concrete, [MOOR_X, y0 + 0.4, MOOR_Z], [0, 0.4, 0], [0.4, 0.1, 0.4], 0.5);
    footprints.push(new THREE.Vector3(MOOR_X, MOOR_Z, 0.6));
    const eye = new THREE.TorusGeometry(0.07, 0.018, 8, 16);
    geos.push(eye);
    solid(eye, lit.steel, [MOOR_X, y0 + 0.5, MOOR_Z], [0, 0.4, 0], [1, 1, 1], 0);

    const link = new THREE.TorusGeometry(0.046, 0.015, 6, high ? 12 : 8);
    link.scale(0.72, 1.3, 1);
    geos.push(link);
    const n = Math.floor((CHAIN_TOP - 0.56) / LINK);
    const chain = new THREE.InstancedMesh(link, lit.steel, n);
    const m = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const y = i * LINK;
      // A slight lean with the current; alternate links turn a quarter.
      m.position.set(0.012 * y * y, y, -0.006 * y * y);
      m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, -0.024 * y);
      m.updateMatrix();
      chain.setMatrixAt(i, m.matrix);
      if (i % 2 === 0 && y < 3.2) objPts.push(MOOR_X + 0.012 * y * y, y0 + 0.57 + y, MOOR_Z - 0.006 * y * y);
    }
    chain.instanceMatrix.needsUpdate = true;
    chain.frustumCulled = false;
    instanced.push(chain);
    sway.position.set(MOOR_X, y0 + 0.57, MOOR_Z);
    sway.add(chain);
    root.add(sway);
  }

  // --- Seabed ---------------------------------------------------------------
  const seabedGeo = gridGeometry(-13.5, 12.5, -12.5, 8.5, high ? 0.25 : 0.5);
  const obs = Array.from({ length: MAX_OBS }, (_, i) => footprints[i]?.clone() ?? new THREE.Vector3());
  const feet = FOOT_ANGLES.map((a) => new THREE.Vector3(BASE_X + Math.cos(a) * FOOT_R, BASE_Z + Math.sin(a) * FOOT_R, FOOT_PAD));
  const seabedMat = shader(
    u,
    seabedVert,
    seabedFrag(high),
    {
      uObs: { value: obs },
      uFeet: { value: feet },
      uBaseCol: { value: C("#10142a") },
      uLit: { value: C("#333a68") },
      uIce: { value: C("#cfdcea") },
      uIndigo: { value: C(INDIGO) },
      uAlert: { value: C(ALERT) },
      uKey: { value: new THREE.Vector3(-0.5, 0.72, 0.42).normalize() },
      uCaust: { value: 0 },
    },
    { depthWrite: true },
  );
  keep(new THREE.Mesh(seabedGeo, seabedMat), -3);
  geos.push(seabedGeo);
  mats.push(seabedMat);

  // Shadow catcher under the tripod (the sand there is flat), high tier only.
  if (high) {
    const cg = new THREE.PlaneGeometry(3.4, 3.4);
    cg.rotateX(-Math.PI / 2);
    const cm = new THREE.ShadowMaterial({ color: "#02030a", opacity: 0.5, depthWrite: false });
    const catcher = new THREE.Mesh(cg, cm);
    catcher.receiveShadow = true;
    catcher.position.set(BASE_X, 0.006, BASE_Z);
    catcher.renderOrder = -2;
    root.add(catcher);
    geos.push(cg);
    mats.push(cm);
  }

  // --- Returns cloud: a polar raster on the sand + samples of the clutter ----
  {
    const pos: number[] = [];
    const rnd: number[] = [];
    const kind: number[] = [];
    const dr = high ? 0.085 : 0.14;
    const arc = dr * 1.35;
    const thin = high ? 0.6 : 0.5;
    for (let r = 0.85; r < 8.3; r += dr) {
      const n = Math.round((2 * Math.PI * r) / arc);
      const off = rand() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const j1 = rand();
        const j2 = rand();
        const k = rand();
        if (rand() > thin) continue;
        const a = off + ((i + (j1 - 0.5) * 0.7) / n) * Math.PI * 2;
        const rr = r + (j2 - 0.5) * dr * 0.35;
        const x = BASE_X + rr * Math.cos(a);
        const z = BASE_Z + rr * Math.sin(a);
        let inside = false;
        for (const f of footprints) {
          const dx = x - f.x;
          const dz = z - f.y;
          if (dx * dx + dz * dz < f.z * f.z * 0.55) {
            inside = true;
            break;
          }
        }
        if (inside) continue;
        pos.push(x, seabedH(x, z) + 0.02, z);
        rnd.push(k);
        kind.push(0);
      }
    }
    for (let i = 0; i < objPts.length; i += 3) {
      pos.push(objPts[i], objPts[i + 1], objPts[i + 2]);
      rnd.push(rand());
      kind.push(1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aRnd", new THREE.Float32BufferAttribute(rnd, 1));
    g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
    const m = shader(u, cloudVert, cloudFrag, {
      uSize: { value: high ? 2.1 : 2.5 },
      uLow: { value: C("#5d63a0") },
      uHigh: { value: C("#c2d0e2") },
      uHot: { value: C("#f2f6fb") },
      uOpacity: { value: 1 },
    });
    keep(new THREE.Points(g, m), 1);
    geos.push(g);
    mats.push(m);
  }

  // --- Wavefronts in the water volume: the two youngest pings -----------------
  const domeGeo = new THREE.SphereGeometry(1, high ? 72 : 40, high ? 36 : 20);
  geos.push(domeGeo);
  const domes = [0, 1].map(() => {
    const m = glowBlend(
      shader(u, domeVert, domeFrag, { uR: { value: 1 }, uColor: { value: C(ICE) }, uOpacity: { value: 0.85 } }, { side: THREE.DoubleSide }),
    );
    keep(new THREE.Mesh(domeGeo, m), 2);
    mats.push(m);
    return m;
  });

  // --- Track: the swum path on the sand, revealed as returns come in ----------
  {
    const segs = high ? 220 : 120;
    const pos = new Float32Array((segs + 1) * 2 * 3);
    const aTime = new Float32Array((segs + 1) * 2);
    const aSide = new Float32Array((segs + 1) * 2);
    const idx: number[] = [];
    const p: V3 = { x: 0, y: 0, z: 0 };
    const d: V3 = { x: 0, y: 0, z: 0 };
    const half = 0.034;
    for (let i = 0; i <= segs; i++) {
      const t = TRACK_T0 + ((TRACK_T1 - TRACK_T0) * i) / segs;
      diverAt(t, p);
      diverDir(t, d);
      const x = p.x + d.x * DIVER_MID;
      const z = p.z + d.z * DIVER_MID;
      for (let s = 0; s < 2; s++) {
        const side = s ? 1 : -1;
        const k = i * 2 + s;
        const px = x - d.z * side * half;
        const pz = z + d.x * side * half;
        pos[k * 3] = px;
        pos[k * 3 + 1] = seabedH(px, pz) + 0.03;
        pos[k * 3 + 2] = pz;
        aTime[k] = t;
        aSide[k] = side;
      }
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aTime", new THREE.BufferAttribute(aTime, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    g.setIndex(idx);
    const m = shader(u, trackVert, trackFrag, { uIce: { value: C(ICE_HOT) }, uAlert: { value: C(ALERT) }, uDash: { value: 1.9 } }, { side: THREE.DoubleSide });
    keep(new THREE.Mesh(g, m), -1);
    geos.push(g);
    mats.push(m);
  }

  // Predicted path ahead of the swimmer.
  {
    const segs = 24;
    const aS = new Float32Array((segs + 1) * 2);
    const aSide = new Float32Array((segs + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      aS[i * 2] = aS[i * 2 + 1] = i / segs;
      aSide[i * 2] = -1;
      aSide[i * 2 + 1] = 1;
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(aS.length * 3), 3));
    g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    g.setIndex(idx);
    const m = shader(u, predictVert, predictFrag, { uAlert: { value: C(ALERT) }, uWidth: { value: 0.03 } }, { side: THREE.DoubleSide });
    keep(new THREE.Mesh(g, m), -1);
    geos.push(g);
    mats.push(m);
  }

  // Returns from the swimmer: a plot node on the sand and an echo ring in the water, per return.
  {
    const n = DETECTIONS.length;
    const pos = new Float32Array(n * 2 * 3);
    const aTau = new Float32Array(n * 2);
    const aKind = new Float32Array(n * 2);
    DETECTIONS.forEach((d, i) => {
      pos.set([d.x, seabedH(d.x, d.z) + 0.04, d.z], i * 6);
      pos.set([d.x, d.y, d.z], i * 6 + 3);
      aTau[i * 2] = aTau[i * 2 + 1] = d.tau;
      aKind[i * 2 + 1] = 1;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aTau", new THREE.BufferAttribute(aTau, 1));
    g.setAttribute("aKind", new THREE.BufferAttribute(aKind, 1));
    const m = shader(u, nodeVert, nodeFrag, { uSize: { value: 18 }, uIce: { value: C(ICE_HOT) }, uAlert: { value: C(ALERT) }, uHot: { value: C("#ffffff") } }, { depthTest: false });
    keep(new THREE.Points(g, m), 8);
    geos.push(g);
    mats.push(m);
  }

  // Lock: bracket reticle (billboard) and a dashed stalk down to the ring on the sand.
  const RET_W = 2.95;
  const RET_H = 1.55;
  const reticleGeo = new THREE.PlaneGeometry(1, 1);
  const reticleMat = new THREE.ShaderMaterial({
    vertexShader: reticleVert,
    fragmentShader: reticleFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: { uSize: { value: new THREE.Vector2(RET_W, RET_H) }, uColor: { value: C(ICE_HOT) }, uOpacity: { value: 0 }, uCorner: { value: 0.34 }, uPR: u.uPR },
  });
  const reticle = keep(new THREE.Mesh(reticleGeo, reticleMat), 9);
  geos.push(reticleGeo);
  mats.push(reticleMat);
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array([-1, 1, -1, 1]), 1));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    const m = shader(u, stalkVert, stalkFrag, { uIce: { value: C(ICE_HOT) }, uAlert: { value: C(ALERT) }, uWidth: { value: 0.016 } }, { side: THREE.DoubleSide });
    keep(new THREE.Mesh(g, m), 8);
    geos.push(g);
    mats.push(m);
  }
  const ice = C(ICE_HOT);
  const alert = C(ALERT);

  // --- Fish: a small school circling the mooring, with quiet "normal" ticks ----
  const fishCount = Math.min(FISH_MAX, high ? 16 : 9);
  const fishGeo = (() => {
    const body = place(
      lathe(
        [
          [0.0001, -0.13],
          [0.022, -0.11],
          [0.046, -0.02],
          [0.04, 0.06],
          [0.016, 0.115],
          [0.0001, 0.13],
        ],
        high ? 10 : 6,
        false,
      ),
      0,
      0,
      0,
      0,
      0,
      -Math.PI / 2,
    );
    body.scale(1, 1, 0.42);
    const tail = prism(
      roundedPoly([
        [-0.105, 0, 0],
        [-0.2, 0.062, 0.006],
        [-0.175, 0, 0],
        [-0.2, -0.062, 0.006],
      ]),
      0.008,
      0.002,
      2,
    );
    const g = join([body, tail]);
    g.scale(1.3, 1.3, 1.3);
    return g;
  })();
  geos.push(fishGeo);
  const fish = new THREE.InstancedMesh(fishGeo, lit.fish, fishCount);
  fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  keep(fish, 6);
  instanced.push(fish);
  const tickGeo = new THREE.BufferGeometry();
  const tickPos = new THREE.BufferAttribute(new Float32Array(fishCount * 3), 3);
  tickPos.setUsage(THREE.DynamicDrawUsage);
  tickGeo.setAttribute("position", tickPos);
  const tickMat = shader(u, tickVert, tickFrag, { uSize: { value: 14 }, uColor: { value: C(ICE_HOT) }, uOpacity: { value: 0.8 } });
  keep(new THREE.Points(tickGeo, tickMat), 7);
  geos.push(tickGeo);
  mats.push(tickMat);
  const fishObj = new THREE.Object3D();
  fishObj.rotation.order = "YZX";
  const f0: V3 = { x: 0, y: 0, z: 0 };
  const f1: V3 = { x: 0, y: 0, z: 0 };

  // --- Marine snow -----------------------------------------------------------
  {
    const n = high ? 520 : 200;
    const boxMin = new THREE.Vector3(-8.5, 0.1, -8);
    const boxSize = new THREE.Vector3(17, 5.4, 15.5);
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = boxMin.x + rand() * boxSize.x;
      pos[i * 3 + 1] = boxMin.y + rand() * boxSize.y;
      pos[i * 3 + 2] = boxMin.z + rand() * boxSize.z;
      rnd[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    const m = shader(u, snowVert, snowFrag, {
      uBoxMin: { value: boxMin },
      uBoxSize: { value: boxSize },
      uSize: { value: high ? 2.4 : 2.8 },
      uColor: { value: C("#cfdcea") },
      uOpacity: { value: 0.6 },
    });
    keep(new THREE.Points(g, m), 7);
    geos.push(g);
    mats.push(m);
  }

  // --- Bubbles from the regulator --------------------------------------------
  const breaths = Math.ceil(BUBBLE_LIFE / BREATH) + 1;
  const bubbleCount = breaths * BUBBLES_PER_BREATH;
  const bubblePos = new THREE.BufferAttribute(new Float32Array(bubbleCount * 3), 3);
  const bubbleLife = new THREE.BufferAttribute(new Float32Array(bubbleCount), 1);
  bubblePos.setUsage(THREE.DynamicDrawUsage);
  bubbleLife.setUsage(THREE.DynamicDrawUsage);
  {
    const rnd = new Float32Array(bubbleCount);
    for (let i = 0; i < bubbleCount; i++) rnd[i] = hash1(i * 1.7 + 0.3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", bubblePos);
    g.setAttribute("aLife", bubbleLife);
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    const m = shader(u, bubbleVert, bubbleFrag, { uSize: { value: 7.5 }, uColor: { value: C("#e6edf5") } });
    keep(new THREE.Points(g, m), 7);
    geos.push(g);
    mats.push(m);
  }
  const bp: V3 = { x: 0, y: 0, z: 0 };
  const bd: V3 = { x: 0, y: 0, z: 0 };

  return {
    root,
    uniforms: u,
    /** The tripod (shadow target for the key light). */
    node: node.group,
    /**
     * Per frame. `t` is absolute time, `s` the timeline state for it, `camera`
     * the scene camera (the reticle is a billboard), `narrow` 0 on a 4:3 or
     * wider panel … 1 on a square one (the school moves with the framing).
     */
    update(t: number, s: SonarState, camera: THREE.Camera, narrow: number) {
      const tl = s.tl;
      u.uT.value = tl;
      u.uTime.value = t % 3600;
      u.uPingA.value = s.pingAge;
      u.uDiver.value.set(s.mid.x, s.mid.y, s.mid.z);
      u.uDiverDir.value.set(s.dir.x, s.dir.z);
      u.uDiverFade.value = s.fade;
      u.uCand.value = s.cand;
      u.uLock.value = s.lock;
      u.uLockTint.value = s.lockTint;
      u.uTrack.value = s.track;
      u.uReveal.value = s.reveal;
      u.uEcho.value = s.echo;
      // Caustic clock, wrapped on the pattern's own period.
      seabedMat.uniforms.uCaust.value = (t * 0.45) % (Math.PI * 48);

      // Sensor: the status rings flash when it fires.
      node.setPulse(Math.exp(-s.pingAge * 3.2));
      domes[0].uniforms.uR.value = PING_SPEED * s.pingAge;
      domes[1].uniforms.uR.value = PING_SPEED * (s.pingAge + PING_PERIOD);

      // Target.
      diver.group.visible = s.fade > 0.004;
      diver.group.position.set(s.pelvis.x, s.pelvis.y, s.pelvis.z);
      diver.group.rotation.y = Math.atan2(-s.dir.z, s.dir.x);
      diver.update(t, Math.atan2(s.dir.y, 0.3) * 0.6);

      // Reticle: loose and ice-coloured on the first return, snaps tight and turns alert on the lock.
      const snap = s.sinceLock < 0 ? 0 : Math.exp(-s.sinceLock * 5);
      const k = 1 + 0.12 * (1 - s.lockTint) + 0.3 * snap * s.lockTint + 0.012 * Math.sin(tl * 2.4) * s.lock;
      reticle.position.set(s.mid.x - s.dir.x * 0.05, s.mid.y + 0.06, s.mid.z - s.dir.z * 0.05);
      reticle.quaternion.copy(camera.quaternion);
      reticle.scale.set(RET_W * k, RET_H * k, 1);
      reticleMat.uniforms.uSize.value.set(RET_W * k, RET_H * k);
      reticleMat.uniforms.uColor.value.copy(ice).lerp(alert, s.lockTint);
      reticleMat.uniforms.uOpacity.value = Math.max(s.cand * 0.38 * (1 - s.lockTint), s.lock);
      reticle.visible = reticleMat.uniforms.uOpacity.value > 0.004;

      // Mooring chain sways a little with the swell.
      sway.rotation.z = 0.02 * Math.sin((t * Math.PI * 2) / 8);
      sway.rotation.x = 0.014 * Math.sin((t * Math.PI * 2) / 11 + 1);

      // Fish.
      for (let i = 0; i < fishCount; i++) {
        fishAt(i, t, f0);
        fishAt(i, t + 0.35, f1);
        // On a square panel the camera swings round and the mooring leaves the
        // frame; the school drifts over so the benign clutter stays in view.
        f0.x += FISH_NARROW_X * narrow;
        f0.z += FISH_NARROW_Z * narrow;
        f1.x += FISH_NARROW_X * narrow;
        f1.z += FISH_NARROW_Z * narrow;
        const vx = f1.x - f0.x;
        const vy = f1.y - f0.y;
        const vz = f1.z - f0.z;
        fishObj.position.set(f0.x, f0.y, f0.z);
        fishObj.rotation.set(0, Math.atan2(-vz, vx) + 0.16 * Math.sin(t * 8 + i * 1.9), Math.atan2(vy, Math.hypot(vx, vz)));
        fishObj.scale.setScalar(0.72 + 0.5 * hash1(i * 2.9 + 0.7));
        fishObj.updateMatrix();
        fish.setMatrixAt(i, fishObj.matrix);
        tickPos.setXYZ(i, f0.x, f0.y, f0.z);
      }
      fish.instanceMatrix.needsUpdate = true;
      tickPos.needsUpdate = true;

      // Bubbles: each breath releases a burst at the regulator, which rises, spreads and thins out.
      const breath = Math.floor(tl / BREATH);
      for (let b = 0; b < breaths; b++) {
        for (let j = 0; j < BUBBLES_PER_BREATH; j++) {
          const i = b * BUBBLES_PER_BREATH + j;
          const h = hash1(i * 3.3 + 1.1);
          const born = (breath - b) * BREATH + 0.9 + j * 0.075 + h * 0.1;
          const age = tl - born;
          if (age <= 0 || age >= BUBBLE_LIFE || born < DIVER_IN[1] - 0.5 || born > DIVER_OUT[0]) {
            bubbleLife.setX(i, 0);
            continue;
          }
          diverAt(born, bp);
          diverDir(born, bd);
          const side = hash1(i * 5.1 + 2.2) - 0.5;
          const spread = 0.05 + 0.16 * smooth(0, BUBBLE_LIFE, age);
          bubblePos.setXYZ(
            i,
            bp.x + bd.x * 0.8 + (side * 2 * spread + 0.03 * Math.sin(age * 5 + i)) * -bd.z + 0.03 * Math.sin(age * 4 + i * 2),
            bp.y + 0.02 + age * (0.4 + 0.22 * h) + 0.08 * age * age,
            bp.z + bd.z * 0.8 + (side * 2 * spread + 0.03 * Math.sin(age * 5 + i)) * bd.x + 0.03 * Math.cos(age * 4.4 + i),
          );
          bubbleLife.setX(i, age / BUBBLE_LIFE);
        }
      }
      bubblePos.needsUpdate = true;
      bubbleLife.needsUpdate = true;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      instanced.forEach((m) => m.dispose());
      node.dispose();
      diver.dispose();
    },
  };
}
