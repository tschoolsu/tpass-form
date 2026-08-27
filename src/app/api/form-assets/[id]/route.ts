// 說明欄插圖的讀取端。只驗「有登入」：填寫頁本來就要求登入，而插圖就是要給填寫者看的。
// 刻意不做 per-form 授權——插圖是問卷內容不是個資，id 是 cuid 不可猜。
// 注意這不是 /api/files/[id]（回覆附件，只有問卷擁有者/超管能下載），那條不要動。
import { NextResponse, type NextRequest } from "next/server";
import { tpass } from "@/config/auth";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/form-assets/[id]">) {
  const session = await tpass.getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const asset = await prisma.formAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await getObject(asset.storageKey);
  if (!body) return NextResponse.json({ error: "gone" }, { status: 410 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": asset.mime,
      // 內容不可變：換圖就是換 id，所以可以永久快取。private 是因為要登入才拿得到。
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
