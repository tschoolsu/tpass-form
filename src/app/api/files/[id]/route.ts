// 下載上傳檔：回覆附件屬個資，只開放「該問卷建立者或超管」（安全審查 M2）。
import { NextResponse, type NextRequest } from "next/server";
import { tpass } from "@/config/auth";
import { isAdmin } from "@/config/admin";
import { canReadResponses } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const session = await tpass.getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) return NextResponse.json({ error: "not found" }, { status: 404 });

  const form = await prisma.form.findUnique({
    where: { id: upload.formId },
    select: { ownerSub: true },
  });
  if (!form || !canReadResponses(session, form)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await getObject(upload.storageKey);
  if (!body) return NextResponse.json({ error: "gone" }, { status: 410 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": upload.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.filename)}`,
    },
  });
}
