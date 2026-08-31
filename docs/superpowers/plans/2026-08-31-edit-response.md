# 送出後可修改回覆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「每人限填一次」且開了「送出後可修改」的問卷，填過的人回到 `/f/<slug>` 可以改自己那一筆並重新送出，webhook 再通知一次「更新了回覆」。

**Architecture:** 同一個 `FormFiller` 加 `mode="edit"` 預填舊答案；`submitFormAction` 不分兩支，用既有的防重複 key（`respondentSub` / `anonHash`）查有沒有既有回覆決定 `create` 或 `update`；`ResponseNotice` 多一個 `kind` 換通知標題。`Response` 加 nullable `editedAt`。

**Tech Stack:** Next 16.3 App Router（server actions、`after()`）、Prisma 6 + PostgreSQL、zod 3、vitest 4、tpass-ui。

## Global Constraints

- 一律 `pnpm`；驗證指令：`pnpm test`、`pnpm lint`、`pnpm exec tsc --noEmit`（都會結束）。
- 不要在前景跑 `pnpm dev`。
- 設定新欄位預設 `false`，既有問卷行為不得改變。
- `Response.editedAt` 必須 nullable（既有列不動）；不用 `@updatedAt`。
- 通知文案：Google Chat `✏️ *{formTitle}* 有人更新了回覆`；Discord embed title `問卷回覆已更新`。其餘欄位與新回覆完全相同。
- UI 文案：說明列「你正在修改 {時間} 送出的回覆，按「更新回覆」才會生效」；按鈕「更新回覆」/「更新中…」；完成「已更新，謝謝你！」/「你的修改已經收到。」；後台「· 更新於 {時間}」。
- 編輯模式不啟用草稿自動儲存；quiz 皮不支援（走既有 Notice）。
- commit 訊息繁體中文，結尾附 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 工作目錄：`/Users/yushunchen/.z/pr/tpass/tpass-form`（獨立 git repo）。

## File Structure

| 檔案 | 責任 |
| --- | --- |
| `src/lib/survey-schema.ts` | 設定欄位 `allowEditAfterSubmit` |
| `src/components/builder/SettingsPanel.tsx` | 開關 UI，與 `oneResponsePerUser` 連動 |
| `prisma/schema.prisma` + `prisma/migrations/<ts>_response_edited_at/migration.sql` | `Response.editedAt` |
| `src/lib/response-stats.ts` / `src/lib/forms.ts` / `src/components/responses/SingleResponse.tsx` | 帶出並顯示 `editedAt` |
| `src/lib/upload-refs.ts`（新，純函式）+ `.test.ts` | `collectUploadIds`（從 forms.ts 搬來）、`removedUploadIds` |
| `src/lib/forms.ts` | `ownResponseWhere`、`findOwnResponse`、`hasSubmitted` 改建其上、`deleteUploads` 抽出 |
| `src/lib/webhook-format.ts` + `.test.ts` / `src/lib/webhooks.ts` + `.test.ts` / `src/app/admin/webhooks/actions.ts` | `kind`、改名 `notifyResponse` |
| `src/app/f/[slug]/actions.ts` | create / update 分支、附件回收、通知 kind |
| `src/components/fill/useDraftAutosave.ts` | `enabled` 參數 |
| `src/components/fill/FormFiller.tsx` | `mode="edit"` |
| `src/app/f/[slug]/page.tsx` | 填過且可修改 → 編輯模式 |

---

### Task 1: 設定欄位與建構端開關

**Files:**
- Modify: `src/lib/survey-schema.ts:159-177`（`formSettingsSchema`）
- Modify: `src/components/builder/SettingsPanel.tsx:125-139`（「每人限填一次」區塊）

**Interfaces:**
- Produces: `FormSettings.allowEditAfterSubmit: boolean`（zod default `false`）。

- [ ] **Step 1: 加 schema 欄位**

在 `formSettingsSchema` 的 `oneResponsePerUser: z.boolean().default(false),` 下一行加：

```ts
  // 填過的人可以回來改自己那一筆（只在 oneResponsePerUser 時有意義；建構端會連動關掉）。
  allowEditAfterSubmit: z.boolean().default(false),
```

