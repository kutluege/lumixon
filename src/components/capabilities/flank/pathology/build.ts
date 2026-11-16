import * as THREE from "three";
import type { FlankQuality } from "../contract";
import {
  buildTiles,
  CHIP_LIFT,
  clamp01,
  COLS,
  COVER,
  heatRaw,
  HOT_BOX,
  LABEL_X1,
  lumenSd,
  REGION,
  ROWS,
  sampleNuclei,
  SLIDE,
  smoothstep,
  tissueSd,
  tone,
  Y_MARKERS,
  Y_NUCLEI,
  Y_OVERLAY,
  Y_TISSUE,
} from "./model";
import {
  chipFrag,
  CHIP_PAD,
  chipVert,
  glassFrag,
  glassVert,
  labelFrag,
  labelVert,
  markerFrag,
  markerVert,
  nucleiFrag,
  nucleiVert,
  overlayFrag,
  overlayVert,
  postFrag,
  postVert,
  stageFrag,
  stageVert,
  tissueFrag,
  tissueVert,
} from "./shaders";

/** Display-space colour for the hand-written shaders (they blend in display space). */
const srgb = (hex: string) => new THREE.Color(hex).convertLinearToSRGB();

/** Uniforms shared (by reference) by every pathology material; written once per frame. */
export function makePathoUniforms() {
  return {
    uT: { value: 0 },
    uHead: { value: new THREE.Vector3() },
    uLamp: { value: 0 },
    uLayer: { value: 1 },
    uRefine: { value: 0 },
    uContour: { value: 0 },
    uLock: { value: 0 },
    uLift: { value: 0 },
    uFadeC: { value: new THREE.Vector2() },
    uFadeR: { value: 4.4 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPR: { value: 1 },
    uStripDir: { value: new THREE.Vector3(-0.78, 0.0, 0.62).normalize() },
    uStripC: { value: 0 },
  };
}

export type PathoUniforms = ReturnType<typeof makePathoUniforms>;

/** Flat rectangle in the XZ plane at height y; uv = (x, z) normalised over the rectangle. */
function xzPlane(x0: number, x1: number, z0: number, z1: number, y: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1]), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

/** Bevelled glass plate with rounded corners, resting on y = y0. */
function plateGeometry(x0: number, x1: number, z0: number, z1: number, y0: number, h: number, radius: number, bevel: number, curve: number) {
  const w = x1 - x0;
  const d = z1 - z0;
  const r = Math.min(radius, w / 2, d / 2);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const b = Math.min(bevel, h / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - 2 * b,
    steps: 1,
    curveSegments: curve,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 1,
  });
  // extrusion axis (z) -> up (y)
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y0 + b, (z0 + z1) / 2);
  return g;
}

