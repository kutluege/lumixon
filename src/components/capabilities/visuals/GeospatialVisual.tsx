"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Elevation contours (marching squares over a synthetic terrain field, computed
 * once), a slippy-map tile grid, and a sensor sweep that reveals detection
 * boxes as it passes, one of them flagged as a change since the last pass.
 */

const PEAKS = [
  { x: 118, y: 132, s: 74, h: 1 },
  { x: 304, y: 66, s: 52, h: 0.8 },
  { x: 262, y: 200, s: 58, h: -0.45 },
  { x: 40, y: 30, s: 40, h: 0.35 },
];
const field = (x: number, y: number) =>
  PEAKS.reduce((acc, p) => acc + p.h * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.s * p.s)), 0);

const CELL = 10;
const COLS = 400 / CELL;
const ROWS = 240 / CELL;

function contours(level: number) {
  const v = (i: number, j: number) => field(i * CELL, j * CELL);
  const lerpPt = (x0: number, y0: number, a: number, x1: number, y1: number, b: number) => {
    const t = (level - a) / (b - a);
    return `${r1(x0 + (x1 - x0) * t)} ${r1(y0 + (y1 - y0) * t)}`;
  };
  let d = "";
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const a = v(i, j);
      const b = v(i + 1, j);
      const c = v(i + 1, j + 1);
      const e = v(i, j + 1);
      const x = i * CELL;
      const y = j * CELL;
      const pts: string[] = [];
      if (a < level !== b < level) pts.push(lerpPt(x, y, a, x + CELL, y, b));
      if (b < level !== c < level) pts.push(lerpPt(x + CELL, y, b, x + CELL, y + CELL, c));
      if (c < level !== e < level) pts.push(lerpPt(x + CELL, y + CELL, c, x, y + CELL, e));
      if (e < level !== a < level) pts.push(lerpPt(x, y + CELL, e, x, y, a));
      if (pts.length >= 2) d += `M${pts[0]}L${pts[1]}`;
      if (pts.length === 4) d += `M${pts[2]}L${pts[3]}`;
    }
  }
  return d;
}

const LEVELS = [-0.25, 0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82].map((l, i) => ({
  d: contours(l),
  major: i % 3 === 2,
}));

const BOXES = [
  { x: 62, y: 66, w: 36, h: 24, label: "building" },
  { x: 160, y: 150, w: 18, h: 12, label: "vehicle" },
  { x: 188, y: 162, w: 18, h: 12, label: "vehicle" },
  { x: 258, y: 100, w: 46, h: 32, label: "change", accent: true },
  { x: 332, y: 160, w: 30, h: 24, label: "building" },
] as const;

const bracket = (x: number, y: number, w: number, h: number, l = 6) =>
  `M${x} ${y + l}V${y}H${x + l}M${x + w - l} ${y}H${x + w}V${y + l}M${x + w} ${y + h - l}V${y + h}H${x + w - l}M${x + l} ${y + h}H${x}V${y + h - l}`;

function frame(t: number, north: string, east: string) {
  const c = (t * 0.14 + 0.35) % 1;
  const scanX = -20 + c * 1.3 * 420;
  return {
    scanX,
    visible: BOXES.map((b) => scanX > b.x + b.w / 2 && c < 0.94),
    lat: `${north} ${(41.0118 + (scanX / 400) * 0.0213).toFixed(4)}°  ${east} ${(28.9702 + (scanX / 400) * 0.0365).toFixed(4)}°`,
  };
}

export function GeospatialVisual(props: VisualProps) {
  const L = useT().visuals.geospatial;
  const scan = useRef<SVGGElement>(null);
  const boxes = useRef<(SVGGElement | null)[]>([]);
  const lat = useRef<SVGTextElement>(null);
  const init = useMemo(() => frame(T0, L.north, L.east), [L]);

  useVisualLoop((t) => {
    const f = frame(t, L.north, L.east);
    scan.current?.setAttribute("transform", `translate(${r1(f.scanX)} 0)`);
    f.visible.forEach((v, i) => {
      const el = boxes.current[i];
      if (el) el.style.opacity = v ? "1" : "0";
    });
    if (lat.current) lat.current.textContent = f.lat;
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* contours */}
      {LEVELS.map((l, i) => (
        <path
          key={i}
          d={l.d}
          stroke={l.major ? C.ice : C.indigoHi}
          strokeOpacity={l.major ? (hot ? 0.45 : 0.32) : hot ? 0.3 : 0.18}
          strokeWidth={l.major ? 1 : 0.8}
          className="transition-[stroke-opacity] duration-500"
        />
      ))}

      {/* tile grid */}
      <g stroke={C.ice} strokeOpacity={0.14}>
        {[110, 200, 290].map((x) => (
          <path key={x} d={`M${x} 0V240`} />
        ))}
        {[80, 160].map((y) => (
          <path key={y} d={`M0 ${y}H400`} />
        ))}
      </g>
      <g fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.35}>
        <text x={114} y={90}>14/9325/6074</text>
        <text x={204} y={170}>14/9326/6075</text>
      </g>

      {/* sensor sweep */}
      <g ref={scan} transform={`translate(${r1(init.scanX)} 0)`}>
        <rect x={-46} y={0} width={46} height={240} fill={C.indigo} fillOpacity={0.12} />
        <path d="M0 0V240" stroke={C.ice} strokeOpacity={0.7} />
      </g>

      {/* detections */}
      {BOXES.map((b, i) => (
        <g
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          style={{ opacity: init.visible[i] ? 1 : 0, transition: "opacity 450ms" }}
        >
          {"accent" in b ? (
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={C.burgundy} fillOpacity={0.35} stroke={C.accent} strokeDasharray="3 2" />
          ) : null}
          <path d={bracket(b.x, b.y, b.w, b.h)} stroke={"accent" in b ? C.accent : C.iceHi} strokeWidth={1.2} />
          <text x={b.x} y={b.y - 4} fontFamily={MONO} fontSize={8.5} fill={"accent" in b ? C.iceHi : C.ice} fillOpacity={0.85}>
            {L[b.label]}
          </text>
        </g>
      ))}

      {/* coordinates readout */}
      <rect x={226} y={7} width={166} height={17} fill={C.bg} fillOpacity={0.75} />
      <text ref={lat} x={386} y={19} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.75} textAnchor="end" style={{ whiteSpace: "pre" }}>
        {init.lat}
      </text>

      {/* scale bar + north */}
      <g stroke={C.ice} strokeOpacity={0.6}>
        <path d="M20 226h60M20 222v8M50 224v4M80 222v8" />
      </g>
      <text x={86} y={229} fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.6}>
        {L.scale}
      </text>
      <g transform="translate(376 210)">
        <path d="M0 -12L5 6L0 2L-5 6Z" fill={C.ice} fillOpacity={0.6} />
        <text y={18} fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.6} textAnchor="middle">
          {L.north}
        </text>
      </g>
    </svg>
  );
}
