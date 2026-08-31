// 新回覆通知的「純」部分：網址檢查、遮罩、payload 組裝。
// 刻意不依賴 server-only / prisma，這樣測試可以直接跑（真正發送在 lib/webhooks.ts）。
//
// ⚠️ 內容外送是**人的決定，不是預設**：每份問卷可以選「只送關鍵資訊」（預設）或
// 「連答案一起送」（settings.webhookIncludeAnswers）。
// 為什麼預設是只送關鍵資訊：通知進的那個群組，成員名單不在 T-Pass 的權限模型裡——
// auth 的 /admin 把某人降回 default 只擋得住後台，擋不住群組；卸任、畢業都不會自動收權。
// 問卷回覆常含個資，所以「要不要把它送出這道門」必須有人明確按下去，而不是預設就開著。
// （tpass-appeals 的申訴通知是另一回事：那裡沒有開關，永遠不送內容——申訴的對象
// 很可能就在那個頻道裡。不要把這裡的開關「順手」加到那邊去。）
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

export interface AnswerLine {
  title: string;
  text: string;
}

export interface ResponseNotice {
  formTitle: string;
  // 後台那份回覆清單的完整網址（由呼叫端組，本檔不讀 env）。
  responsesUrl: string;
  // 匿名問卷、或沒收姓名的問卷 → null，通知就只說「有人填了」。
  respondent: string | null;
  submittedAt: Date;
  // new = 第一次送出；updated = 填寫者事後修改（問卷開了「送出後可修改」）。
  kind: "new" | "updated";
  // 只有在該問卷勾了「連答案一起送」時才會有值。undefined／空陣列＝只送關鍵資訊。
  answers?: AnswerLine[];
}

// 兩家的訊息長度上限都在四千字上下（Discord embed description 4096、Google Chat 約 4000）。
// 超過就整包被退回，所以寧可截斷——反正完整內容在後台。
const MAX_ANSWERS_CHARS = 3_000;

function answersBlock(answers: AnswerLine[] | undefined): string | null {
  if (!answers || answers.length === 0) return null;

  const lines: string[] = [];
  let used = 0;
  let truncated = false;
  for (const a of answers) {
    const line = `• ${a.title}：${a.text || "（未填）"}`;
    if (used + line.length > MAX_ANSWERS_CHARS) {
      truncated = true;
      break;
    }
    lines.push(line);
    used += line.length;
  }
  if (truncated) lines.push("…（內容過長，其餘請至後台查看）");
  return lines.join("\n");
}

function timeLabel(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

// ⚠️ 這兩個 payload 就是「內容出不出得了這道門」的實際落點，改之前先讀檔頭。
// answers 有值＝那份問卷的人選了「連答案一起送」；沒有值就只給關鍵資訊 + 後台連結。
export function buildPayload(kind: WebhookKind, n: ResponseNotice): unknown {
  const who = n.respondent ?? "（匿名／未收姓名）";
  const body = answersBlock(n.answers);
  const headline =
    n.kind === "updated" ? `✏️ *${n.formTitle}* 有人更新了回覆` : `📥 *${n.formTitle}* 有新回覆`;

  if (kind === "google_chat") {
    return {
      text: [
        headline,
        `填寫者：${who}`,
        `時間：${timeLabel(n.submittedAt)}`,
        body ?? "內容不在此顯示，請至後台查看：",
        body ? `完整內容與附件：${n.responsesUrl}` : n.responsesUrl,
      ].join("\n"),
    };
  }
  return {
    embeds: [
      {
        title: n.kind === "updated" ? "問卷回覆已更新" : "問卷有新回覆",
        description: [
          `**${n.formTitle}**`,
          `填寫者：${who}`,
          body ?? "內容不在此顯示，請至後台查看：",
          body
            ? `[完整內容與附件](${n.responsesUrl})`
            : `[開啟回覆清單](${n.responsesUrl})`,
        ].join("\n"),
        timestamp: n.submittedAt.toISOString(),
      },
    ],
  };
}