- [ ] **Step 2: 開關 UI**

把 SettingsPanel 的「防重複」區塊改成（整段取代 `{/* 防重複 */}` 到它的 `</div>`）：

```tsx
      {/* 防重複 */}
      <div className="flex items-start justify-between gap-3 border-t-2 border-dashed border-foreground/15 pt-4">
        <div>
          <Label>每人限填一次</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            匿名時以不可逆雜湊防重複，仍不洩漏身分。
          </p>
        </div>
        <Switch
          checked={settings.oneResponsePerUser}
          // 關掉限一次就沒有「唯一的那一筆」可改，允許修改一併關掉，不留無效組合。
          onChange={(v) =>
            set(v ? { oneResponsePerUser: true } : { oneResponsePerUser: false, allowEditAfterSubmit: false })
          }
          label="每人限填一次"
        />
      </div>

      {/* 送出後可修改：只在限一次時可操作 */}
      <div
        className={cn(
          "flex items-start justify-between gap-3 pt-3",
          !settings.oneResponsePerUser && "opacity-50",
        )}
      >
        <div>
          <Label>送出後可修改</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            填過的人回到問卷連結可以改自己的回覆，改完會再通知一次。需先開「每人限填一次」。
          </p>
        </div>
        <Switch
          checked={settings.allowEditAfterSubmit}
          disabled={!settings.oneResponsePerUser}
          onChange={(v) => set({ allowEditAfterSubmit: v })}
          label="送出後可修改"
        />
      </div>
```

若 `tpass-ui` 的 `Switch` 沒有 `disabled` prop（先 `grep -n "disabled" node_modules/tpass-ui/src/primitives.tsx`），改成 `onChange={(v) => settings.oneResponsePerUser && set({ allowEditAfterSubmit: v })}` 並保留 `opacity-50`。

- [ ] **Step 3: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 全部通過（既有 75 條）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/survey-schema.ts src/components/builder/SettingsPanel.tsx
git commit -m "feat(form): 問卷設定「送出後可修改」（預設關，需先開每人限填一次）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `Response.editedAt` 與後台顯示

**Files:**
- Modify: `prisma/schema.prisma`（`model Response`）
- Create: `prisma/migrations/20260831120000_response_edited_at/migration.sql`
- Modify: `src/lib/response-stats.ts:8-15`（`ResponseRecord`）
- Modify: `src/lib/forms.ts:204-218`（`listResponses`）
- Modify: `src/components/responses/SingleResponse.tsx:18-21`

**Interfaces:**
- Produces: `Response.editedAt: DateTime?`；`ResponseRecord.editedAt: Date | null`。

- [ ] **Step 1: schema**

在 `model Response` 的 `submittedAt DateTime @default(now())` 下加：

```prisma
  editedAt        DateTime? // 填寫者事後修改過 → 最後修改時間；null = 沒改過
```

- [ ] **Step 2: migration（手寫，不跑 `migrate dev` 免得碰本機 DB 狀態）**

```sql
-- AlterTable
ALTER TABLE "Response" ADD COLUMN "editedAt" TIMESTAMP(3);
```

然後 `pnpm exec prisma generate`。本機 DB 套用：`pnpm exec prisma migrate deploy`（正式站由 deploy.sh 的 `migrate deploy` 套）。

- [ ] **Step 3: 型別與查詢**

`ResponseRecord` 加 `editedAt: Date | null;`（放在 `submittedAt` 下）。`listResponses` 的 map 加 `editedAt: r.editedAt,`。

- [ ] **Step 4: 單筆檢視**

`SingleResponse.tsx` 的時間 span 改成：

```tsx
        <span className="font-mono text-[11px] text-muted-foreground">
          {response.submittedAt.toLocaleString("zh-TW")}
          {response.editedAt && ` · 更新於 ${response.editedAt.toLocaleString("zh-TW")}`}
        </span>
```

