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

  // 這條是鐵律的測試：通知裡不能出現任何答案內容。
  it("只送辨識資訊，不送答案內容", () => {
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
