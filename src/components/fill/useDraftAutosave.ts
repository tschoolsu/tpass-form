"use client";

// 填寫進度自動儲存（debounce）。通用填寫器與特效版填寫器共用這一份。
// 草稿只有本人一個寫入者，所以不像 builder 那樣需要樂觀鎖。
import * as React from "react";
import type { AnswerMap } from "@/lib/answers";
import { saveDraftAction, discardDraftAction } from "@/app/f/[slug]/actions";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

const DEBOUNCE_MS = 800;

export interface DraftAutosave {
  saveState: SaveState;
  /** 伺服器回報的最後存檔時間；沒有草稿（答案全空）時為 null。 */
  savedAt: string | null;
  /** 這次進來是不是接續了上次的草稿（使用者一動就關掉）。 */
  restored: boolean;
  /** 送出成功後呼叫：草稿已由伺服器刪掉，別再存回去。 */
  markDone: () => void;
  /** 放棄草稿（連同草稿裡的附件）。呼叫端負責 reset 自己的畫面狀態。 */
  discard: () => Promise<void>;
}

export function useDraftAutosave(
  slug: string,
  answers: AnswerMap,
  history: string[],
  draftSavedAt: string | null,
): DraftAutosave {
  const [saveState, setSaveState] = React.useState<SaveState>(
    draftSavedAt ? "saved" : "unsaved",
  );
  const [savedAt, setSavedAt] = React.useState<string | null>(draftSavedAt);
  const [restored, setRestored] = React.useState(draftSavedAt !== null);

  const stateRef = React.useRef({ answers, history });
  React.useEffect(() => {
    stateRef.current = { answers, history };
  });

  const doneRef = React.useRef(false);
  const markDone = React.useCallback(() => {
    doneRef.current = true;
  }, []);

  const flush = React.useCallback(async () => {
    if (doneRef.current) return;
    setSaveState("saving");
    try {
      const res = await saveDraftAction(slug, stateRef.current);
      if (doneRef.current) return;
      if (res.ok) {
        setSaveState("saved");
        setSavedAt(res.savedAt ?? null); // 答案全空 → 伺服器不留草稿
      } else {
        setSaveState("error");
      }
    } catch {
      if (!doneRef.current) setSaveState("error");
    }
  }, [slug]);

  const firstRender = React.useRef(true);
  const lastHistory = React.useRef(history);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      lastHistory.current = history;
      return;
    }
    if (doneRef.current) return;
    setRestored(false); // 使用者一動，「已還原」提示就功成身退
    setSaveState("unsaved");
    // 換頁是「使用者可能就此離開」的時刻，不等 debounce。
    const delay = lastHistory.current === history ? DEBOUNCE_MS : 0;
    lastHistory.current = history;
    const t = setTimeout(() => {
      void flush();
    }, delay);
    return () => clearTimeout(t);
  }, [answers, history, flush]);

  const discard = React.useCallback(async () => {
    await discardDraftAction(slug);
    setRestored(false);
    setSavedAt(null);
    setSaveState("unsaved");
  }, [slug]);

  return { saveState, savedAt, restored, markDone, discard };
}