- [ ] **Step 5: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 通過。若 tsc 在其他地方建構 `ResponseRecord` 物件（`grep -rn "submittedAt:" src --include="*.ts" --include="*.tsx"`）報缺欄位，補 `editedAt: null`。

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/response-stats.ts src/lib/forms.ts src/components/responses/SingleResponse.tsx
git commit -m "feat(form): Response.editedAt，後台單筆顯示更新時間

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 附件引用純函式 `upload-refs.ts`

**Files:**
- Create: `src/lib/upload-refs.ts`
- Create: `src/lib/upload-refs.test.ts`
- Modify: `src/lib/forms.ts:257-268`（刪掉 `collectUploadIds`，改 import）
- Modify: `src/lib/response-draft.ts:8`（import 路徑）

**Interfaces:**
- Produces: `collectUploadIds(answers: unknown): string[]`；`removedUploadIds(before: unknown, after: unknown): string[]`。

- [ ] **Step 1: 失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { collectUploadIds, removedUploadIds } from "./upload-refs";

const f = (id: string) => ({ id, name: `${id}.pdf` });

describe("collectUploadIds", () => {
  it("只撿檔案題（UploadedFile[]）的 id，其餘題型略過", () => {
    expect(collectUploadIds({ q1: [f("a"), f("b")], q2: "文字", q3: ["opt1"], q4: null })).toEqual([
      "a",
      "b",
    ]);
    expect(collectUploadIds(undefined)).toEqual([]);
  });
});

describe("removedUploadIds", () => {
  it("回傳舊答案有、新答案沒有的 upload id", () => {
    expect(removedUploadIds({ q1: [f("a"), f("b")] }, { q1: [f("b")] })).toEqual(["a"]);
  });
  it("新增或不變都不算移除", () => {
    expect(removedUploadIds({ q1: [f("a")] }, { q1: [f("a"), f("c")] })).toEqual([]);
  });
  it("整題被刪掉 → 該題所有附件都算移除", () => {
    expect(removedUploadIds({ q1: [f("a")], q2: [f("x")] }, { q1: [f("a")] })).toEqual(["x"]);
  });
});
```

- [ ] **Step 2: 跑，確認紅**

Run: `pnpm test -- upload-refs`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 實作**

```ts
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
```

forms.ts：刪掉自己的 `collectUploadIds` 定義（含上方註解），在 import 區加 `import { collectUploadIds } from "@/lib/upload-refs";`，並把 `import type { UploadedFile } ...` 這行刪掉（若沒有其他使用）。response-draft.ts 的 import 改成 `from "@/lib/upload-refs"`。

- [ ] **Step 4: 跑，確認綠**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint`
Expected: 通過（新增 4 條）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload-refs.ts src/lib/upload-refs.test.ts src/lib/forms.ts src/lib/response-draft.ts
git commit -m "refactor(form): 附件引用掃描抽成純函式，加 removedUploadIds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `forms.ts`：找自己的回覆、抽出附件刪除

**Files:**
- Modify: `src/lib/forms.ts:193-201`（`hasSubmitted`）、`:224-256`（`deleteResponse`）

**Interfaces:**
- Produces:
  - `ownResponseWhere(form: FormView, sub: string): { formId: string; anonHash: string } | { formId: string; respondentSub: string }`
  - `findOwnResponse(form: FormView, sub: string): Promise<{ id: string; answers: unknown; submittedAt: Date } | null>`（`oneResponsePerUser` 為 false 一律 `null`）
  - `hasSubmitted(form, sub)` 行為不變。
  - `deleteUploads(formId: string, uploadIds: string[]): Promise<void>`（刪 Upload row + 儲存體，best-effort）。

- [ ] **Step 1: 把 `hasSubmitted` 改成建立在同一把 key 上**

取代原本的 `hasSubmitted`：

