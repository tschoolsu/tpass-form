"use client";

import * as React from "react";
import { Button } from "./primitives";

interface Props {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 確認執行中：兩顆按鈕都鎖住，也不讓 ESC / 點背景關掉。 */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 用原生 <dialog>：focus trap、ESC、背景 inert 都交給瀏覽器，自己只管樣式。
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "確定",
  cancelLabel = "取消",
  pending = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault(); // 交給 onCancel 收 state，不讓瀏覽器自己關
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        // 點到 backdrop（事件目標就是 dialog 本身）才關。
        if (e.target === ref.current && !pending) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border-2 border-foreground bg-card p-5 text-foreground shadow-[6px_6px_0_0_var(--color-foreground)] backdrop:bg-foreground/30"
    >
      <h2 className="text-lg font-extrabold">{title}</h2>
      {description && (
        <div className="mt-2 text-sm font-medium text-muted-foreground">{description}</div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
