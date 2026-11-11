"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import type * as THREE from "three";
import { clamp, type SceneLayout } from "./math";
import { useCopyFrame, type CopyFrame } from "./stage/copyFrame";

type CameraRigProps = {
  layout: SceneLayout;
  progress: MotionValue<number>;
  reduce: boolean;
  parallax: boolean;
};

/** Tall layout: how far (world units at the focus) the deck's front edge shows below the feet line. */
const TALL_DROP = 0.24;

/** Screen placement of the group: centre x and feet line (CSS px), size (px per world unit). */
type Placement = { cx: number; feet: number; scale: number };

/**
 * Fits the group (2 × fit wide, `height` tall, standing on the feet line) into
 * the free area of the hero.
 * - wide (two zones): the copy is a narrow column on the left; the group fills
 *   the rest of the width, below the centred logo, as large as that box allows,
 *   centred at `aim` when there is room and otherwise slid just clear of the
 *   copy's ink (or of the right margin).
 * - tall: in the band between the logo and the copy block.
 * Without a measurement it falls back to the layout's fractional window.
 */
function place(layout: SceneLayout, w: number, h: number, copy: CopyFrame, maxScale: number, out: Placement) {
  const [left, right, top, feet] = layout.frame;
  const gw = layout.fit * 2;
  const gh = layout.height;
  const gap = Math.max(12, w * 0.012);

  if (layout.key === "wide") {
    const x0 = copy.valid ? Math.max(w * 0.3, copy.copyRight + Math.max(24, w * 0.022)) : w * left;
    const x1 = w * right;
    const y0 = Math.max(h * top, copy.valid ? copy.logoBottom + Math.max(16, h * 0.02) : 0);
    out.feet = h * feet;
    out.scale = Math.max(Math.min((x1 - x0) / gw, (out.feet - y0) / gh, maxScale), maxScale * 0.3);
    const half = (gw * out.scale) / 2;
    out.cx = Math.max(x0 + half, Math.min(x1 - half, w * layout.aim));
    return;
  }

  const x0 = w * left;
  const x1 = w * right;
  const y0 = copy.valid && copy.logoBottom > 0 ? copy.logoBottom + gap : h * top;
  const y1 = copy.valid ? copy.copyTop - gap * 1.5 : h * feet;
  // Seen from above, the deck's front edge drops below the feet line: the band
  // holds the robots (gh above the feet) plus that drop, clear of the eyebrow.
  const fitted = Math.min((y1 - y0) / (gh + TALL_DROP), (x1 - x0) / gw, maxScale);
  const floor = maxScale * 0.5;
  if (fitted >= floor) {
    out.scale = fitted;
    out.cx = (x0 + x1) / 2;
    out.feet = Math.min(y1 - TALL_DROP * fitted, (y0 + y1) / 2 + ((gh * 1.12 - TALL_DROP) * fitted) / 2);
    return;
  }
  // No band left between logo and copy (short phones, long locales): stay small,
  // tucked under the logo on the side the left-aligned headline leaves free.
  out.scale = floor;
  out.cx = x1 - (gw * floor) / 2;
  out.feet = y0 + gh * floor;
}

/**
 * Subject-locked camera. The ground point at the centre of the group is
 * pinned where `place` puts it, at the size `place` allows, for every
 * viewport and locale; drift, pointer parallax and the scroll move all orbit /
 * dolly around that point, so the robots never slide under the hero copy and
 * the motion cannot jitter the composition.
 *
 * - idle: slow orbital drift (a few degrees) with a faint dolly breath
 * - pointer (fine pointers only): damped orbit, the camera follows the cursor
 * - scroll: dolly-in with a downward tilt as the hero leaves the viewport
 * - intro: a decelerating push-in while the canvas fades up
 */
