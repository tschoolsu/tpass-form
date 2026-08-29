"use client";
// 單題彙整卡：依題型分派到對應圖表或清單。摘要分頁與依題目分頁共用同一個元件。
import * as React from "react";
import { QUESTION_TYPE_LABELS, type QuestionBlock } from "@/lib/survey-schema";
import type { QuestionStats } from "@/lib/response-stats";
import { Badge, Button, cn } from "tpass-ui";
import { FileLinks } from "@/components/responses/AnswerView";
import { BarList, DonutChart, DonutLegend, GridMatrix, ScaleHistogram } from "@/components/responses/charts";

const PREVIEW = 20; // 文字題預設只列前 N 筆

function Who({ name, email }: { name: string | null; email: string | null }) {
  if (!name && !email) return null;
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      {name && <Badge className="bg-tone-blue-badge">{name}</Badge>}
      {email && <Badge className="bg-tone-blue-badge">{email}</Badge>}
    </span>
  );
}

function Body({
  stats,
  large,
  onJump,
}: {
  stats: QuestionStats;
  large: boolean;
  onJump?: (responseId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  if (stats.answered === 0) {
    return <p className="font-medium text-muted-foreground">還沒有人作答這題。</p>;
  }

  switch (stats.kind) {
    case "choice":
      return stats.multi ? (
        <BarList slices={stats.slices} tone={1} />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <DonutChart slices={stats.slices} size={large ? 220 : 168} />
          <DonutLegend slices={stats.slices} />
        </div>
      );

    case "scale":
      return (
        <div>
          <ScaleHistogram slices={stats.slices} />
          {stats.average !== null && (
            <p className="mt-3 text-sm font-bold">
              平均：<span className="font-mono">{stats.average.toFixed(2)}</span>
            </p>
          )}
        </div>
      );

    case "date":
      return <BarList slices={stats.slices} tone={2} />;

    case "grid":
      return (
        <GridMatrix
          rows={stats.rows}
          cols={stats.cols}
          cells={stats.cells}
          rowTotals={stats.rowTotals}
          peak={stats.peak}
        />
      );

    case "files":
      return (
        <ul className="flex flex-col gap-2">
          {stats.entries.map((e) => (
            <li
              key={e.responseId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground bg-tone-green-bg px-3 py-2"
            >
              <FileLinks files={e.files} />
              <Who name={e.name} email={e.email} />
            </li>
          ))}
        </ul>
      );

    default: {
      const shown = expanded ? stats.entries : stats.entries.slice(0, PREVIEW);
      return (
        <div>
          <ul className="flex flex-col gap-2">
            {shown.map((e) => (
              <li key={e.responseId}>
                <button
                  type="button"
                  onClick={() => onJump?.(e.responseId)}
                  disabled={!onJump}
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground bg-tone-green-bg px-3 py-2 text-left",
                    onJump && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)]",
                  )}
                >
                  <span className="min-w-0 whitespace-pre-wrap font-medium">{e.text}</span>
                  <Who name={e.name} email={e.email} />
                </button>
              </li>
            ))}
          </ul>
          {stats.entries.length > PREVIEW && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "收合" : `顯示全部 ${stats.entries.length} 筆`}
            </Button>
          )}
        </div>
      );
    }
  }
}

export function QuestionSummary({
  q,
  stats,
  index,
  large = false,
  onJump,
}: {
  q: QuestionBlock;
  stats: QuestionStats;
  index: number;
  large?: boolean;
  onJump?: (responseId: string) => void;
}) {
  return (
    <section className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]">
      <header className="mb-4 border-b-2 border-dashed border-foreground/15 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Q{index + 1}</Badge>
          <Badge className="bg-tone-orange-badge">{QUESTION_TYPE_LABELS[q.type]}</Badge>
        </div>
        <h3 className={cn("mt-2 font-extrabold", large ? "text-xl" : "text-base")}>
          {q.title || "（未命名題目）"}
        </h3>
        <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">
          {stats.answered} 人作答
          {stats.blank > 0 && ` ・ ${stats.blank} 人未作答`}
        </p>
      </header>
      <Body stats={stats} large={large} onJump={onJump} />
    </section>
  );
}
