// 表單 CRUD（server-only）。真相來源 = Postgres；definition/settings 存 jsonb，
// 讀寫都過 zod，套用預設並擋掉壞資料。
import "server-only";
import { customAlphabet } from "nanoid";
import type { Form } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import type { ResponseRecord } from "@/lib/response-stats";
import type { UploadedFile } from "@/components/fill/QuestionRenderer";
import {
  formDefinitionSchema,
  formSettingsSchema,
  emptyForm,
  type FormDefinition,
  type FormSettings,
} from "@/lib/survey-schema";

const slugId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export type FormStatus = "draft" | "published" | "closed";

// 樂觀鎖衝突：存檔時 version 對不上（有人搶先改了同一份問卷）。
export class ConflictError extends Error {
  constructor() {
    super("Conflict");
    this.name = "ConflictError";
  }
}

export interface FormView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: FormStatus;
  ownerSub: string;
  ownerEmail: string;
  version: number;
  definition: FormDefinition;
  settings: FormSettings;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

// 把 Prisma row 轉成型別安全的 view（jsonb → 過 zod）。
export function toView(form: Form): FormView {
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    status: form.status as FormStatus,
    ownerSub: form.ownerSub,
    ownerEmail: form.ownerEmail,
    version: form.version,
    definition: formDefinitionSchema.parse(form.definition),
    settings: formSettingsSchema.parse(form.settings),
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    publishedAt: form.publishedAt,
  };
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = slugId();
    const hit = await prisma.form.findUnique({ where: { slug }, select: { id: true } });
    if (!hit) return slug;
  }
  return `${slugId()}${slugId()}`;
}

export async function createDraft(owner: { sub: string; email: string }): Promise<string> {
  const slug = await uniqueSlug();
  const form = await prisma.form.create({
    data: {
      slug,
      title: "未命名問卷",
      status: "draft",
      ownerSub: owner.sub,
      ownerEmail: owner.email,
      definition: emptyForm(),
      settings: formSettingsSchema.parse({}),
    },
    select: { id: true },
  });
  return form.id;
}

// 任何 admin 皆可維護所有問卷，故不再依 ownerSub 過濾（授權在呼叫端 requireAdmin）。
export async function getForm(id: string): Promise<FormView | null> {
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) return null;
  return toView(form);
}

export async function getPublicForm(slug: string): Promise<FormView | null> {
  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form) return null;
  return toView(form);
}

// 列出所有問卷（全員共管）。
export async function listForms(): Promise<FormView[]> {
  const forms = await prisma.form.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return forms.map(toView);
}

export async function listPublishedForms(): Promise<FormView[]> {
  const forms = await prisma.form.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  return forms.map(toView);
}

export interface DraftPatch {
  title?: string;
  description?: string | null;
  definition?: unknown;
  settings?: unknown;
}

// 存草稿。樂觀鎖：只在 version === expectedVersion 時寫入並 +1，回傳新 version。
// 版本對不上 → 有人搶先改了 → 丟 ConflictError（絕不靜默覆蓋）。
export async function saveDraft(
  id: string,
  patch: DraftPatch,
  expectedVersion: number,
): Promise<number> {
  const res = await prisma.form.updateMany({
    where: { id, version: expectedVersion },
    data: {
      version: { increment: 1 },
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.definition !== undefined
        ? { definition: formDefinitionSchema.parse(patch.definition) }
        : {}),
      ...(patch.settings !== undefined
        ? { settings: formSettingsSchema.parse(patch.settings) }
        : {}),
    },
  });
  if (res.count === 0) {
    // 沒改到：分辨是「不存在」還是「版本衝突」。
    const exists = await prisma.form.findUnique({ where: { id }, select: { id: true } });
    if (exists) throw new ConflictError();
    throw new Error("not found");
  }
  return expectedVersion + 1;
}

export async function setStatus(id: string, status: FormStatus): Promise<void> {
  const form = await prisma.form.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!form) throw new Error("not found");
  await prisma.form.update({
    where: { id },
    data: {
      status,
      ...(status === "published" && !form.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    },
  });
}

// 回覆的形狀定義在 response-stats（isomorphic），這裡沿用同一份，避免 server/client 各寫一份。
export type ResponseRow = ResponseRecord;

// 列出某問卷的回覆（授權在呼叫端 requireAdmin）。
export async function listResponses(id: string): Promise<ResponseRow[]> {
  const rows = await prisma.response.findMany({
    where: { formId: id },
    orderBy: { submittedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    submittedAt: r.submittedAt,
    respondentName: r.respondentName,
    respondentEmail: r.respondentEmail,
    respondentGrade: r.respondentGrade,
    answers: (r.answers as Record<string, unknown>) ?? {},
  }));
}

// 刪掉單一筆回覆，連同該筆上傳的附件（Upload row + 儲存體物件）。
// 副作用：若問卷設了 oneResponsePerUser，unique key（formId+respondentSub / formId+anonHash）
// 隨 row 一起消失 → 該使用者可以再填一次。這是刻意的行為，不是漏洞。
export async function deleteResponse(formId: string, responseId: string): Promise<void> {
  // formId 一起帶入 where，擋「拿 A 表單的權限刪 B 表單的回覆」。
  const row = await prisma.response.findFirst({
    where: { id: responseId, formId },
    select: { answers: true },
  });
  if (!row) throw new Error("not found");

  const uploadIds = collectUploadIds(row.answers);
  const uploads = uploadIds.length
    ? await prisma.upload.findMany({
        where: { id: { in: uploadIds }, formId },
        select: { id: true, storageKey: true },
      })
    : [];

  await prisma.$transaction([
    prisma.response.delete({ where: { id: responseId } }),
    prisma.upload.deleteMany({ where: { id: { in: uploads.map((u) => u.id) } } }),
  ]);

  // 儲存體是 best-effort：刪不掉只留孤兒檔案，不該讓已完成的 DB 交易白費。
  for (const u of uploads) {
    try {
      await deleteObject(u.storageKey);
    } catch (e) {
      console.error("[forms] deleteObject failed", u.storageKey, e);
    }
  }
}

// 從 answers 掃出所有檔案題的 upload id（值形狀 = UploadedFile[]）。
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

export async function deleteForm(id: string): Promise<void> {
  await prisma.form.delete({ where: { id } });
}
