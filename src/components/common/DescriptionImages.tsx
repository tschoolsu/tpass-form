// 說明欄插圖的渲染端。四處說明（問卷 / 區段 / 說明板塊 / 題目）與建構器預覽共用同一份。
import type { ImageRef } from "@/lib/survey-schema";
import { assetUrl } from "@/lib/asset-refs";
import { cn } from "tpass-ui";

interface Props {
  images: ImageRef[] | undefined;
  className?: string;
}

export function DescriptionImages({ images, className }: Props) {
  if (!images || images.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-3 grid gap-3",
        images.length > 1 && "sm:grid-cols-2",
        className,
      )}
    >
      {images.map((img) => (
        <figure key={img.id} className="m-0 min-w-0">
          <a
            href={assetUrl(img.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border-2 border-foreground bg-muted shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
          >
            {/* 用原生 <img>：插圖已在上傳時轉成 WebP 並縮到 1600px，next/image 沒東西可優化，
                而且它的優化器是伺服器端去抓圖、不帶使用者 cookie，會被讀取端的登入檢查擋掉。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(img.id)}
              alt={img.alt}
              width={img.w}
              height={img.h}
              loading="lazy"
              className="block h-auto w-full"
            />
          </a>
          {img.alt && (
            <figcaption className="mt-1 font-mono text-[11px] font-bold text-muted-foreground">
              {img.alt}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
