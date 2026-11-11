"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ARM_DIM,
  ARM_STATIONS,
  armPose,
  armToolLocal,
  clamp,
  demoPart,
  REDUCED_T,
  type SceneLayout,
  type Vec3,
} from "../math";
import { BASE_YAW } from "./build";

/**
 * Live tool-centre-point readout, like the position page of a teach pendant:
 * a small tag tied to the gripper tip by a hairline leader, showing the TCP in
 * the robot's BASE frame in millimetres.
 *
 * Frame: origin at the centre of the base on the floor, X out of the base
 * front (toward the work cell), Z up, Y to the robot's left (right-handed).
 * 1 arm-local unit = 1 m. The numbers come from the same forward kinematics
 * the arm is rendered with (armToolLocal), so they are exactly the drawn tip.
 *
 * The tag is plain DOM built once and appended next to the canvas (inside the
 * canvas container, so it is clipped, scrolled and mirrored with it, and stays
 * under the hero's scrims, HUD and copy). No React tree or state is involved:
 * positions go through style transforms, digits through textContent at
 * ~12 Hz. Every tick the tag also picks the side of the tip that is clear of
 * the arm, the learner, the nests and the hero copy, and glides there.
 */

type TcpReadoutProps = {
  layout: SceneLayout;
  reduce: boolean;
  /** Animation clock owned by RobotArm (seconds). */
  clock: RefObject<number>;
};

const TICK = 1 / 12; // digit + placement refresh
const MEASURE = 0.8; // DOM re-measure interval (copy rects, tag size, mirroring)
const SLOTS = 12; // candidate directions around the tip
const RING = 5; // tip marker radius (px)
const EDGE = 10; // keep-inside margin (px)
const MAX_RECTS = 20;

type Dom = {
  root: HTMLDivElement;
  lead: HTMLSpanElement;
  tag: HTMLDivElement;
  flip: HTMLDivElement;
  /** Zero-size markers at the root's origin and 64px along its local +X (mirroring probe). */
  origin: HTMLSpanElement;
  probe: HTMLSpanElement;
  x: HTMLSpanElement;
  y: HTMLSpanElement;
  z: HTMLSpanElement;
};

