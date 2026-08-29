// 表單裡「人寫的字」（標題 / 說明 / 文字區塊）支援行內 Markdown。
//
// 支援：**粗體**、*斜體*、~~刪除線~~、`程式碼`、[文字](網址)，以及 \* 這種跳脫。
// 不支援：# 標題、清單、引言、圖片、表格——問卷說明是一段話，不是一篇文章；
// 區塊級語法會把版面搞爛，而且每多一種語法就多一種要防的攻擊面。
//
// 安全性：這裡只吐結構化節點，由 React 當成元素渲染（絕不 dangerouslySetInnerHTML），
// 所以文字本身不可能變成標籤。唯一的攻擊面是 href 的協定，故用白名單擋。

export type RichNode =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: RichNode[] }
  | { kind: "strong"; children: RichNode[] }
  | { kind: "em"; children: RichNode[] }
  | { kind: "del"; children: RichNode[] };

// 一次掃完所有行內語法。順序有意義：**粗體** 必須排在 *斜體* 前面，否則會被吃掉。
// 每種語法都不跨行（[^\n]）——跨行的成對符號幾乎都是誤判，不是作者的本意。
const INLINE_RE = new RegExp(
  [
    /\\([\\`*_~[\]()])/, //           1: 跳脫
    /`([^`\n]+)`/, //                 2: 行內程式碼（內容不再解析）
    /\[([^\]\n]*)\]\(([^\s)]+)\)/, // 3,4: 連結（文字, 網址）
    /\*\*([^\n]+?)\*\*/, //           5: 粗體
    /__([^\n]+?)__/, //               6: 粗體
    /~~([^\n]+?)~~/, //               7: 刪除線
    /\*([^\n]+?)\*/, //               8: 斜體
    /_([^\n]+?)_/, //                 9: 斜體
  ]
    .map((r) => r.source)
    .join("|"),
  "g",
);

// href 白名單：http(s) / mailto，或以單一 / 開頭的站內路徑。
// `//evil.com` 是協定相對網址（等於外站），不算站內路徑，所以要排除第二個斜線。
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const SITE_PATH = /^\/(?!\/)/;
const WORD = /[0-9A-Za-z]/;

function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href) || SITE_PATH.test(href);
}

/** 把一段文字解析成行內節點樹。認不得或不安全的寫法原樣留成文字。 */
export function parseRichText(input: string): RichNode[] {
  const out: RichNode[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    // 相鄰文字要合併，否則被打回文字的壞語法會被切成好幾塊。
    if (last?.kind === "text") last.text += text;
    else out.push({ kind: "text", text });
  };

  let cursor = 0;
  INLINE_RE.lastIndex = 0;
  for (const m of input.matchAll(INLINE_RE)) {
    const [whole, esc, code, label, href, strongA, strongB, del, emA, emB] = m;
    pushText(input.slice(cursor, m.index));
    cursor = m.index + whole.length;

    // `_` 夾在單字中間（snake_case_name）是識別字，不是斜體。CommonMark 也是這樣判。
    const underscore = strongB !== undefined || emB !== undefined;
    const before = input[m.index - 1] ?? " ";
    const after = input[cursor] ?? " ";
    if (underscore && (WORD.test(before) || WORD.test(after))) {
      pushText(whole);
      continue;
    }

    if (esc !== undefined) pushText(esc);
    else if (code !== undefined) out.push({ kind: "code", text: code });
    else if (href !== undefined) {
      // 空文字的連結（`[](url)`）點不到，當作寫壞了。
      if (label && isSafeHref(href)) {
        out.push({ kind: "link", href, children: parseRichText(label) });
      } else pushText(whole);
    } else if (strongA !== undefined || strongB !== undefined) {
      out.push({ kind: "strong", children: parseRichText((strongA ?? strongB)!) });
    } else if (del !== undefined) {
      out.push({ kind: "del", children: parseRichText(del) });
    } else {
      out.push({ kind: "em", children: parseRichText((emA ?? emB)!) });
    }
  }
  pushText(input.slice(cursor));
  return out;
}
