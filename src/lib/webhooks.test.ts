// notifyResponse 的行為：只送啟用中的目標、失敗不外拋、結果寫回 DB 供後台排錯。
// prisma 與 fetch 都是 mock —— 這裡驗的是「決策」，網路那一段由 webhook-format 的測試守。
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { webhook: { findMany: (a: unknown) => findMany(a), update: (a: unknown) => update(a) } },
}));

const { notifyResponse } = await import("./webhooks");

const NOTICE = {
  formTitle: "回報問題給數位部",
  responsesUrl: "https://form.test.invalid/admin/forms/f1/responses",
  respondent: "某同學",
  submittedAt: new Date("2026-08-27T12:00:00Z"),
  kind: "new" as const,
};

const DISCORD = { id: "w1", url: "https://discord.com/api/webhooks/1/tok" };

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyResponse", () => {
  it("沒有選任何目標就不查 DB、不發任何請求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await notifyResponse([], NOTICE)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("只送啟用中的目標（查詢條件就帶 enabled）", async () => {
    findMany.mockResolvedValue([DISCORD]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    const results = await notifyResponse(["w1", "w2"], NOTICE);

    expect(findMany.mock.calls[0][0].where).toEqual({ id: { in: ["w1", "w2"] }, enabled: true });
    expect(results).toEqual([{ webhookId: "w1", ok: true, status: 204 }]);
  });

  it("送出的 body 不含答案內容，且帶得出後台連結", async () => {
    findMany.mockResolvedValue([DISCORD]);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await notifyResponse(["w1"], NOTICE);

    const body = String(fetchSpy.mock.calls[0][1]!.body);
    expect(body).toContain("內容不在此顯示");
    expect(body).toContain("admin/forms/f1/responses");
  });

  it("HTTP 失敗不外拋，結果寫回 DB 給後台看", async () => {
    findMany.mockResolvedValue([DISCORD]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));

    const [r] = await notifyResponse(["w1"], NOTICE);

    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(update.mock.calls[0][0].data.lastStatus).toBe("HTTP 404");
  });

  it("連線炸掉也不外拋（回覆已經落地，通知不該讓送出看起來失敗）", async () => {
    findMany.mockResolvedValue([DISCORD]);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const [r] = await notifyResponse(["w1"], NOTICE);
    expect(r!.ok).toBe(false);
  });

  it("DB 裡被手改成白名單外的網址 → 第二道防線擋下，不發請求", async () => {
    findMany.mockResolvedValue([{ id: "w9", url: "https://evil.example.com/hook" }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const [r] = await notifyResponse(["w9"], NOTICE);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, error: "網址不在白名單" });
  });

  it("一個目標掛掉不影響另一個", async () => {
    findMany.mockResolvedValue([DISCORD, { id: "w2", url: "https://chat.googleapis.com/v1/spaces/A/messages" }]);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const results = await notifyResponse(["w1", "w2"], NOTICE);
    expect(results.map((r) => r.ok)).toEqual([false, true]);
  });
});