function el<K extends keyof HTMLElementTagNameMap>(name: K, className: string, parent: HTMLElement, text?: string) {
  const node = document.createElement(name);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

/**
 * Size tiers, chosen from how large the arm is drawn (px per arm-local unit):
 * 0 = small scenes (phones, short windows), 1 = regular, 2 = large displays.
 * Class strings are spelled out in full so Tailwind sees them.
 */
type Tier = 0 | 1 | 2;
const TIER_GAP = [26, 44, 52]; // leader length (px)
const TIER_BOX = [
  "relative whitespace-nowrap bg-abyss-950/65 px-2 py-1.5 font-mono tabular-nums shadow-[0_0_0_1px_rgb(175_193_214_/_0.14)]",
  "relative whitespace-nowrap bg-abyss-950/65 px-3 py-2 font-mono tabular-nums shadow-[0_0_0_1px_rgb(175_193_214_/_0.14)]",
  "relative whitespace-nowrap bg-abyss-950/65 px-3.5 py-2.5 font-mono tabular-nums shadow-[0_0_0_1px_rgb(175_193_214_/_0.14)]",
];
const TIER_HEAD = [
  "flex items-center justify-between gap-3 text-[0.5rem] leading-[1.3] tracking-[0.2em] text-fg-subtle",
  "flex items-center justify-between gap-3 text-[0.5625rem] leading-[1.4] tracking-[0.2em] text-fg-subtle",
  "flex items-center justify-between gap-3 text-[0.625rem] leading-[1.4] tracking-[0.2em] text-fg-subtle",
];
const TIER_ROWS = [
  "mt-0.5 grid grid-cols-[auto_auto] gap-x-3 text-[0.625rem] leading-[1.4] tracking-[0.06em]",
  "mt-1 grid grid-cols-[auto_auto] gap-x-3 text-[0.8125rem] leading-[1.45] tracking-[0.06em]",
  "mt-1.5 grid grid-cols-[auto_auto] gap-x-4 text-[0.9375rem] leading-[1.45] tracking-[0.06em]",
];

/** Tier for a scene scale, with hysteresis around the current one. */
function tierFor(u: number, cur: Tier): Tier {
  if (u < (cur === 0 ? 96 : 84)) return 0;
  if (u > (cur === 2 ? 150 : 162)) return 2;
  return 1;
}

function buildDom(host: HTMLElement, tier: Tier): Dom {
  const root = el(
    "div",
    "pointer-events-none absolute left-0 top-0 select-none opacity-0 transition-opacity duration-700 will-change-transform",
    host,
  );
  root.setAttribute("aria-hidden", "true");
  root.dataset.tcpReadout = "";
  // Tip marker: hairline ring + centre dot.
  el("span", "absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full border border-ice-100/80", root);
  el("span", "absolute -left-px -top-px h-[2px] w-[2px] rounded-full bg-ice-100", root);
  const origin = el("span", "absolute left-0 top-0", root);
  const probe = el("span", "absolute left-16 top-0", root);
  const lead = el("span", "absolute left-0 top-0 -mt-px h-px w-0 origin-left bg-linear-to-r from-ice-100/85 to-ice/35", root);
  const tag = el("div", "absolute left-0 top-0 will-change-transform", root);
  const flip = el("div", TIER_BOX[tier], tag);
  // Numbers and unit always read left to right, whatever the page direction.
  flip.dir = "ltr";
  el("span", "absolute -left-px -top-px h-2 w-2 border-l border-t border-ice-100/70", flip);
  el("span", "absolute -bottom-px -right-px h-2 w-2 border-b border-r border-ice-100/70", flip);
  const head = el("p", TIER_HEAD[tier], flip);
  const name = el("span", "flex items-center gap-1.5 text-ice-400", head);
  el("span", "h-1 w-1 bg-burgundy-300", name);
  el("span", "", name, "TCP");
  el("span", "tracking-[0.12em]", head, "mm");
  const grid = el("div", TIER_ROWS[tier], flip);
  const row = (axis: string) => {
    el("span", "text-indigo-300", grid, axis);
    return el("span", "text-end text-ice-100", grid, "+0000.0");
  };
  return { root, lead, tag, flip, origin, probe, x: row("X"), y: row("Y"), z: row("Z") };
}

/* Screen-space obstacle points, [x, y] pairs. */
const P_WRIST = 0;
const P_ELBOW = 1;
const P_SHOULDER = 2;
const P_BASE = 3;
const P_FEET = 4;
const P_HEAD = 5;
const P_CHEST = 6;
const P_NEST = 7; // + one per station
const P_COUNT = P_NEST + ARM_STATIONS.length;

type Scratch = {
  q: number[];
  p: Vec3;
  v: THREE.Vector3;
  pts: Float32Array;
  /** Screen boxes to keep clear of: the first nSoft are HUD furniture, the rest hero copy. */
  rects: Float32Array;
  nRects: number;
  nSoft: number;
  acc: number;
  measureAcc: number;
  since: number;
  slot: number;
  /** Direction from the tip to the tag (screen angle, radians): current (gliding) and goal. */
  ang: number;
  goal: number;
  tagW: number;
  tagH: number;
  mirrored: boolean;
  shown: boolean;
  /** The chosen spot still covers the hero copy (no clear side, e.g. a tiny scene on a short phone): fade the tag out. */
  blocked: boolean;
  visible: boolean;
  /** Canvas size the tier was judged for, and the seconds left in which it may still change. */
  sizeW: number;
  sizeH: number;
  tierWatch: number;
  /** Last written values, to skip redundant DOM writes. */
  wTx: number;
  wTy: number;
  wRx: number;
  wRy: number;
  wLen: number;
  wAng: number;
};

/** "+1385.2" / "−0312.7": sign and zero padding keep every row the same width. */
function fmt(metres: number) {
  const mm = Math.round(metres * 10000) / 10;
  return (mm < 0 ? "−" : "+") + Math.abs(mm).toFixed(1).padStart(6, "0");
}

/** Arm-local point → canvas pixels, stored as obstacle point i. */
function plot(s: Scratch, i: number, layout: SceneLayout, camera: THREE.Camera, W: number, H: number, x: number, y: number, z: number) {
  const a = layout.armScale;
  s.v.set(layout.arm[0] + a * x, layout.arm[1] + a * y, layout.arm[2] + a * z).project(camera);
  s.pts[i * 2] = (s.v.x * 0.5 + 0.5) * W;
  s.pts[i * 2 + 1] = (0.5 - s.v.y * 0.5) * H;
}

function plotWorld(s: Scratch, i: number, camera: THREE.Camera, W: number, H: number, x: number, y: number, z: number) {
  s.v.set(x, y, z).project(camera);
  s.pts[i * 2] = (s.v.x * 0.5 + 0.5) * W;
  s.pts[i * 2 + 1] = (0.5 - s.v.y * 0.5) * H;
}

/** 0..1: how deep the capsule (segment a→b, radius r) reaches into the box. */
function capsule(ax: number, ay: number, bx: number, by: number, r: number, x0: number, y0: number, x1: number, y1: number) {
  let worst = 0;
  for (let k = 0; k <= 4; k++) {
    const u = k / 4;
    const px = ax + (bx - ax) * u;
    const py = ay + (by - ay) * u;
    const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
    const dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
    const pen = 1 - Math.hypot(dx, dy) / r;
    if (pen > worst) worst = pen;
  }
  return worst;
}

/** Re-read what only the DOM knows: mirroring, the tag's size and where the hero copy sits (canvas pixels). */
function measure(s: Scratch, canvas: HTMLCanvasElement, d: Dom, range: Range) {
  const { tag, flip, origin, probe } = d;
  const cr = canvas.getBoundingClientRect();
  // The hero mirrors the whole canvas layer for RTL locales. Detect it from geometry (works for any
  // ancestor transform / scale): the probe sits 64px along the root's local +X, so if it lands to
  // the left of the origin on screen the layer is flipped. Only the text is flipped back.
  s.mirrored = probe.getBoundingClientRect().left < origin.getBoundingClientRect().left;
  flip.style.transform = s.mirrored ? "scaleX(-1)" : "";
  s.tagW = tag.offsetWidth || s.tagW;
  s.tagH = tag.offsetHeight || s.tagH;
  s.nRects = 0;
  const add = (r: DOMRect, mergeLines: boolean) => {
    if (r.width < 2 || r.height < 2) return;
    const x0 = s.mirrored ? cr.right - r.right : r.left - cr.left;
    const y0 = r.top - cr.top;
    const x1 = x0 + r.width;
    const y1 = y0 + r.height;
    if (mergeLines) {
      for (let i = s.nSoft; i < s.nRects; i++) {
        const o = i * 4;
        const overlap = Math.min(y1, s.rects[o + 3]) - Math.max(y0, s.rects[o + 1]);
        if (overlap > 0.5 * Math.min(y1 - y0, s.rects[o + 3] - s.rects[o + 1])) {
          s.rects[o] = Math.min(s.rects[o], x0);
          s.rects[o + 1] = Math.min(s.rects[o + 1], y0);
          s.rects[o + 2] = Math.max(s.rects[o + 2], x1);
          s.rects[o + 3] = Math.max(s.rects[o + 3], y1);
          return;
        }
      }
    }
    if (s.nRects >= MAX_RECTS) return;
    s.rects.set([x0, y0, x1, y1], s.nRects++ * 4);
  };
  // HUD furniture drawn above this layer on desktop (HeroHud): the elevation ruler at the far edge
  // (lg+) and the telemetry block in the far bottom corner (xl+, 860px+ tall). Soft obstacles, in canvas space
  // (the canvas is mirrored for RTL, the HUD uses logical "end", so they coincide).
  s.nSoft = 0;
  if (cr.width >= 1024) s.rects.set([cr.width - 100, cr.height / 2 - 120, cr.width - 28, cr.height / 2 + 140], (s.nRects++, s.nSoft++) * 4);
  if (cr.width >= 1280 && window.innerHeight >= 860) s.rects.set([cr.width - 440, cr.height - 130, cr.width - 40, cr.height - 30], (s.nRects++, s.nSoft++) * 4);
  const title = document.getElementById("hero-title");
  if (!title) return;
  // Headline: one box per rendered line of actual text (its element boxes are far wider than the words).
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // The screen-reader copy of the headline is one long clipped line: not visible, not an obstacle.
    if (node.parentElement?.closest(".sr-only")) continue;
    range.selectNodeContents(node);
    const lines = range.getClientRects();
    for (let i = 0; i < lines.length; i++) add(lines[i], true);
  }
  const first = s.nRects;
  const eyebrow = title.previousElementSibling?.lastElementChild;
  if (eyebrow) add(eyebrow.getBoundingClientRect(), false);
  const lede = title.nextElementSibling;
  if (lede) add(lede.getBoundingClientRect(), false);
  const actions = lede?.nextElementSibling?.children;
  if (actions) for (let i = 0; i < actions.length; i++) add(actions[i].getBoundingClientRect(), false);
  // The big centred logo: on phones and tablets the raised arm reaches up toward it.
  const logo = title.closest("section")?.querySelector("img");
  if (logo) add(logo.getBoundingClientRect(), false);
  // Breathing room around the copy.
  for (let i = s.nSoft; i < s.nRects; i++) {
    const pad = i < first ? 10 : 8;
    s.rects[i * 4] -= pad;
    s.rects[i * 4 + 1] -= pad;
    s.rects[i * 4 + 2] += pad;
    s.rects[i * 4 + 3] += pad;
  }
}

