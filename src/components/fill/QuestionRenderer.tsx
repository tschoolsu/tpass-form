"use client";

// ★ 共用題目渲染器 ★ 建構器預覽（onChange 省略 → 唯讀）與真實填寫共用同一份，所見即所得。
import * as React from "react";
import { Upload, X } from "lucide-react";
import type { QuestionBlock } from "@/lib/survey-schema";
import { Input, Textarea, Select, cn } from "tpass-ui";
import { DescriptionImages } from "@/components/common/DescriptionImages";
import { RichText } from "@/components/common/RichText";

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
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const maxFiles = q.file?.maxFiles ?? 1;
  const accept = q.file?.accept?.join(",") || undefined;
  const canUpload = !readOnly && !!formId;

  async function handleFiles(list: FileList | null) {
    if (!list || !formId) return;
    setErr(null);
    const incoming = Array.from(list);
    if (files.length + incoming.length > maxFiles) {
      setErr(`最多上傳 ${maxFiles} 個檔案`);
      return;
    }
    setBusy(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of incoming) {
        if (q.file && file.size > q.file.maxSizeMB * 1024 * 1024) {
          setErr(`「${file.name}」超過 ${q.file.maxSizeMB}MB`);
          continue;
        }
        const fd = new FormData();
        fd.set("file", file);
        fd.set("formId", formId);
        fd.set("questionId", q.id);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          setErr("上傳失敗，請再試一次");
          continue;
        }
        const data = (await res.json()) as { id: string; filename: string };
        uploaded.push({ id: data.id, name: data.filename });
      }
      if (uploaded.length) emit([...files, ...uploaded]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-2 w-fit rounded-xl border-2 border-dashed border-foreground/50 bg-muted px-4 py-3 font-bold text-sm",
          canUpload ? "cursor-pointer hover:border-foreground" : "opacity-60 cursor-not-allowed",
        )}
      >
        <Upload className="h-4 w-4" />
        {busy ? "上傳中…" : "選擇檔案"}
        <input
          type="file"
          hidden
          multiple={maxFiles > 1}
          accept={accept}
          disabled={!canUpload || busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        最多 {maxFiles} 個，單檔 ≤ {q.file?.maxSizeMB ?? 10}MB
        {accept ? `，限 ${accept}` : ""}
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
      {err && <p className="mt-2 font-mono text-xs font-bold text-destructive">{err}</p>}
    </div>
  );
}
