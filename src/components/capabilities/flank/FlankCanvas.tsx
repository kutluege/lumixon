"use client";

import { lazy, Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { FlankKind, FlankQuality } from "./contract";

export type { FlankKind };

/*
 * Each scene is its own chunk, fetched only when this canvas host mounts
 * (FlankStage loads this module with next/dynamic, ssr: false).
 */
const SCENES = {
  research: lazy(() => import("./ResearchScene")),
  field: lazy(() => import("./FieldScene")),
  pathology: lazy(() => import("./PathologyScene")),
  sonar: lazy(() => import("./SonarScene")),
};

export type FlankCanvasProps = {
  kind: FlankKind;
  quality: FlankQuality;
  reduce: boolean;
  /** false → frameloop "never" (panel off-screen or tab hidden). */
  active: boolean;
  /** Called once the scene has rendered its first frame. */
  onReady: () => void;
};

/** Mounts with the scene (same Suspense boundary) and reports its first rendered frame. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // Let the frame land on screen before the stage cross-fades from the fallback.
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  });
  return null;
}

/**
 * One transparent R3F canvas hosting one flank scene. The scene brings its own
 * camera, lights and motion; the host only sets renderer policy.
 */
export default function FlankCanvas({ kind, quality, reduce, active, onReady }: FlankCanvasProps) {
  const Scene = SCENES[kind];
  return (
    <Canvas
      aria-hidden
      dpr={quality === "high" ? [1, 1.6] : [1, 1.25]}
      frameloop={!active ? "never" : reduce ? "demand" : "always"}
      shadows={quality === "high" ? "percentage" : false}
      gl={{
        antialias: quality === "high",
        alpha: true,
        stencil: false,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 35, near: 0.05, far: 200, position: [3, 2, 4] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <Scene quality={quality} reduce={reduce} />
        <FirstFrame onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
