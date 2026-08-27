"use server";

// 通知目標（webhook）管理。url 內含 secret：不回顯完整 URL、不寫進錯誤訊息。
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { checkWebhookUrl } from "@/lib/webhook-format";
import { notifyNewResponse } from "@/lib/webhooks";
import { authConfig } from "@/config/auth";

export interface WebhookResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function addWebhookAction(
  _prev: WebhookResult | null,
  formData: FormData,
): Promise<WebhookResult> {
  const session = await requireAdmin("/admin/webhooks");

  const name = (formData.get("name") ?? "").toString().trim();
  const url = (formData.get("url") ?? "").toString().trim();
  if (!name) return { ok: false, error: "請填一個看得懂的名稱（例如：數位部 Discord）。" };

  const check = checkWebhookUrl(url);
  if (!check.ok) return { ok: false, error: check.error };

  await prisma.webhook.create({ data: { name, url, createdBy: session.email } });
  revalidatePath("/admin/webhooks");
  return { ok: true, message: `已新增「${name}」。到問卷的設定面板勾選它才會開始通知。` };
}

export async function toggleWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/webhooks");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const w = await prisma.webhook.findUnique({ where: { id }, select: { enabled: true } });
  if (!w) return;
  await prisma.webhook.update({ where: { id }, data: { enabled: !w.enabled } });
  revalidatePath("/admin/webhooks");
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/webhooks");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  // 問卷設定裡留下的孤兒 id 不必清：送出時是拿 id 去查現存的 webhook，查不到就不送。
  await prisma.webhook.delete({ where: { id } });
  revalidatePath("/admin/webhooks");
}

// 測試發送：走的是跟真正通知一模一樣的路徑（同一支 notifyNewResponse），
// 只是內容標成測試。這樣「測試會通、正式卻不通」的情況不會發生。
export async function testWebhookAction(
  _prev: WebhookResult | null,
  formData: FormData,
): Promise<WebhookResult> {
  await requireAdmin("/admin/webhooks");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { ok: false, error: "沒有指定 webhook。" };

  const [result] = await notifyNewResponse([id], {
    formTitle: "（測試通知）T-Form",
    responsesUrl: `${authConfig.selfUrl}/admin`,
    respondent: "測試",
    submittedAt: new Date(),
  });

  revalidatePath("/admin/webhooks");
  if (!result) return { ok: false, error: "這個 webhook 是停用狀態，沒有送出。" };
  return result.ok
    ? { ok: true, message: "送出成功，去群組看一下。" }
    : { ok: false, error: `送不出去：${result.error}` };
}
