"use server";

// 回覆的後台操作。server action 可被直接 POST，授權一定要在函式內做。
import { revalidatePath } from "next/cache";
import { requireAdmin, canReadResponses, ForbiddenError } from "@/lib/guard";
import { getForm, deleteResponse } from "@/lib/forms";

export interface DeleteResponseResult {
  ok: boolean;
  error?: string;
}

export async function deleteResponseAction(
  formId: string,
  responseId: string,
): Promise<DeleteResponseResult> {
  const session = await requireAdmin(`/admin/forms/${formId}/responses`);
  const form = await getForm(formId);
  // 回覆內容屬個資：讀得到才刪得掉（問卷建立者或超管）。
  if (!form || !canReadResponses(session, form)) throw new ForbiddenError();

  try {
    await deleteResponse(formId, responseId);
  } catch {
    return { ok: false, error: "刪除失敗（可能已經被刪掉了）" };
  }

  revalidatePath(`/admin/forms/${formId}/responses`);
  return { ok: true };
}
