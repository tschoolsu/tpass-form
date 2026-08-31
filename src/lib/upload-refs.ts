// 從答案裡抓檔案題的 upload id。純函式、無 server-only，好測；forms.ts / response-draft.ts /
// 填寫端 action 共用同一份，不各自掃一次 answers。
import type { UploadedFile } from "@/components/fill/QuestionRenderer";

/** 掃出所有檔案題的 upload id（值形狀 = UploadedFile[]）。 */
export function collectUploadIds(answers: unknown): string[] {
  const ids: string[] = [];
  for (const value of Object.values((answers as Record<string, unknown>) ?? {})) {
    if (!Array.isArray(value)) continue;
    for (const f of value as UploadedFile[]) {
      if (f && typeof f.id === "string") ids.push(f.id);
    }
  }
  return ids;
}

/** 修改回覆時：舊答案引用、新答案不再引用的 upload id（要回收的孤兒附件）。 */
export function removedUploadIds(before: unknown, after: unknown): string[] {
  const keep = new Set(collectUploadIds(after));
  return collectUploadIds(before).filter((id) => !keep.has(id));
}
