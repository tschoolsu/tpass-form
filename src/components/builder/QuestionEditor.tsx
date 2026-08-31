"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  type QuestionBlock,
  type Option,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  newId,
} from "@/lib/survey-schema";
import {
  Input,
  Textarea,
  Select,
  Switch,
  Badge,
  Button,
  Label,
} from "tpass-ui";
import { MAX_FILE_MB } from "@/lib/file-limits";
import { QuestionRenderer } from "@/components/fill/QuestionRenderer";
import { ImageAttachments } from "./ImageAttachments";

interface Props {
  formId: string;
  block: QuestionBlock;
  sections: Array<{ id: string; title: string }>;
  onChange: (next: QuestionBlock) => void;
}

export function QuestionEditor({ formId, block, sections, onChange }: Props) {
  const set = (patch: Partial<QuestionBlock>) => onChange({ ...block, ...patch });
  const hasOptions =
    block.type === "single_choice" ||
    block.type === "multi_choice" ||
    block.type === "dropdown";
  const branchable = block.type === "single_choice" || block.type === "dropdown";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-tone-violet-badge">{QUESTION_TYPE_LABELS[block.type]}</Badge>
        <Select
          className="max-w-[10rem] py-1.5 text-sm"
          value={block.type}
          onChange={(e) => set({ type: e.target.value as QuestionBlock["type"] })}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      <Input
        value={block.title}
        placeholder="題目標題"
        className="font-bold"
        onChange={(e) => set({ title: e.target.value })}
      />
      <Textarea
        value={block.description ?? ""}
        placeholder="補充說明（選填，可換行）"
        className="min-h-16 text-sm"
        onChange={(e) => set({ description: e.target.value })}
      />
      <ImageAttachments
        formId={formId}
        images={block.images}
        onChange={(images) => set({ images })}
      />

      {/* 型別專屬設定 */}
      {hasOptions && (
        <OptionsEditor
          block={block}
          branchable={branchable}
          sections={sections}
          onChange={onChange}
        />
      )}
      {block.type === "linear_scale" && <ScaleEditor block={block} set={set} />}
      {(block.type === "grid_single" || block.type === "grid_multi") && (
        <GridEditor block={block} onChange={onChange} />
      )}
      {block.type === "file_upload" && <FileEditor block={block} set={set} />}

      <div className="flex items-center gap-2 pt-1 border-t-2 border-dashed border-foreground/15">
        <Switch checked={block.required} onChange={(v) => set({ required: v })} label="必填" />
        <span className="text-sm font-medium">必填</span>
      </div>

      {/* 即時預覽 */}
      <div className="rounded-xl border-2 border-dashed border-foreground/25 bg-muted/40 p-3">
        <p className="mb-2 font-mono text-[10px] font-bold text-muted-foreground">預覽</p>
        <QuestionRenderer question={block} value={undefined} />
      </div>
    </div>
  );
}

function OptionsEditor({
  block,
  branchable,
  sections,
  onChange,
}: {
  block: QuestionBlock;
  branchable: boolean;
  sections: Array<{ id: string; title: string }>;
  onChange: (next: QuestionBlock) => void;
}) {
  const options = block.options ?? [];
  const setOptions = (next: Option[]) => onChange({ ...block, options: next });

  return (
    <div className="flex flex-col gap-2">
      <Label>選項</Label>
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <Input
            value={o.label}
            placeholder={`選項 ${i + 1}`}
            className="py-1.5 text-sm"
            onChange={(e) =>
              setOptions(options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))
            }
          />
          {branchable && (
            <Select
              className="max-w-[11rem] py-1.5 text-xs"
              value={o.goTo ?? ""}
              title="選此項後跳到…"
              onChange={(e) => {
                const v = e.target.value;
                setOptions(
                  options.map((x) =>
                    x.id === o.id ? { ...x, goTo: v === "" ? undefined : v } : x,
                  ),
                );
              }}
            >
              <option value="">↳ 跳轉：預設</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  ↳ 跳到：{s.title}
                </option>
              ))}
              <option value="END">↳ 結束問卷</option>
            </Select>
          )}
          <button
            type="button"
            onClick={() => setOptions(options.filter((x) => x.id !== o.id))}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="刪除選項"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="w-fit"
        onClick={() => setOptions([...options, { id: newId("o"), label: "" }])}
      >
        <Plus className="h-4 w-4" /> 新增選項
      </Button>
    </div>
  );
}

