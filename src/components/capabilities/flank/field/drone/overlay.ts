import * as THREE from "three";
import type { FlankQuality } from "../../contract";
import { fanDotFrag, nodeFrag } from "../shaders";
import type { FieldUniforms } from "../world";
import { AIR_NODE_SPACING, AIR_NODES, AIR_TRAIL, LINKS } from "./flight";
import { airNodeVert, airTrailFrag, airTrailVert, linkFrag, linkVert, scanFanFrag, scanFanVert, scanRayFrag, scanRayVert } from "./shaders";

const C = (hex: string) => new THREE.Color(hex);

/** Drone-side palette: the indigo family (the quadruped's instrumentation is ice). */
const AIR = "#9ea3dc";
const AIR_HOT = "#e4e6fb";

export type DroneOverlay = { root: THREE.Group; dispose(): void };

/**
 * The drone's share of the SLAM picture, all driven by the shared field
 * uniforms (nothing to update per frame): its scan plane and measuring ray,
 * its trajectory and keyframes in the air with the ground track below, and
 * the links that fuse its pose graph with the quadruped's.
 */
export function buildDroneOverlay(u: FieldUniforms, quality: FlankQuality): DroneOverlay {
  const high = quality === "high";
  const root = new THREE.Group();
  root.name = "drone-overlay";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const shader = (vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform>, opts: THREE.ShaderMaterialParameters = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      ...opts,
      uniforms: { ...u, ...extra },
    });
    mats.push(m);
    return m;
  };
  /** Geometry whose vertices are placed entirely by the vertex shader. */
  const geometry = (count: number, attrs: Record<string, number[]>, index?: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (const [name, data] of Object.entries(attrs)) g.setAttribute(name, new THREE.Float32BufferAttribute(data, 1));
    if (index) g.setIndex(index);
    geos.push(g);
    return g;
  };
  const add = <T extends THREE.Object3D>(obj: T, order: number) => {
    obj.frustumCulled = false;
    obj.renderOrder = order;
    root.add(obj);
    return obj;
  };

  // --- Scan plane: a soft sheet from the scanner to the scan line, with ribs ---
  {
    const n = high ? 28 : 14;
    const aLat: number[] = [];
    const aEnd: number[] = [];
    for (let i = 0; i < n; i++) {
      const l0 = -1 + (2 * i) / n;
      const l1 = -1 + (2 * (i + 1)) / n;
      aLat.push((l0 + l1) / 2, l0, l1);
      aEnd.push(0, 1, 1);
    }
    const sheet = shader(scanFanVert, scanFanFrag, { uColor: { value: C(AIR) }, uOpacity: { value: 0.11 } }, { side: THREE.DoubleSide });
    add(new THREE.Mesh(geometry(aLat.length, { aLat, aEnd }), sheet), 2);

    const ribs = 13;
    const rLat: number[] = [];
    const rEnd: number[] = [];
    for (let i = 0; i < ribs; i++) {
      const l = -0.9 + (1.8 * i) / (ribs - 1);
      rLat.push(l, l);
      rEnd.push(0, 1);
    }
    const ribMat = shader(scanFanVert, scanFanFrag, { uColor: { value: C(AIR_HOT) }, uOpacity: { value: 0.3 } });
    add(new THREE.LineSegments(geometry(rLat.length, { aLat: rLat, aEnd: rEnd }), ribMat), 3);
  }

  // --- Measuring ray to the sweeping spot, and its hit dot ---
  {
    const ray = shader(scanRayVert, scanRayFrag, {
      uColor: { value: C("#f2f6fb") },
      uOpacity: { value: 0.85 },
      uWidth: { value: 1.6 },
      uDot: { value: 0 },
    }, { side: THREE.DoubleSide });
    add(new THREE.Mesh(geometry(4, { aEnd: [0, 0, 1, 1], aSide: [-1, 1, -1, 1] }, [0, 1, 2, 1, 3, 2]), ray), 4);
    const dot = shader(scanRayVert, fanDotFrag, {
      uColor: { value: C("#f2f6fb") },
      uOpacity: { value: 1 },
      uWidth: { value: 0 },
      uDot: { value: 9 },
    });
    add(new THREE.Points(geometry(1, { aEnd: [1], aSide: [0] }), dot), 4);
  }

  // --- Trajectory in the air ---
  {
    const segs = high ? 140 : 80;
    const aX: number[] = [];
    const aSide: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const x = -AIR_TRAIL + (i / segs) * AIR_TRAIL;
      aX.push(x, x);
      aSide.push(-1, 1);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const m = shader(airTrailVert, airTrailFrag, {
      uWidth: { value: 2.8 },
      uCore: { value: C(AIR_HOT) },
      uGlow: { value: C(AIR) },
      uLength: { value: AIR_TRAIL },
      uOpacity: { value: 0.95 },
    }, { side: THREE.DoubleSide });
    add(new THREE.Mesh(geometry(aX.length, { aX, aSide }, idx), m), 3);
  }

  // --- Drone keyframes ---
  {
    const aK = Array.from({ length: AIR_NODES }, (_, i) => i);
    const m = shader(airNodeVert, nodeFrag, {
      uSpacing: { value: AIR_NODE_SPACING },
      uSize: { value: 11 },
      uCount: { value: AIR_NODES },
      uColor: { value: C(AIR) },
      uHot: { value: C(AIR_HOT) },
      uOpacity: { value: 0.95 },
    });
    add(new THREE.Points(geometry(AIR_NODES, { aK }), m), 4);
  }

  // --- Links: the live one between the sensor heads (k = -1) and the settled constraints ---
  {
    const aK: number[] = [];
    const aEnd: number[] = [];
    const aSide: number[] = [];
    const idx: number[] = [];
    for (let k = -1; k < LINKS; k++) {
      const o = aK.length;
      aK.push(k, k, k, k);
      aEnd.push(0, 0, 1, 1);
      aSide.push(-1, 1, -1, 1);
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    const m = shader(linkVert, linkFrag, {
      uColor: { value: C("#afc1d6") },
      uHot: { value: C("#f2f6fb") },
      uOpacity: { value: 1 },
      uWidth: { value: 2.6 },
      uCount: { value: LINKS },
    }, { side: THREE.DoubleSide });
    add(new THREE.Mesh(geometry(aK.length, { aK, aEnd, aSide }, idx), m), 5);
  }

  return {
    root,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