/** Tissue fields baked once: R outline distance, G lumen distance, B score, A stain tone. */
function fieldTexture(w: number, h: number) {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const z = REGION.z0 + ((j + 0.5) / h) * (REGION.z1 - REGION.z0);
    for (let i = 0; i < w; i++) {
      const x = REGION.x0 + ((i + 0.5) / w) * (REGION.x1 - REGION.x0);
      const sd = tissueSd(x, z);
      const k = (j * w + i) * 4;
      data[k] = Math.round(255 * clamp01(0.5 + sd / 0.25));
      if (sd > 0.06) {
        data[k + 1] = 255;
        continue;
      }
      data[k + 1] = Math.round(255 * clamp01(0.5 + lumenSd(x, z) / 0.125));
      data[k + 2] = Math.round(255 * heatRaw(x, z) * smoothstep(0.004, -0.03, sd));
      data[k + 3] = Math.round(255 * tone(x, z));
    }
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** One texel per pyramid tile: R = contains tissue, G = patch score. */
function tileTexture() {
  const data = new Uint8Array(COLS * ROWS * 4);
  for (const t of buildTiles()) {
    const k = (t.row * COLS + t.col) * 4;
    data[k] = t.cover > 0.07 ? 255 : 0;
    data[k + 1] = Math.round(255 * clamp01(t.score * 1.15));
    data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export type PathoWorld = ReturnType<typeof buildPathoWorld>;

/**
 * Everything in the pathology scene except the scanner rig and the lights:
 * the stage, the glass slide with its label end and coverslip, the H&E
 * section with its instanced nuclei, and the analysis layer. Built once per
 * quality tier; per frame the scene only writes the shared uniforms.
 */
export function buildPathoWorld(quality: FlankQuality) {
  const high = quality === "high";
  const u = makePathoUniforms();
  const root = new THREE.Group();
  root.name = "pathology-world";
  const trash: { dispose(): void }[] = [];

  const shader = (
    vertexShader: string,
    fragmentShader: string,
    extra: Record<string, THREE.IUniform>,
    opts: THREE.ShaderMaterialParameters = {},
  ) => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      ...opts,
      uniforms: { ...u, ...extra },
    });
    trash.push(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, order: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    root.add(mesh);
    trash.push(geo);
    return mesh;
  };

  const field = fieldTexture(high ? 512 : 256, high ? 256 : 128);
  const tiles = tileTexture();
  trash.push(field, tiles);

  // --- stage ---------------------------------------------------------------
  const stageMat = shader(
    stageVert,
    stageFrag,
    {
      uBase: { value: srgb("#0d1024") },
      uPlate: { value: srgb("#1b2040") },
      uIce: { value: srgb("#afc1d6") },
      uIndigo: { value: srgb("#8d92c4") },
      uGlow: { value: srgb("#c3cfe8") },
      uWindow: { value: srgb("#232a4d") },
      uShadow: { value: high ? 0.3 : 0.5 },
    },
    { depthWrite: true },
  );
  add(xzPlane(-6, 6.6, -4.4, 3.4, 0), stageMat, -3);

  if (high) {
    const cm = new THREE.ShadowMaterial({ color: "#02030a", opacity: 0.42, depthWrite: false });
    const catcher = add(xzPlane(-2.6, 2.9, -2.4, 1.3, 0.003), cm, -2);
    catcher.receiveShadow = true;
    trash.push(cm);
  }

  // --- slide glass, label end, coverslip -------------------------------------
  const glass = (face: number, edge: number, strip: number, stripOff: number) =>
    shader(
      glassVert,
      glassFrag,
      {
        uTint: { value: srgb("#dfe8f2") },
        uEdgeCol: { value: srgb("#b7cbe0") },
        uFace: { value: face },
        uEdge: { value: edge },
        uStrip: { value: strip },
        uStripOff: { value: stripOff },
      },
      { side: THREE.DoubleSide },
    );
  const hw = SLIDE.w / 2;
  const hd = SLIDE.d / 2;
  add(plateGeometry(-hw, hw, -hd, hd, 0, SLIDE.h, SLIDE.r, 0.007, high ? 6 : 3), glass(0.06, 0.62, 0.17, 0.0), 0);

  const labelMat = shader(labelVert, labelFrag, {
    uPaper: { value: srgb("#c3cedb") },
    uInk: { value: srgb("#1b2040") },
    uBand: { value: srgb("#8d3560") },
    uCode: { value: new THREE.Vector3((-hw + LABEL_X1) / 2 + 0.03, -0.09, 0.03) },
  });
  add(xzPlane(-hw + 0.012, LABEL_X1, -hd + 0.012, hd - 0.012, SLIDE.h + 0.0006), labelMat, 1);

  // --- tissue section + nuclei ---------------------------------------------
  const stain = {
    uEosin: { value: srgb("#b45c86") },
    uEosinLight: { value: srgb("#dba6c0") },
    uHema: { value: srgb("#4a3f86") },
    uHemaDark: { value: srgb("#2b2459") },
    uLumen: { value: srgb("#efe2ec") },
    uAmbient: { value: 0.9 },
  };
  const tissueMat = shader(tissueVert, tissueFrag, { ...stain, uField: { value: field }, uDetail: { value: high ? 1 : 0 } });
  add(xzPlane(REGION.x0, REGION.x1, REGION.z0, REGION.z1, Y_TISSUE), tissueMat, 2);

  const nuclei = sampleNuclei(high ? 1 : 0.4);
  const quad = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1]), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.instanceCount = nuclei.count;
    return g;
  };
  const aPos = new THREE.InstancedBufferAttribute(nuclei.pos, 2);
  const aShape = new THREE.InstancedBufferAttribute(nuclei.shape, 3);
  const aMeta = new THREE.InstancedBufferAttribute(nuclei.meta, 4);
  const withInstances = (g: THREE.InstancedBufferGeometry) => {
    g.setAttribute("aPos", aPos);
    g.setAttribute("aShape", aShape);
    g.setAttribute("aMeta", aMeta);
    return g;
  };
  const nucleiMat = shader(nucleiVert, nucleiFrag, { ...stain, uY: { value: Y_NUCLEI } }, { side: THREE.DoubleSide });
  add(withInstances(quad()), nucleiMat, 3);

  add(
    plateGeometry(COVER.x0, COVER.x1, COVER.z0, COVER.z1, SLIDE.h + 0.0005, COVER.h, 0.012, 0.003, 2),
    glass(0.03, 0.42, 0.19, 0.035),
    4,
  );

  // --- analysis layer ---------------------------------------------------------
  /** Fills composite "over", line-work adds light: the shaders output premultiplied colour. */
  const premultiplied = {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  } as const;
  const overlayMat = shader(
    overlayVert,
    overlayFrag,
    {
      uField: { value: field },
      uTiles: { value: tiles },
      uIce: { value: srgb("#afc1d6") },
      uHot: { value: srgb("#f2f6fb") },
      uHeat0: { value: srgb("#6c71a8") },
      uHeat1: { value: srgb("#a8406d") },
      uHeat2: { value: srgb("#f4c6a0") },
      uHotBox: { value: new THREE.Vector4(HOT_BOX.cx, HOT_BOX.cz, HOT_BOX.hx, HOT_BOX.hz) },
      uPulse: { value: 0 },
    },
    premultiplied,
  );
  add(xzPlane(REGION.x0, REGION.x1, REGION.z0, REGION.z1, Y_OVERLAY), overlayMat, 5);

  const markerMat = shader(
    markerVert,
    markerFrag,
    {
      uY: { value: Y_MARKERS },
      uRing: { value: 1 },
      uIce: { value: srgb("#c9d7e8") },
      uHot: { value: srgb("#ffffff") },
      uAlert: { value: srgb("#ffd6bd") },
    },
    { side: THREE.DoubleSide },
  );
  add(withInstances(quad()), markerMat, 6);

  // --- flagged region, lifted off the slide as a chip -------------------------
  const chipMat = shader(
    chipVert,
    chipFrag,
    {
      uField: { value: field },
      uIce: { value: srgb("#afc1d6") },
      uHot: { value: srgb("#f2f6fb") },
      uPlate: { value: srgb("#141936") },
      uHeat0: overlayMat.uniforms.uHeat0,
      uHeat1: overlayMat.uniforms.uHeat1,
      uHeat2: overlayMat.uniforms.uHeat2,
      uHotBox: overlayMat.uniforms.uHotBox,
      uPulse: overlayMat.uniforms.uPulse,
    },
    { ...premultiplied, side: THREE.DoubleSide },
  );
  const cx0 = HOT_BOX.cx - HOT_BOX.hx - CHIP_PAD;
  const cx1 = HOT_BOX.cx + HOT_BOX.hx + CHIP_PAD;
  const cz0 = HOT_BOX.cz - HOT_BOX.hz - CHIP_PAD;
  const cz1 = HOT_BOX.cz + HOT_BOX.hz + CHIP_PAD;
  const chip = add(xzPlane(cx0 - 0.01, cx1 + 0.01, cz0 - 0.01, cz1 + 0.01, 0), chipMat, 8);
  // Leader lines: one screen-space ribbon per chip corner (unit height, scaled per frame).
  const postGeo = new THREE.BufferGeometry();
  {
    const pos: number[] = [];
    const side: number[] = [];
    const idx: number[] = [];
    [
      [cx0, cz0],
      [cx1, cz0],
      [cx0, cz1],
      [cx1, cz1],
    ].forEach(([x, z], i) => {
      pos.push(x, 0, z, x, 0, z, x, 1, z, x, 1, z);
      side.push(-1, 1, -1, 1);
      const a = i * 4;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    });
    postGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    postGeo.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(side), 1));
    postGeo.setIndex(idx);
  }
  const postMat = new THREE.ShaderMaterial({
    vertexShader: postVert,
    fragmentShader: postFrag,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: srgb("#afc1d6") }, uOpacity: { value: 0 }, uRes: u.uRes, uPR: u.uPR },
  });
  const posts = new THREE.Mesh(postGeo, postMat);
  posts.frustumCulled = false;
  posts.renderOrder = 7;
  posts.position.y = Y_OVERLAY;
  root.add(posts);
  trash.push(postGeo, postMat);

  return {
    root,
    uniforms: u,
    /** Per-frame: raise the flagged-region chip (`lift` 0..1) and its leader lines. */
    setLift(lift: number, layer: number) {
      const h = Math.max(lift * CHIP_LIFT, 1e-3);
      chip.position.y = Y_OVERLAY + h;
      chip.visible = lift > 0.001 && layer > 0.001;
      posts.scale.y = h;
      posts.visible = chip.visible;
      postMat.uniforms.uOpacity.value = 0.75 * Math.min(1, lift * 3) * layer;
    },
    /** Slow breathing of the heatmap and the flag bracket (0..1). */
    pulse: overlayMat.uniforms.uPulse as THREE.IUniform<number>,
    nucleiCount: nuclei.count,
    dispose() {
      trash.forEach((t) => t.dispose());
    },
  };
}
