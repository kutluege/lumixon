"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ImitationLink } from "./Humanoid";
import { beamFrag, beamVert, markFrag, markVert, ribbonFrag, ribbonVert } from "./humanoid/shaders";
import { ARM_CYCLE, armPose, armTool, clamp, demoGrip, IMIT_LAG, learnerTarget, REDUCED_T, type SceneLayout, type Vec3 } from "./math";

type ImitationProps = {
  layout: SceneLayout;
  quality: "high" | "low";
  reduce: boolean;
  link: ImitationLink;
};

/** Marker slots. */
const TOOL = 0;
const HAND = 1;

/**
 * Closed, time-parameterised path → screen-space ribbon geometry. Each
 * vertex carries its nearest *distinct* neighbours, so the stretches where
 * the path rests (dwells) collapse cleanly instead of twisting.
 */
function ribbonGeometry(n: number, sample: (t: number, out: Vec3) => void) {
  const pts = new Float32Array(n * 3);
  const p: Vec3 = [0, 0, 0];
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    sample((i / n) * ARM_CYCLE, p);
    pts.set(p, i * 3);
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k]);
      hi[k] = Math.max(hi[k], p[k]);
    }
  }
  // "Distinct" = further apart than a small fraction of the path's extent.
  const eps2 = (Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 2e-3) ** 2;
  const d2 = (a: number, b: number) =>
    (pts[a * 3] - pts[b * 3]) ** 2 + (pts[a * 3 + 1] - pts[b * 3 + 1]) ** 2 + (pts[a * 3 + 2] - pts[b * 3 + 2]) ** 2;

  const count = (n + 1) * 2;
  const pos = new Float32Array(count * 3);
  const prev = new Float32Array(count * 3);
  const next = new Float32Array(count * 3);
  const side = new Float32Array(count);
  const u = new Float32Array(count);
  const idx: number[] = [];
  const reach = Math.floor(n / 2);
  for (let i = 0; i <= n; i++) {
    const c = i % n;
    let a = c;
    let b = c;
    for (let k = 1; k < reach; k++) {
      a = (c - k + n) % n;
      if (d2(a, c) > eps2) break;
    }
    for (let k = 1; k < reach; k++) {
      b = (c + k) % n;
      if (d2(b, c) > eps2) break;
    }
    for (let s = 0; s < 2; s++) {
      const v = i * 2 + s;
      for (let k = 0; k < 3; k++) {
        pos[v * 3 + k] = pts[c * 3 + k];
        prev[v * 3 + k] = pts[a * 3 + k];
        next[v * 3 + k] = pts[b * 3 + k];
      }
      side[v] = s ? 1 : -1;
      u[v] = i / n;
    }
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  g.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  g.setIndex(idx);
  return g;
}

