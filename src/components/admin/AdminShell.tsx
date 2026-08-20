import Link from "next/link";
import { authConfig } from "@/config/auth";
import { PortalLink } from "@/components/common/PortalLink";
import { AdminSidebar, AdminTabBar } from "@/components/admin/AdminNav";

export function AdminShell({
  email,
  superAdmin,
  children,
}: {
  email: string;
  superAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-50 h-16 bg-background/90 backdrop-blur-md border-b-2 border-foreground/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <PortalLink href={authConfig.portalUrl} />
            <Link
              href="/admin"
              className="font-mono text-lg font-extrabold tracking-tight text-foreground"
            >
              T<span className="text-primary">-</span>Form
              <span className="ml-2 rounded-md border-2 border-foreground bg-primary px-1.5 py-0.5 align-middle font-mono text-[10px] font-bold text-primary-foreground">
                ADMIN
              </span>
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {/* 手機上也必須看得見是誰：後台能刪回覆、能改權限，用錯帳號的代價比填問卷更高。
                原本 hidden sm:inline 等於在最容易搞錯身分的裝置上把身分藏起來。 */}
            <span
              title={email}
              className="max-w-[40vw] truncate rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground sm:max-w-none"
            >
              {email}
            </span>
            <form method="post" action={authConfig.logoutUrl} className="shrink-0">
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminTabBar superAdmin={superAdmin} />

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex gap-8">
        <AdminSidebar superAdmin={superAdmin} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
