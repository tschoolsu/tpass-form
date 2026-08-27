// ★「回報問題給數位部」問卷定義（B5）★
// 全平台的唯一回報入口：門戶頁尾與各服務錯誤頁的「回報」都指到 portal 的 /feedback，
// 那條路由再轉址到這份問卷（slug 固定為 FEEDBACK_SLUG）。
//
// 為什麼題目寫在 code 裡：這份問卷是**基礎設施**，不是某個人的問卷——
// 誰都不該在後台不小心改壞或刪掉它。真相在這個檔，DB 那一列由
// scripts/seed-feedback-form.ts 冪等寫入（可重跑）。
//
// ⚠️ 服務清單不在這裡硬編碼（專案鐵律）：由 seed 腳本從 tpass-registry 派生後傳進來。
// isomorphic（不可依賴 server-only）。
import type { FormDefinition, FormSettings, QuestionBlock } from "@/lib/survey-schema";

export const FEEDBACK_SLUG = "feedback";
export const FEEDBACK_TITLE = "回報問題給數位部";
export const FEEDBACK_DESCRIPTION =
  "撞到怪怪的畫面、東西壞掉、或有想建議的功能，都可以填這裡。看得懂的細節愈多，修得愈快。";

export interface FeedbackServiceOption {
  id: string;
  label: string;
}

// 題目 id 一律語意化且**上線後不要改**：Response.answers 存的就是這些 id。
export function buildFeedbackDefinition(
  services: FeedbackServiceOption[],
): FormDefinition {
  const serviceQuestion: QuestionBlock = {
    kind: "question",
    id: "q_service",
    type: "single_choice",
    title: "你在哪個服務遇到問題？",
    description: "不確定就選「不知道／不在清單裡」，我們自己查。",
    images: [],
    required: true,
    options: [
      ...services.map((s) => ({ id: `svc_${s.id}`, label: s.label })),
      { id: "svc_login", label: "登入本身（還沒進到任何服務就卡住）" },
      { id: "svc_unknown", label: "不知道／不在清單裡" },
    ],
  };

  const kindQuestion: QuestionBlock = {
    kind: "question",
    id: "q_kind",
    type: "single_choice",
    title: "比較像哪一種？",
    images: [],
    required: true,
    options: [
      { id: "kind_broken", label: "壞掉了：打不開、按了沒反應、跳出錯誤畫面" },
      { id: "kind_stuck", label: "卡住了：不知道下一步該按哪裡" },
      { id: "kind_wrong", label: "內容有錯：文字、資料或權限不對" },
      { id: "kind_idea", label: "想建議一個功能" },
      { id: "kind_other", label: "其他" },
    ],
  };

  const detail: QuestionBlock = {
    kind: "question",
    id: "q_detail",
    type: "paragraph",
    title: "發生了什麼事？",
    description:
      "照著「我本來想做什麼 → 我按了什麼 → 結果看到什麼」寫最有用。不用寫得漂亮。",
    images: [],
    required: true,
  };

  const digest: QuestionBlock = {
    kind: "question",
    id: "q_digest",
    type: "short_text",
    title: "畫面上有出現「錯誤代碼」嗎？",
    description: "錯誤頁會顯示一串代碼，貼過來我們就能直接對到主機上的紀錄。沒有就留空。",
    images: [],
    required: false,
  };

  const url: QuestionBlock = {
    kind: "question",
    id: "q_url",
    type: "short_text",
    title: "當時的網址是？",
    description: "從瀏覽器網址列複製貼上即可。沒印象就留空。",
    images: [],
    required: false,
  };

  const shot: QuestionBlock = {
    kind: "question",
    id: "q_screenshot",
    type: "file_upload",
    title: "有截圖的話上傳一張",
    description: "一張截圖通常勝過三段描述。",
    images: [],
    required: false,
    file: { accept: ["image/*"], maxSizeMB: 10, maxFiles: 3 },
  };

  const reply: QuestionBlock = {
    kind: "question",
    id: "q_reply",
    type: "single_choice",
    title: "需要我們回覆你嗎？",
    images: [],
    required: true,
    options: [
      { id: "reply_yes", label: "需要，用學校信箱找我" },
      { id: "reply_no", label: "不用，我只是回報一下" },
    ],
  };

  return {
    blocks: [serviceQuestion, kindQuestion, detail, digest, url, shot, reply],
  };
}

// 實名（回報要能追問），橘色（＝錯誤頁那顆警示圖示的顏色）。
export const FEEDBACK_SETTINGS: FormSettings = {
  anonymous: false,
  identityFields: ["name", "email"],
  theme: { tone: "orange" },
  images: [],
  acceptingResponses: true,
  // 同一個人會撞到不只一個問題，不能只准回報一次。
  oneResponsePerUser: false,
};
