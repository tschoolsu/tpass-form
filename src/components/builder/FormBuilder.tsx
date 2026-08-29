"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  CircleHelp,
  SquareSplitVertical,
  Type as TypeIcon,
  Send,
  Lock,
  Trash2,
} from "lucide-react";
import {
  type Block,
  type FormDefinition,
  type FormSettings,
  createQuestion,
  createSection,
  createText,
  newId,
} from "@/lib/survey-schema";
import type { FormStatus } from "@/lib/forms";
import { Button, Input, Textarea, Badge, ConfirmDialog } from "tpass-ui";
import { SortableBlock } from "./SortableBlock";
import { InsertDivider } from "./InsertDivider";
import { SettingsPanel } from "./SettingsPanel";
import { CopyLinkButton } from "@/components/common/CopyLinkButton";
import {
  saveFormAction,
  publishFormAction,
  closeFormAction,
  reopenFormAction,
  deleteFormAction,
} from "@/app/admin/forms/actions";

interface Props {
  id: string;
  publicUrl: string;
  initialTitle: string;
  initialDescription: string | null;
  initialStatus: FormStatus;
  initialVersion: number;
  initialDefinition: FormDefinition;
  initialSettings: FormSettings;
  // 可勾選的通知目標（/admin/webhooks 登記的啟用中項目）。刻意不帶 url——它內含 secret。
  webhooks: Array<{ id: string; name: string }>;
}

type SaveState = "saved" | "saving" | "unsaved" | "error" | "conflict";

