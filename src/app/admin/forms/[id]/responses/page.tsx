import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Inbox } from "lucide-react";
import { canReadResponses, requireAdmin } from "@/lib/guard";
import { getForm, listResponses } from "@/lib/forms";
import { questionBlocks } from "@/lib/answer-format";
import { Badge } from "tpass-ui";
import { ResponsesView } from "@/components/responses/ResponsesView";

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/forms/${id}/responses`);
  const form = await getForm(id);
  // 回覆內容只有問卷建立者或超管可讀（M2）；對無權者以 404 呈現，不洩漏存在性。
  if (!form || !canReadResponses(session, form)) notFound();

  const responses = await listResponses(id);
  const questions = questionBlocks(form.definition.blocks);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href={`/admin/forms/${id}/edit`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 回編輯
        </Link>
        <a
          href={`/api/forms/${id}/export`}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-3 py-1.5 text-sm font-bold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
        >
          <Download className="h-4 w-4" /> 匯出 CSV
        </a>
      </div>

      <div className="flex flex-wrap items-baseline gap-3 mb-6">
        <h1 className="font-extrabold text-2xl tracking-tight">{form.title}</h1>
        <Badge className="bg-tone-green-badge">{responses.length} 份回覆</Badge>
        {responses.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            最後一筆 {responses[0].submittedAt.toLocaleString("zh-TW")}
          </span>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground/30 p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">還沒有人填寫</p>
        </div>
      ) : (
        <ResponsesView
          formId={id}
          questions={questions}
          responses={responses}
          anonymous={form.settings.anonymous}
        />
      )}
    </div>
  );
}
