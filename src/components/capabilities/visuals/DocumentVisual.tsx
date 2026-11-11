"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, clamp, r1, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";

/**
 * Layout analysis on a page: a read head sweeps down the document, each field
 * it passes gets an extraction box and a link to its slot in the structured
 * output, with a page reference kept for traceability.
 */
const PAGE = { x: 34, y: 22, w: 140, h: 196 };
const FIELDS = [
  { key: "belge_no", box: [112, 34, 52, 10], bar: 70 },
  { key: "tarih", box: [112, 50, 40, 10], bar: 54 },
  { key: "taraflar", box: [44, 70, 100, 22], bar: 120 },
  { key: "tutar", box: [116, 162, 48, 11], bar: 62 },
  { key: "imza", box: [44, 186, 54, 20], bar: 40 },
] as const;
const OUT_X = 216;
const rowY = (i: number) => 54 + i * 34;

// static page furniture
const TEXT_LINES: [number, number, number][] = [
  [44, 38, 46],
  [44, 46, 30],
  [44, 100, 120],
  [44, 106, 112],
  [44, 112, 96],
  [44, 178, 70],
];
const TABLE = { x: 44, y: 122, w: 120, h: 34, rows: 3, cols: 3 };

function frame(t: number) {
  const p = (t / 7) % 1;
  const scanY = PAGE.y + clamp(p / 0.72, 0, 1) * PAGE.h;
  const fade = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
  const prog = FIELDS.map((f) => clamp((scanY - (f.box[1] + f.box[3])) / 26, 0, 1));
  return { scanY, fade, prog };
}

export function DocumentVisual(props: VisualProps) {
  const L = useT().visuals.document;
  const scan = useRef<SVGGElement>(null);
  const layer = useRef<SVGGElement>(null);
  const boxes = useRef<(SVGRectElement | null)[]>([]);
  const links = useRef<(SVGPathElement | null)[]>([]);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const init = useMemo(() => frame(T0), []);

  useVisualLoop((t) => {
    const f = frame(t);
    scan.current?.setAttribute("transform", `translate(0 ${r1(f.scanY)})`);
    layer.current?.setAttribute("opacity", String(r1(f.fade)));
    f.prog.forEach((v, i) => {
      boxes.current[i]?.setAttribute("opacity", v > 0 ? "1" : "0");
      links.current[i]?.setAttribute("stroke-dashoffset", String(r1(1 - v)));
      bars.current[i]?.setAttribute("width", String(r1(FIELDS[i].bar * v)));
    });
  }, props);

  const hot = props.hot;

  return (
    <svg {...SVG_PROPS}>
      {/* page */}
      <path
        d={`M${PAGE.x} ${PAGE.y}H${PAGE.x + PAGE.w - 14}L${PAGE.x + PAGE.w} ${PAGE.y + 14}V${PAGE.y + PAGE.h}H${PAGE.x}Z`}
        fill={C.indigoLo}
        fillOpacity={0.55}
        stroke={C.ice}
        strokeOpacity={0.45}
      />
      <path d={`M${PAGE.x + PAGE.w - 14} ${PAGE.y}V${PAGE.y + 14}H${PAGE.x + PAGE.w}`} stroke={C.ice} strokeOpacity={0.45} />
      <g fill={C.ice} fillOpacity={0.2}>
        {TEXT_LINES.map(([x, y, w], i) => (
          <rect key={i} x={x} y={y} width={w} height={2.5} />
        ))}
        {FIELDS.slice(0, 2).map((f) => (
          <rect key={f.key} x={f.box[0] + 3} y={f.box[1] + 4} width={f.box[2] - 10} height={2.5} />
        ))}
        <rect x={48} y={75} width={70} height={2.5} />
        <rect x={48} y={83} width={86} height={2.5} />
        <rect x={120} y={166} width={36} height={3} fillOpacity={0.35} />
      </g>
      <g stroke={C.ice} strokeOpacity={0.22}>
        <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} />
        {[1, 2].map((r) => (
          <path key={`r${r}`} d={`M${TABLE.x} ${TABLE.y + (r * TABLE.h) / 3}h${TABLE.w}`} />
        ))}
        {[1, 2].map((c) => (
          <path key={`c${c}`} d={`M${TABLE.x + (c * TABLE.w) / 3} ${TABLE.y}v${TABLE.h}`} />
        ))}
      </g>
      <path d="M48 200c6 -10 10 4 16 -4s8 6 14 -2 6 4 12 0" stroke={C.ice} strokeOpacity={0.5} />

      {/* output schema */}
      <text x={OUT_X} y={30} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.55}>
        {L.header}
      </text>
      {FIELDS.map((f, i) => (
        <g key={f.key} fontFamily={MONO} fontSize={9.5}>
          <text x={OUT_X + 10} y={rowY(i)} fill={C.ice} fillOpacity={hot ? 0.9 : 0.65} className="transition-[fill-opacity] duration-500">
            {L.fields[i]}:
          </text>
          <rect x={OUT_X + 10} y={rowY(i) + 6} width={f.bar} height={5} fill={C.ice} fillOpacity={0.08} />
          <rect
            ref={(el) => {
              bars.current[i] = el;
            }}
            x={OUT_X + 10}
            y={rowY(i) + 6}
            width={r1(f.bar * init.prog[i])}
            height={5}
            fill={C.indigoHi}
            fillOpacity={0.85}
          />
          <text x={388} y={rowY(i) + 11} fill={C.ice} fillOpacity={0.4} textAnchor="end" fontSize={8.5}>
            {L.page}
          </text>
        </g>
      ))}
      <text x={OUT_X} y={rowY(FIELDS.length) - 8} fontFamily={MONO} fontSize={9.5} fill={C.ice} fillOpacity={0.55}>
        {"}"}
      </text>

      {/* extraction layer */}
      <g ref={layer} opacity={r1(init.fade)}>
        {FIELDS.map((f, i) => {
          const [x, y, w, h] = f.box;
          const sx = x + w;
          const sy = y + h / 2;
          const ty = rowY(i) - 3;
          return (
            <g key={f.key}>
              <rect
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                x={x - 2}
                y={y - 2}
                width={w + 4}
                height={h + 4}
                fill={C.indigo}
                fillOpacity={0.25}
                stroke={i === 4 ? C.accent : C.iceHi}
                strokeOpacity={0.9}
                opacity={init.prog[i] > 0 ? 1 : 0}
                style={{ transition: "opacity 250ms" }}
              />
              <path
                ref={(el) => {
                  links.current[i] = el;
                }}
                d={`M${sx + 2} ${sy}C${sx + 34} ${sy} ${OUT_X - 30} ${ty} ${OUT_X + 4} ${ty}`}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={r1(1 - init.prog[i])}
                stroke={i === 4 ? C.accent : C.ice}
                strokeOpacity={0.6}
              />
            </g>
          );
        })}
      </g>

      {/* read head */}
      <g ref={scan} transform={`translate(0 ${r1(init.scanY)})`}>
        <rect x={PAGE.x} y={-10} width={PAGE.w} height={10} fill={C.indigo} fillOpacity={0.25} />
        <path d={`M${PAGE.x - 6} 0H${PAGE.x + PAGE.w + 6}`} stroke={C.ice} strokeOpacity={0.8} />
      </g>
    </svg>
  );
}