function ScaleEditor({
  block,
  set,
}: {
  block: QuestionBlock;
  set: (patch: Partial<QuestionBlock>) => void;
}) {
  const scale = block.scale ?? { min: 1, max: 5 };
  const upd = (patch: Partial<typeof scale>) => set({ scale: { ...scale, ...patch } });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label>最小值</Label>
        <Select
          className="mt-1 w-20 py-1.5"
          value={scale.min}
          onChange={(e) => upd({ min: Number(e.target.value) })}
        >
          {[0, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>最大值</Label>
        <Select
          className="mt-1 w-20 py-1.5"
          value={scale.max}
          onChange={(e) => upd({ max: Number(e.target.value) })}
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <Input
        className="max-w-[9rem] py-1.5 text-sm"
        placeholder="最低標籤（選填）"
        value={scale.minLabel ?? ""}
        onChange={(e) => upd({ minLabel: e.target.value })}
      />
      <Input
        className="max-w-[9rem] py-1.5 text-sm"
        placeholder="最高標籤（選填）"
        value={scale.maxLabel ?? ""}
        onChange={(e) => upd({ maxLabel: e.target.value })}
      />
    </div>
  );
}

function GridEditor({
  block,
  onChange,
}: {
  block: QuestionBlock;
  onChange: (next: QuestionBlock) => void;
}) {
  const grid = block.grid ?? { rows: [], cols: [] };
  const setGrid = (next: typeof grid) => onChange({ ...block, grid: next });

  const list = (which: "rows" | "cols") => (
    <div className="flex flex-col gap-2">
      <Label>{which === "rows" ? "列（題目）" : "欄（選項）"}</Label>
      {grid[which].map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            value={item.label}
            placeholder={`${which === "rows" ? "列" : "欄"} ${i + 1}`}
            className="py-1.5 text-sm"
            onChange={(e) =>
              setGrid({
                ...grid,
                [which]: grid[which].map((x) =>
                  x.id === item.id ? { ...x, label: e.target.value } : x,
                ),
              })
            }
          />
          <button
            type="button"
            onClick={() =>
              setGrid({ ...grid, [which]: grid[which].filter((x) => x.id !== item.id) })
            }
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="刪除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="w-fit"
        onClick={() =>
          setGrid({
            ...grid,
            [which]: [
              ...grid[which],
              { id: newId(which === "rows" ? "r" : "c"), label: "" },
            ],
          })
        }
      >
        <Plus className="h-4 w-4" /> 新增{which === "rows" ? "列" : "欄"}
      </Button>
    </div>
  );

  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{list("rows")}{list("cols")}</div>;
}

function FileEditor({
  block,
  set,
}: {
  block: QuestionBlock;
  set: (patch: Partial<QuestionBlock>) => void;
}) {
  const file = block.file ?? { accept: [], maxSizeMB: 10, maxFiles: 1 };
  const upd = (patch: Partial<typeof file>) => set({ file: { ...file, ...patch } });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label>最多檔案數</Label>
        <Input
          type="number"
          min={1}
          className="mt-1 w-24 py-1.5"
          value={file.maxFiles}
          onChange={(e) => upd({ maxFiles: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>
      <div>
        <Label>單檔上限 (MB，最多 {MAX_FILE_MB})</Label>
        <Input
          type="number"
          min={1}
          max={MAX_FILE_MB}
          className="mt-1 w-24 py-1.5"
          value={file.maxSizeMB}
          onChange={(e) =>
            upd({ maxSizeMB: Math.min(MAX_FILE_MB, Math.max(1, Number(e.target.value) || 1)) })
          }
        />
      </div>
      <div className="grow">
        <Label>允許的副檔名 / 類型（逗號分隔，選填）</Label>
        <Input
          className="mt-1 py-1.5 text-sm"
          placeholder="例如 .pdf,image/*"
          value={file.accept.join(",")}
          onChange={(e) =>
            upd({
              accept: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
    </div>
  );
}
