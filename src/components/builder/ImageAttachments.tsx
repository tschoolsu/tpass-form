"use client";

// 說明欄插圖的編輯端。四處說明（問卷 / 區段 / 說明板塊 / 題目）共用這一個元件——
// 每處各長一套 UI 只會讓「加圖片」在四個地方行為不一致。
import * as React from "react";
import { ImagePlus, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MAX_IMAGES_PER_FIELD, type ImageRef } from "@/lib/survey-schema";
import { assetUrl } from "@/lib/asset-refs";
import { Input, Button } from "@/components/ui/primitives";

interface Props {
  formId: string;
  images: ImageRef[] | undefined;
  onChange: (next: ImageRef[]) => void;
}

export function ImageAttachments({ formId, images, onChange }: Props) {
  const list = images ?? [];
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = list.length >= MAX_IMAGES_PER_FIELD;

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    // 一張一張傳：後端有每問卷張數上限，並行送會讓錯誤訊息對不上是哪一張。
    const added: ImageRef[] = [];
    for (const file of Array.from(files).slice(0, MAX_IMAGES_PER_FIELD - list.length)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("formId", formId);
      try {
        const res = await fetch("/api/form-assets", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "上傳失敗。");
          break;
        }
        added.push({ id: json.id, alt: "", w: json.width, h: json.height });
      } catch {
        setError("上傳失敗，請檢查網路後再試。");
        break;
      }
    }
    if (added.length > 0) onChange([...list, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const setAlt = (i: number, alt: string) =>
    onChange(list.map((img, n) => (n === i ? { ...img, alt } : img)));

  const remove = (i: number) => onChange(list.filter((_, n) => n !== i));

  // 只有 6 張上限，用左右鍵搬比拖曳簡單得多，也不用再拉一層 dnd context。
  const move = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((img, i) => (
            <li
              key={img.id}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-foreground/25 bg-muted/40 p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(img.id)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg border-2 border-foreground object-cover"
              />
              <Input
                value={img.alt}
                placeholder="圖說（選填，也是替代文字）"
                className="py-1 text-sm"
                onChange={(e) => setAlt(i, e.target.value)}
              />
              <div className="flex shrink-0 items-center">
                <IconButton label="往前移" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="往後移"
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
                <IconButton label="刪除圖片" danger onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || full}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? "上傳中…" : "加圖片"}
        </Button>
        <span className="font-mono text-[11px] font-bold text-muted-foreground">
          {full ? `已達上限 ${MAX_IMAGES_PER_FIELD} 張` : `${list.length}/${MAX_IMAGES_PER_FIELD}`}
        </span>
      </div>

      {error && (
        <p className="font-mono text-[11px] font-bold text-destructive">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void pick(e.target.files)}
      />
    </div>
  );
}

function IconButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-md p-1.5 text-muted-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-muted " +
        (danger ? "hover:text-destructive" : "hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
