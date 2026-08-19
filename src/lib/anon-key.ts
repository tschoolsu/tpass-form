// 由 sub 導出、不可反解的「每人每表單」key。
// 三個地方共用同一條公式：Response.anonHash（匿名問卷防重複）、ResponseDraft.ownerKey
// （草稿擁有者）、以及「這個人填過了嗎」的查詢。抽成獨立模組是為了讓 forms 與
// response-draft 都能用它而不互相 import（會形成循環）。
import "server-only";
import { createHash } from "node:crypto";
import { authConfig } from "@/config/auth";

export function anonKeyFor(sub: string, formId: string): string {
  return createHash("sha256")
    .update(`${sub}:${formId}:${authConfig.anonHashSecret}`)
    .digest("hex");
}
