import { describe, expect, it } from "vitest";
import { buildPayload, checkWebhookUrl, maskWebhookUrl } from "./webhook-format";

describe("checkWebhookUrl", () => {
  it("認得 Google Chat 與 Discord", () => {
    expect(checkWebhookUrl("https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t")).toEqual({
      ok: true,
      kind: "google_chat",
    });
    expect(checkWebhookUrl("https://discord.com/api/webhooks/123/abc")).toEqual({
      ok: true,
      kind: "discord",
    });
  });

  it("擋掉白名單外的主機（貼錯 / 帳號失守時的外流面）", () => {
    const r = checkWebhookUrl("https://evil.example.com/hook");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("evil.example.com");
  });

  it("擋掉 http 與非網址", () => {
    expect(checkWebhookUrl("http://discord.com/api/webhooks/1/2").ok).toBe(false);
    expect(checkWebhookUrl("讓我想想").ok).toBe(false);
    expect(checkWebhookUrl("").ok).toBe(false);
  });

  it("Discord 只收 /api/webhooks/ 開頭的路徑", () => {
    expect(checkWebhookUrl("https://discord.com/channels/1/2").ok).toBe(false);
  });

  it("前後空白不算錯", () => {
    expect(checkWebhookUrl("  https://discord.com/api/webhooks/1/2  ").ok).toBe(true);
  });
});

describe("maskWebhookUrl", () => {
  it("不回吐完整網址（url 內含 secret）", () => {
    const url = "https://discord.com/api/webhooks/123456789/SUPER_SECRET_TOKEN_VALUE";
    const masked = maskWebhookUrl(url);
    expect(masked).not.toContain("SUPER_SECRET_TOKEN_VALUE");
    expect(masked).toContain("discord.com");
  });
});

describe("buildPayload", () => {
  const notice = {
    formTitle: "回報問題給數位部",
    responsesUrl: "https://form.test.invalid/admin/forms/f1/responses",
    respondent: "某同學",
    submittedAt: new Date("2026-08-27T12:34:56Z"),
  };

  // 預設模式：沒有 answers 就不會有任何答案內容跑出去。
  it("預設只送關鍵資訊，不帶答案內容", () => {
    for (const kind of ["google_chat", "discord"] as const) {
      const json = JSON.stringify(buildPayload(kind, notice));
      expect(json).toContain("回報問題給數位部");
      expect(json).toContain("某同學");
      expect(json).toContain("admin/forms/f1/responses");
      expect(json).toContain("內容不在此顯示");
    }
  });

  it("匿名問卷不會漏出填寫者", () => {
    const json = JSON.stringify(buildPayload("google_chat", { ...notice, respondent: null }));
    expect(json).toContain("匿名");
    expect(json).not.toContain("某同學");
  });

  it("Google Chat 用 text、Discord 用 embeds", () => {
    expect(buildPayload("google_chat", notice)).toHaveProperty("text");
    expect(buildPayload("discord", notice)).toHaveProperty("embeds");
  });
});

// 「連答案一起送」是每份問卷自己的選擇（settings.webhookIncludeAnswers）。
// 送出端只有在勾了的時候才會把 answers 帶進來，所以這裡驗的是「有帶就送、沒帶就不送」。
describe("buildPayload：連答案一起送", () => {
  const base = {
    formTitle: "回報問題給數位部",
    responsesUrl: "https://form.test.invalid/admin/forms/f1/responses",
    respondent: "某同學",
    submittedAt: new Date("2026-08-27T12:34:56Z"),
  };
  const answers = [
    { title: "發生了什麼事？", text: "問卷送出後一直轉圈圈" },
    { title: "當時的網址是？", text: "https://form.tschoolsu.org/f/abc" },
  ];

  it("兩家都會把題目與答案寫進訊息，並保留後台連結", () => {
    for (const kind of ["google_chat", "discord"] as const) {
      const json = JSON.stringify(buildPayload(kind, { ...base, answers }));
      expect(json).toContain("發生了什麼事？");
      expect(json).toContain("問卷送出後一直轉圈圈");
      expect(json).toContain("admin/forms/f1/responses");
      // 送了內容就不該再說「內容不在此顯示」
      expect(json).not.toContain("內容不在此顯示");
    }
  });

  it("沒填的題目顯示（未填），不是空白", () => {
    const json = JSON.stringify(
      buildPayload("discord", { ...base, answers: [{ title: "電話", text: "" }] }),
    );
    expect(json).toContain("（未填）");
  });

  it("空陣列視同沒開（例如問卷一題都沒有）", () => {
    const json = JSON.stringify(buildPayload("discord", { ...base, answers: [] }));
    expect(json).toContain("內容不在此顯示");
  });

  it("內容過長會截斷——超過上限整包會被平台退回", () => {
    const long = Array.from({ length: 200 }, (_, i) => ({
      title: `題目 ${i}`,
      text: "很長的答案".repeat(20),
    }));
    const payload = buildPayload("discord", { ...base, answers: long }) as {
      embeds: Array<{ description: string }>;
    };
    const desc = payload.embeds[0]!.description;
    expect(desc).toContain("內容過長，其餘請至後台查看");
    expect(desc.length).toBeLessThan(4000);
  });

  it("匿名問卷即使送內容，也不會多出填寫者身分", () => {
    const json = JSON.stringify(
      buildPayload("google_chat", { ...base, respondent: null, answers }),
    );
    expect(json).toContain("匿名");
    expect(json).not.toContain("某同學");
  });
});