/** Strip for the beam: the curve itself is evaluated in the vertex shader. */
function beamGeometry(segs: number) {
  const count = (segs + 1) * 2;
  const u = new Float32Array(count);
  const side = new Float32Array(count);
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    u[i * 2] = u[i * 2 + 1] = i / segs;
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

const overlay = { transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending } as const;

/**
 * Demonstration → policy overlay.
 *  - the demonstrated tool path as a faint ice ribbon, with a bright comet at
 *    the live tool and its trail fading behind it;
 *  - the same path retargeted into the learner's reach (indigo fading to
 *    burgundy), whose comet is the learner's hand, arriving IMIT_LAG later;
 *  - one arcing beam from tool to hand carrying pulses of light downstream;
 *  - a soft marker on each end, the hand's reticle closing with the grasp.
 */
export function Imitation({ layout, quality, reduce, link }: ImitationProps) {
  const time = useRef(0);
  const tmp = useMemo(() => ({ q: [0, 0, 0, 0, 0, 0], tool: [0, 0, 0] as Vec3 }), []);

  const res = useMemo(() => {
    const hi = quality === "high";
    const n = hi ? 480 : 240;
    const q = [0, 0, 0, 0, 0, 0];
    // Line weights follow the scene scale (the tall layout is roughly half size).
    const k = clamp(layout.humanoidScale / 1.3, 0.7, 1);

    const demoGeo = ribbonGeometry(n, (t, out) => armTool(armPose(t, q), layout, out));
    const learnGeo = ribbonGeometry(n, (t, out) => learnerTarget(t, layout, out));
    const ribbon = (
      color: string,
      hot: string,
      tail: string,
      rest: string,
      base: number,
      width: number,
      head: number,
      opacity: number,
    ) =>
      new THREE.ShaderMaterial({
        ...overlay,
        vertexShader: ribbonVert,
        fragmentShader: ribbonFrag,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uHot: { value: new THREE.Color(hot) },
          uTailColor: { value: new THREE.Color(tail) },
          uRestColor: { value: new THREE.Color(rest) },
          uRes: { value: new THREE.Vector2(1, 1) },
          uPhase: { value: 0 },
          uTail: { value: 12 },
          uFront: { value: 900 },
          uBase: { value: base },
          uWidth: { value: width * k },
          uHeadWidth: { value: head * k },
          uOpacity: { value: opacity },
        },
      });
    const demoMat = ribbon("#afc1d6", "#f4f8fc", "#7d90ab", "#7d90ab", 0.15, 1.1, 3.0, 0.85);
    const learnMat = ribbon("#a2a7e2", "#f1f2ff", "#a03c6c", "#7f84c0", 0.2, 1.1, 3.4, 0.95);

    const beamGeo = beamGeometry(hi ? 56 : 28);
    const beamMat = new THREE.ShaderMaterial({
      ...overlay,
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      side: THREE.DoubleSide,
      uniforms: {
        uA: { value: new THREE.Vector3() },
        uB: { value: new THREE.Vector3() },
        uC: { value: new THREE.Vector3() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uColorA: { value: new THREE.Color("#afc1d6") },
        uColorB: { value: new THREE.Color("#9da2e0") },
        uHot: { value: new THREE.Color("#f4f8fc") },
        uTime: { value: 0 },
        uBase: { value: 0.16 },
        uWidth: { value: 1.0 * k },
        uOpacity: { value: 0.8 },
      },
    });

    const markGeo = new THREE.BufferGeometry();
    markGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    markGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array([30 * k, 40 * k]), 1));
    markGeo.setAttribute("aRing", new THREE.BufferAttribute(new Float32Array([0, 0.8]), 1));
    const tint = new Float32Array(6);
    new THREE.Color("#afc1d6").toArray(tint, TOOL * 3);
    new THREE.Color("#a9aeea").toArray(tint, HAND * 3);
    markGeo.setAttribute("aColor", new THREE.BufferAttribute(tint, 3));
    const markMat = new THREE.ShaderMaterial({
      ...overlay,
      vertexShader: markVert,
      fragmentShader: markFrag,
      depthTest: false,
      uniforms: { uPR: { value: 1 }, uOpacity: { value: 0.85 } },
    });
    return { demoGeo, learnGeo, demoMat, learnMat, beamGeo, beamMat, markGeo, markMat };
  }, [layout, quality]);

  useEffect(
    () => () => {
      res.demoGeo.dispose();
      res.learnGeo.dispose();
      res.demoMat.dispose();
      res.learnMat.dispose();
      res.beamGeo.dispose();
      res.beamMat.dispose();
      res.markGeo.dispose();
      res.markMat.dispose();
    },
    [res],
  );

  useFrame((state, delta) => {
    if (!reduce) time.current += Math.min(delta, 0.05);
    const t = reduce ? REDUCED_T : time.current;
    const phase = (((t % ARM_CYCLE) + ARM_CYCLE) % ARM_CYCLE) / ARM_CYCLE;
    const { width, height } = state.size;

    res.demoMat.uniforms.uPhase.value = phase;
    res.learnMat.uniforms.uPhase.value = phase;
    res.demoMat.uniforms.uRes.value.set(width, height);
    res.learnMat.uniforms.uRes.value.set(width, height);

    // Beam: a raised arc from the live tool point to the learner's hand.
    armTool(armPose(t, tmp.q), layout, tmp.tool);
    const bu = res.beamMat.uniforms;
    const a = (bu.uA.value as THREE.Vector3).set(tmp.tool[0], tmp.tool[1], tmp.tool[2]);
    const b = (bu.uB.value as THREE.Vector3).copy(link.hand);
    const c = (bu.uC.value as THREE.Vector3).addVectors(a, b).multiplyScalar(0.5);
    c.y += a.distanceTo(b) * 0.42 + 0.1 * layout.humanoidScale;
    bu.uRes.value.set(width, height);
    bu.uTime.value = t;

    // Markers: steady on the tool; on the hand the reticle closes with the imitated grasp.
    const grip = clamp(demoGrip(t - IMIT_LAG), 0, 1);
    const pos = res.markGeo.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(TOOL, a.x, a.y, a.z);
    pos.setXYZ(HAND, b.x, b.y, b.z);
    pos.needsUpdate = true;
    const ring = res.markGeo.getAttribute("aRing") as THREE.BufferAttribute;
    ring.setX(HAND, 0.82 - 0.36 * grip);
    ring.needsUpdate = true;
    res.markMat.uniforms.uPR.value = state.viewport.dpr;
  });

  return (
    <group>
      <mesh geometry={res.demoGeo} material={res.demoMat} frustumCulled={false} renderOrder={5} />
      <mesh geometry={res.learnGeo} material={res.learnMat} frustumCulled={false} renderOrder={5} />
      <mesh geometry={res.beamGeo} material={res.beamMat} frustumCulled={false} renderOrder={6} />
      <points geometry={res.markGeo} material={res.markMat} frustumCulled={false} renderOrder={7} />
    </group>
  );
}
