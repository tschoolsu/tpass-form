import Link from "next/link";
import { Plus, FileText, ArrowUpRight } from "lucide-react";
import { requireAdmin } from "@/lib/guard";
import { listForms, type FormStatus } from "@/lib/forms";
import { Badge } from "tpass-ui";
import { createFormAction } from "@/app/admin/forms/actions";

const STATUS_META: Record<FormStatus, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-card" },
  published: { label: "已發布", cls: "bg-tone-green-badge" },
  closed: { label: "已關閉", cls: "bg-tone-rose-badge" },
};

export default async function AdminHomePage() {
  await requireAdmin();
  const forms = await listForms();

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-extrabold text-2xl tracking-tight">所有問卷</h1>
        <form action={createFormAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-2 font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
          >
            <Plus className="h-4 w-4" /> 新增問卷
          </button>
        </form>
      </div>

      {forms.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground/30 p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">還沒有問卷</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            點右上角「新增問卷」開始建立第一份。
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {forms.map((f) => (
            <li key={f.id}>
              <Link
                href={`/admin/forms/${f.id}/edit`}
                className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold truncate">{f.title || "未命名問卷"}</span>
                    <Badge className={STATUS_META[f.status].cls}>
                      {STATUS_META[f.status].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    建立者 {f.ownerEmail} · 更新於 {f.updatedAt.toLocaleString("zh-TW")}
                  </p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
