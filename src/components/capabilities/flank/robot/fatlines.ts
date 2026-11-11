import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { glowBlend } from "./materials";

/**
 * Screen-space-width line segments whose endpoints and colours are rewritten
 * in place every frame (buffers allocated once). Colour doubles as intensity
 * under additive blending, so fading = darkening.
 */
export class FatLines {
  readonly object: LineSegments2;
  readonly geometry: LineSegmentsGeometry;
  readonly material: LineMaterial;
  readonly capacity: number;
  private pos: THREE.InterleavedBuffer;
  private col: THREE.InterleavedBuffer;
  private P: Float32Array;
  private C: Float32Array;

  constructor(capacity: number, opts: { width: number; opacity?: number }) {
    this.capacity = capacity;
    this.geometry = new LineSegmentsGeometry();
    this.geometry.setPositions(new Float32Array(capacity * 6));
    this.geometry.setColors(new Float32Array(capacity * 6));
    this.pos = (this.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data;
    this.col = (this.geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute).data;
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.col.setUsage(THREE.DynamicDrawUsage);
    this.P = this.pos.array as Float32Array;
    this.C = this.col.array as Float32Array;
    this.material = new LineMaterial({
      linewidth: opts.width,
      vertexColors: true,
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: false,
      worldUnits: false,
    });
    glowBlend(this.material);
    this.material.toneMapped = false;
    this.object = new LineSegments2(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.geometry.instanceCount = 0;
  }

  /** Segment i from a to b with colours ca → cb (rgb triples scaled by k). */
  set(
    i: number,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    r: number, g: number, b: number, ka: number, kb: number,
  ) {
    const o = i * 6;
    const P = this.P;
    const C = this.C;
    P[o] = ax;
    P[o + 1] = ay;
    P[o + 2] = az;
    P[o + 3] = bx;
    P[o + 4] = by;
    P[o + 5] = bz;
    C[o] = r * ka;
    C[o + 1] = g * ka;
    C[o + 2] = b * ka;
    C[o + 3] = r * kb;
    C[o + 4] = g * kb;
    C[o + 5] = b * kb;
  }

  /** Upload and draw the first `count` segments. */
  commit(count: number) {
    this.geometry.instanceCount = count;
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
