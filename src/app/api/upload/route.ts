// 檔案上傳端點：填寫者上傳前先打這裡拿 upload id，再把 id 帶進答案。
// 一律驗 session、檢查目標題確實是該問卷的 file_upload 題、擋超大檔。
import { NextResponse } from "next/server";
import { tpass } from "@/config/auth";
import { prisma } from "@/lib/db";
import { formDefinitionSchema, formSettingsSchema } from "@/lib/survey-schema";
import { newStorageKey, putObject } from "@/lib/storage";

// 單一使用者對單一問卷的上傳數上限（防灌爆儲存空間；正常填寫遠低於此）。
const MAX_UPLOADS_PER_USER_PER_FORM = 20;

// 檔案型別是否符合題目設定的 accept 清單（空清單 = 不限制）。
// accept 項目支援三種形式（與 <input accept> 一致）：.pdf / image/* / application/pdf
function mimeAllowed(accept: string[], mime: string, filename: string): boolean {
  if (accept.length === 0) return true;
  const lowerName = filename.toLowerCase();
  return accept.some((a) => {
    const rule = a.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return lowerName.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

export async function POST(request: Request) {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const formId = form.get("formId");
  const questionId = form.get("questionId");

  if (!(file instanceof File) || typeof formId !== "string" || typeof questionId !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const dbForm = await prisma.form.findUnique({ where: { id: formId } });
  if (!dbForm || dbForm.status !== "published") {
    return NextResponse.json({ error: "form not open" }, { status: 404 });
  }

  // 與送出動作同一條門檻：暫停收回覆時也不收檔案（M3）。
  const settings = formSettingsSchema.parse(dbForm.settings);
  if (!settings.acceptingResponses) {
    return NextResponse.json({ error: "form not open" }, { status: 404 });
  }

  const def = formDefinitionSchema.parse(dbForm.definition);
  const q = def.blocks.find(
    (b) => b.kind === "question" && b.id === questionId && b.type === "file_upload",
  );
  if (!q || q.kind !== "question") {
    return NextResponse.json({ error: "no such file question" }, { status: 400 });
  }

  const maxBytes = (q.file?.maxSizeMB ?? 10) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  // 伺服器端也驗題目的 accept 清單——前端 <input accept> 只是 UX，不是門禁（M3）。
  const mime = file.type || "application/octet-stream";
  if (!mimeAllowed(q.file?.accept ?? [], mime, file.name)) {
    return NextResponse.json({ error: "file type not allowed" }, { status: 415 });
  }

  // 每人每問卷上傳配額（M3：防匿名灌檔）。
  const uploadedCount = await prisma.upload.count({
    where: { formId, uploaderSub: session.sub },
  });
  if (uploadedCount >= MAX_UPLOADS_PER_USER_PER_FORM) {
    return NextResponse.json({ error: "upload quota exceeded" }, { status: 429 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = newStorageKey();
  await putObject(storageKey, buffer, file.type || "application/octet-stream");

  const upload = await prisma.upload.create({
    data: {
      formId,
      questionId,
      storageKey,
      filename: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      uploaderSub: session.sub,
    },
    select: { id: true, filename: true },
  });

  return NextResponse.json({ id: upload.id, filename: upload.filename });
}
