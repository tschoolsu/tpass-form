"use client";

// ★ 共用題目渲染器 ★ 建構器預覽（onChange 省略 → 唯讀）與真實填寫共用同一份，所見即所得。
import * as React from "react";
import { Upload, X } from "lucide-react";
import type { QuestionBlock } from "@/lib/survey-schema";
import { Input, Textarea, Select, cn } from "tpass-ui";
import { DescriptionImages } from "@/components/common/DescriptionImages";
import { RichText } from "@/components/common/RichText";
import { describeAccept, describeUploadError, fileLimits } from "@/lib/file-limits";

export interface UploadedFile {
  id: string;
  name: string;
}

interface RendererProps {
  question: QuestionBlock;
  value: unknown;
  onChange?: (v: unknown) => void; // 省略 → 唯讀預覽
  error?: string;
  formId?: string; // 檔案上傳目標
}

export function QuestionRenderer({ question: q, value, onChange, error, formId }: RendererProps) {
  const readOnly = !onChange;
  return (
    <div>
      <div className="flex items-start gap-1.5">
        <span className="font-bold text-foreground">
          {q.title ? (
            <RichText text={q.title} />
          ) : (
            <span className="text-muted-foreground">（未命名題目）</span>
          )}
        </span>
        {q.required && <span className="text-destructive font-bold">*</span>}
      </div>
      {q.description && (
        <div className="mt-1 text-sm font-medium text-muted-foreground whitespace-pre-wrap">
          <RichText text={q.description} />
        </div>
      )}
      <DescriptionImages images={q.images} />
      <div className="mt-3">
        <Field q={q} value={value} onChange={onChange} readOnly={readOnly} formId={formId} />
      </div>
      {error && (
        <p className="mt-2 font-mono text-xs font-bold text-destructive">{error}</p>
      )}
    </div>
  );
}

