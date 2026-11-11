"use client";

import { useMemo, useRef } from "react";
import { C, MONO, SVG_PROPS, T0, clamp, cubic, r1, smooth, useVisualLoop, type VisualProps } from "./engine";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { VisualText } from "@/i18n/types";

type Labels = VisualText["agentic"];
type StatusKey = keyof Labels["status"];

/**
 * Agent execution graph. An orchestrator plans, fans out parallel tool calls,
 * results flow into a guardrail stage; a failed schema check routes back to
 * the planner (retry), the revised plan passes and is gated by a human
 * approval before the output is published. A live execution trace, step
 * counter, status chip and run metrics track the same deterministic script.
 */
type P = readonly [number, number];
type Seg = [P, P, P, P];
type Box = { x: number; y: number; w: number; h: number };

/* ── layout (viewBox 400×240) ───────────────────────────────────────────── */
const PLAN: Box = { x: 10, y: 64, w: 68, h: 64 };
const VAL: Box = { x: 226, y: 74, w: 64, h: 44 };
const HUMAN: Box = { x: 314, y: 50, w: 76, h: 28 };
const OUT: Box = { x: 314, y: 114, w: 76, h: 28 };
const TX = 104;
const TW = 98;
const TH = 17;
const TOOLS = [
  { id: "rag", label: "RAG", ms: "96ms" },
  { id: "sql", label: "SQL/ERP", ms: "182ms" },
  { id: "api", label: "REST API", ms: "240ms" },
  { id: "doc", label: "DOKÜMAN", ms: "131ms" },
  { id: "mail", label: "E-POSTA", ms: "" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];
const tcy = (i: number) => 50 + i * 23;

type NodeId = "plan" | ToolId | "val" | "human" | "out";
const NODE_IDS: NodeId[] = ["plan", ...TOOLS.map((t) => t.id), "val", "human", "out"];

/* ── edges ──────────────────────────────────────────────────────────────── */
const EDGES: Record<string, Seg> = {};
TOOLS.forEach((tl, i) => {
  const y = tcy(i);
  const ys = 96 + (i - 2) * 9;
  EDGES[`plan-${tl.id}`] = [[78, ys], [91, ys], [91, y], [TX, y]];
  const yv = 96 + (i - 2) * 6;
  EDGES[`${tl.id}-val`] = [[TX + TW, y], [214, y], [214, yv], [226, yv]];
});
EDGES["val-human"] = [[290, 88], [302, 88], [302, 64], [314, 64]];
EDGES["human-out"] = [[352, 78], [352, 92], [352, 100], [352, 114]];
EDGES["val-plan"] = [[258, 118], [258, 170], [44, 170], [44, 128]];
const EDGE_IDS = Object.keys(EDGES);
const toD = (e: Seg) => `M${e[0][0]} ${e[0][1]}C${e[1][0]} ${e[1][1]} ${e[2][0]} ${e[2][1]} ${e[3][0]} ${e[3][1]}`;

/* ── script ─────────────────────────────────────────────────────────────── */
type Kind = "call" | "result" | "retry" | "flow";
type Step = {
  dur: number;
  edges: string[];
  kind: Kind;
  /** Key into the localized status chip labels; the log line is `log[index]`. */
  status: StatusKey;
  fail?: boolean;
  focus?: NodeId;
};
const SCRIPT: Step[] = [
  { dur: 1.2, edges: [], kind: "flow", status: "planning", focus: "plan" },
  { dur: 1.1, edges: ["plan-rag", "plan-sql"], kind: "call", status: "toolCall" },
  { dur: 1.1, edges: ["rag-val", "sql-val"], kind: "result", status: "result" },
  { dur: 1.1, edges: [], kind: "flow", status: "failed", fail: true, focus: "val" },
  { dur: 1.3, edges: ["val-plan"], kind: "retry", status: "retry", fail: true },
  { dur: 1.1, edges: ["plan-api", "plan-doc"], kind: "call", status: "toolCall" },
  { dur: 1.1, edges: ["api-val", "doc-val"], kind: "result", status: "result" },
  { dur: 1.0, edges: [], kind: "flow", status: "passed", focus: "val" },
  { dur: 1.5, edges: ["val-human"], kind: "flow", status: "awaiting", focus: "human" },
  { dur: 1.2, edges: ["human-out"], kind: "flow", status: "done" },
  { dur: 1.4, edges: [], kind: "flow", status: "idle" },
];
const N = SCRIPT.length;
const NSTEPS = N - 1; // last entry is the idle hold
const START: number[] = [];
{
  let acc = 0;
  for (const s of SCRIPT) {
    START.push(acc);
    acc += s.dur;
  }
}
const CYCLE = START[N - 1] + SCRIPT[N - 1].dur;
const MOVE = 0.68; // fraction of a step spent travelling
const arriveAt = (i: number) => START[i] + SCRIPT[i].dur * MOVE;
const RETRY = SCRIPT.findIndex((s) => s.kind === "retry");
const PASS = 7;
// static frame (T0) lands mid-way through the second result hand-off
const OFF = START[6] + SCRIPT[6].dur * 0.5 - T0;

const TOOL_STEPS = TOOLS.map((tl) => ({
  call: SCRIPT.findIndex((s) => s.edges.includes(`plan-${tl.id}`)),
  res: SCRIPT.findIndex((s) => s.edges.includes(`${tl.id}-val`)),
}));

const NODE_ARRIVALS: Record<NodeId, number[]> = Object.fromEntries(NODE_IDS.map((n) => [n, [] as number[]])) as unknown as Record<
  NodeId,
  number[]
>;
SCRIPT.forEach((s, i) => {
  for (const e of s.edges) NODE_ARRIVALS[e.split("-")[1] as NodeId].push(arriveAt(i));
});

const ts = (i: number) => `[${START[i].toFixed(2).padStart(5, "0")}]`;
const PACKET_FILL: Record<Kind, string> = { call: C.iceHi, result: C.indigoHi, retry: C.accent, flow: C.iceHi };

/* ── frame ──────────────────────────────────────────────────────────────── */
function frame(t: number, k: number, L: Labels) {
  const c = (((t + OFF) % CYCLE) + CYCLE) % CYCLE;
  let idx = N - 1;
  for (let i = 0; i < N; i++) {
    if (c < START[i] + SCRIPT[i].dur) {
      idx = i;
      break;
    }
  }
  const step = SCRIPT[idx];
  const u = (c - START[idx]) / step.dur;
  const mv = smooth(clamp(u / MOVE, 0, 1));
  const fade = idx === N - 1 ? 1 - smooth(u) : 1;
  const gain = 0.8 + 0.2 * k;

  // edges: current step draws on, executed path stays faintly lit
  const edges: Record<string, { p: number; o: number }> = {};
  for (const id of EDGE_IDS) {
    let last = -1;
    for (let i = 0; i <= idx; i++) if (SCRIPT[i].edges.includes(id)) last = i;
    if (last < 0) edges[id] = { p: 0, o: 0 };
    else if (last === idx) edges[id] = { p: mv, o: 1 };
    else edges[id] = { p: 1, o: Math.max(0.32, 1 - (c - START[last] - SCRIPT[last].dur) / 1.6) * fade };
  }

  // packets (max two in flight)
  const packets = [0, 1].map((j) => {
    const id = step.edges[j];
    if (!id || u > MOVE + 0.04) return { on: false, x: 0, y: 0, kind: step.kind };
    const [x, y] = cubic(...EDGES[id], mv);
    return { on: true, x, y, kind: step.kind };
  });

  // node glow
  const glow = {} as Record<NodeId, number>;
  for (const n of NODE_IDS) {
    let g = 0;
    for (const a of NODE_ARRIVALS[n]) if (c >= a) g = Math.max(g, 1 - (c - a) / 1.5);
    if (step.focus === n) g = Math.max(g, 0.55 + 0.25 * Math.sin(c * 7));
    glow[n] = clamp(g, 0, 1) * gain * fade;
  }
  if (idx === 0) glow.plan = Math.max(glow.plan, (0.5 + 0.25 * Math.sin(c * 7)) * smooth(clamp(u * 3, 0, 1)) * gain);

  // tool states
  const tools = TOOL_STEPS.map((ts_) => {
    if (ts_.call < 0 || idx < ts_.call) return 0; // idle
    if (c < arriveAt(ts_.call)) return 0.5; // call in flight
    if (idx < ts_.res) return 1; // running
    return 2; // done
  });
  const done = tools.filter((s) => s === 2).length;

  const failing = idx >= 3 && idx <= RETRY;
  const marks: [string, string] =
    idx < 3 || (idx > RETRY && idx < PASS) ? ["·", "·"] : failing ? ["✓", "✕"] : ["✓", "✓"];
  const approved = idx >= N - 2 && c >= START[N - 2];
  const human = approved ? L.humanApproved : idx === N - 3 && u > MOVE ? L.humanPending : L.humanIdle;
  const published = idx === N - 1 || (idx === N - 2 && u > MOVE);

  // execution trace: three latest lines, newest typed in
  const lines = [2, 1, 0].map((back) => {
    const i = (idx - back + N) % N;
    let txt = L.log[i] ?? "";
    if (back === 0) {
      const n = Math.ceil(txt.length * clamp(u / 0.32, 0, 1));
      txt = txt.slice(0, n) + (n < txt.length || Math.sin(c * 9) > 0 ? "_" : " ");
    }
    return { ts: ts(i), txt, fail: !!SCRIPT[i].fail, back };
  });

  // planner progress: filled segments
  const steps = Math.min(idx + (u > MOVE ? 1 : 0), NSTEPS);
  let bar = "";
  const sw = 52 / NSTEPS;
  for (let i = 0; i < steps; i++) bar += `M${r1(18 + i * sw)} 104h${r1(sw - 1.2)}v4h${r1(-(sw - 1.2))}Z`;

  return {
    edges,
    packets,
    glow,
    tools,
    marks,
    failing,
    human,
    published,
    lines,
    bar,
    planVer: idx > RETRY || (idx === RETRY && u > MOVE) ? "plan v2" : "plan v1",
    stepLabel: fmt(L.step, { n: String(Math.min(idx + 1, NSTEPS)).padStart(2, "0"), total: NSTEPS }),
    status: L.status[step.status],
    fail: !!step.fail,
    halo: 5 + 2 * k,
    metrics: [
      `${c.toFixed(2)}s`,
      `${((c * 412) / 1000).toFixed(1)}k`,
      `${done}/${TOOLS.length}`,
      `${idx > RETRY || (idx === RETRY && u > MOVE) ? 2 : 1}/3`,
    ],
  };
}

type Frame = ReturnType<typeof frame>;

function set(el: Element | null | undefined, attr: string, v: string) {
  if (el && el.getAttribute(attr) !== v) el.setAttribute(attr, v);
}
function text(el: Element | null | undefined, v: string) {
  if (el && el.textContent !== v) el.textContent = v;
}
const toolLed = (s: number) => (s === 2 ? C.ice : s > 0 ? C.indigoHi : "none");
const lineFill = (l: Frame["lines"][number]) => (l.fail ? C.accent : l.back === 0 ? C.iceHi : C.ice);
const lineOp = (l: Frame["lines"][number]) => String(l.back === 0 ? 1 : l.back === 1 ? 0.62 : 0.4);

export function AgenticVisual(props: VisualProps) {
  const L = useT().visuals.agentic;
  const init = useMemo(() => frame(T0, 0, L), [L]);
  const edgeEls = useRef<Record<string, SVGPathElement | null>>({});
  const glowEls = useRef<Partial<Record<NodeId, SVGRectElement | null>>>({});
  const ledEls = useRef<(SVGRectElement | null)[]>([]);
  const msEls = useRef<(SVGTextElement | null)[]>([]);
  const pkEls = useRef<(SVGGElement | null)[]>([]);
  const tsEls = useRef<(SVGTextElement | null)[]>([]);
  const lnEls = useRef<(SVGTextElement | null)[]>([]);
  const mEls = useRef<(SVGTextElement | null)[]>([]);
  const markEls = useRef<(SVGTextElement | null)[]>([]);
  const valBorder = useRef<SVGRectElement>(null);
  const humanSub = useRef<SVGTextElement>(null);
  const outSub = useRef<SVGTextElement>(null);
  const bar = useRef<SVGPathElement>(null);
  const planVer = useRef<SVGTextElement>(null);
  const stepTxt = useRef<SVGTextElement>(null);
  const statTxt = useRef<SVGTextElement>(null);
  const statBox = useRef<SVGRectElement>(null);

  useVisualLoop((t, k) => {
    const f = frame(t, k, L);
    for (const id of EDGE_IDS) {
      const el = edgeEls.current[id];
      set(el, "stroke-dashoffset", String(r1(1 - f.edges[id].p)));
      set(el, "stroke-opacity", String(r1(f.edges[id].o * (0.75 + 0.25 * k))));
    }
    f.packets.forEach((p, j) => {
      const g = pkEls.current[j];
      set(g, "opacity", p.on ? "1" : "0");
      if (!p.on || !g) return;
      set(g, "transform", `translate(${r1(p.x)} ${r1(p.y)})`);
      const [halo, core] = g.children;
      set(halo, "r", String(r1(f.halo)));
      set(halo, "fill", PACKET_FILL[p.kind]);
      set(core, "fill", PACKET_FILL[p.kind]);
    });
    for (const n of NODE_IDS) {
      const el = glowEls.current[n];
      set(el, "fill-opacity", String(r1(0.06 + f.glow[n] * 0.62)));
      if (n === "val") set(el, "fill", f.failing ? C.burgundy : C.indigo);
    }
    set(valBorder.current, "stroke", f.failing ? C.accent : C.ice);
    f.tools.forEach((s, i) => {
      set(ledEls.current[i], "fill", toolLed(s));
      set(ledEls.current[i], "fill-opacity", s === 1 || s === 0.5 ? String(r1(0.55 + 0.45 * Math.sin(t * 9))) : "1");
      text(msEls.current[i], s === 2 ? TOOLS[i].ms : s > 0 ? "···" : TOOLS[i].ms ? "" : "—");
    });
    markEls.current.forEach((el, i) => {
      text(el, f.marks[i]);
      set(el, "fill", f.marks[i] === "✕" ? C.accent : f.marks[i] === "✓" ? C.iceHi : C.iceLo);
    });
    text(humanSub.current, f.human);
    set(outSub.current, "fill-opacity", f.published ? "0.9" : "0.45");
    text(outSub.current, f.published ? `${L.reportFile} ✓` : L.reportFile);
    set(bar.current, "d", f.bar);
    text(planVer.current, f.planVer);
    text(stepTxt.current, f.stepLabel);
    text(statTxt.current, f.status);
    set(statTxt.current, "fill", f.fail ? C.accent : C.iceHi);
    set(statBox.current, "stroke", f.fail ? C.accent : C.indigoHi);
    set(statBox.current, "fill", f.fail ? C.burgundy : C.indigo);
    f.lines.forEach((l, i) => {
      text(tsEls.current[i], l.ts);
      text(lnEls.current[i], l.txt);
      set(lnEls.current[i], "fill", lineFill(l));
      set(lnEls.current[i], "fill-opacity", lineOp(l));
    });
    f.metrics.forEach((m, i) => text(mEls.current[i], m));
  }, props);

  const hot = props.hot;
  const label = { fontFamily: MONO, fontSize: 9, fill: C.iceHi } as const;
  const faint = { fontFamily: MONO, fontSize: 8.5, fill: C.ice, fillOpacity: 0.5 } as const;
  const nodeRect = (b: Box, id: NodeId, stroke: string = C.ice) => (
    <>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={C.bg} />
      <rect
        ref={(el) => {
          glowEls.current[id] = el;
        }}
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        fill={id === "val" && init.failing ? C.burgundy : C.indigo}
        fillOpacity={r1(0.06 + init.glow[id] * 0.62)}
      />
      <rect
        ref={id === "val" ? valBorder : undefined}
        x={b.x + 0.5}
        y={b.y + 0.5}
        width={b.w - 1}
        height={b.h - 1}
        stroke={stroke}
        strokeOpacity={0.55}
      />
    </>
  );

  return (
    <svg {...SVG_PROPS}>
      <defs>
        <marker id="ag-arrow" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0.6L5.5 3L0 5.4" stroke={C.ice} strokeOpacity={0.6} fill="none" />
        </marker>
      </defs>

      {/* header: task + step counter + status chip */}
      <text x={12} y={18} {...faint}>
        {L.task}
      </text>
      <text x={56} y={18} {...label}>
        {L.taskName}
      </text>
      <rect x={240.5} y={7.5} width={66} height={15} stroke={C.ice} strokeOpacity={0.35} fill={C.bg} />
      <text ref={stepTxt} x={273.5} y={18} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={C.ice}>
        {init.stepLabel}
      </text>
      <rect ref={statBox} x={311.5} y={7.5} width={78} height={15} stroke={init.fail ? C.accent : C.indigoHi} strokeOpacity={0.8} fill={init.fail ? C.burgundy : C.indigo} fillOpacity={0.35} />
      <text ref={statTxt} x={350.5} y={18} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={init.fail ? C.accent : C.iceHi}>
        {init.status}
      </text>

      {/* column captions */}
      <g {...faint} fillOpacity={0.42} textAnchor="middle">
        <text x={44} y={36}>{L.columns[0]}</text>
        <text x={153} y={36}>{L.columns[1]}</text>
        <text x={258} y={36}>{L.columns[2]}</text>
      </g>

      {/* base edges */}
      <g stroke={C.ice} strokeOpacity={hot ? 0.34 : 0.2} className="transition-[stroke-opacity] duration-500">
        {EDGE_IDS.filter((id) => id !== "val-plan").map((id) => (
          <path key={id} d={toD(EDGES[id])} markerEnd="url(#ag-arrow)" />
        ))}
        <path d={toD(EDGES["val-plan"])} strokeDasharray="3 3" markerEnd="url(#ag-arrow)" />
      </g>
      <text x={150} y={171} {...faint} fillOpacity={0.5} textAnchor="middle">
        {L.retryNote}
      </text>

      {/* live edges (draw-on with pathLength 1) */}
      <g strokeWidth={1.3} fill="none">
        {EDGE_IDS.map((id) => (
          <path
            key={id}
            ref={(el) => {
              edgeEls.current[id] = el;
            }}
            d={toD(EDGES[id])}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={r1(1 - init.edges[id].p)}
            stroke={id === "val-plan" ? C.accent : C.iceHi}
            strokeOpacity={r1(init.edges[id].o * 0.75)}
          />
        ))}
      </g>

      {/* planner */}
      {nodeRect(PLAN, "plan")}
      <text x={44} y={80} textAnchor="middle" {...label} fontSize={9.5}>
        {L.planner}
      </text>
      <text x={44} y={93} textAnchor="middle" {...faint}>
        LLM · ReAct
      </text>
      <rect x={17.5} y={103.5} width={53} height={5} stroke={C.ice} strokeOpacity={0.25} />
      <path ref={bar} d={init.bar} fill={C.ice} fillOpacity={0.8} />
      <text ref={planVer} x={44} y={121} textAnchor="middle" {...faint}>
        {init.planVer}
      </text>

      {/* tools */}
      {TOOLS.map((tl, i) => {
        const y = tcy(i) - TH / 2;
        const s = init.tools[i];
        return (
          <g key={tl.id}>
            {nodeRect({ x: TX, y, w: TW, h: TH }, tl.id)}
            <rect
              ref={(el) => {
                ledEls.current[i] = el;
              }}
              x={TX + 6}
              y={tcy(i) - 2.5}
              width={5}
              height={5}
              stroke={C.ice}
              strokeOpacity={0.6}
              fill={toolLed(s)}
            />
            <text x={TX + 16} y={tcy(i) + 3.2} {...label} fill={tl.ms ? C.iceHi : C.ice} fillOpacity={tl.ms ? 1 : 0.6}>
              {tl.id === "doc" ? L.toolDoc : tl.id === "mail" ? L.toolMail : tl.label}
            </text>
            <text
              ref={(el) => {
                msEls.current[i] = el;
              }}
              x={TX + TW - 5}
              y={tcy(i) + 3}
              textAnchor="end"
              {...faint}
              fillOpacity={0.7}
            >
              {s === 2 ? tl.ms : s > 0 ? "···" : tl.ms ? "" : "—"}
            </text>
          </g>
        );
      })}

      {/* validation / guardrail */}
      {nodeRect(VAL, "val", init.failing ? C.accent : C.ice)}
      <text x={258} y={87} textAnchor="middle" {...label}>
        {L.validation}
      </text>
      {L.checks.map((name, i) => (
        <g key={i}>
          <text x={231} y={100 + i * 11} {...faint} fillOpacity={0.65}>
            {name}
          </text>
          <text
            ref={(el) => {
              markEls.current[i] = el;
            }}
            x={285}
            y={100 + i * 11}
            textAnchor="end"
            fontFamily={MONO}
            fontSize={9}
            fill={init.marks[i] === "✕" ? C.accent : init.marks[i] === "✓" ? C.iceHi : C.iceLo}
          >
            {init.marks[i]}
          </text>
        </g>
      ))}

      {/* human gate + output */}
      {nodeRect(HUMAN, "human", C.indigoHi)}
      <text x={352} y={61} textAnchor="middle" {...label}>
        {L.human}
      </text>
      <text ref={humanSub} x={352} y={72.5} textAnchor="middle" {...faint} fillOpacity={0.7}>
        {init.human}
      </text>
      {nodeRect(OUT, "out")}
      <text x={352} y={125} textAnchor="middle" {...label}>
        {L.output}
      </text>
      <text ref={outSub} x={352} y={136.5} textAnchor="middle" {...faint} fillOpacity={init.published ? 0.9 : 0.45}>
        {init.published ? `${L.reportFile} ✓` : L.reportFile}
      </text>
      <text x={352} y={158} textAnchor="middle" {...faint} fillOpacity={0.4}>
        {L.audit}
      </text>

      {/* packets */}
      {[0, 1].map((j) => {
        const p = init.packets[j];
        return (
          <g
            key={j}
            ref={(el) => {
              pkEls.current[j] = el;
            }}
            transform={`translate(${r1(p.x)} ${r1(p.y)})`}
            opacity={p.on ? 1 : 0}
          >
            <circle r={init.halo} fill={PACKET_FILL[p.kind]} fillOpacity={0.18} />
            <circle r={2.4} fill={PACKET_FILL[p.kind]} />
          </g>
        );
      })}

      {/* execution trace + run metrics */}
      <rect x={10.5} y={180.5} width={379} height={52} fill={C.bg} fillOpacity={0.85} stroke={C.ice} strokeOpacity={0.22} />
      <path d="M296.5 186V227" stroke={C.ice} strokeOpacity={0.18} />
      {init.lines.map((l, i) => (
        <g key={i}>
          <text
            ref={(el) => {
              tsEls.current[i] = el;
            }}
            x={17}
            y={195 + i * 13}
            fontFamily={MONO}
            fontSize={8.5}
            fill={C.iceLo}
          >
            {l.ts}
          </text>
          <text
            ref={(el) => {
              lnEls.current[i] = el;
            }}
            x={56}
            y={195 + i * 13}
            fontFamily={MONO}
            fontSize={9}
            fill={lineFill(l)}
            fillOpacity={lineOp(l)}
          >
            {l.txt}
          </text>
        </g>
      ))}
      {L.metrics.map((m, i) => (
        <g key={i}>
          <text x={304} y={192 + i * 10.5} {...faint} fillOpacity={0.45}>
            {m}
          </text>
          <text
            ref={(el) => {
              mEls.current[i] = el;
            }}
            x={383}
            y={192 + i * 10.5}
            textAnchor="end"
            fontFamily={MONO}
            fontSize={8.5}
            fill={C.iceHi}
            fillOpacity={0.85}
          >
            {init.metrics[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
