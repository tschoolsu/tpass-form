"use client";

// 兩個 block 中間的插入點。有了它就不必為「往上插」「往下插」各做一顆按鈕——
// 每個縫隙自己就是一個插入位置，上下兩個方向自然都涵蓋到了。
import * as React from "react";
import { CircleHelp, Plus, SquareSplitVertical, Type as TypeIcon, X } from "lucide-react";
import { type Block, createQuestion, createSection, createText } from "@/lib/survey-schema";
import { Button } from "tpass-ui";

export function InsertDivider({ onInsert }: { onInsert: (b: Block) => void }) {
  const [open, setOpen] = React.useState(false);

  const pick = (b: Block) => {
    onInsert(b);
    setOpen(false);
  };

  if (open) {
    return (
      <div className="my-2 flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed border-foreground/40 bg-muted/40 p-2">
        <Button type="button" size="sm" onClick={() => pick(createQuestion("short_text"))}>
          <CircleHelp className="h-4 w-4" /> 題目
        </Button>
        <Button type="button" size="sm" onClick={() => pick(createSection())}>
          <SquareSplitVertical className="h-4 w-4" /> 區段
        </Button>
        <Button type="button" size="sm" onClick={() => pick(createText())}>
          <TypeIcon className="h-4 w-4" /> 文字
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" /> 取消
        </Button>
      </div>
    );
  }

  return (
    <div className="group relative flex h-4 items-center justify-center">
      <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t-2 border-dashed border-transparent transition-colors duration-200 group-hover:border-foreground/25" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="在這裡插入"
        // 手機沒有 hover，小螢幕一律顯示；桌機才藏起來、滑過或 focus 才浮現。
        className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground bg-card text-foreground opacity-100 transition-opacity duration-200 hover:bg-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
