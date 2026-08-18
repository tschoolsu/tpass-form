"use client";
// 單一題答案的呈現（單筆檢視、依題目明細共用）。檔案題給下載連結，其餘走 answerToText。
import { answerToText } from "@/lib/answer-format";
import type { QuestionBlock } from "@/lib/survey-schema";
import type { UploadedFile } from "@/components/fill/QuestionRenderer";

export function FileLinks({ files }: { files: UploadedFile[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {files.map((f) => (
        <a
          key={f.id}
          href={`/api/files/${f.id}`}
          className="inline-block rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-xs font-bold text-accent hover:underline"
        >
          {f.name}
        </a>
      ))}
    </span>
  );
}

export function AnswerView({ q, value }: { q: QuestionBlock; value: unknown }) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-foreground/40">—</span>;
  }
  if (q.type === "file_upload" && Array.isArray(value)) {
    return <FileLinks files={value as UploadedFile[]} />;
  }
  return <span className="whitespace-pre-wrap">{answerToText(q, value)}</span>;
}
