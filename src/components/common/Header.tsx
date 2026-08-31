// 頂部導覽列。Server Component：登入/登出都是純連結與表單，不需 client 互動。
import Link from "next/link";
import { PortalLink } from "@/components/common/PortalLink";

interface HeaderProps {
  isLoggedIn: boolean;
  // 目前登入者的 email。契約 v2 下本服務的身分是自己網域的 cookie，不跟著 portal 換帳號走，
  // 所以「現在是誰」一定要印在畫面上——只寫「已登入」等於讓人在錯的身分下按送出。
  userEmail?: string | null;
  loginUrl: string;
  logoutUrl: string;
  portalUrl: string;
  isAdmin?: boolean;
}

export function Header({ isLoggedIn, userEmail, loginUrl, logoutUrl, portalUrl, isAdmin }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-background/90 backdrop-blur-md border-b-2 border-foreground/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PortalLink href={portalUrl} />
          <Link
            href="/"
            className="font-mono text-lg font-extrabold tracking-tight text-foreground"
          >
            T<span className="text-primary">-</span>Form
          </Link>
        </div>

        {isLoggedIn ? (
          <div className="flex min-w-0 items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="shrink-0 rounded-md border-2 border-foreground bg-primary px-2.5 py-1 font-mono text-[11px] font-bold text-primary-foreground shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)]"
              >
                管理後台
              </Link>
            )}
            <span
              title={userEmail ?? undefined}
              className="max-w-[40vw] truncate rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground sm:max-w-none"
            >
              {userEmail ?? "已登入"}
            </span>
            {/* 登出：POST 到本服務自己的 /api/auth/logout，先清自己的 host-only cookie，
                再由那支 route 鏈到 auth 清登入態（見 config/auth.ts 的 logoutUrl）。 */}
            <form method="post" action={logoutUrl} className="shrink-0">
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                登出
              </button>
            </form>
          </div>
        ) : (
          <a
            href={loginUrl}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            登入
          </a>
        )}
      </div>
    </header>
  );
}