/**
 * Choose which side of the tip (tx, ty) the tag sits on: the candidate
 * direction whose box (and leader) covers the least of what matters, with
 * hysteresis so it only moves when a clearly better spot has been available
 * for a while. `partNest` is the station the work piece rests on (-1 = in the gripper).
 */
function place(
  s: Scratch,
  layout: SceneLayout,
  camera: THREE.Camera,
  W: number,
  H: number,
  tx: number,
  ty: number,
  pxPerWorld: number,
  gap: number,
  partNest: number,
  snap: boolean,
) {
  const { h1, a1, d1, l2, a3, l3 } = ARM_DIM;
  const q = s.q;
  // Arm chain (same kinematics as armToolLocal): shoulder, elbow, wrist centre.
  const c1 = Math.cos(q[0]);
  const s1 = Math.sin(q[0]);
  const q23 = q[1] + q[2];
  const ex = a1 - Math.sin(q[1]) * l2;
  const ey = d1 + Math.cos(q[1]) * l2;
  const wx = ex - a3 * Math.cos(q23) - l3 * Math.sin(q23);
  const wy = ey - a3 * Math.sin(q23) + l3 * Math.cos(q23);
  plot(s, P_WRIST, layout, camera, W, H, wx * c1, h1 + wy, -wx * s1);
  plot(s, P_ELBOW, layout, camera, W, H, ex * c1, h1 + ey, -ex * s1);
  plot(s, P_SHOULDER, layout, camera, W, H, a1 * c1, h1 + d1, -a1 * s1);
  plot(s, P_BASE, layout, camera, W, H, 0, 0.12, 0);
  for (let i = 0; i < ARM_STATIONS.length; i++) {
    const st = ARM_STATIONS[i];
    plot(s, P_NEST + i, layout, camera, W, H, st[0], st[1], st[2]);
  }
  // Learner, from the layout alone: a standing figure (model is in metres) and its chest, where the beam lands.
  const hs = layout.humanoidScale;
  const [hx, hy, hz] = layout.humanoid;
  plotWorld(s, P_FEET, camera, W, H, hx, hy + 0.15 * hs, hz);
  plotWorld(s, P_HEAD, camera, W, H, hx, hy + 1.72 * hs, hz);
  plotWorld(s, P_CHEST, camera, W, H, hx, hy + 1.28 * hs, hz);

  const P = s.pts;
  const u = pxPerWorld * layout.armScale; // px per arm-local unit at the tip
  const hw = s.tagW / 2;
  const hh = s.tagH / 2;
  const area = s.tagW * s.tagH;
  let best = 0;
  let bestCost = Infinity;
  let curCost = Infinity;
  let onCopy = 0; // bit i: slot i covers the hero copy
  for (let i = 0; i < SLOTS; i++) {
    const ang = (i / SLOTS) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const reach = gap + hw * Math.abs(dx) + hh * Math.abs(dy);
    // Box as it would really be drawn: pushed back inside the canvas.
    const left = clamp(tx + dx * reach - hw, EDGE, Math.max(EDGE, W - EDGE - s.tagW));
    const top = clamp(ty + dy * reach - hh, EDGE, Math.max(EDGE, H - EDGE - s.tagH));
    const x0 = left;
    const y0 = top;
    const x1 = left + s.tagW;
    const y1 = top + s.tagH;
    let cost = 0.05 * Math.hypot(left + hw - (tx + dx * reach), top + hh - (ty + dy * reach));
    // Leader (tip → nearest point of the box) should not run up the gripper or along the imitation beam.
    const lx = clamp(tx, x0, x1) - tx;
    const ly = clamp(ty, y0, y1) - ty;
    const ll = Math.hypot(lx, ly) || 1;
    const gx = P[P_WRIST * 2] - tx;
    const gy = P[P_WRIST * 2 + 1] - ty;
    cost += 3 * Math.max(0, (lx * gx + ly * gy) / (ll * (Math.hypot(gx, gy) || 1)) - 0.25);
    const bx = P[P_CHEST * 2] - tx;
    const by = P[P_CHEST * 2 + 1] - ty;
    cost += 1.2 * Math.max(0, (lx * bx + ly * by) / (ll * (Math.hypot(bx, by) || 1)) - 0.5);
    // Gripper + wrist, forearm, lower arm, turret.
    cost += 3.2 * capsule(tx, ty, P[P_WRIST * 2], P[P_WRIST * 2 + 1], 0.17 * u + 6, x0, y0, x1, y1);
    cost += 1.7 * capsule(P[P_WRIST * 2], P[P_WRIST * 2 + 1], P[P_ELBOW * 2], P[P_ELBOW * 2 + 1], 0.17 * u, x0, y0, x1, y1);
    cost += 1.2 * capsule(P[P_ELBOW * 2], P[P_ELBOW * 2 + 1], P[P_SHOULDER * 2], P[P_SHOULDER * 2 + 1], 0.2 * u, x0, y0, x1, y1);
    cost += 1.0 * capsule(P[P_SHOULDER * 2], P[P_SHOULDER * 2 + 1], P[P_BASE * 2], P[P_BASE * 2 + 1], 0.34 * u, x0, y0, x1, y1);
    // Learner's body (head and raised hand included), then the imitation beam's corridor.
    cost += 2.6 * capsule(P[P_FEET * 2], P[P_FEET * 2 + 1], P[P_HEAD * 2], P[P_HEAD * 2 + 1], 0.56 * hs * pxPerWorld, x0, y0, x1, y1);
    cost += 1.4 * capsule(tx, ty, P[P_CHEST * 2], P[P_CHEST * 2 + 1], 12, x0, y0, x1, y1);
    // Nest heads: the one holding the work piece matters, an empty one barely.
    for (let n = 0; n < ARM_STATIONS.length; n++) {
      const o = (P_NEST + n) * 2;
      cost += (n === partNest ? 2 : 0.35) * capsule(P[o], P[o + 1], P[o], P[o + 1], 0.13 * u + 4, x0, y0, x1, y1);
    }
    // Hero copy: never worth covering.
    for (let r = 0; r < s.nRects; r++) {
      const o = r * 4;
      const ix = Math.min(x1, s.rects[o + 2]) - Math.max(x0, s.rects[o]);
      const iy = Math.min(y1, s.rects[o + 3]) - Math.max(y0, s.rects[o + 1]);
      if (ix > 0 && iy > 0) {
        cost += r < s.nSoft ? 1.2 + (2.5 * ix * iy) / area : 4 + (8 * ix * iy) / area;
        if (r >= s.nSoft) onCopy |= 1 << i;
      }
    }
    if (i === s.slot) {
      cost -= 0.7;
      curCost = cost;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  if (best !== s.slot && (snap || s.slot < 0 || s.since > 1.4 || curCost - bestCost > 3)) {
    s.slot = best;
    s.since = 0;
  }
  s.goal = (s.slot / SLOTS) * Math.PI * 2;
  s.blocked = ((onCopy >> s.slot) & 1) === 1;
}

export function TcpReadout({ layout, reduce, clock }: TcpReadoutProps) {
  // Tag size follows the drawn size of the arm; this state only changes when a tier boundary is crossed (resize).
  const [tier, setTier] = useState<Tier>(1);
  const invalidate = useThree((st) => st.invalidate);
  const gl = useThree((st) => st.gl);
  const dom = useRef<Dom | null>(null);

  const s = useMemo<Scratch>(
    () => ({
      q: [0, 0, 0, 0, 0, 0],
      p: [0, 0, 0],
      v: new THREE.Vector3(),
      pts: new Float32Array(P_COUNT * 2),
      rects: new Float32Array(MAX_RECTS * 4),
      nRects: 0,
      nSoft: 0,
      acc: 0,
      measureAcc: 0,
      since: 0,
      slot: -1,
      ang: 0,
      goal: 0,
      tagW: 112,
      tagH: 72,
      mirrored: false,
      shown: false,
      blocked: false,
      visible: false,
      sizeW: 0,
      sizeH: 0,
      tierWatch: 0,
      wTx: NaN,
      wTy: NaN,
      wRx: NaN,
      wRy: NaN,
      wLen: NaN,
      wAng: NaN,
    }),
    [],
  );
  const range = useMemo(() => document.createRange(), []);

  // Build the tag beside the canvas. Rebuilt (and placed from scratch) when the size tier changes.
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const d = buildDom(host, tier);
    dom.current = d;
    s.slot = -1;
    s.shown = false;
    s.visible = false;
    s.blocked = false;
    s.wTx = s.wTy = s.wRx = s.wRy = s.wLen = s.wAng = NaN;
    invalidate();
    return () => {
      dom.current = null;
      d.root.remove();
    };
  }, [s, gl, tier, invalidate]);

  // Layout changed: place from scratch on the next frame.
  useEffect(() => {
    s.slot = -1;
    invalidate();
  }, [s, layout, invalidate]);

  // On-demand rendering never ticks again by itself: re-place once the copy has finished animating in.
  useEffect(() => {
    if (!reduce) return;
    const id = window.setTimeout(invalidate, 1800);
    return () => window.clearTimeout(id);
  }, [reduce, invalidate, layout]);

  useFrame((state, delta) => {
    const d = dom.current;
    if (!d) return;
    const { camera, size } = state;
    const W = size.width;
    const H = size.height;
    const dt = Math.min(delta, 0.1);

    const t = reduce ? REDUCED_T : clock.current;
    const gap = TIER_GAP[tier];
    armToolLocal(armPose(t, s.q), s.p);
    const p = s.p;
    const a = layout.armScale;
    camera.updateMatrixWorld();
    s.v.set(layout.arm[0] + a * p[0], layout.arm[1] + a * p[1], layout.arm[2] + a * p[2]).applyMatrix4(camera.matrixWorldInverse);
    const depth = -s.v.z;
    s.v.applyMatrix4(camera.projectionMatrix);
    const tx = (s.v.x * 0.5 + 0.5) * W;
    const ty = (0.5 - s.v.y * 0.5) * H;
    const shown = depth > camera.near && tx > -24 && tx < W + 24 && ty > -24 && ty < H + 24;
    const pxPerWorld = shown ? (0.5 * H * camera.projectionMatrix.elements[5]) / depth : 0;
    // Size tier: judged only for a moment after the canvas (re)sizes, so the scroll dolly never swaps it.
    if (W !== s.sizeW || H !== s.sizeH) {
      s.sizeW = W;
      s.sizeH = H;
      s.tierWatch = 1;
    }
    if (shown && s.tierWatch > 0) {
      s.tierWatch -= dt;
      const want = tierFor(pxPerWorld * a, tier);
      if (want !== tier) {
        setTier(want);
        return;
      }
    }
    s.shown = shown;
    if (!shown) {
      if (s.visible) {
        s.visible = false;
        d.root.style.opacity = "0";
      }
      return;
    }

    const snap = reduce || s.slot < 0;
    s.acc += dt;
    s.since += dt;
    s.measureAcc += dt;
    if (snap || s.measureAcc >= MEASURE) {
      s.measureAcc = 0;
      measure(s, gl.domElement, d, range);
    }
    if (snap || s.acc >= TICK) {
      s.acc = 0;
      // Base frame: X out of the base front, Y to the robot's left, Z up.
      const cb = Math.cos(BASE_YAW);
      const sb = Math.sin(BASE_YAW);
      const sx = fmt(p[0] * cb - p[2] * sb);
      const sy = fmt(-p[0] * sb - p[2] * cb);
      const sz = fmt(p[1]);
      if (d.x.textContent !== sx) d.x.textContent = sx;
      if (d.y.textContent !== sy) d.y.textContent = sy;
      if (d.z.textContent !== sz) d.z.textContent = sz;
      place(s, layout, camera, W, H, tx, ty, pxPerWorld, gap, demoPart(t), snap);
      if (s.visible === s.blocked) {
        s.visible = !s.blocked;
        d.root.style.opacity = s.visible ? "1" : "0";
      }
    }

    // Swing around the tip toward the chosen side (shortest way, never across the tip);
    // the box itself always stays inside the canvas.
    const turn = Math.atan2(Math.sin(s.goal - s.ang), Math.cos(s.goal - s.ang));
    s.ang += turn * (snap ? 1 : 1 - Math.exp(-dt * 5));
    const dx = Math.cos(s.ang);
    const dy = Math.sin(s.ang);
    const reach = gap + (s.tagW / 2) * Math.abs(dx) + (s.tagH / 2) * Math.abs(dy);
    const left = clamp(tx + dx * reach - s.tagW / 2, EDGE, Math.max(EDGE, W - EDGE - s.tagW));
    const top = clamp(ty + dy * reach - s.tagH / 2, EDGE, Math.max(EDGE, H - EDGE - s.tagH));
    const rx = Math.round((left - tx) * 4) / 4;
    const ry = Math.round((top - ty) * 4) / 4;
    const rtx = Math.round(tx * 4) / 4;
    const rty = Math.round(ty * 4) / 4;
    if (rtx !== s.wTx || rty !== s.wTy) {
      s.wTx = rtx;
      s.wTy = rty;
      d.root.style.transform = `translate3d(${rtx}px,${rty}px,0)`;
    }
    if (rx !== s.wRx || ry !== s.wRy) {
      s.wRx = rx;
      s.wRy = ry;
      d.tag.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      // Leader: from the tip marker to the nearest point of the box.
      const nx = clamp(0, rx, rx + s.tagW);
      const ny = clamp(0, ry, ry + s.tagH);
      const len = Math.round(Math.max(0, Math.hypot(nx, ny) - RING));
      const ang = Math.round(Math.atan2(ny, nx) * 500) / 500;
      if (len !== s.wLen || ang !== s.wAng) {
        s.wLen = len;
        s.wAng = ang;
        d.lead.style.width = `${len}px`;
        d.lead.style.transform = `rotate(${ang}rad) translateX(${RING}px)`;
      }
    }
  });

  return null;
}
