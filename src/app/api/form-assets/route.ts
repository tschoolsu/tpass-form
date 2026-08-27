// 說明欄插圖上傳。建構者專用——與 /api/upload（填寫者的回覆附件）是兩條不同的路，
// 授權方向相反，別合併。
import { NextResponse } from "next/server";
import { tpass } from "@/config/auth";
import { isAdmin } from "@/config/admin";
import { prisma } from "@/lib/db";
import { newStorageKey, putObject } from "@/lib/storage";
import {
  processImage,
  UnsupportedImageError,
  MAX_UPLOAD_BYTES,
  MAX_ASSETS_PER_FORM,
} from "@/lib/form-assets";

export async function POST(request: Request) {
  // 問卷編輯是全 admin 共管（同 saveFormAction），所以這裡只驗 admin，不比對 ownerSub。
  const session = await tpass.getSession();
  if (!session) return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "沒有權限。" }, { status: 403 });

  const body = await request.formData();
  const file = body.get("file");
  const formId = body.get("formId");
  if (!(file instanceof File) || typeof formId !== "string") {
    return NextResponse.json({ error: "請求格式錯誤。" }, { status: 400 });
  }

  const form = await prisma.form.findUnique({ where: { id: formId }, select: { id: true } });
  if (!form) return NextResponse.json({ error: "找不到這份問卷。" }, { status: 404 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "只能上傳圖片。" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `圖片太大了（上限 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB）。` },
      { status: 413 },
    );
  }

  const count = await prisma.formAsset.count({ where: { formId } });
  if (count >= MAX_ASSETS_PER_FORM) {
    return NextResponse.json(
      { error: `一份問卷最多 ${MAX_ASSETS_PER_FORM} 張圖，請先刪掉用不到的。` },
      { status: 429 },
    );
  }

  let processed;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof UnsupportedImageError) {
      return NextResponse.json(
        { error: "這張圖的格式不支援，請改存成 JPG 或 PNG 再上傳。" },
        { status: 415 },
      );
    }
    throw e;
  }

  const storageKey = newStorageKey();
  await putObject(storageKey, processed.data, "image/webp");

  const asset = await prisma.formAsset.create({
    data: {
      formId,
      storageKey,
      mime: "image/webp",
      width: processed.width,
      height: processed.height,
      size: processed.data.byteLength,
      createdBy: session.sub,
    },
    select: { id: true, width: true, height: true },
  });

  return NextResponse.json(asset);
}
