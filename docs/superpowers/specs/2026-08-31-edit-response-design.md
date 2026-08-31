# 送出後可修改回覆（並重新通知）— 設計

日期：2026-08-31
狀態：設計已確認，待實作

## 目的

「每人限填一次」的問卷，填過的人目前只能看到「你已經填過這份問卷了」。要讓他們能回來改自己那一筆，
改完後 webhook 再通知一次「有人更新了回覆」。行為對齊 Google 表單的「送出後可編輯」：是獨立開關，預設關。

## 範圍

- 只適用 `oneResponsePerUser: true` 的問卷——只有它們把填寫者身分（`respondentSub` 或 `anonHash`）存在回覆上，
  才有唯一的「你那一筆」可以改。可多次填的問卷不做。
- 只做通用填寫器（`FormFiller`）。quiz 皮（`QuizFiller`）的問卷設定寫在 code 裡、預設關，不受影響，也不支援。
- 編輯模式不做草稿自動儲存：中途離開＝放棄修改，正式答案完整保留。
- 不做並發控制：兩個分頁同時改，後寫的贏。

## 設定

`formSettingsSchema`（`src/lib/survey-schema.ts`）新增：

```ts
allowEditAfterSubmit: z.boolean().default(false),
```

預設 `false` → 既有問卷行為完全不變。

`SettingsPanel`：在「每人限填一次」下方加開關「送出後可修改」，說明文字「填過的人回到問卷連結可以改自己的回覆，改完會再通知一次」。
只在 `oneResponsePerUser` 為 `true` 時可操作；把「每人限填一次」關掉時，同一個 `set()` 一併把 `allowEditAfterSubmit` 設回 `false`
（不留下「允許修改但沒有唯一回覆」的無效組合）。

## 資料

`Response` 新增 `editedAt DateTime?`。nullable，既有列不動；`null` = 從未修改。
不用 `@updatedAt`：它會在任何 update 時動，語意不是「填寫者改過」。一支 Prisma migration。

## 填寫頁（`src/app/f/[slug]/page.tsx`）

現在 `hasSubmitted(form, session.sub)` 成立就回 Notice。改成：

1. `hasSubmitted` 成立、且 `form.settings.allowEditAfterSubmit`、且問卷仍在收件（`status === "published" && acceptingResponses`，這條件在更前面已擋過）、且不是 quiz 皮
   → 用同一把 key 讀出該筆回覆（新 helper `findOwnResponse(form, sub)`，key 組法與 `hasSubmitted` 共用同一個函式，避免兩處各寫一次），
   以 `mode="edit"` 渲染 `FormFiller`：`initialAnswers = response.answers`、`initialHistory = null`（從第一段開始走）、
   `editingSubmittedAt = response.submittedAt`、`draftSavedAt = null`。
2. 其他情況維持現在的「你已經填過這份問卷了」Notice。

`hasSubmitted` 改成建立在 `findOwnResponse` 之上（或兩者共用 `ownResponseWhere(form, sub)`），只保留一種 key 組法。

## FormFiller（`src/components/fill/FormFiller.tsx`）

新增 props：`mode?: "new" | "edit"`（預設 `"new"`）、`editingSubmittedAt?: string | null`。

編輯模式差異，全部集中在這幾個點，不複製元件：

- 抬頭卡下方多一條說明列（沿用「已還原你上次的填寫進度」那條的樣式）：「你正在修改 {日期時間} 送出的回覆，按「更新回覆」才會生效」。
- 不掛 `useDraftAutosave`（hook 需無條件呼叫：改為傳入 `enabled: mode === "new"`，內部不動作），`DraftBar` 不渲染。
- 最後一頁按鈕文字：「更新回覆」（送出中：「更新中…」）。
- 完成畫面：「已更新，謝謝你！」＋「你的修改已經收到。」

送出仍呼叫同一個 `submitFormAction(slug, answers)`；client 不告訴 server 這是新增還是更新——由 server 依既有回覆決定（見下）。

## 送出（`src/app/f/[slug]/actions.ts`）

`submitFormAction` 在驗證答案之後：

1. 若 `oneResponsePerUser`，用 `ownResponseWhere(form, session.sub)` 查既有回覆。
2. 有既有回覆：
   - `allowEditAfterSubmit` 為 `false` → 回 `{ ok: false, message: "你已經填過這份問卷了。" }`（與現況相同；DB unique 約束仍是最後防線）。
   - 為 `true` → `prisma.response.update({ where: { id }, data: { answers, editedAt: now } })`。身分戳記欄位不重寫（保留首次送出時的值）。
     附件回收：`collectUploadIds(舊 answers)` 減 `collectUploadIds(新 answers)` 的差集，沿用 `deleteResponse` 裡的刪法（Upload row + 儲存體物件）。差集抽成純函式 `removedUploadIds(before, after)` 並加測試。
3. 沒有既有回覆：維持現在的 `create` 路徑。
4. `deleteDraft` 只在 `create` 路徑呼叫（編輯模式沒有草稿）。
5. 通知：兩條路徑都走 `after(() => notifyResponse(webhookIds, notice))`，`notice.kind` 分別為 `"new"` / `"updated"`，`submittedAt` 帶當下時間（更新時即 `editedAt`）。

## 通知（`src/lib/webhook-format.ts`、`src/lib/webhooks.ts`）

`ResponseNotice` 新增 `kind: "new" | "updated"`。`buildPayload`：

| | new（現況） | updated |
| --- | --- | --- |
| Google Chat 第一行 | `📥 *{formTitle}* 有新回覆` | `✏️ *{formTitle}* 有人更新了回覆` |
| Discord embed title | `問卷有新回覆` | `問卷回覆已更新` |

其餘欄位（填寫者、時間、後台連結、「連答案一起送」才附答案）完全相同。
`notifyNewResponse` 改名 `notifyResponse`（唯一呼叫端就是 actions.ts）。

## 後台

`SingleResponse.tsx` 在送出時間旁顯示「· 更新於 {editedAt}」，只在 `editedAt` 有值時。`listResponses` / `ResponseRecord` 帶出 `editedAt`。
清單排序維持 `submittedAt desc`，CSV 匯出不動。

## 測試

- `webhook-format.test.ts`：`kind: "updated"` 兩家各一條，確認標題換了、其餘欄位不變。
- 新 `removedUploadIds` 純函式測試：新增、移除、不變、檔案題被刪掉整題。
- 既有測試全綠；`pnpm lint` / `pnpm exec tsc --noEmit`。
- 手動：開一份限一次＋允許修改的問卷，填一次 → 回到連結看到預填與提示 → 改答案並移除一個附件 → 更新 → webhook 收到「更新了回覆」、後台看到「更新於」、被移除的附件在 `data/uploads` 消失；把「送出後可修改」關掉 → 回到連結看到「你已經填過了」。

## 不做

- 編輯模式的草稿自動儲存。
- quiz 皮支援。
- 樂觀鎖。
- 通知只列差異（採同一式模板換標題）。
- 管理員在後台代改回覆。
