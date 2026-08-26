"use client";

import type { SectionBlock } from "@/lib/survey-schema";
import { Input, Select, Badge, Label } from "@/components/ui/primitives";
import { ImageAttachments } from "./ImageAttachments";

interface Props {
  formId: string;
  block: SectionBlock;
  // 此段之後可跳轉的目標段（通常是它後面的段）。
  sections: Array<{ id: string; title: string }>;
  onChange: (next: SectionBlock) => void;
}

export function SectionEditor({ formId, block, sections, onChange }: Props) {
  const set = (patch: Partial<SectionBlock>) => onChange({ ...block, ...patch });
  const others = sections.filter((s) => s.id !== block.id);

  return (
    <div className="flex flex-col gap-3">
      <Badge className="bg-tone-blue-badge w-fit">區段</Badge>
      <Input
        value={block.title ?? ""}
        placeholder="區段標題"
        className="font-bold"
        onChange={(e) => set({ title: e.target.value })}
      />
      <Input
        value={block.description ?? ""}
        placeholder="區段說明（選填）"
        className="text-sm"
        onChange={(e) => set({ description: e.target.value })}
      />
      <ImageAttachments
        formId={formId}
        images={block.images}
        onChange={(images) => set({ images })}
      />
      <div>
        <Label>完成此段後</Label>
        <Select
          className="mt-1 max-w-xs py-1.5 text-sm"
          value={block.defaultNext}
          onChange={(e) => set({ defaultNext: e.target.value })}
        >
          <option value="NEXT">前往下一段</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              跳到：{s.title}
            </option>
          ))}
          <option value="END">送出問卷（結束）</option>
        </Select>
      </div>
    </div>
  );
}
