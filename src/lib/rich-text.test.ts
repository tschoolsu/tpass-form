import { describe, it, expect } from "vitest";
import { parseRichText, type RichNode } from "./rich-text";

const text = (t: string): RichNode => ({ kind: "text", text: t });
const hr: RichNode = { kind: "hr" };

describe("parseRichText", () => {
  it("沒有語法時整段就是一個文字節點", () => {
    expect(parseRichText("純文字\n第二行")).toEqual([text("純文字\n第二行")]);
  });

  it("空字串回空陣列", () => {
    expect(parseRichText("")).toEqual([]);
  });

  // ── 連結 ────────────────────────────────────────────────────────────
  it("解析連結並保留前後文字", () => {
    expect(parseRichText("請看 [規章](https://example.com/a) 再填")).toEqual([
      text("請看 "),
      { kind: "link", href: "https://example.com/a", children: [text("規章")] },
      text(" 再填"),
    ]);
  });

  it("允許 mailto 與站內相對路徑", () => {
    expect(parseRichText("[寄信](mailto:a@b.c)")).toEqual([
      { kind: "link", href: "mailto:a@b.c", children: [text("寄信")] },
    ]);
    expect(parseRichText("[首頁](/f/abc)")).toEqual([
      { kind: "link", href: "/f/abc", children: [text("首頁")] },
    ]);
  });

  it("擋掉 javascript: 之類的協定，原樣當文字顯示", () => {
    for (const raw of [
      "[點我](javascript:alert(1))",
      "[x](data:text/html,hi)",
      "[x](JavaScript:alert(1))",
      "[x](//evil.com)", // 協定相對＝外站，不是站內路徑
    ]) {
      expect(parseRichText(raw)).toEqual([text(raw)]);
    }
  });

  it("連結寫壞不會吃掉文字", () => {
    expect(parseRichText("[沒關括號](https://a.com")).toEqual([
      text("[沒關括號](https://a.com"),
    ]);
    expect(parseRichText("[空網址]()")).toEqual([text("[空網址]()")]);
    expect(parseRichText("[](https://a.com)")).toEqual([text("[](https://a.com)")]);
    expect(parseRichText("[換\n行](https://a.com)")).toEqual([text("[換\n行](https://a.com)")]);
  });

  // ── 強調 ────────────────────────────────────────────────────────────
  it("粗體、斜體、刪除線、行內程式碼", () => {
    expect(parseRichText("**粗**")).toEqual([{ kind: "strong", children: [text("粗")] }]);
    expect(parseRichText("__粗__")).toEqual([{ kind: "strong", children: [text("粗")] }]);
    expect(parseRichText("*斜*")).toEqual([{ kind: "em", children: [text("斜")] }]);
    expect(parseRichText("_斜_")).toEqual([{ kind: "em", children: [text("斜")] }]);
    expect(parseRichText("~~刪~~")).toEqual([{ kind: "del", children: [text("刪")] }]);
    expect(parseRichText("`code`")).toEqual([{ kind: "code", text: "code" }]);
  });

  it("粗體優先於斜體，不會被 * 拆掉", () => {
    expect(parseRichText("**兩顆星**")).toEqual([
      { kind: "strong", children: [text("兩顆星")] },
    ]);
  });

  it("可以巢狀：連結文字裡有粗體", () => {
    expect(parseRichText("[看**這裡**](https://a.com)")).toEqual([
      {
        kind: "link",
        href: "https://a.com",
        children: [text("看"), { kind: "strong", children: [text("這裡")] }],
      },
    ]);
  });

  it("行內程式碼裡的符號不再解析", () => {
    expect(parseRichText("`**not bold**`")).toEqual([{ kind: "code", text: "**not bold**" }]);
  });

  it("# 標題不支援，原樣顯示", () => {
    expect(parseRichText("# 大標題")).toEqual([text("# 大標題")]);
    expect(parseRichText("## 小標題")).toEqual([text("## 小標題")]);
  });

  it("單字中間的底線是識別字，不是斜體", () => {
    expect(parseRichText("snake_case_name")).toEqual([text("snake_case_name")]);
    expect(parseRichText("a__b__c")).toEqual([text("a__b__c")]);
  });

  it("落單的符號原樣顯示", () => {
    expect(parseRichText("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
    expect(parseRichText("剩一顆星 *")).toEqual([text("剩一顆星 *")]);
  });

  it("成對符號不跨行", () => {
    expect(parseRichText("*換\n行*")).toEqual([text("*換\n行*")]);
  });

  it("反斜線可以跳脫，把符號當字面顯示", () => {
    expect(parseRichText("\\*不是斜體\\*")).toEqual([text("*不是斜體*")]);
    expect(parseRichText("價格 5\\*3")).toEqual([text("價格 5*3")]);
  });

  // ── 分隔線 ──────────────────────────────────────────────────────────
  describe("分隔線（thematic break）", () => {
    it("前後有文字時，換行一併被吃掉", () => {
      expect(parseRichText("上\n---\n下")).toEqual([text("上"), hr, text("下")]);
    });

    it("在文字開頭也能判定（前面沒有換行）", () => {
      expect(parseRichText("---\n下面")).toEqual([hr, text("下面")]);
    });

    it("在文字結尾也能判定（後面沒有換行）", () => {
      expect(parseRichText("上面\n---")).toEqual([text("上面"), hr]);
    });

    it("整段只有分隔線", () => {
      expect(parseRichText("---")).toEqual([hr]);
    });

    it("三種字元都算：- * _", () => {
      expect(parseRichText("上\n***\n下")).toEqual([text("上"), hr, text("下")]);
      expect(parseRichText("上\n___\n下")).toEqual([text("上"), hr, text("下")]);
    });

    it("字元之間、前後可以夾空白或 tab", () => {
      expect(parseRichText("上\n- - -\n下")).toEqual([text("上"), hr, text("下")]);
      expect(parseRichText("上\n_ _ _\n下")).toEqual([text("上"), hr, text("下")]);
      expect(parseRichText("上\n \t- -\t- \t\n下")).toEqual([text("上"), hr, text("下")]);
    });

    it("字元數可以超過 3 個", () => {
      expect(parseRichText("上\n----------\n下")).toEqual([text("上"), hr, text("下")]);
    });

    it("多個分隔線各自被判定", () => {
      expect(parseRichText("上\n---\n中\n***\n下")).toEqual([
        text("上"),
        hr,
        text("中"),
        hr,
        text("下"),
      ]);
    });

    it("不是分隔線：前面還有其他字（a---b）", () => {
      expect(parseRichText("a---b")).toEqual([text("a---b")]);
    });

    it("不是分隔線：只有兩個字元", () => {
      expect(parseRichText("上\n--\n下")).toEqual([text("上\n--\n下")]);
    });

    it("不是分隔線：字元之間夾了其他文字", () => {
      expect(parseRichText("上\n- - x\n下")).toEqual([text("上\n- - x\n下")]);
    });

    it("不是分隔線：夾在同一行文字中間", () => {
      expect(parseRichText("文字 --- 更多文字")).toEqual([text("文字 --- 更多文字")]);
    });

    it("不是分隔線：混用不同字元", () => {
      expect(parseRichText("上\n-*-\n下")).toEqual([text("上\n-*-\n下")]);
    });
  });
});
