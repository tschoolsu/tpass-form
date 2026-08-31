"use server";

// 填寫端的 server actions（送出 / 草稿）。身分一律由伺服器從驗章後的 session 戳記，
// client 傳的身分與草稿擁有者一概不信。
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/guard";
import { authConfig } from "@/config/auth";
import { notifyResponse } from "@/lib/webhooks";
import { answerToText, questionBlocks } from "@/lib/answer-format";
import { anonKeyFor } from "@/lib/anon-key";
import { prisma } from "@/lib/db";
import { findOwnResponse, deleteUploads, getPublicForm } from "@/lib/forms";
import { removedUploadIds } from "@/lib/upload-refs";
import { validateAnswers, type AnswerMap } from "@/lib/answers";
import { deriveGrade } from "@/lib/grade";
import {
  deleteDraft,
  discardDraft,
  sanitizeDraft,
  upsertDraft,
  type DraftPayload,
} from "@/lib/response-draft";

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  updated?: boolean; // true = 這次是修改既有回覆
}

export async function submitFormAction(
  slug: string,
  answers: AnswerMap,
): Promise<SubmitResult> {
  const session = await requireSession(`/f/${slug}`);
  const form = await getPublicForm(slug);

  if (!form || form.status !== "published" || !form.settings.acceptingResponses) {
    return { ok: false, message: "這份問卷目前沒有開放填寫。" };
  }

  const fieldErrors = validateAnswers(form.definition, answers);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, errors: fieldErrors, message: "有題目尚未完成。" };
  }

  const { anonymous, identityFields, oneResponsePerUser } = form.settings;

  // 身分戳記（只在非匿名時，且只記設計者勾選的欄位）。
  const stamp = {
    respondentSub: null as string | null,
    anonHash: null as string | null,
    respondentName: null as string | null,
    respondentEmail: null as string | null,
    respondentGrade: null as number | null,
  };

  if (!anonymous) {
    if (identityFields.includes("name")) stamp.respondentName = session.name;
    if (identityFields.includes("email")) stamp.respondentEmail = session.email;
    if (identityFields.includes("grade")) stamp.respondentGrade = deriveGrade(session);
  }

  // 防重複 key（與身分顯示分離）：
  if (oneResponsePerUser) {
    if (anonymous) {
      // secret 在 config REQUIRED 裡強制存在（M1：空 secret 會讓匿名雜湊可被反解）。
      stamp.anonHash = anonKeyFor(session.sub, form.id);
    } else {
      stamp.respondentSub = session.sub;
    }
  }

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
    // 不再被引用的附件回收；best-effort——回覆已落地，回收失敗頂多留孤兒檔，不能讓使用者看到「送出失敗」。
    try {
      await deleteUploads(form.id, removedUploadIds(existing.answers, answers));
    } catch (e) {
      console.error("[submit] 回收附件失敗", e);
    }
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

  // 通知排在回應之後（after）：webhook 最多要等 10 秒，填寫者不該替它站崗；
  // 而且通知失敗絕不能讓「已經存進 DB 的回覆」看起來像送出失敗。
  const { webhookIds, webhookIncludeAnswers } = form.settings;
  if (webhookIds.length > 0) {
    // 「連答案一起送」是這份問卷的人自己在設定面板勾的（預設關）。沒勾就只帶關鍵資訊。
    const answerLines = webhookIncludeAnswers
      ? questionBlocks(form.definition.blocks).map((q) => ({
          title: q.title,
          text: answerToText(q, answers[q.id]),
        }))
      : undefined;

    after(async () => {
      await notifyResponse(webhookIds, {
        formTitle: form.title,
        responsesUrl: `${authConfig.selfUrl}/admin/forms/${form.id}/responses`,
        // 匿名或沒收姓名 → null，通知只說「有人填了」。
        respondent: stamp.respondentName ?? stamp.respondentEmail,
        submittedAt: now,
        kind: updated ? "updated" : "new",
        answers: answerLines,
      });
    });
  }

  return { ok: true, updated };
}

export interface DraftResult {
  ok: boolean;
  savedAt?: string;
  message?: string;
}

// 自動儲存填寫進度。不驗 answers（草稿允許不完整），但只收 definition 裡真的存在的
// 題目，並限制大小——server action 可被直接 POST，這裡是唯一的把關點。
export async function saveDraftAction(
  slug: string,
  payload: DraftPayload,
): Promise<DraftResult> {
  const session = await requireSession(`/f/${slug}`);
  const form = await getPublicForm(slug);
  if (!form || form.status !== "published" || !form.settings.acceptingResponses) {
    return { ok: false, message: "這份問卷目前沒有開放填寫。" };
  }

  const clean = sanitizeDraft(form.definition, payload);
  if (!clean) return { ok: false, message: "內容過大，無法儲存草稿。" };

  // 一題都沒答 → 不留草稿（光是翻頁就生一列是雜訊，也會誤觸「已還原進度」提示）。
  if (Object.keys(clean.answers).length === 0) {
    await deleteDraft(form.id, session.sub);
    return { ok: true };
  }

  const savedAt = await upsertDraft(form.id, session.sub, clean);
  return { ok: true, savedAt: savedAt.toISOString() };
}

// 使用者主動放棄草稿（連同草稿裡上傳的附件一起回收）。
export async function discardDraftAction(slug: string): Promise<DraftResult> {
  const session = await requireSession(`/f/${slug}`);
  const form = await getPublicForm(slug);
  if (!form) return { ok: false, message: "找不到這份問卷。" };

  await discardDraft(form.id, session.sub);
  return { ok: true };
}
