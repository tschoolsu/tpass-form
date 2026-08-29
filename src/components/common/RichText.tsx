// 表單裡人寫的字（標題 / 說明 / 文字區塊）統一經過這裡渲染。
// 支援哪些語法、為什麼不支援標題，見 @/lib/rich-text。
import * as React from "react";
import { parseRichText, type RichNode } from "@/lib/rich-text";

const LINK_CLASS =
  "font-bold text-accent underline decoration-2 underline-offset-2 transition-colors duration-200 hover:text-foreground";
const CODE_CLASS =
  "rounded-md border-2 border-foreground/20 bg-muted px-1 py-0.5 font-mono text-[0.9em] font-bold";

function render(nodes: RichNode[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return <React.Fragment key={i}>{n.text}</React.Fragment>;
      case "code":
        return (
          <code key={i} className={CODE_CLASS}>
            {n.text}
          </code>
        );
      case "strong":
        return (
          <strong key={i} className="font-extrabold">
            {render(n.children)}
          </strong>
        );
      case "em":
        return <em key={i}>{render(n.children)}</em>;
      case "del":
        return (
          <del key={i} className="opacity-70">
            {render(n.children)}
          </del>
        );
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            // 外站另開分頁——填到一半的表單不能被踩掉。站內路徑與 mailto 不必。
            {...(/^https?:/i.test(n.href)
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={LINK_CLASS}
          >
            {render(n.children)}
          </a>
        );
    }
  });
}

export function RichText({ text }: { text: string }) {
  return <>{render(parseRichText(text))}</>;
}
