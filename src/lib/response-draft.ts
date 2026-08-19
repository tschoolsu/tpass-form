// 填寫進度草稿（自動儲存）的唯一資料存取層。
// 草稿只有本人一個寫入者，所以不需要像表單建構器那樣的樂觀鎖。
import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { authConfig } from "@/config/auth";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { collectUploadIds } from "@/lib/forms";
import type { AnswerMap } from "@/lib/answers";
import { type FormDefinition, START_SECTION_ID } from "@/lib/survey-schema";

// server action 可被直接 POST，草稿又不過 validateAnswers（草稿本來就允許不完整），
// 所以尺寸上限是擋「灌爆 DB」的最後一道防線。
export const MAX_DRAFT_BYTES = 256 * 1024;

// 草稿的擁有者 key：不存明文 sub，匿名問卷的草稿因此無法反查身分。
// 公式與 Response.anonHash 相同，兩處共用這一個函式。
export function draftKeyFor(sub: string, formId: string): string {
  return createHash("sha256")
    .update(`${sub}:${formId}:${authConfig.anonHashSecret}`)
    .digest("hex");
}

export interface DraftPayload {
  answers: AnswerMap;
  history: string[];
}

export interface DraftView extends DraftPayload {
  updatedAt: Date;
}

// 只留 definition 裡真的存在的 question id / section id，丟掉 client 亂塞的 key。
export function sanitizeDraft(
  def: FormDefinition,
  payload: DraftPayload,
): DraftPayload | null {
  const questionIds = new Set(
    def.blocks.filter((b) => b.kind === "question").map((b) => b.id),
  );
  const sectionIds = new Set([
    START_SECTION_ID,
    ...def.blocks.filter((b) => b.kind === "section").map((b) => b.id),
  ]);

  const answers: AnswerMap = {};
  for (const [qid, value] of Object.entries(payload.answers ?? {})) {
    if (questionIds.has(qid)) answers[qid] = value;
  }
  const history = (payload.history ?? []).filter((id) => sectionIds.has(id));

  const clean: DraftPayload = {
    answers,
    history: history.length > 0 ? history : [START_SECTION_ID],
  };
  if (Buffer.byteLength(JSON.stringify(clean), "utf8") > MAX_DRAFT_BYTES) return null;
  return clean;
}

export async function getDraft(formId: string, sub: string): Promise<DraftView | null> {
  const row = await prisma.responseDraft.findUnique({
    where: { formId_ownerKey: { formId, ownerKey: draftKeyFor(sub, formId) } },
  });
  if (!row) return null;
  return {
    answers: (row.answers as AnswerMap) ?? {},
    history: Array.isArray(row.history) ? (row.history as string[]) : [START_SECTION_ID],
    updatedAt: row.updatedAt,
  };
}

export async function upsertDraft(
  formId: string,
  sub: string,
  payload: DraftPayload,
): Promise<Date> {
  const data = {
    answers: payload.answers as Prisma.InputJsonValue,
    history: payload.history as Prisma.InputJsonValue,
  };
  const row = await prisma.responseDraft.upsert({
    where: { formId_ownerKey: { formId, ownerKey: draftKeyFor(sub, formId) } },
    create: { formId, ownerKey: draftKeyFor(sub, formId), ...data },
    update: data,
    select: { updatedAt: true },
  });
  return row.updatedAt;
}

// 送出成功後用：只刪草稿列。草稿引用的 Upload 這時已經是正式回覆的附件，絕不能刪。
export async function deleteDraft(formId: string, sub: string): Promise<void> {
  await prisma.responseDraft.deleteMany({
    where: { formId, ownerKey: draftKeyFor(sub, formId) },
  });
}

// 使用者主動放棄草稿：連同草稿裡上傳、尚未屬於任何回覆的附件一起回收。
export async function discardDraft(formId: string, sub: string): Promise<void> {
  const ownerKey = draftKeyFor(sub, formId);
  const row = await prisma.responseDraft.findUnique({
    where: { formId_ownerKey: { formId, ownerKey } },
    select: { id: true, answers: true },
  });
  if (!row) return;

  const uploadIds = collectUploadIds(row.answers);
  const uploads = uploadIds.length
    ? await prisma.upload.findMany({
        where: { id: { in: uploadIds }, formId },
        select: { id: true, storageKey: true },
      })
    : [];

  await prisma.$transaction([
    prisma.responseDraft.delete({ where: { id: row.id } }),
    prisma.upload.deleteMany({ where: { id: { in: uploads.map((u) => u.id) } } }),
  ]);

  // 儲存體是 best-effort：刪不掉只留孤兒檔案，不該讓已完成的 DB 交易白費。
  for (const u of uploads) {
    try {
      await deleteObject(u.storageKey);
    } catch (e) {
      console.error("[response-draft] deleteObject failed", u.storageKey, e);
    }
  }
}