```ts
// 「自己那一筆」的查詢 key。與 submitFormAction 寫進去的那一份完全一致
// （匿名→anonHash、具名→respondentSub），所以這裡跟 DB unique 約束永遠同步。
export function ownResponseWhere(form: FormView, sub: string) {
  return form.settings.anonymous
    ? { formId: form.id, anonHash: anonKeyFor(sub, form.id) }
    : { formId: form.id, respondentSub: sub };
}

// 這個人對這份問卷送出過的那一筆。只在 oneResponsePerUser 時有意義，否則一律 null。
export async function findOwnResponse(form: FormView, sub: string) {
  if (!form.settings.oneResponsePerUser) return null;
  return prisma.response.findFirst({
    where: ownResponseWhere(form, sub),
    select: { id: true, answers: true, submittedAt: true },
  });
}

// 這個人已經對這份問卷送出過了嗎？把攔截點從「送出那一刻」提前到「進場前」，不是另一套規則。
export async function hasSubmitted(form: FormView, sub: string): Promise<boolean> {
  return (await findOwnResponse(form, sub)) !== null;
}
```

- [ ] **Step 2: 從 `deleteResponse` 抽出 `deleteUploads`**

`deleteResponse` 改成：

```ts
export async function deleteResponse(formId: string, responseId: string): Promise<void> {
  const row = await prisma.response.findFirst({
    where: { id: responseId, formId },
    select: { answers: true },
  });
  if (!row) throw new Error("not found");

  await prisma.response.delete({ where: { id: responseId } });
  await deleteUploads(formId, collectUploadIds(row.answers));
}

// 刪一批附件（Upload row + 儲存體物件）。formId 一起帶入 where，擋「拿 A 表單的權限刪 B 表單的檔」。
// 儲存體是 best-effort：刪不掉只留孤兒檔案，不該讓已完成的 DB 交易白費。
export async function deleteUploads(formId: string, uploadIds: string[]): Promise<void> {
  if (uploadIds.length === 0) return;
  const uploads = await prisma.upload.findMany({
    where: { id: { in: uploadIds }, formId },
    select: { id: true, storageKey: true },
  });
  await prisma.upload.deleteMany({ where: { id: { in: uploads.map((u) => u.id) } } });
  for (const u of uploads) {
    try {
      await deleteObject(u.storageKey);
    } catch (e) {
      console.error("[forms] deleteObject failed", u.storageKey, e);
    }
  }
}
```

（原本 response.delete 與 upload.deleteMany 包在同一個 `$transaction`；拆開後 response 先刪、upload 後刪，失敗最壞是留孤兒 Upload row，可接受。）

- [ ] **Step 3: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 通過。

- [ ] **Step 4: Commit**

```bash
git add src/lib/forms.ts
git commit -m "refactor(form): findOwnResponse 與 deleteUploads，hasSubmitted 建於其上

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 通知加 `kind`，`notifyNewResponse` → `notifyResponse`

**Files:**
- Modify: `src/lib/webhook-format.ts:68-76`（`ResponseNotice`）、`:108-137`（`buildPayload`）
- Modify: `src/lib/webhook-format.test.ts:49-55`（notice 常數）+ 新測試
- Modify: `src/lib/webhooks.ts:49`、`src/lib/webhooks.test.ts`、`src/app/admin/webhooks/actions.ts:8,56,66`、`src/app/f/[slug]/actions.ts:9,104`

**Interfaces:**
- Produces: `ResponseNotice.kind: "new" | "updated"`；`notifyResponse(webhookIds, notice)`（簽名同原 `notifyNewResponse`）。

- [ ] **Step 1: 失敗測試**

`webhook-format.test.ts` 的 `describe("buildPayload")` 裡，`notice` 常數加 `kind: "new" as const,`；並加：

```ts
  it("更新回覆：兩家都換成「更新」標題，其餘欄位不變", () => {
    const updated = { ...notice, kind: "updated" as const };
    const gc = JSON.stringify(buildPayload("google_chat", updated));
    expect(gc).toContain("有人更新了回覆");
    expect(gc).not.toContain("有新回覆");
    expect(gc).toContain("某同學");
    expect(gc).toContain("admin/forms/f1/responses");

    const dc = buildPayload("discord", updated) as { embeds: Array<{ title: string; description: string }> };
    expect(dc.embeds[0].title).toBe("問卷回覆已更新");
    expect(dc.embeds[0].description).toContain("某同學");
  });
