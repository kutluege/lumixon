import * as THREE from "three";

/** Status-light colours of the industrial arm (pulsed per frame by the rig). */
export const ROBOT_GLOW = "#afc1d6";
export const ROBOT_GLOW_HOT = "#e6edf5";

/**
 * Industrial arm: clear-coated indigo castings, satin ice-aluminium caps and
 * covers, graphite motors and structure, near-black seals, bright machined
 * steel, one burgundy anodised accent, rubber hoses, glossy dark optics and
 * unlit ice status lights. Low tier swaps MeshPhysical (clearcoat) for
 * MeshStandard.
 */
export function makeRobotMaterials(quality: "high" | "low") {
  const physical = quality === "high";
  const make = ({ clearcoat, clearcoatRoughness, ...base }: THREE.MeshPhysicalMaterialParameters) =>
    physical
      ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat, clearcoatRoughness })
      : new THREE.MeshStandardMaterial(base);
  return {
    shell: make({ color: "#3f4672", metalness: 0.5, roughness: 0.36, clearcoat: 0.85, clearcoatRoughness: 0.18 }),
    cover: make({ color: "#c2cedc", metalness: 0.85, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    graphite: make({ color: "#23272f", metalness: 0.7, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    joint: new THREE.MeshStandardMaterial({ color: "#0d0f13", metalness: 0.85, roughness: 0.32 }),
    machined: new THREE.MeshStandardMaterial({ color: "#9aa5b5", metalness: 1, roughness: 0.22 }),
    accent: new THREE.MeshStandardMaterial({
      color: "#7a2350",
      metalness: 0.75,
      roughness: 0.3,
      emissive: new THREE.Color("#7a2350"),
      emissiveIntensity: 0.3,
    }),
    hose: new THREE.MeshStandardMaterial({ color: "#0b0c10", metalness: 0.1, roughness: 0.68 }),
    lens: new THREE.MeshStandardMaterial({
      color: "#05070a",
      metalness: 0.2,
      roughness: 0.05,
      emissive: new THREE.Color(ROBOT_GLOW),
      emissiveIntensity: 0.35,
    }),
    /** Status ring / light bar and the gripper state ring: separate instances so they pulse independently. */
    glow: new THREE.MeshBasicMaterial({ color: ROBOT_GLOW, toneMapped: false }),
    led: new THREE.MeshBasicMaterial({ color: ROBOT_GLOW, toneMapped: false }),
  };
}

export type RobotMaterials = ReturnType<typeof makeRobotMaterials>;

/** Visor light bar / status pill colour at full brightness (pulsed per frame by the humanoid). */
export const HUMANOID_GLOW = "#e6edf5";

/**
 * Learner humanoid: clear-coated ice-white shell panels and metallic indigo
 * secondary panels over a graphite structure, near-black actuators with
 * machined rings, a mirror-black visor, an ice light bar and burgundy trim.
 */
export function makeHumanoidMaterials(quality: "high" | "low") {
  const physical = quality === "high";
  const make = ({ clearcoat, clearcoatRoughness, ...base }: THREE.MeshPhysicalMaterialParameters) =>
    physical
      ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat, clearcoatRoughness })
      : new THREE.MeshStandardMaterial(base);
  return {
    /** Primary body panels: cool pearl white under a hard clear coat. */
    shell: make({ color: "#dbe3ec", metalness: 0.05, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 }),
    /** Secondary panels: the arm's indigo paint, one step lighter. */
    panel: make({ color: "#454a80", metalness: 0.45, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.22 }),
    /** Structure visible in the seams between panels. */
    core: make({ color: "#15171d", metalness: 0.55, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    /** Actuator housings. */
    joint: new THREE.MeshStandardMaterial({ color: "#0a0b0f", metalness: 0.85, roughness: 0.32 }),
    /** Machined bearing rings. */
    steel: new THREE.MeshStandardMaterial({ color: "#9aa5b5", metalness: 1, roughness: 0.22 }),
    /** Fingers and small mechanical parts: reads against the dark background. */
    gun: new THREE.MeshStandardMaterial({ color: "#566070", metalness: 0.9, roughness: 0.34 }),
    visor: make({ color: "#020306", metalness: 0.4, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }),
    glow: new THREE.MeshBasicMaterial({ color: HUMANOID_GLOW, toneMapped: false }),
    accent: make({
      color: "#7a2350",
      emissive: new THREE.Color("#7a2350"),
      emissiveIntensity: 0.55,
      metalness: 0.3,
      roughness: 0.36,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
  };
}

export type HumanoidMaterials = ReturnType<typeof makeHumanoidMaterials>;
