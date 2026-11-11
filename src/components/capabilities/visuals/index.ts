import type { ComponentType } from "react";
import type { VisualKey } from "../data";
import type { VisualProps } from "./engine";
import { KinematicsVisual } from "./KinematicsVisual";
import { SpectrumVisual } from "./SpectrumVisual";
import { FusionVisual } from "./FusionVisual";
import { GeospatialVisual } from "./GeospatialVisual";
import { TwinVisual } from "./TwinVisual";
import { ForecastVisual } from "./ForecastVisual";
import { NetworkVisual } from "./NetworkVisual";
import { DocumentVisual } from "./DocumentVisual";
import { AgenticVisual } from "./AgenticVisual";
import { TimelineVisual } from "./TimelineVisual";
import { MeshVisual } from "./MeshVisual";
import { SlamVisual } from "./SlamVisual";

export type { VisualProps };

export const VISUALS: Record<VisualKey, ComponentType<VisualProps>> = {
  kinematics: KinematicsVisual,
  spectrum: SpectrumVisual,
  fusion: FusionVisual,
  geospatial: GeospatialVisual,
  twin: TwinVisual,
  forecast: ForecastVisual,
  network: NetworkVisual,
  document: DocumentVisual,
  agentic: AgenticVisual,
  timeline: TimelineVisual,
  mesh: MeshVisual,
  slam: SlamVisual,
};
