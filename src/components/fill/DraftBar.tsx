"use client";

// 填寫進度的存檔狀態列（通用版 / 特效版填寫器共用）。
import * as React from "react";
import { RotateCcw } from "lucide-react";
import type { SaveState } from "@/components/fill/useDraftAutosave";

const LABEL: Record<SaveState, string> = {
  saved: "已儲存草稿",
  saving: "儲存中…",
  unsaved: "尚未儲存",
  error: "草稿儲存失敗",
};

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface Props {
  saveState: SaveState;
  savedAt: string | null;
  disabled?: boolean;
  onDiscard: () => void;
}

export function DraftBar({ saveState, savedAt, disabled, onDiscard }: Props) {
  // 兩段式確認（不用 window.confirm）。
  const [confirming, setConfirming] = React.useState(false);

  // 一題都沒答時伺服器不留草稿，這時說「已儲存」是騙人的，乾脆不顯示。
  const status = saveState === "saved" && !savedAt ? null : LABEL[saveState];

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="font-mono text-[11px] font-bold text-muted-foreground">
        {status}
        {saveState === "saved" && savedAt ? ` · ${hhmm(savedAt)}` : ""}
      </span>
      <button
        type="button"
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setConfirming(false);
          onDiscard();
        }}
        onBlur={() => setConfirming(false)}
        disabled={disabled}
        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        <RotateCcw className="h-3 w-3" />
        {confirming ? "確定清除？" : "清除草稿、重新開始"}
      </button>
    </div>
  );
}
