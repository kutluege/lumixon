import * as THREE from "three";
import type { FlankQuality } from "../contract";
import { fadeGlsl, sonarGlsl, type SonarUniforms } from "./glsl";

export const ICE = "#afc1d6";
export const ICE_HOT = "#e6edf5";
export const INDIGO = "#8d92c4";
/** Alert accent: the page burgundy, lifted so thin additive line-work holds on navy. */
export const ALERT = "#cf4a80";

/** How a lit material dissolves: with the environment, as a solid actor, or as the swimmer. */
export type FadeMode = "world" | "solid" | "diver";

const FADE_EXPR: Record<FadeMode, string> = {
  world: "sonarFade(vSonarW)",
  solid: "solidFade(vSonarW)",
  diver: "solidFade(vSonarW) * uDiverFade",
};

/**
 * Patches a lit three material so it melts into the section background like
 * the shader-drawn parts of the scene.
 */
export function withFade<T extends THREE.MeshStandardMaterial>(mat: T, u: SonarUniforms, mode: FadeMode): T {
  mat.transparent = true;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSonarW;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvSonarW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\nvSonarW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSonarW;\n${sonarGlsl}\n${fadeGlsl}`)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>\ngl_FragColor.a *= ${FADE_EXPR[mode]};`);
  };
  mat.customProgramCacheKey = () => `sonar-fade-${mode}`;
  return mat;
}

/** Material slots of the swimmer. */
export type DiverKey = "suit" | "pad" | "trim" | "fin" | "tank" | "dark" | "steel" | "glass";

/**
 * The swimmer: a dark neoprene suit with indigo shoulder / knee panels and
 * thin ice piping (so the figure never sinks into the navy), light indigo
 * fins, a pearl tank in the same clear-coat as the sonar shell.
 */
export function makeDiverMaterials(quality: FlankQuality, u: SonarUniforms): Record<DiverKey, THREE.MeshStandardMaterial> {
  const physical = quality === "high";
  const make = ({ clearcoat, clearcoatRoughness, ...base }: THREE.MeshPhysicalMaterialParameters) =>
    withFade(
      physical ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat, clearcoatRoughness }) : new THREE.MeshStandardMaterial(base),
      u,
      "diver",
    );
  const std = (p: THREE.MeshStandardMaterialParameters) => withFade(new THREE.MeshStandardMaterial(p), u, "diver");
  return {
    suit: std({ color: "#373d60", metalness: 0.1, roughness: 0.55 }),
    pad: std({ color: "#585f9c", metalness: 0.25, roughness: 0.48 }),
    trim: std({ color: ICE, emissive: new THREE.Color(ICE), emissiveIntensity: 0.55, metalness: 0, roughness: 0.5 }),
    fin: std({ color: "#7a80b8", emissive: new THREE.Color("#4e5283"), emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.45 }),
    tank: make({ color: "#dbe3ec", metalness: 0.06, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.14 }),
    dark: std({ color: "#10121b", metalness: 0.5, roughness: 0.45 }),
    steel: std({ color: "#9aa5b5", metalness: 1, roughness: 0.26 }),
    glass: make({ color: "#05070c", metalness: 0.4, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
  };
}

/**
 * Depth-only twin of the swimmer, drawn just before its colour pass: while the
 * figure fades in or out only its nearest surface blends, so limbs never show
 * through the torso.
 */
export function makeDepthOnly() {
  return new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
}
