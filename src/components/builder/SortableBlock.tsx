"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import type { Block, QuestionBlock, SectionBlock, TextBlock } from "@/lib/survey-schema";
import { QuestionEditor } from "./QuestionEditor";
import { SectionEditor } from "./SectionEditor";
import { TextEditor } from "./TextEditor";

interface Props {
  formId: string;
  block: Block;
  sections: Array<{ id: string; title: string }>;
  onChange: (next: Block) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableBlock({
  formId,
  block,
  sections,
  onChange,
  onDuplicate,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_var(--color-foreground)]"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="拖曳排序"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="複製"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
            aria-label="刪除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {block.kind === "question" && (
        <QuestionEditor
          formId={formId}
          block={block as QuestionBlock}
          sections={sections}
          onChange={onChange}
        />
      )}
      {block.kind === "section" && (
        <SectionEditor
          formId={formId}
          block={block as SectionBlock}
          sections={sections}
          onChange={onChange}
        />
      )}
      {block.kind === "text" && (
        <TextEditor formId={formId} block={block as TextBlock} onChange={onChange} />
      )}
    </div>
  );
}