export function CameraRig({ layout, progress, reduce, parallax }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const canvas = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const copy = useCopyFrame(canvas, invalidate);
  const pointer = useRef({ x: 0, y: 0 });
  const st = useRef({
    t: 0,
    px: 0,
    py: 0,
    p: 0,
    cx: 0,
    feet: 0,
    scale: 0,
    primed: false,
    key: "",
    measured: false,
    w: 0,
    h: 0,
    settle: 0,
  });
  const want = useRef<Placement>({ cx: 0, feet: 0, scale: 1 });

  useEffect(() => {
    if (!parallax || reduce) {
      pointer.current.x = 0;
      pointer.current.y = 0;
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      pointer.current.y = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax, reduce]);

  // Static (reduced-motion) frames are rendered on demand: re-frame when the layout flips.
  useEffect(() => {
    invalidate();
  }, [layout, reduce, invalidate]);

  useFrame((state, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.05);
    const live = reduce ? 0 : 1;
    if (!reduce) s.t += dt;
    const t = s.t;

    const w = state.size.width;
    const h = Math.max(1, state.size.height);
    const aspect = w / h;
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const maxScale = h / 2 / (layout.dist * tanV);
    const target = want.current;
    place(layout, w, h, copy, maxScale, target);

    // Damp the inputs, not the pose: the pose is then a pure function of them.
    const pTarget = reduce ? 0 : clamp(progress.get(), 0, 1);
    // Snap on the first frame, on a layout flip, when the first DOM measurement lands
    // (all while the canvas is still fading in) and while the viewport is being resized,
    // like the rest of the page; ease every other re-framing (fonts, locale).
    const now = performance.now();
    if (w !== s.w || h !== s.h) {
      s.w = w;
      s.h = h;
      s.settle = now + 400;
    }
    if (reduce || !s.primed || s.key !== layout.key || s.measured !== copy.valid || now < s.settle) {
      s.px = reduce ? 0 : pointer.current.x;
      s.py = reduce ? 0 : pointer.current.y;
      s.p = pTarget;
      s.cx = target.cx;
      s.feet = target.feet;
      s.scale = target.scale;
      s.primed = true;
      s.key = layout.key;
      s.measured = copy.valid;
    } else {
      const kPointer = 1 - Math.exp(-dt * 2.6);
      s.px += (pointer.current.x - s.px) * kPointer;
      s.py += (pointer.current.y - s.py) * kPointer;
      s.p += (pTarget - s.p) * (1 - Math.exp(-dt * 7));
      // Re-framing (resize, fonts, locale) eases in rather than popping. Real elapsed
      // time, not the clamped step, so it also settles promptly at low frame rates.
      const kFrame = 1 - Math.exp(-Math.min(delta, 1) * 4);
      s.cx += (target.cx - s.cx) * kFrame;
      s.feet += (target.feet - s.feet) * kFrame;
      s.scale += (target.scale - s.scale) * kFrame;
    }
    const p = s.p * s.p * (3 - 2 * s.p);
    const intro = live * Math.exp(-t * 0.85);

    const yaw = layout.yaw + live * (Math.sin(t * 0.13) * 0.05 + Math.sin(t * 0.057 + 1.3) * 0.014) - s.px * 0.04;
    const pitch = layout.pitch + live * Math.sin(t * 0.083 + 0.7) * 0.008 + s.py * 0.014 + p * 0.09 + intro * 0.03;

    let dist = h / 2 / (s.scale * tanV);
    dist *= (1 + live * Math.sin(t * 0.061 + 2.1) * 0.012) * (1 - p * 0.2) * (1 + intro * 0.14);

    const fx = (s.cx / w) * 2 - 1;
    const fy = 1 - (s.feet / h) * 2 + p * 0.16;

    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const sp = Math.sin(pitch);
    const cp = Math.cos(pitch);
    // Camera basis: forward f, right r, up u (no roll).
    const fX = sy * cp;
    const fY = -sp;
    const fZ = -cy * cp;
    const offR = fx * dist * tanV * aspect;
    const offU = fy * dist * tanV;

    const [x, y, z] = layout.focus;
    const cx = x - fX * dist - cy * offR - sy * sp * offU;
    const cyy = y - fY * dist - cp * offU;
    const cz = z - fZ * dist - sy * offR + cy * sp * offU;

    camera.position.set(cx, cyy, cz);
    camera.lookAt(cx + fX * 10, cyy + fY * 10, cz + fZ * 10);
  });

  return null;
}
