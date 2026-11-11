"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, r1, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Editing timeline: a film strip whose frames keep one subject consistent
 * across shots, shot blocks, keyframes and an interpolation curve, all
 * scrolling under a fixed playhead with a 24 fps timecode.
 */
const PERIOD = 208; // 4 frames of 52 units
const SPEED = 24; // units per second
const FPS = 24;
const GUTTER = 30;
const PH = 214; // playhead x

function periodContent(off: number) {
  const frames = [0, 1, 2, 3].map((j) => {
    const x = off + j * 52;
    const px = x + 9 + j * 6.5;
    return { x, px };
  });
  return frames;
}

const COPIES = [0, PERIOD, PERIOD * 2];
const KEYS = [18, 74, 128, 176];
const CURVE = "M18 204C40 204 52 184 74 184C100 184 104 198 128 198C150 198 154 188 176 188C196 188 204 204 226 204";

function frame(t: number) {
  const shift = (t * SPEED) % PERIOD;
  const f = Math.floor(t * FPS);
  const ff = String(f % FPS).padStart(2, "0");
  const ss = String(Math.floor(f / FPS) % 60).padStart(2, "0");
  const mm = String(Math.floor(f / (FPS * 60)) % 60).padStart(2, "0");
  return { shift, tc: `00:${mm}:${ss}:${ff}` };
}

export function TimelineVisual(props: VisualProps) {
  const L = useT().visuals.timeline;
  const strip = useRef<SVGGElement>(null);
  const tc = useRef<SVGTextElement>(null);
  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    strip.current?.setAttribute("transform", `translate(${r1(GUTTER - f.shift)} 0)`);
    if (tc.current) tc.current.textContent = f.tc;
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      <g ref={strip} transform={`translate(${r1(GUTTER - init.shift)} 0)`}>
        {COPIES.map((off) => (
          <g key={off}>
            {/* film strip */}
            <rect x={off} y={34} width={PERIOD} height={60} fill={C.indigoLo} fillOpacity={0.6} />
            {Array.from({ length: 16 }, (_, k) => (
              <g key={k} fill={C.bg}>
                <rect x={off + 4 + k * 13} y={38} width={6} height={4} />
                <rect x={off + 4 + k * 13} y={86} width={6} height={4} />
              </g>
            ))}
            {periodContent(off).map(({ x, px }, j) => (
              <g key={j}>
                <rect x={x + 2} y={46} width={48} height={36} fill={C.bg} fillOpacity={0.85} stroke={C.ice} strokeOpacity={0.3} />
                <path d={`M${x + 2} 72H${x + 50}`} stroke={C.ice} strokeOpacity={0.18} />
                <rect x={px} y={60} width={14} height={11} fill={C.indigo} stroke={C.indigoHi} strokeOpacity={0.8} />
                <path d={`M${px + 2} 72l-3 6M${px + 12} 72l3 6`} stroke={C.ice} strokeOpacity={0.25} />
                <path d={`M${x + 32 - j * 4} 50l10 0`} stroke={C.iceHi} strokeOpacity={0.35} />
              </g>
            ))}

            {/* shot blocks */}
            <rect x={off + 1} y={112} width={96} height={16} fill={C.indigo} fillOpacity={0.45} stroke={C.ice} strokeOpacity={0.35} />
            <rect x={off + 100} y={112} width={106} height={16} fill={C.indigo} fillOpacity={0.3} stroke={C.ice} strokeOpacity={0.35} />
            <text x={off + 6} y={123} fontFamily={MONO} fontSize={8.5} fill={C.iceHi} fillOpacity={0.75}>
              {L.scene} 01
            </text>
            <text x={off + 105} y={123} fontFamily={MONO} fontSize={8.5} fill={C.iceHi} fillOpacity={0.75}>
              {L.scene} 02
            </text>

            {/* keyframes */}
            <path d={`M${off} 150H${off + PERIOD}`} stroke={C.ice} strokeOpacity={0.15} />
            {KEYS.map((k) => (
              <rect key={k} x={off + k - 4} y={146} width={8} height={8} transform={`rotate(45 ${off + k} 150)`} fill={C.bg} stroke={C.iceHi} strokeOpacity={0.85} />
            ))}

            {/* interpolation curve */}
            <path d={CURVE} transform={`translate(${off} 0)`} stroke={C.indigoHi} strokeOpacity={0.85} />
            {KEYS.map((k) => (
              <path key={k} d={`M${off + k} 154V204`} stroke={C.ice} strokeOpacity={0.08} />
            ))}
          </g>
        ))}
      </g>

      {/* track gutter */}
      <rect x={0} y={0} width={GUTTER} height={240} fill={C.bg} />
      <path d={`M${GUTTER} 30V214`} stroke={C.ice} strokeOpacity={0.2} />
      <g fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.5}>
        <text x={6} y={67}>{L.tracks[0]}</text>
        <text x={6} y={123}>{L.tracks[1]}</text>
        <text x={6} y={153}>{L.tracks[2]}</text>
        <text x={6} y={196}>{L.tracks[3]}</text>
      </g>

      {/* playhead */}
      <path d={`M${PH} 26V214`} stroke={C.accent} strokeWidth={1.2} />
      <path d={`M${PH - 5} 26h10l-5 6z`} fill={C.accent} />
      <rect x={PH - 27} y={30} width={54} height={66} stroke={C.iceHi} strokeOpacity={hot ? 0.9 : 0.5} className="transition-[stroke-opacity] duration-500" />
      <rect x={PH - 36} y={8} width={72} height={14} fill={C.bg} stroke={C.accent} strokeOpacity={0.7} />
      <text ref={tc} x={PH} y={18} fontFamily={MONO} fontSize={9.5} fill={C.iceHi} textAnchor="middle">
        {init.tc}
      </text>
      <text x={388} y={228} fontFamily={MONO} fontSize={8.5} fill={C.ice} fillOpacity={0.5} textAnchor="end">
        {L.caption}
      </text>
    </svg>
  );
}
