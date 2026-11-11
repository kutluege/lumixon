import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { FlankQuality } from "../contract";

/** Material slots every part of the quadruped is binned into. */
/** "inner": seam backing, solid style only. */
export type PartKey = "shell" | "panel" | "core" | "inner" | "joint" | "steel" | "rubber" | "visor" | "lens" | "glow" | "accent";

export const ICE = "#afc1d6";
export const ICE_HOT = "#e6edf5";
export const INDIGO = "#8d92c4";
export const INDIGO_DEEP = "#3f4672";
export const BURGUNDY = "#7a2350";

/**
 * The real machine: clear-coated pearl shell panels over a graphite frame,
 * metallic indigo side covers, near-black actuators with machined rings,
 * rubber feet, a mirror-black sensor face, ice status light and one burgundy
 * anodised accent. Low tier: MeshStandard everywhere.
 */
export function makeFieldMaterials(quality: FlankQuality): Record<PartKey, THREE.Material> {
  const physical = quality === "high";
  const make = ({ clearcoat, clearcoatRoughness, ...base }: THREE.MeshPhysicalMaterialParameters) =>
    physical
      ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat, clearcoatRoughness })
      : new THREE.MeshStandardMaterial(base);
  const core = make({ color: "#1a1d25", metalness: 0.6, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  return {
    shell: make({ color: "#dbe3ec", metalness: 0.06, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.14 }),
    panel: make({ color: "#454a80", metalness: 0.5, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    core,
    inner: core,
    joint: new THREE.MeshStandardMaterial({ color: "#0c0d12", metalness: 0.85, roughness: 0.32 }),
    steel: new THREE.MeshStandardMaterial({ color: "#9aa5b5", metalness: 1, roughness: 0.24 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#0b0c10", metalness: 0.05, roughness: 0.78 }),
    visor: make({ color: "#030409", metalness: 0.4, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }),
    lens: new THREE.MeshStandardMaterial({
      color: "#05070a",
      metalness: 0.3,
      roughness: 0.06,
      emissive: new THREE.Color(ICE),
      emissiveIntensity: 0.4,
    }),
    glow: new THREE.MeshBasicMaterial({ color: ICE_HOT, toneMapped: false }),
    accent: make({
      color: BURGUNDY,
      emissive: new THREE.Color(BURGUNDY),
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.34,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
  };
}

const fresnelVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vY = (modelMatrix * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * mv;
}
`;

const fresnelFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uBase;
uniform float uRim;
uniform float uOpacity;
uniform float uScan;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(f, 2.4);
  // Thin scan band travelling up the machine (simulation refresh).
  float band = exp(-pow((vY - uScan) * 38.0, 2.0)) * 0.55;
  vec3 c = uColor * (uBase + uRim * rim + band) * uOpacity;
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Additive light on a transparent canvas: colour is added (scaled by the
 * fragment alpha) while the framebuffer alpha is left untouched, so with the
 * canvas' premultiplied compositing the glow lands on whatever is behind the
 * canvas instead of punching an opaque black hole into it.
 */
export function glowBlend<M extends THREE.Material>(m: M): M {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneFactor;
  m.blendEquationAlpha = THREE.AddEquation;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.transparent = true;
  m.depthWrite = false;
  return m;
}

export type TwinMaterials = {
  shell: THREE.ShaderMaterial;
  /** Visible edges: shell / covers (ice) and mechanism (indigo). */
  lineMain: LineMaterial;
  lineMech: LineMaterial;
  /** Edges behind the shell: same colours, faint (high tier only). */
  hiddenMain: LineMaterial | null;
  hiddenMech: LineMaterial | null;
  /** Bright accents: lidar window, status light. */
  lineHot: LineMaterial;
  /** Wide faint underlay of the shell edges: a soft neon bloom (high tier only). */
  glowMain: LineMaterial | null;
  all: THREE.Material[];
};

/** Render order of the twin: shells first (they fill depth), then line-work. */
export const TWIN_ORDER = { shell: 2, lines: 3 } as const;

function line(color: string, width: number, opacity: number, hidden: boolean) {
  const m = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: width,
    transparent: true,
    opacity,
    depthWrite: false,
    worldUnits: false,
  });
  glowBlend(m);
  m.toneMapped = false;
  if (hidden) m.depthFunc = THREE.GreaterDepth;
  return m;
}

/**
 * Digital twin: an additive fresnel "glass" shell (dark faces, glowing
 * silhouette) that also fills the depth buffer, then crisp edge line-work on
 * top, with the hidden edges redrawn faintly behind it (CAD x-ray).
 */
export function makeTwinMaterials(quality: FlankQuality): TwinMaterials {
  const high = quality === "high";
  const shell = new THREE.ShaderMaterial({
    vertexShader: fresnelVert,
    fragmentShader: fresnelFrag,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(INDIGO) },
      uBase: { value: 0.035 },
      uRim: { value: 0.75 },
      uOpacity: { value: 1 },
      uScan: { value: -10 },
    },
  });
  glowBlend(shell);
  // The shell still fills depth: hidden-line pass and self-occlusion of the line-work.
  shell.depthWrite = true;
  const w = high ? 1.35 : 1.15;
  const lineMain = line(ICE_HOT, w, 0.85, false);
  const lineMech = line(INDIGO, w * 0.9, 0.8, false);
  const lineHot = line(ICE_HOT, w * 1.4, 1, false);
  const hiddenMain = high ? line(ICE, w * 0.8, 0.13, true) : null;
  const hiddenMech = high ? line(INDIGO, w * 0.8, 0.1, true) : null;
  const glowMain = high ? line(INDIGO, 5, 0.09, false) : null;
  const all: THREE.Material[] = [shell, lineMain, lineMech, lineHot];
  if (glowMain) all.push(glowMain);
  if (hiddenMain) all.push(hiddenMain);
  if (hiddenMech) all.push(hiddenMech);
  return { shell, lineMain, lineMech, lineHot, glowMain, hiddenMain, hiddenMech, all };
}