```

`webhooks.test.ts` 裡的 `NOTICE` 常數同樣加 `kind: "new" as const`（先 `grep -n "NOTICE" src/lib/webhooks.test.ts` 找定義）。

- [ ] **Step 2: 跑，確認紅**

Run: `pnpm test -- webhook`
Expected: tsc 型別錯（`kind` 不在型別上）或斷言失敗。

- [ ] **Step 3: 實作**

`ResponseNotice` 加：

```ts
  // new = 第一次送出；updated = 填寫者事後修改（問卷開了「送出後可修改」）。
  kind: "new" | "updated";
```

`buildPayload` 的兩處標題改成：

```ts
  const headline =
    n.kind === "updated" ? `✏️ *${n.formTitle}* 有人更新了回覆` : `📥 *${n.formTitle}* 有新回覆`;
  // …google_chat 的 text 第一行用 headline
  // …discord 的 title：
  title: n.kind === "updated" ? "問卷回覆已更新" : "問卷有新回覆",
```

改名：

```bash
grep -rl "notifyNewResponse" src | xargs sed -i '' 's/notifyNewResponse/notifyResponse/g'
```

`src/app/admin/webhooks/actions.ts` 測試發送的 notice 物件加 `kind: "new",`；`src/app/f/[slug]/actions.ts` 的呼叫暫時加 `kind: "new",`（Task 6 會改成依分支）。

- [ ] **Step 4: 跑，確認綠**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint`
Expected: 通過。

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhook-format.ts src/lib/webhook-format.test.ts src/lib/webhooks.ts src/lib/webhooks.test.ts src/app/admin/webhooks/actions.ts "src/app/f/[slug]/actions.ts"
git commit -m "feat(form): 通知區分新回覆／更新回覆，notifyNewResponse 改名 notifyResponse

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `submitFormAction` 的 create / update 分支

**Files:**
- Modify: `src/app/f/[slug]/actions.ts:34-118`

**Interfaces:**
- Consumes: `findOwnResponse`、`deleteUploads`（Task 4）、`removedUploadIds`（Task 3）、`notifyResponse` + `kind`（Task 5）。
- Produces: `submitFormAction(slug, answers): Promise<SubmitResult>` 簽名不變；`SubmitResult` 加 `updated?: boolean`。

- [ ] **Step 1: 改 imports**

```ts
import { findOwnResponse, deleteUploads, getPublicForm } from "@/lib/forms";
import { removedUploadIds } from "@/lib/upload-refs";
import { notifyResponse } from "@/lib/webhooks";
```

`SubmitResult` 加 `updated?: boolean; // true = 這次是修改既有回覆`。

- [ ] **Step 2: 把 stamp 之後到通知之前整段換掉**

從 `try { await prisma.response.create(` 到 `await deleteDraft(form.id, session.sub);` 整段替換為：

```ts
  const now = new Date();
  const existing = await findOwnResponse(form, session.sub);
  let updated = false;

  if (existing) {
    if (!form.settings.allowEditAfterSubmit) {
      return { ok: false, message: "你已經填過這份問卷了。" };
    }
    // 修改既有回覆：身分戳記維持首次送出的值，只換答案、記下修改時間。
    await prisma.response.update({
      where: { id: existing.id },
      data: { answers: answers as Prisma.InputJsonValue, editedAt: now },
    });
    // 不再被引用的附件回收，別留孤兒檔。
    await deleteUploads(form.id, removedUploadIds(existing.answers, answers));
    updated = true;
  } else {
    try {
      await prisma.response.create({
        data: {
          formId: form.id,
          answers: answers as Prisma.InputJsonValue,
          ...stamp,
        },
      });
    } catch (e) {
      // 併發下 findOwnResponse 撲空但 unique 約束撞到 → 仍是最後防線。
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, message: "你已經填過這份問卷了。" };
      }
      throw e;
    }
    // 回覆已落地，草稿功成身退（附件已屬於這筆回覆，不能跟著刪）。編輯模式沒有草稿。
    await deleteDraft(form.id, session.sub);
  }
```

- [ ] **Step 3: 通知帶 kind，回傳帶 updated**

