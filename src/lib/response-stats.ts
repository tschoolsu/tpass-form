// 回覆彙整（isomorphic：結果頁三個分頁共用同一份資料，在 client 端算，不打 API）。
// 這裡只做「數數字」，呈現方式（圖表/清單）交給 components/responses。
import type { QuestionBlock } from "@/lib/survey-schema";
import type { UploadedFile } from "@/components/fill/QuestionRenderer";
import { isBlank } from "@/lib/answers";

// 一筆回覆（server 從 prisma 撈出後直接交給 client 的形狀）。
export interface ResponseRecord {
  id: string;
  submittedAt: Date;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentGrade: number | null;
  answers: Record<string, unknown>;
}

export interface Slice {
  id: string;
  label: string;
  count: number;
  pct: number; // 佔「有作答人數」的百分比
}

interface Base {
  answered: number;
  blank: number;
}

export type QuestionStats = Base &
  (
    | { kind: "choice"; multi: boolean; slices: Slice[] }
    | { kind: "scale"; min: number; max: number; slices: Slice[]; average: number | null }
    | { kind: "date"; slices: Slice[] }
    | {
        kind: "grid";
        rows: { id: string; label: string }[];
        cols: { id: string; label: string }[];
        cells: number[][]; // [rowIdx][colIdx]
        rowTotals: number[];
        peak: number; // 全表最大格值（畫濃淡用）
      }
    | { kind: "text"; entries: TextEntry[] }
    | { kind: "files"; entries: FileEntry[] }
  );

export interface TextEntry {
  responseId: string;
  text: string;
  name: string | null;
  email: string | null;
}

export interface FileEntry {
  responseId: string;
  files: UploadedFile[];
  name: string | null;
  email: string | null;
}

const pctOf = (count: number, total: number) => (total === 0 ? 0 : (count / total) * 100);

function toSlices(counts: Map<string, number>, labels: Map<string, string>, answered: number): Slice[] {
  return [...counts].map(([id, count]) => ({
    id,
    label: labels.get(id) ?? id,
    count,
    pct: pctOf(count, answered),
  }));
}

export function computeStats(q: QuestionBlock, responses: ResponseRecord[]): QuestionStats {
  const filled = responses.filter((r) => !isBlank(r.answers[q.id]));
  const answered = filled.length;
  const blank = responses.length - answered;
  const base = { answered, blank };

  switch (q.type) {
    case "single_choice":
    case "dropdown":
    case "multi_choice": {
      const multi = q.type === "multi_choice";
      const labels = new Map((q.options ?? []).map((o) => [o.id, o.label]));
      // 先鋪滿所有選項（0 票的也要出現），再數。
      const counts = new Map<string, number>((q.options ?? []).map((o) => [o.id, 0]));
      for (const r of filled) {
        const v = r.answers[q.id];
        const picked = multi ? (Array.isArray(v) ? v : []) : [v];
        for (const p of picked) {
          if (typeof p !== "string" || !counts.has(p)) continue;
          counts.set(p, (counts.get(p) ?? 0) + 1);
        }
      }
      return { ...base, kind: "choice", multi, slices: toSlices(counts, labels, answered) };
    }

    case "linear_scale": {
      const min = q.scale?.min ?? 1;
      const max = q.scale?.max ?? 5;
      const counts = new Map<string, number>();
      const labels = new Map<string, string>();
      for (let v = min; v <= max; v++) {
        counts.set(String(v), 0);
        labels.set(String(v), String(v));
      }
      let sum = 0;
      let n = 0;
      for (const r of filled) {
        const num = Number(r.answers[q.id]);
        if (Number.isNaN(num)) continue;
        sum += num;
        n++;
        const key = String(num);
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return {
        ...base,
        kind: "scale",
        min,
        max,
        slices: toSlices(counts, labels, answered),
        average: n === 0 ? null : sum / n,
      };
    }

    case "date": {
      const counts = new Map<string, number>();
      for (const r of filled) {
        const v = r.answers[q.id];
        if (typeof v !== "string") continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const slices = [...counts]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, count]) => ({ id, label: id, count, pct: pctOf(count, answered) }));
      return { ...base, kind: "date", slices };
    }

    case "grid_single":
    case "grid_multi": {
      const rows = q.grid?.rows ?? [];
      const cols = q.grid?.cols ?? [];
      const colIdx = new Map(cols.map((c, i) => [c.id, i]));
      const cells = rows.map(() => cols.map(() => 0));
      for (const r of filled) {
        const map = (r.answers[q.id] ?? {}) as Record<string, unknown>;
        rows.forEach((row, ri) => {
          const picked = map[row.id];
          const list =
            q.type === "grid_multi"
              ? Array.isArray(picked)
                ? picked
                : []
              : typeof picked === "string"
                ? [picked]
                : [];
          for (const c of list) {
            const ci = colIdx.get(c as string);
            if (ci !== undefined) cells[ri][ci] += 1;
          }
        });
      }
      const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
      const peak = Math.max(0, ...cells.flat());
      return { ...base, kind: "grid", rows, cols, cells, rowTotals, peak };
    }

    case "file_upload": {
      const entries: FileEntry[] = filled.map((r) => ({
        responseId: r.id,
        files: (r.answers[q.id] as UploadedFile[]) ?? [],
        name: r.respondentName,
        email: r.respondentEmail,
      }));
      return { ...base, kind: "files", entries };
    }

    default: {
      // short_text / paragraph
      const entries: TextEntry[] = filled.map((r) => ({
        responseId: r.id,
        text: String(r.answers[q.id] ?? ""),
        name: r.respondentName,
        email: r.respondentEmail,
      }));
      return { ...base, kind: "text", entries };
    }
  }
}
