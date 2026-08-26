// 說明欄插圖的「引用關係」計算（純函式、isomorphic，不碰 DB 也不碰儲存體）。
// 抽出來的理由：GC 是「刪檔案」的操作，判斷邏輯錯了會靜默刪掉別人的圖，
// 必須能單獨測，不能埋在 route handler 裡靠手動點擊驗證。
import type { FormDefinition, FormSettings } from "@/lib/survey-schema";

// 插圖的取用網址。只有這一處組字串，換路徑不必全域搜尋。
export function assetUrl(id: string): string {
  return `/api/form-assets/${id}`;
}

// 掃出一份問卷目前引用到的所有 asset id（四處說明欄全含）。
export function collectAssetIds(
  definition: FormDefinition,
  settings: FormSettings,
): Set<string> {
  const ids = new Set<string>();
  for (const img of settings.images ?? []) ids.add(img.id);
  for (const block of definition.blocks) {
    for (const img of block.images ?? []) ids.add(img.id);
  }
  return ids;
}

export interface AssetRow {
  id: string;
  storageKey: string;
  createdAt: Date;
}

// 上傳後多久才算得上孤兒。緩衝同時擋掉兩種誤刪：
// 「剛上傳、還沒 debounce 存檔」與「編輯中暫時移掉、等下又放回去」。
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

// 從某問卷的 asset 清單挑出可以刪的：沒被引用，而且已經過了緩衝期。
// 呼叫端負責只餵入「同一份問卷」的 asset —— 跨問卷的判斷不在這裡做。
export function pickOrphans(
  assets: AssetRow[],
  referenced: Set<string>,
  now: Date,
  graceMs: number = ORPHAN_GRACE_MS,
): AssetRow[] {
  const cutoff = now.getTime() - graceMs;
  return assets.filter((a) => !referenced.has(a.id) && a.createdAt.getTime() < cutoff);
}
