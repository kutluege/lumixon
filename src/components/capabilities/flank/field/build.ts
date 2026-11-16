import * as THREE from "three";
import type { FlankQuality } from "../contract";
import { blobFrag, blobVert, cloudFrag, cloudVert, fanDotFrag, fanFrag, fanVert, groundFrag, groundVert, nodeFrag, nodeVert, trailFrag, trailVert } from "./shaders";
import { LIDAR_RANGE, LIDAR_RINGS, pathSlope } from "./terrain";
import { buildDroneOverlay } from "./drone/overlay";
import { buildObstacles, makeFieldUniforms, MAX_FOOTPRINTS, sampleGround, sampleSwath, type FieldUniforms } from "./world";

const C = (hex: string) => new THREE.Color(hex);

/** Ground grid extent in relative coordinates (the fade hides everything past ~6 m). */
const GX = 7.5;
const GZ0 = -5.6;
const GZ1 = 3.6;
/** Trajectory length drawn behind the robot (m) and pose-graph node spacing (divides the tile). */
const TRAIL = 6.2;
const NODE_SPACING = 0.75;
const NODES = 9;

function groundGeometry(step: number) {
  const nx = Math.round((2 * GX) / step) + 1;
  const nz = Math.round((GZ1 - GZ0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3;
      pos[k] = -GX + i * step;
      pos[k + 2] = GZ0 + j * step;
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

function shader(u: FieldUniforms, vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform>, opts: THREE.ShaderMaterialParameters = {}) {
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

export type FieldWorld = ReturnType<typeof buildFieldWorld>;

/**
 * Everything in the field scene except the two robots and the lights, built
 * imperatively once per quality tier. Per frame the scene writes the shared
 * uniforms and calls `update`; nothing allocates after construction.
 */
export function buildFieldWorld(quality: FlankQuality) {
  const high = quality === "high";
  const u = makeFieldUniforms();
  const root = new THREE.Group();
  root.name = "field-world";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  // --- Obstacles (lit solids) -------------------------------------------
  const obstacles = buildObstacles(quality, u);
  root.add(obstacles.root);

  // --- Ground ------------------------------------------------------------
  const step = high ? 0.075 : 0.125; // both divide the 18 m tile exactly
  const groundGeo = groundGeometry(step);
  const obs = Array.from({ length: MAX_FOOTPRINTS }, (_, i) => obstacles.footprints[i]?.clone() ?? new THREE.Vector3());
  const groundMat = shader(
    u,
    groundVert,
    groundFrag,
    {
      uSnap: { value: 0 },
      uObs: { value: obs },
      uBase: { value: C("#0f1328") },
      uLit: { value: C("#2f3663") },
      uIce: { value: C("#cfdcea") },
      uIndigo: { value: C("#8d92c4") },
      uAerial: { value: C("#a9adea") },
      uWine: { value: C("#7a2350") },
      uKey: { value: new THREE.Vector3(-0.35, 0.75, 0.55).normalize() },
      uLive: { value: 1 },
      uShadow: { value: 0.5 },
    },
    { depthWrite: true },
  );
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.frustumCulled = false;
  ground.renderOrder = -3;
  root.add(ground);
  geos.push(groundGeo);
  mats.push(groundMat);

  // --- Map cloud, one draw call for both sources: the quadruped's ground
  // raster, the drone's cross-track swath, and the obstacle surfaces split
  // by which of the two can see them ------------------------------------
  const gs = sampleGround(quality, obstacles.footprints, obstacles.shadows);
  const ds = sampleSwath(quality, obstacles.footprints);
  const os = obstacles.samples;
  const nG = gs.rnd.length;
  const nD = ds.rnd.length;
  const nO = os.count;
  const nAll = nG + nD + nO;
  const cPos = new Float32Array(nAll * 3);
  cPos.set(gs.pos, 0);
  cPos.set(ds.pos, nG * 3);
  cPos.set(os.pos, (nG + nD) * 3);
  const cRnd = new Float32Array(nAll);
  const cKind = new Float32Array(nAll);
  const cSrc = new Float32Array(nAll);
  cRnd.set(gs.rnd, 0);
  cRnd.set(ds.rnd, nG);
  cSrc.fill(1, nG, nG + nD);
  cSrc.set(os.aerial, nG + nD);
  let seed = 99;
  for (let i = nG + nD; i < nAll; i++) {
    seed = (seed * 16807) % 2147483647;
    cRnd[i] = seed / 2147483647;
    cKind[i] = 1;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
  cloudGeo.setAttribute("aRnd", new THREE.BufferAttribute(cRnd, 1));
  cloudGeo.setAttribute("aKind", new THREE.BufferAttribute(cKind, 1));
  cloudGeo.setAttribute("aSrc", new THREE.BufferAttribute(cSrc, 1));
  const cloudMat = shader(u, cloudVert, cloudFrag, {
    uSize: { value: high ? 2.2 : 2.5 },
    uLow: { value: C("#7f96b6") },
    uHigh: { value: C("#d3dfec") },
    uObj: { value: C("#cbd8e7") },
    uAirLow: { value: C("#7a7ed6") },
    uAirHigh: { value: C("#a6aaf0") },
    uAirObj: { value: C("#b2b5f4") },
    uHot: { value: C("#f2f6fb") },
    uAirHot: { value: C("#e4e6fb") },
    uWine: { value: C("#a3466f") },
    uOpacity: { value: 1 },
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  cloud.frustumCulled = false;
  cloud.renderOrder = 1;
  root.add(cloud);
  geos.push(cloudGeo);
  mats.push(cloudMat);

  // --- Lidar head: the vertical scan fan at the beam angle (a soft sheet with
  // trailing copies, the channel rays, and their hit dots on the ground) ---
  {
    const ground = LIDAR_RINGS.map((d) => -Math.atan(0.5 / d)).sort((a, b) => a - b);
    const rays = [...ground, -0.035, 0.05];
    const fanAttrs = (n: number) => ({ aEl: new Float32Array(n), aEnd: new Float32Array(n), aLag: new Float32Array(n) });
    const fanGeo = (a: ReturnType<typeof fanAttrs>) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(a.aEl.length * 3), 3));
      g.setAttribute("aEl", new THREE.BufferAttribute(a.aEl, 1));
      g.setAttribute("aEnd", new THREE.BufferAttribute(a.aEnd, 1));
      g.setAttribute("aLag", new THREE.BufferAttribute(a.aLag, 1));
      geos.push(g);
      return g;
    };
    const add = (obj: THREE.Object3D, order: number) => {
      obj.frustumCulled = false;
      obj.renderOrder = order;
      root.add(obj);
    };

    // Sheet: triangles (sensor, hit i, hit i+1) between neighbouring channels.
    const sheets = high ? 6 : 3;
    const sa = fanAttrs(sheets * (ground.length - 1) * 3);
    let k = 0;
    for (let l = 0; l < sheets; l++) {
      for (let i = 0; i < ground.length - 1; i++) {
        for (const [el, end] of [[ground[i], 0], [ground[i], 1], [ground[i + 1], 1]] as const) {
          sa.aEl[k] = el;
          sa.aEnd[k] = end;
          sa.aLag[k] = l / sheets;
          k++;
        }
      }
    }
    const sheetMat = shader(u, fanVert, fanFrag, {
      uColor: { value: C("#afc1d6") },
      uOpacity: { value: 0.16 },
      uSpread: { value: 0.5 },
      uDot: { value: 0 },
    }, { side: THREE.DoubleSide });
    add(new THREE.Mesh(fanGeo(sa), sheetMat), 2);
    mats.push(sheetMat);

    // Rays: the leading fan plus two faint echoes.
    const echoes = 3;
    const ra = fanAttrs(echoes * rays.length * 2);
    k = 0;
    for (let l = 0; l < echoes; l++) {
      for (const el of rays) {
        for (let end = 0; end < 2; end++) {
          ra.aEl[k] = el;
          ra.aEnd[k] = end;
          ra.aLag[k] = l / echoes;
          k++;
        }
      }
    }
    const rayMat = shader(u, fanVert, fanFrag, {
      uColor: { value: C("#e6edf5") },
      uOpacity: { value: 0.7 },
      uSpread: { value: 0.16 },
      uDot: { value: 0 },
    });
    add(new THREE.LineSegments(fanGeo(ra), rayMat), 3);
    mats.push(rayMat);

    // Hit dots where the leading rays meet the ground.
    const da = fanAttrs(ground.length);
    ground.forEach((el, i) => {
      da.aEl[i] = el;
      da.aEnd[i] = 1;
    });
    const dotMat = shader(u, fanVert, fanDotFrag, {
      uColor: { value: C("#f2f6fb") },
      uOpacity: { value: 1 },
      uSpread: { value: 0 },
      uDot: { value: 7 },
    });
    add(new THREE.Points(fanGeo(da), dotMat), 4);
    mats.push(dotMat);
  }

  // --- Trajectory ribbon ---------------------------------------------------
  {
    const segs = high ? 180 : 100;
    const aX = new Float32Array((segs + 1) * 2);
    const aSide = new Float32Array((segs + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const x = -TRAIL + (i / segs) * TRAIL;
      aX[i * 2] = x;
      aX[i * 2 + 1] = x;
      aSide[i * 2] = -1;
      aSide[i * 2 + 1] = 1;
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(aX.length * 3), 3));
    g.setAttribute("aX", new THREE.BufferAttribute(aX, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    g.setIndex(idx);
    const m = shader(u, trailVert, trailFrag, {
      uWidth: { value: 0.045 },
      uCore: { value: C("#eef3f9") },
      uGlow: { value: C("#8d92c4") },
      uLength: { value: TRAIL },
      uOpacity: { value: 0.95 },
    }, { side: THREE.DoubleSide });
    const trail = new THREE.Mesh(g, m);
    trail.frustumCulled = false;
    trail.renderOrder = -1;
    root.add(trail);
    geos.push(g);
    mats.push(m);
  }

  // --- Pose-graph keyframes ------------------------------------------------
  {
    const aK = new Float32Array(NODES);
    for (let i = 0; i < NODES; i++) aK[i] = i;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODES * 3), 3));
    g.setAttribute("aK", new THREE.BufferAttribute(aK, 1));
    const m = shader(u, nodeVert, nodeFrag, {
      uSpacing: { value: NODE_SPACING },
      uSize: { value: 14 },
      uCount: { value: NODES },
      uColor: { value: C("#afc1d6") },
      uHot: { value: C("#f2f6fb") },
      uOpacity: { value: 0.9 },
    });
    const nodes = new THREE.Points(g, m);
    nodes.frustumCulled = false;
    nodes.renderOrder = 0;
    root.add(nodes);
    geos.push(g);
    mats.push(m);
  }

  // --- Survey drone: scan plane, trajectory, keyframes, inter-robot links ---
  const overlay = buildDroneOverlay(u, quality);
  root.add(overlay.root);

  // --- Grounding under the robot: contact blob (+ shadow catcher on high) ---
  const under = new THREE.Group();
  root.add(under);
  {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      vertexShader: blobVert,
      fragmentShader: blobFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: high ? 0.55 : 0.7 } },
    });
    const blob = new THREE.Mesh(g, m);
    blob.scale.set(1.25, 1, 0.62);
    blob.position.y = 0.004;
    blob.renderOrder = -2;
    under.add(blob);
    geos.push(g);
    mats.push(m);
    if (high) {
      const cg = new THREE.PlaneGeometry(3.2, 3.2);
      cg.rotateX(-Math.PI / 2);
      const cm = new THREE.ShadowMaterial({ color: "#02030a", opacity: 0.5, depthWrite: false });
      const catcher = new THREE.Mesh(cg, cm);
      catcher.receiveShadow = true;
      catcher.position.y = 0.006;
      catcher.renderOrder = -2;
      under.add(catcher);
      geos.push(cg);
      mats.push(cm);
    }
  }

  return {
    root,
    uniforms: u,
    anchors: obstacles.anchors,
    lidarRange: LIDAR_RANGE,
    /** Per-frame: world scroll (tile metres) and the robot's lateral position. */
    update(sMod: number, z: number) {
      groundMat.uniforms.uSnap.value = sMod % step;
      under.position.z = z;
      under.rotation.y = -Math.atan(pathSlope(sMod));
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      obstacles.dispose();
      overlay.dispose();
    },
  };
}
