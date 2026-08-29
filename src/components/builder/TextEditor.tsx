"use client";

import type { TextBlock } from "@/lib/survey-schema";
import { Input, Textarea, Badge } from "tpass-ui";
import { ImageAttachments } from "./ImageAttachments";

interface Props {
  formId: string;
  block: TextBlock;
  onChange: (next: TextBlock) => void;
}

export function TextEditor({ formId, block, onChange }: Props) {
  const set = (patch: Partial<TextBlock>) => onChange({ ...block, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <Badge className="bg-tone-orange-badge w-fit">文字區塊</Badge>
      <Input
        value={block.heading ?? ""}
        placeholder="標題"
        className="font-bold"
        onChange={(e) => set({ heading: e.target.value })}
      />
      <Textarea
        value={block.body ?? ""}
        placeholder="說明內容（選填）"
        onChange={(e) => set({ body: e.target.value })}
      />
      <ImageAttachments
        formId={formId}
        images={block.images}
        onChange={(images) => set({ images })}
      />
    </div>
  );
}
