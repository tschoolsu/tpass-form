// 通知目標清單。登記好的 webhook 之後在每份問卷的設定面板勾選——
// 大量回覆的問卷不要開，「不會有人定期檢查」的（例如回報表單）才開。
// url 內含 secret，這裡只顯示遮罩版。
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { maskWebhookUrl } from "@/lib/webhook-format";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { WebhookForm, TestWebhookButton } from "@/components/admin/WebhookForm";
import { deleteWebhookAction, toggleWebhookAction } from "./actions";

export const metadata = { title: "通知目標 — T-Form" };

export default async function AdminWebhooksPage() {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">通知目標</h1>
      <p className="mb-6 font-medium text-muted-foreground">
        登記 Discord 或 Google Chat 的 incoming webhook，之後在每份問卷的「表單設定」裡勾選要用哪幾個。
        通知<strong>只會說「有新回覆」與填寫者是誰，不會送出答案內容</strong>——要看內容請點連結進後台。
      </p>

      <Card className="mb-6">
        <h2 className="mb-3 font-bold">新增通知目標</h2>
        <WebhookForm />
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          Discord：頻道設定 → 整合 → Webhook → 複製 URL。
          Google Chat：群組 → 應用程式與整合 → Webhook → 複製 URL。
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        {webhooks.map((w) => (
          <div
            key={w.id}
            className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_var(--color-foreground)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{w.name}</span>
              <Badge className={w.enabled ? "bg-tone-green-badge" : "bg-muted"}>
                {w.enabled ? "啟用中" : "已停用"}
              </Badge>
              <span className="flex-1" />
              <span className="font-mono text-[11px] text-muted-foreground">
                {maskWebhookUrl(w.url)}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              由 {w.createdBy} 新增 ·{" "}
              {w.createdAt.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}
              {w.lastSentAt && (
                <>
                  {" "}
                  · 最後一次投遞 {w.lastSentAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}
                  （{w.lastStatus}）
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TestWebhookButton id={w.id} />
              <form action={toggleWebhookAction}>
                <input type="hidden" name="id" value={w.id} />
                <Button type="submit" size="sm">
                  {w.enabled ? "停用" : "啟用"}
                </Button>
              </form>
              <form action={deleteWebhookAction}>
                <input type="hidden" name="id" value={w.id} />
                <Button type="submit" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4" /> 刪除
                </Button>
              </form>
            </div>
          </div>
        ))}

        {webhooks.length === 0 && (
          <p className="text-sm font-medium text-muted-foreground">
            還沒有任何通知目標。沒有目標時，所有問卷都不會發通知（這也是預設狀態）。
          </p>
        )}
      </div>
    </div>
  );
}
