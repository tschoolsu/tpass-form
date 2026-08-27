// 新回覆通知（webhook）的發送端。目標先在 /admin/webhooks 登記，每份問卷自己挑要不要用。
//
// ⚠️ 鐵律：通知**只送辨識資訊，不送答案內容**——payload 長相與理由都在 lib/webhook-format.ts。
// url 內含 secret：錯誤訊息與 log 一律不得帶出完整 URL。
import "server-only";
import { prisma } from "@/lib/db";
import { buildPayload, checkWebhookUrl, type ResponseNotice } from "@/lib/webhook-format";

const TIMEOUT_MS = 10_000;

export interface DeliveryResult {
  webhookId: string;
  ok: boolean;
  status?: number;
  error?: string;
}

async function post(
  webhook: { id: string; url: string },
  notice: ResponseNotice,
): Promise<DeliveryResult> {
  const check = checkWebhookUrl(webhook.url);
  // 登記時就擋過了；這裡是第二道（DB 被手改、或白名單縮小時不要把資料送出去）。
  if (!check.ok) return { webhookId: webhook.id, ok: false, error: "網址不在白名單" };

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(buildPayload(check.kind, notice)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok
      ? { webhookId: webhook.id, ok: true, status: res.status }
      : { webhookId: webhook.id, ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "TimeoutError"
        ? "逾時（10 秒）"
        : err instanceof Error
          ? err.name
          : "unknown";
    return { webhookId: webhook.id, ok: false, error };
  }
}

// 送一輪通知。**永遠不外拋**：回覆已經落地，通知掛掉不該讓填寫者看到送出失敗。
// 呼叫端用 next/server 的 after() 排在回應之後，所以填寫者不會等這 10 秒。
export async function notifyNewResponse(
  webhookIds: string[],
  notice: ResponseNotice,
): Promise<DeliveryResult[]> {
  if (webhookIds.length === 0) return [];

  const webhooks = await prisma.webhook.findMany({
    where: { id: { in: webhookIds }, enabled: true },
    select: { id: true, url: true },
  });

  const results = await Promise.all(webhooks.map((w) => post(w, notice)));

  // 結果寫回去給後台排錯（例如群組被刪掉 → 一直 404）。失敗也不外拋。
  await Promise.allSettled(
    results.map((r) =>
      prisma.webhook.update({
        where: { id: r.webhookId },
        data: { lastStatus: r.ok ? `OK ${r.status ?? ""}`.trim() : (r.error ?? "失敗"), lastSentAt: new Date() },
      }),
    ),
  );

  for (const r of results.filter((x) => !x.ok)) {
    // ⚠️ 只印 id 不印 url——url 內含 secret。
    console.error(`[webhook] 投遞失敗 id=${r.webhookId}：${r.error}`);
  }
  return results;
}
