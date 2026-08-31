// 檔案題的上限與呈現，填寫端 / 上傳 API / 建構端三處共用，避免各算各的。
//
// 為什麼要 clamp 而不是在 schema 加 .max：正式 DB 已經有題目寫著 maxSizeMB: 100，
// schema 一收緊那份問卷就整個載不出來。上限是主機的事實（nginx client_max_body_size 21M），
// 題目設多少都不會超過它，所以「有效上限 = min(設定, 20)」，舊資料照常運作。
import type { QuestionBlock } from "@/lib/survey-schema";

/** 主機真正吃得下的單檔上限（MB）。nginx 設 21M 留 1M 給 multipart 邊界與其他欄位。 */
export const MAX_FILE_MB = 20;

export interface FileLimits {
  maxFiles: number;
  maxSizeMB: number;
  accept: string[];
}

export function fileLimits(q: Pick<QuestionBlock, "file">): FileLimits {
  return {
    maxFiles: q.file?.maxFiles ?? 1,
    maxSizeMB: Math.min(q.file?.maxSizeMB ?? 10, MAX_FILE_MB),
    accept: q.file?.accept ?? [],
  };
}

// 常見 mime → 中文。列不到的照原文顯示（例：application/vnd.ms-excel 就是它自己）。
const ACCEPT_LABELS: Record<string, string> = {
  "image/*": "圖片",
  "video/*": "影片",
  "audio/*": "音訊",
  "application/pdf": "PDF",
  ".pdf": "PDF",
};

/** 把 accept 清單翻成填寫者看得懂的字。空清單回空字串（呼叫端不顯示）。 */
export function describeAccept(accept: string[]): string {
  return accept
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => ACCEPT_LABELS[a.toLowerCase()] ?? (a.startsWith(".") ? a.slice(1).toUpperCase() : a))
    .join("、");
}

// 部分 Android 的選檔器不給 file.type。後端只靠 mime 判 image/* 這種規則會把手機照片
// 全部 415 掉，所以用副檔名補一手；表裡沒有的維持 octet-stream，讓規則自己決定。
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function guessMime(filename: string, declared: string): string {
  if (declared) return declared;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

// 檔案型別是否符合題目的 accept 清單（空清單 = 不限制）。
// 規則三種形式與 <input accept> 一致：.pdf / image/* / application/pdf
export function mimeAllowed(accept: string[], mime: string, filename: string): boolean {
  if (accept.length === 0) return true;
  const lowerName = filename.toLowerCase();
  return accept.some((a) => {
    const rule = a.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return lowerName.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

// 上傳 API 的狀態碼 → 給填寫者看的話。「請再試一次」只留給真的不明原因——
// 其餘每一種重試都沒用，要講清楚該做什麼。
const UPLOAD_ERRORS: Record<number, string> = {
  401: "登入已過期，重新整理頁面後再試",
  404: "這份問卷目前不收檔案（已暫停收件）",
  413: "檔案太大",
  415: "不接受這種檔案類型",
  429: "你在這份問卷的上傳次數已達上限",
};

export function describeUploadError(status: number): string {
  return UPLOAD_ERRORS[status] ?? `上傳失敗（HTTP ${status}），請再試一次`;
}
