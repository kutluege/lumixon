import * as THREE from "three";
import type { FlankQuality } from "../../contract";
import { bakeField } from "../../robot/build";
import { ICE_HOT, makeFieldMaterials } from "../../robot/materials";
import { buildAirframe, buildGimbal, buildRotorDiscs, GIMBAL, SCANNER } from "./build";
import { DRONE_SCALE, SCAN_XR, SCANNER_DX, SCANNER_DY, type DroneState } from "./flight";
import { rotorFrag, rotorVert } from "./shaders";

export { droneAt, makeDroneState, type DroneState } from "./flight";
export { buildDroneOverlay, type DroneOverlay } from "./overlay";

export type Drone = {
  group: THREE.Group;
  /** Empty object at the scanner's optical centre (rides on the gimbal). */
  sensor: THREE.Object3D;
  /** Pose the rig from a flight state at absolute time `t`. Must not allocate. */
  update(state: DroneState, t: number): void;
  dispose(): void;
};

/** Drift rate of the rotor smear (rad/s): slow, like a prop strobing against the frame rate. */
const ROTOR_DRIFT = 2.3;

/**
 * The survey quadcopter: one merged mesh per material for the airframe and
 * for the gimballed scanner, plus one blur-disc mesh for the four rotors.
 * Same material palette as the quadruped (its own instances, disposed here).
 */
export function createDrone(quality: FlankQuality): Drone {
  const trash: THREE.BufferGeometry[] = [];
  const mats = makeFieldMaterials(quality);

  const group = new THREE.Group();
  group.name = "survey-drone";
  group.rotation.order = "YXZ";
  group.scale.setScalar(DRONE_SCALE);
  bakeField(group, buildAirframe(quality), mats, trash);

  const gimbal = new THREE.Group();
  gimbal.position.copy(GIMBAL);
  group.add(gimbal);
  bakeField(gimbal, buildGimbal(quality), mats, trash);
  const sensor = new THREE.Object3D();
  sensor.name = "scanner";
  sensor.position.copy(SCANNER);
  gimbal.add(sensor);

  const discGeo = buildRotorDiscs();
  trash.push(discGeo);
  const discMat = new THREE.ShaderMaterial({
    vertexShader: rotorVert,
    fragmentShader: rotorFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(ICE_HOT) },
      uSpin: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
  const discs = new THREE.Mesh(discGeo, discMat);
  discs.name = "rotors";
  discs.renderOrder = 6;
  group.add(discs);

  // Scratch (no per-frame allocation).
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const qBody = new THREE.Quaternion();
  const qAim = new THREE.Quaternion();

  const update = (s: DroneState, t: number) => {
    group.position.set(s.x, s.y, s.z);
    group.rotation.set(s.roll, s.yaw, s.pitch);
    // Gimbal: holds the scanner level against the airframe's roll / pitch and
    // leans the scan plane forward onto the scan line.
    const aim = Math.atan2(SCAN_XR - (s.x + SCANNER_DX), s.y + SCANNER_DY);
    qBody.setFromEuler(group.rotation).invert();
    qAim.setFromEuler(euler.set(0, s.yaw, aim));
    gimbal.quaternion.copy(qBody).multiply(qAim);
    discMat.uniforms.uSpin.value = (t * ROTOR_DRIFT) % (Math.PI * 2);
  };

  const dispose = () => {
    trash.forEach((g) => g.dispose());
    trash.length = 0;
    new Set(Object.values(mats)).forEach((m) => m.dispose());
    discMat.dispose();
  };

  return { group, sensor, update, dispose };
}
