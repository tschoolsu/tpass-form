"use client";
// 手刻圖表原語（零依賴）。一律 Neobrutalism：border-2 border-foreground + 實色填充，
// 顏色只用 globals.css 的五個 tone token（OKLCH），禁 soft shadow / hex。
import type { Slice } from "@/lib/response-stats";
import { cn } from "@/components/ui/primitives";

const TONES = [
  "var(--color-tone-green-badge)",
  "var(--color-tone-blue-badge)",
  "var(--color-tone-orange-badge)",
  "var(--color-tone-violet-badge)",
  "var(--color-tone-rose-badge)",
];
export const toneAt = (i: number) => TONES[i % TONES.length];

const fmtPct = (pct: number) => `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`;

// ── 環圈圖（單選 / 下拉）────────────────────────────────────────────
// pathLength=100 讓 dasharray 直接吃百分比，不用算周長。
export function DonutChart({ slices, size = 168 }: { slices: Slice[]; size?: number }) {
  const R = 15.915; // 半徑；配 pathLength=100
  const W = 9; // 圈厚
  // i 是「過濾前」的原始 index，顏色綁選項本身，才會跟 DonutLegend 對得上；
  // start 只累計畫得出來的切片（切片數很少，不必為了 O(n) 去改成可變累加）。
  const arcs = slices
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.count > 0)
    .map((a, k, drawn) => ({
      ...a,
      start: drawn.slice(0, k).reduce((acc, x) => acc + x.s.pct, 0),
    }));

  const boundary = (pct: number) => {
    const a = ((pct / 100) * 360 - 90) * (Math.PI / 180);
    return {
      x1: 21 + (R - W / 2) * Math.cos(a),
      y1: 21 + (R - W / 2) * Math.sin(a),
      x2: 21 + (R + W / 2) * Math.cos(a),
      y2: 21 + (R + W / 2) * Math.sin(a),
    };
  };

  return (
    <svg viewBox="0 0 42 42" width={size} height={size} className="shrink-0" role="img">
      <g transform="rotate(-90 21 21)">
        {arcs.map(({ s, i, start }) => (
          <circle
            key={s.id}
            cx="21"
            cy="21"
            r={R}
            fill="none"
            stroke={toneAt(i)}
            strokeWidth={W}
            pathLength={100}
            strokeDasharray={`${s.pct} ${100 - s.pct}`}
            strokeDashoffset={-start}
          />
        ))}
      </g>
      {/* 內外描邊 + 分隔線＝硬邊風格 */}
      <circle cx="21" cy="21" r={R + W / 2} fill="none" stroke="var(--color-foreground)" strokeWidth="0.7" />
      <circle cx="21" cy="21" r={R - W / 2} fill="none" stroke="var(--color-foreground)" strokeWidth="0.7" />
      {arcs.length > 1 &&
        arcs.map(({ s, start }) => {
          const b = boundary(start);
          return (
            <line
              key={`b-${s.id}`}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="var(--color-foreground)"
              strokeWidth="0.7"
            />
          );
        })}
    </svg>
  );
}

export function DonutLegend({ slices }: { slices: Slice[] }) {
  return (
    <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
      {slices.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 text-sm">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-[3px] border-2 border-foreground"
            style={{ backgroundColor: toneAt(i) }}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{s.label || "（未命名選項）"}</span>
          <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">
            {s.count}（{fmtPct(s.pct)}）
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── 水平長條（複選 / 日期）──────────────────────────────────────────
export function BarList({ slices, tone = 1 }: { slices: Slice[]; tone?: number }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {slices.map((s) => (
        <li key={s.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{s.label || "（未命名選項）"}</span>
            <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">
              {s.count}（{fmtPct(s.pct)}）
            </span>
          </div>
          <div className="mt-1 h-5 w-full overflow-hidden rounded-md border-2 border-foreground bg-muted">
            <div
              className={cn("h-full", s.pct > 0 && s.pct < 100 && "border-r-2 border-foreground")}
              style={{ width: `${s.pct}%`, backgroundColor: toneAt(tone) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── 直方圖（線性量表）───────────────────────────────────────────────
export function ScaleHistogram({ slices }: { slices: Slice[] }) {
  const peak = Math.max(1, ...slices.map((s) => s.count));
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {slices.map((s, i) => (
        <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-mono text-xs font-bold text-muted-foreground">{s.count}</span>
          <div
            className="w-full rounded-t-md border-2 border-b-0 border-foreground"
            style={{
              height: `${Math.max(2, (s.count / peak) * 100)}%`,
              backgroundColor: toneAt(i),
            }}
          />
          <span className="border-t-2 border-foreground pt-1 w-full text-center font-mono text-xs font-bold">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 矩陣（方格題）───────────────────────────────────────────────────
export function GridMatrix({
  rows,
  cols,
  cells,
  rowTotals,
  peak,
}: {
  rows: { id: string; label: string }[];
  cols: { id: string; label: string }[];
  cells: number[][];
  rowTotals: number[];
  peak: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-2 border-foreground bg-muted px-3 py-2 text-left font-bold" />
            {cols.map((c) => (
              <th key={c.id} className="border-2 border-foreground bg-muted px-3 py-2 font-bold">
                {c.label}
              </th>
            ))}
            <th className="border-2 border-foreground bg-muted px-3 py-2 font-mono text-xs font-bold">
              小計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.id}>
              <th className="border-2 border-foreground bg-card px-3 py-2 text-left font-bold">
                {r.label}
              </th>
              {cols.map((c, ci) => {
                const n = cells[ri]?.[ci] ?? 0;
                const ratio = peak === 0 ? 0 : (n / peak) * 100;
                return (
                  <td
                    key={c.id}
                    className="border-2 border-foreground px-3 py-2 text-center font-mono font-bold"
                    style={{
                      backgroundColor: `color-mix(in oklch, var(--color-tone-violet-badge) ${ratio}%, var(--color-card))`,
                    }}
                  >
                    {n === 0 ? <span className="text-foreground/30">0</span> : n}
                  </td>
                );
              })}
              <td className="border-2 border-foreground bg-muted px-3 py-2 text-center font-mono text-xs font-bold">
                {rowTotals[ri] ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