function Field({
  q,
  value,
  onChange,
  readOnly,
  formId,
}: {
  q: QuestionBlock;
  value: unknown;
  onChange?: (v: unknown) => void;
  readOnly: boolean;
  formId?: string;
}) {
  const emit = (v: unknown) => onChange?.(v);

  switch (q.type) {
    case "short_text":
      return (
        <Input
          value={(value as string) ?? ""}
          disabled={readOnly}
          placeholder="你的回答"
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "paragraph":
      return (
        <Textarea
          value={(value as string) ?? ""}
          disabled={readOnly}
          placeholder="你的回答"
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          className="max-w-48"
          value={(value as string) ?? ""}
          disabled={readOnly}
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "dropdown":
      return (
        <Select
          className="max-w-xs"
          value={(value as string) ?? ""}
          disabled={readOnly}
          onChange={(e) => emit(e.target.value)}
        >
          <option value="">請選擇…</option>
          {q.options?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case "single_choice":
      return (
        <div className="flex flex-col gap-2">
          {q.options?.map((o) => (
            <label key={o.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name={q.id}
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={value === o.id}
                disabled={readOnly}
                onChange={() => emit(o.id)}
              />
              <span className="font-medium">{o.label}</span>
            </label>
          ))}
        </div>
      );
    case "multi_choice": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (id: string) =>
        emit(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
      return (
        <div className="flex flex-col gap-2">
          {q.options?.map((o) => (
            <label key={o.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={arr.includes(o.id)}
                disabled={readOnly}
                onChange={() => toggle(o.id)}
              />
              <span className="font-medium">{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case "linear_scale": {
      const min = q.scale?.min ?? 1;
      const max = q.scale?.max ?? 5;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      // 兩端說明固定放在數字列下方一排，不跟數字擠同一排：1–10 加上文字在手機寬度
      // 會在奇怪的地方換行，說明卡在數字中間，看不出誰是左端誰是右端。
      return (
        <div>
          <div className="flex flex-wrap gap-3">
            {nums.map((n) => (
              <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
                <span className="font-mono text-xs font-bold">{n}</span>
                <input
                  type="radio"
                  name={q.id}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                  checked={value === n}
                  disabled={readOnly}
                  onChange={() => emit(n)}
                />
              </label>
            ))}
          </div>
          {(q.scale?.minLabel || q.scale?.maxLabel) && (
            <div className="mt-1.5 flex justify-between gap-4 text-sm font-medium text-muted-foreground">
              <span>{q.scale?.minLabel}</span>
              <span className="text-right">{q.scale?.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }
    case "grid_single":
    case "grid_multi":
      return <GridField q={q} value={value} emit={emit} readOnly={readOnly} />;
    case "file_upload":
      return <FileField q={q} value={value} emit={emit} readOnly={readOnly} formId={formId} />;
    default:
      return null;
  }
}

function GridField({
  q,
  value,
  emit,
  readOnly,
}: {
  q: QuestionBlock;
  value: unknown;
  emit: (v: unknown) => void;
  readOnly: boolean;
}) {
  const multi = q.type === "grid_multi";
  const map = (value as Record<string, string | string[]>) ?? {};
  const rows = q.grid?.rows ?? [];
  const cols = q.grid?.cols ?? [];

  const setCell = (rowId: string, colId: string) => {
    if (!multi) {
      emit({ ...map, [rowId]: colId });
    } else {
      const cur = Array.isArray(map[rowId]) ? (map[rowId] as string[]) : [];
      const next = cur.includes(colId) ? cur.filter((c) => c !== colId) : [...cur, colId];
      emit({ ...map, [rowId]: next });
    }
  };
  const isChecked = (rowId: string, colId: string) =>
    multi
      ? Array.isArray(map[rowId]) && (map[rowId] as string[]).includes(colId)
      : map[rowId] === colId;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c.id} className="whitespace-nowrap px-3 pb-2 text-center text-sm font-bold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t-2 border-dashed border-foreground/20">
              <td className="whitespace-nowrap py-2 pr-4 font-medium">{r.label}</td>
              {cols.map((c) => (
                <td key={c.id} className="px-3 py-2 text-center">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={`${q.id}-${r.id}`}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    checked={isChecked(r.id, c.id)}
                    disabled={readOnly}
                    onChange={() => setCell(r.id, c.id)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileField({
  q,
  value,
  emit,
  readOnly,
  formId,
}: {
  q: QuestionBlock;
  value: unknown;
  emit: (v: unknown) => void;
  readOnly: boolean;
  formId?: string;
}) {
  const files = Array.isArray(value) ? (value as UploadedFile[]) : [];
  // busy = 正在傳第幾個 / 共幾個；null = 閒置。
  const [busy, setBusy] = React.useState<{ done: number; total: number } | null>(null);
  // 上一批的失敗清單，逐檔講原因；成功的直接進 files，不必再列一次。
  const [failures, setFailures] = React.useState<Array<{ name: string; reason: string }>>([]);
  const { maxFiles, maxSizeMB, accept } = fileLimits(q);
  const canUpload = !readOnly && !!formId;
  const remaining = maxFiles - files.length;

  async function handleFiles(list: FileList | null) {
    if (!list || !formId) return;
    const picked = Array.from(list);
    // 超過數量：收下能收的，不把整批打回去——選了 5 張只能放 3 張，不該一張都不留。
    const incoming = picked.slice(0, Math.max(0, remaining));
    const failed: Array<{ name: string; reason: string }> = picked
      .slice(incoming.length)
      .map((f) => ({ name: f.name, reason: `超過 ${maxFiles} 個的上限，沒有收` }));

    setFailures([]);
    setBusy({ done: 0, total: incoming.length });
    try {
      const uploaded: UploadedFile[] = [];
      for (const [i, file] of incoming.entries()) {
        setBusy({ done: i, total: incoming.length });
        if (file.size > maxSizeMB * 1024 * 1024) {
          failed.push({ name: file.name, reason: `超過 ${maxSizeMB}MB` });
          continue;
        }
        const fd = new FormData();
        fd.set("file", file);
        fd.set("formId", formId);
        fd.set("questionId", q.id);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            failed.push({ name: file.name, reason: describeUploadError(res.status) });
            continue;
          }
          const data = (await res.json()) as { id: string; filename: string };
          uploaded.push({ id: data.id, name: data.filename });
        } catch {
          failed.push({ name: file.name, reason: "連線中斷，請確認網路後再試一次" });
        }
      }
      if (uploaded.length) emit([...files, ...uploaded]);
      setFailures(failed);
    } finally {
      setBusy(null);
    }
  }

  const acceptText = describeAccept(accept);

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-2 w-fit rounded-xl border-2 border-dashed border-foreground/50 bg-muted px-4 py-3 font-bold text-sm",
          canUpload && remaining > 0
            ? "cursor-pointer hover:border-foreground"
            : "opacity-60 cursor-not-allowed",
        )}
      >
        <Upload className="h-4 w-4" />
        {busy
          ? busy.total > 1
            ? `上傳中（${busy.done + 1}/${busy.total}）…`
            : "上傳中…"
          : remaining <= 0
            ? "已達上限"
            : maxFiles > 1
              ? "選擇檔案（可多選）"
              : "選擇檔案"}
        <input
          type="file"
          hidden
          multiple={maxFiles > 1}
          accept={accept.join(",") || undefined}
          disabled={!canUpload || !!busy || remaining <= 0}
          onChange={(e) => {
            void handleFiles(e.target.files);
            // 清掉 value，否則移除後再選同一個檔不會觸發 onChange，看起來像點了沒反應。
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        最多 {maxFiles} 個，單檔 ≤ {maxSizeMB}MB
        {acceptText ? `，限 ${acceptText}` : ""}
      </p>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-md border-2 border-foreground bg-card px-2 py-1 text-sm font-medium"
            >
              <span className="truncate">{f.name}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => emit(files.filter((x) => x.id !== f.id))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="移除"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {failures.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 font-mono text-xs font-bold text-destructive">
          {failures.map((f, i) => (
            <li key={i}>
              ✗ {f.name}：{f.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
