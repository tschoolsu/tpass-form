"use client";
// 一筆回覆的完整內容（單筆分頁用）。身分欄只有問卷有記錄時才會有值。
import { gradeLabel } from "@/lib/grade";
import type { QuestionBlock } from "@/lib/survey-schema";
import type { ResponseRecord } from "@/lib/response-stats";
import { Badge } from "tpass-ui";
import { AnswerView } from "@/components/responses/AnswerView";

export function SingleResponse({
  response,
  questions,
}: {
  response: ResponseRecord;
  questions: QuestionBlock[];
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b-2 border-dashed border-foreground/15 pb-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          {response.submittedAt.toLocaleString("zh-TW")}
          {response.editedAt && ` · 更新於 ${response.editedAt.toLocaleString("zh-TW")}`}
        </span>
        {response.respondentName && (
          <Badge className="bg-tone-blue-badge">{response.respondentName}</Badge>
        )}
        {response.respondentEmail && (
          <Badge className="bg-tone-blue-badge">{response.respondentEmail}</Badge>
        )}
        {response.respondentGrade !== null && (
          <Badge className="bg-tone-violet-badge">{gradeLabel(response.respondentGrade)}</Badge>
        )}
      </div>
      <dl className="flex flex-col gap-2.5">
        {questions.map((q) => (
          <div key={q.id}>
            <dt className="font-bold text-sm">{q.title || "（未命名題目）"}</dt>
            <dd className="mt-0.5 font-medium text-muted-foreground">
              <AnswerView q={q} value={response.answers[q.id]} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
