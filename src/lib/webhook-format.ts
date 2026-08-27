// 新回覆通知的「純」部分：網址檢查、遮罩、payload 組裝。
// 刻意不依賴 server-only / prisma，這樣測試可以直接跑（真正發送在 lib/webhooks.ts）。
//
// ⚠️ 鐵律：通知**只送辨識資訊，不送答案內容**。
// 理由跟 tpass-appeals 的 Discord 通知（加固計畫 A4）一樣：群組/頻道的成員名單不在
// T-Pass 的權限模型裡——auth 的 /admin 把某人降回 default 只擋得住後台，擋不住群組；
// 卸任、畢業都不會自動收權。而問卷回覆常含個資，匿名問卷更是承諾過「不會被看出是誰」。
// 🚫 不要「順手」把答案摘要加回來。要看內容就點連結進後台，那裡才管得住。
//
// url 內含 secret：錯誤訊息與 log 一律不得帶出完整 URL。
// 只收這兩家的 incoming webhook。白名單擋的是①貼錯網址②admin 帳號失守時
// 把通知導去任意主機（SSRF / 資料外流面）。同 tmsg 的 chat.googleapis.com 檢查。
const ALLOWED: Record<string, WebhookKind> = {
  "chat.googleapis.com": "google_chat",
  "discord.com": "discord",
  "discordapp.com": "discord",
  "ptb.discord.com": "discord",
  "canary.discord.com": "discord",
};

export type WebhookKind = "google_chat" | "discord";

export type UrlCheck =
  | { ok: true; kind: WebhookKind }
  | { ok: false; error: string };

// 網址長相決定它是哪一家，不必讓人在 UI 上再選一次（少一個能選錯的地方）。
export function checkWebhookUrl(raw: string): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "這不是有效的網址。" };
  }
  if (u.protocol !== "https:") {
    return { ok: false, error: "Webhook 必須是 https:// 開頭。" };
  }
  const kind = ALLOWED[u.hostname];
  if (!kind) {
    return {
      ok: false,
      error: `只收 Google Chat（chat.googleapis.com）或 Discord（discord.com）的 webhook，收到 ${u.hostname}。`,
    };
  }
  if (kind === "discord" && !u.pathname.startsWith("/api/webhooks/")) {
    return { ok: false, error: "Discord 的網址要長得像 /api/webhooks/<id>/<token>。" };
  }
  return { ok: true, kind };
}

// 後台顯示用：把 secret 藏起來，只留看得出是哪個群組的部分。
export function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.slice(0, 24)}…`;
  } catch {
    return `${url.slice(0, 32)}…`;
  }
}

export interface ResponseNotice {
  formTitle: string;
  // 後台那份回覆清單的完整網址（由呼叫端組，本檔不讀 env）。
  responsesUrl: string;
  // 匿名問卷、或沒收姓名的問卷 → null，通知就只說「有人填了」。
  respondent: string | null;
  submittedAt: Date;
}

function timeLabel(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

// ⚠️ 這兩個 payload 是「不送內容」那條鐵律的實際落點，改之前先讀檔頭。
export function buildPayload(kind: WebhookKind, n: ResponseNotice): unknown {
  const who = n.respondent ?? "（匿名／未收姓名）";
  if (kind === "google_chat") {
    return {
      text: [
        `📥 *${n.formTitle}* 有新回覆`,
        `填寫者：${who}`,
        `時間：${timeLabel(n.submittedAt)}`,
        `內容不在此顯示，請至後台查看：${n.responsesUrl}`,
      ].join("\n"),
    };
  }
  return {
    embeds: [
      {
        title: "問卷有新回覆",
        description: [
          `**${n.formTitle}**`,
          `填寫者：${who}`,
          `內容不在此顯示，請至後台查看：[開啟回覆清單](${n.responsesUrl})`,
        ].join("\n"),
        timestamp: n.submittedAt.toISOString(),
      },
    ],
  };
}