export function FormBuilder(props: Props) {
  const [title, setTitle] = React.useState(props.initialTitle);
  const [description, setDescription] = React.useState(props.initialDescription ?? "");
  const [def, setDef] = React.useState<FormDefinition>(props.initialDefinition);
  const [settings, setSettings] = React.useState<FormSettings>(props.initialSettings);
  const [status, setStatus] = React.useState<FormStatus>(props.initialStatus);
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [conflicted, setConflicted] = React.useState(false);
  const [publishErrors, setPublishErrors] = React.useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // 段落清單（供跳轉下拉用）。
  const sections = React.useMemo(
    () =>
      def.blocks
        .filter((b) => b.kind === "section")
        .map((b) => ({ id: b.id, title: (b.title as string) || "未命名區段" })),
    [def.blocks],
  );

  // ── 自動存草稿（debounce + 樂觀鎖）─────────────────────────────────
  const stateRef = React.useRef({ title, description, def, settings });
  React.useEffect(() => {
    stateRef.current = { title, description, def, settings };
  });
  const firstRender = React.useRef(true);
  // 樂觀鎖版本；衝突後凍結，避免拿舊 version 無限重試蓋掉別人。
  const versionRef = React.useRef(props.initialVersion);
  const conflictedRef = React.useRef(false);

  const flushSave = React.useCallback(async (): Promise<boolean> => {
    if (conflictedRef.current) return false;
    const s = stateRef.current;
    setSaveState("saving");
    const res = await saveFormAction(
      props.id,
      { title: s.title, description: s.description, definition: s.def, settings: s.settings },
      versionRef.current,
    );
    if (res.ok && res.version !== undefined) {
      versionRef.current = res.version;
      setSaveState("saved");
      return true;
    }
    if (res.conflict) {
      conflictedRef.current = true;
      setConflicted(true);
      setSaveState("conflict");
    } else {
      setSaveState("error");
    }
    return false;
  }, [props.id]);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (conflictedRef.current) return;
    setSaveState("unsaved");
    const t = setTimeout(() => {
      void flushSave();
    }, 800);
    return () => clearTimeout(t);
  }, [title, description, def, settings, flushSave]);

  // ── block 操作 ─────────────────────────────────────────────────────
  const updateBlock = (next: Block) =>
    setDef((d) => ({ blocks: d.blocks.map((b) => (b.id === next.id ? next : b)) }));

  const deleteBlock = (id: string) =>
    setDef((d) => ({ blocks: d.blocks.filter((b) => b.id !== id) }));

  const duplicateBlock = (id: string) =>
    setDef((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      if (i < 0) return d;
      const src = d.blocks[i];
      const copy = { ...src, id: newId(src.kind[0]) } as Block;
      const blocks = [...d.blocks];
      blocks.splice(i + 1, 0, copy);
      return { blocks };
    });

  const addBlock = (b: Block) => setDef((d) => ({ blocks: [...d.blocks, b] }));

  // 插到第 index 個 block 之前。index === blocks.length 就等於接在最後面。
  const insertBlock = (index: number, b: Block) =>
    setDef((d) => {
      const blocks = [...d.blocks];
      blocks.splice(index, 0, b);
      return { blocks };
    });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDef((d) => {
      const from = d.blocks.findIndex((b) => b.id === active.id);
      const to = d.blocks.findIndex((b) => b.id === over.id);
      if (from < 0 || to < 0) return d;
      return { blocks: arrayMove(d.blocks, from, to) };
    });
  };

  // ── 發布 / 關閉 / 刪除 ─────────────────────────────────────────────
  const onPublish = () =>
    startTransition(async () => {
      const saved = await flushSave();
      if (!saved) return; // 衝突或存檔失敗 → 不發布
      const res = await publishFormAction(props.id);
      if (res.ok) {
        setPublishErrors([]);
        setStatus("published");
      } else {
        setPublishErrors(res.errors ?? ["發布失敗"]);
      }
    });

  const onClose = () =>
    startTransition(async () => {
      await closeFormAction(props.id);
      setStatus("closed");
    });

  const onReopen = () =>
    startTransition(async () => {
      await reopenFormAction(props.id);
      setStatus("published");
    });

  const onDelete = () =>
    startTransition(async () => {
      await deleteFormAction(props.id);
    });

  return (
    <div>
      {/* 工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </Link>
        <div className="flex items-center gap-3">
          <SaveBadge state={saveState} />
          <StatusBadge status={status} />
        </div>
      </div>

      {conflicted && (
        <div className="mb-6 rounded-2xl border-2 border-destructive bg-destructive/10 p-4 shadow-[4px_4px_0_0_var(--color-destructive)]">
          <p className="font-extrabold text-foreground">⚠ 編輯衝突</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            有人同時修改了這份問卷，你剛才的變更<strong>尚未儲存</strong>。
            請先複製你需要保留的內容，再重新載入頁面取得最新版本後繼續編輯。
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-4 py-2 font-bold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
          >
            重新載入
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 主畫布 */}
        <div className="flex-1 min-w-0">
          {/* 表單抬頭 */}
          <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)] mb-4">
            <Input
              value={title}
              placeholder="問卷標題"
              className="text-xl font-extrabold border-0 shadow-none px-0 focus:shadow-none"
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              value={description}
              placeholder="問卷說明（選填）"
              className="mt-2 border-0 shadow-none px-0 focus:shadow-none min-h-12"
              onChange={(e) => setDescription(e.target.value)}
            />
            {/* 這個功能不寫出來沒人會知道。放一次就好，不必每個欄位都掛。 */}
            <p className="mt-2 font-mono text-[11px] font-bold text-muted-foreground">
              標題與說明可以換行，也支援 Markdown：**粗體** *斜體* ~~刪除線~~ `程式碼`
              [連結文字](https://網址)。不支援 # 標題。
            </p>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={def.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* gap 交給 InsertDivider 撐（h-4 = 原本的 gap-4），縫隙才點得到。 */}
              <div className="flex flex-col">
                {def.blocks.map((block, i) => (
                  <React.Fragment key={block.id}>
                    <InsertDivider onInsert={(b) => insertBlock(i, b)} />
                    <SortableBlock
                      formId={props.id}
                      block={block}
                      sections={sections}
                      onChange={updateBlock}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  </React.Fragment>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* 新增 block */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => addBlock(createQuestion("short_text"))}>
              <CircleHelp className="h-4 w-4" /> 新增題目
            </Button>
            <Button type="button" variant="default" onClick={() => addBlock(createSection())}>
              <SquareSplitVertical className="h-4 w-4" /> 新增區段
            </Button>
            <Button type="button" variant="default" onClick={() => addBlock(createText())}>
              <TypeIcon className="h-4 w-4" /> 新增文字
            </Button>
          </div>
        </div>

        {/* 側欄：設定 + 發布 */}
        <aside className="lg:w-80 shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]">
            <SettingsPanel
              formId={props.id}
              settings={settings}
              onChange={setSettings}
              webhooks={props.webhooks}
            />
          </div>

          <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)] flex flex-col gap-3">
            <h2 className="font-extrabold text-lg">發布</h2>

            {status !== "draft" && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[11px] font-bold text-muted-foreground break-all">
                  {props.publicUrl}
                </p>
                <CopyLinkButton url={props.publicUrl} variant="default" />
              </div>
            )}

            {publishErrors.length > 0 && (
              <ul className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-medium text-foreground flex flex-col gap-1">
                {publishErrors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}

            {status === "draft" && (
              <Button type="button" variant="primary" disabled={pending} onClick={onPublish}>
                <Send className="h-4 w-4" /> 發布問卷
              </Button>
            )}
            {status === "published" && (
              <Button type="button" variant="default" disabled={pending} onClick={onClose}>
                <Lock className="h-4 w-4" /> 停止收件
              </Button>
            )}
            {status === "closed" && (
              <Button type="button" variant="primary" disabled={pending} onClick={onReopen}>
                <Send className="h-4 w-4" /> 重新開放
              </Button>
            )}
            {status !== "draft" && (
              <Link
                href={`/admin/forms/${props.id}/responses`}
                className="text-center text-sm font-bold text-accent hover:underline"
              >
                查看回應 →
              </Link>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> 刪除問卷
            </button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="確定刪除這份問卷？"
        description={
          <>
            <strong className="text-foreground">「{title || "未命名問卷"}」</strong>
            與它的所有回覆都會一併刪除，且<strong className="text-foreground">無法復原</strong>。
          </>
        }
        confirmLabel={pending ? "刪除中…" : "確定刪除"}
        pending={pending}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, string> = {
    saved: "已儲存",
    saving: "儲存中…",
    unsaved: "未儲存",
    error: "儲存失敗",
    conflict: "編輯衝突",
  };
  return (
    <span className="font-mono text-[11px] font-bold text-muted-foreground">{map[state]}</span>
  );
}

function StatusBadge({ status }: { status: FormStatus }) {
  const map: Record<FormStatus, { label: string; cls: string }> = {
    draft: { label: "草稿", cls: "bg-card" },
    published: { label: "已發布", cls: "bg-tone-green-badge" },
    closed: { label: "已關閉", cls: "bg-tone-rose-badge" },
  };
  return <Badge className={map[status].cls}>{map[status].label}</Badge>;
}
