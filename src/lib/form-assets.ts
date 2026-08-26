// 說明欄插圖的 server 端操作：轉檔、GC、整份問卷清空。
// 判斷邏輯（誰是孤兒）在 asset-refs.ts（純函式、有測試），這裡只負責碰 DB 與儲存體。
import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { collectAssetIds, pickOrphans } from "@/lib/asset-refs";
import type { FormDefinition, FormSettings } from "@/lib/survey-schema";

// 原檔上限。轉檔後通常 <300KB，所以這裡可以放寬——擋的是「有人拿它當免費網路硬碟」，
// 不是畫質。
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// 單一問卷的插圖總數上限。
export const MAX_ASSETS_PER_FORM = 40;
// 長邊上限；問卷是直欄式版面，再大也只是浪費頻寬。
const MAX_DIMENSION = 1600;

export class UnsupportedImageError extends Error {
  constructor() {
    super("unsupported image");
    this.name = "UnsupportedImageError";
  }
}

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

// 一律轉成 WebP：一個格式打死，讀取端不必分支。
// rotate() 先套用 EXIF 方向再讓 sharp 把 metadata 整份丟掉——手機直拍的照片不轉會躺著，
// 而 EXIF 裡的 GPS 座標本來就不該跟著問卷插圖流出去。
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  try {
    const { data, info } = await sharp(input)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    // sharp 預設沒編 libheif，HEIC 會落到這裡；格式壞掉的檔案也是。
    throw new UnsupportedImageError();
  }
}

// 存檔後回收孤兒圖。best-effort：清不掉只是留下垃圾檔，不該讓存檔本身失敗。
export async function gcFormAssets(
  formId: string,
  definition: FormDefinition,
  settings: FormSettings,
): Promise<void> {
  const referenced = collectAssetIds(definition, settings);
  const assets = await prisma.formAsset.findMany({
    where: { formId },
    select: { id: true, storageKey: true, createdAt: true },
  });
  const orphans = pickOrphans(assets, referenced, new Date());
  if (orphans.length === 0) return;

  await prisma.formAsset.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  await removeObjects(orphans.map((o) => o.storageKey));
}

// 刪問卷前把它的插圖檔案清掉。DB row 靠 onDelete: Cascade，儲存體沒有 cascade，要自己來。
export async function purgeFormAssets(formId: string): Promise<void> {
  const assets = await prisma.formAsset.findMany({
    where: { formId },
    select: { storageKey: true },
  });
  await removeObjects(assets.map((a) => a.storageKey));
}

async function removeObjects(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (e) {
      console.error("[form-assets] deleteObject failed", key, e);
    }
  }
}
