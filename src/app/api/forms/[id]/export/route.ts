// CSV 匯出（給愛用試算表的幹部）。DB 才是真相來源，這只是匯出鏡像。
import { NextResponse, type NextRequest } from "next/server";
import { tpass } from "@/config/auth";
import { isAdmin } from "@/config/admin";
import { canReadResponses } from "@/lib/guard";
import { getForm, listResponses } from "@/lib/forms";
import { answerToText, questionBlocks } from "@/lib/answer-format";
import { gradeLabel } from "@/lib/grade";

function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/forms/[id]/export">) {
  const session = await tpass.getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const form = await getForm(id);
  if (!form) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 回覆內容只有問卷建立者或超管可讀（M2：一般 admin 不再全域可讀）。
  if (!canReadResponses(session, form)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const responses = await listResponses(id);
  const questions = questionBlocks(form.definition.blocks);

  const header = ["送出時間", "姓名", "電子郵件", "年級", ...questions.map((q) => q.title || "（未命名）")];
  const lines = [header.map(csvCell).join(",")];

  for (const r of responses) {
    const row = [
      r.submittedAt.toISOString(),
      r.respondentName ?? "",
      r.respondentEmail ?? "",
      gradeLabel(r.respondentGrade) ?? "",
      ...questions.map((q) => answerToText(q, r.answers[q.id])),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  // 加 BOM 讓 Excel 正確辨識 UTF-8 中文。
  const body = "﻿" + lines.join("\r\n");
  const filename = `${form.title || "form"}-responses.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