`after(...)` 裡的 `notifyNewResponse(` 已於 Task 5 改名；把 `submittedAt: new Date(),` 改為 `submittedAt: now,`，並加 `kind: updated ? "updated" : "new",`。最後 `return { ok: true };` 改 `return { ok: true, updated };`。

- [ ] **Step 4: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 通過。

- [ ] **Step 5: Commit**

```bash
git add "src/app/f/[slug]/actions.ts"
git commit -m "feat(form): 送出時若已有回覆且問卷允許修改 → 更新並回收孤兒附件，通知 kind=updated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: FormFiller 編輯模式（含 `useDraftAutosave` 的 `enabled`）

**Files:**
- Modify: `src/components/fill/useDraftAutosave.ts:25-30,62-75`
- Modify: `src/components/fill/FormFiller.tsx:22-36`（Props）、`:38-50`（參數）、`:78`（hook）、`:136-146`（完成畫面）、`:172-176`（已還原提示旁）、`:237-242`（DraftBar）、`:254-269`（按鈕）

**Interfaces:**
- Consumes: `SubmitResult.updated`（Task 6）。
- Produces: `useDraftAutosave(slug, answers, history, draftSavedAt, enabled = true)`；`FormFiller` props `mode?: "new" | "edit"`、`editingSubmittedAt?: string | null`。

- [ ] **Step 1: hook 加 `enabled`**

簽名加第五個參數 `enabled: boolean = true`。在 debounce 的 `useEffect` 裡，`if (doneRef.current) return;` 之後加 `if (!enabled) return;`；`flush` 開頭 `if (doneRef.current) return;` 改為 `if (doneRef.current || !enabled) return;`，並把 `enabled` 加進 `flush` 的依賴陣列。`QuizFiller.tsx:84` 不用改（預設 true）。

- [ ] **Step 2: FormFiller props**

`Props` 加：

```ts
  // edit = 正在修改已送出的回覆：預填舊答案、不存草稿、按鈕與完成文案不同。
  mode?: "new" | "edit";
  // 編輯模式下，原回覆的送出時間（ISO），顯示在說明列。
  editingSubmittedAt?: string | null;
```

解構加 `mode = "new", editingSubmittedAt = null,`；hook 呼叫改 `useDraftAutosave(slug, answers, history, draftSavedAt, mode === "new")`；加 `const editing = mode === "edit";`。

- [ ] **Step 3: 完成畫面**

```tsx
        <h2 className="mt-4 font-extrabold text-2xl">
          {editing ? "已更新，謝謝你！" : "已送出，謝謝你！"}
        </h2>
        <p className="mt-2 font-medium text-muted-foreground">
          {editing ? "你的修改已經收到。" : "你的回覆已經收到。"}
        </p>
```

- [ ] **Step 4: 說明列**

在 `{draft.restored && (...)}` 之前加：

```tsx
      {editing && (
        <p className="rounded-xl border-2 border-foreground bg-tone-orange-badge px-3 py-2 font-mono text-[11px] font-bold">
          你正在修改{" "}
          {editingSubmittedAt ? new Date(editingSubmittedAt).toLocaleString("zh-TW") : "先前"}
          {" "}送出的回覆，按「更新回覆」才會生效
        </p>
      )}
```

- [ ] **Step 5: DraftBar 只在新填時出現**

`<DraftBar ... />` 包成 `{!editing && (<DraftBar ... />)}`。

- [ ] **Step 6: 按鈕文案**

最後一頁的按鈕內容改成：

```tsx
              <Send className="h-4 w-4" />{" "}
              {submitting ? (editing ? "更新中…" : "送出中…") : editing ? "更新回覆" : "送出"}
```

- [ ] **Step 7: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 通過。

- [ ] **Step 8: Commit**

```bash
git add src/components/fill/useDraftAutosave.ts src/components/fill/FormFiller.tsx
git commit -m "feat(form): FormFiller 編輯模式——預填、不存草稿、更新文案

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 填寫頁：填過且可修改 → 編輯模式

**Files:**
- Modify: `src/app/f/[slug]/page.tsx:7`（import）、`:99-111`（hasSubmitted 分支）

**Interfaces:**
- Consumes: `findOwnResponse`（Task 4）、`FormFiller` 的 `mode` / `editingSubmittedAt`（Task 7）。

- [ ] **Step 1: import 改用 `findOwnResponse`**

`import { getPublicForm, hasSubmitted } from "@/lib/forms";` → `import { getPublicForm, findOwnResponse } from "@/lib/forms";`。

- [ ] **Step 2: 分支**

把 `if (await hasSubmitted(form, session.sub)) { ... }` 整段換成：

```tsx
  // 只能填一次的問卷：填過的人分兩路——問卷允許修改就交出預填的填寫器（編輯模式）；
  // 否則攔在這裡。原本唯一的攔截是送出時撞 DB unique 約束，使用者得整份重填完才被擋。
  // 「填過了」是綁在**這個帳號**上的判斷，而本服務的帳號不一定是使用者以為的那個
  // （契約 v2 的 cookie 不跟著 portal 換帳號走），所以一定要把帳號印出來並給切換入口。
  const own = await findOwnResponse(form, session.sub);
  // editing 是「要拿去預填的那筆」；用物件而不是 boolean 當旗標，TS 才能在 JSX 裡縮窄型別。
  const editing =
    own !== null && form.settings.allowEditAfterSubmit && !hasQuizSkin(slug) ? own : null;
  if (own && !editing) {
    return (
      <Shell isLoggedIn admin={admin} userEmail={session.email}>
        <IdentityBar email={session.email} returnPath={`/f/${slug}`} />
        <Notice
          title="你已經填過這份問卷了"
          body={`這份問卷每個帳號只能填寫一次。目前登入的是 ${session.email}。`}
        />
      </Shell>
    );
  }
```

接著在通用 `FormFiller` 的 JSX（最後那個 return）加 props：

```tsx
        mode={editing ? "edit" : "new"}
        editingSubmittedAt={editing?.submittedAt.toISOString() ?? null}
        initialAnswers={editing ? (editing.answers as AnswerMap) : (draft?.answers ?? null)}
        initialHistory={editing ? null : (draft?.history ?? null)}
        draftSavedAt={editing ? null : (draft?.updatedAt.toISOString() ?? null)}
```

（原本的 `initialAnswers` / `initialHistory` / `draftSavedAt` 三行刪掉。）加 `import type { AnswerMap } from "@/lib/answers";`。`getDraft` 可以維持原樣呼叫（編輯模式不會用到它的結果）。

- [ ] **Step 3: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`
Expected: 全綠、build 成功。

- [ ] **Step 4: Commit**

```bash
git add "src/app/f/[slug]/page.tsx"
git commit -m "feat(form): 填過且問卷允許修改 → 以編輯模式進入填寫器

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 手動驗證、出貨

**Files:** 無新檔。

- [ ] **Step 1: 本機端到端**

`pnpm dev`（背景），以管理員登入建一份問卷：一題短答、一題檔案上傳；設定開「每人限填一次」＋「送出後可修改」＋選一個 webhook；發布。
1. 填一次並上傳一個檔 → 送出 → webhook 收到「有新回覆」。
2. 回到 `/f/<slug>` → 看到橘色說明列與預填答案、沒有草稿列、按鈕是「更新回覆」。
3. 改短答、移除檔案 → 更新 → 完成畫面「已更新」；webhook 收到「有人更新了回覆」；後台單筆看到「· 更新於」；`data/uploads/` 該檔消失、`Upload` 表該列消失。
4. 後台把「送出後可修改」關掉 → 回到連結看到「你已經填過這份問卷了」。
5. 把「每人限填一次」關掉 → 「送出後可修改」自動關且變灰。
關掉 dev server。

- [ ] **Step 2: 推 main、部署**

```bash
git push origin main
gh workflow run deploy -R tschoolsu/tpass-ops -f service=form
gh run watch <run-id> -R tschoolsu/tpass-ops --exit-status
```

deploy.sh 會跑 `prisma migrate deploy` 套上 `editedAt`。部署後 `scripts/ssh.sh 'cd /home/service/tpass-form && set -a && . ./.env.local && set +a && psql "$DATABASE_URL" -c "\d \"Response\""'` 確認欄位存在。
