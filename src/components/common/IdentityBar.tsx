// 「你現在是誰」身分列。Server Component：切換帳號是純 POST 表單，不需 client 互動。
//
// 為什麼需要它：契約 v2 下本服務的身分＝自己網域的 host-only cookie，一旦簽出來就與
// auth 當下登入的是誰無關（portal 換帳號、auth 登出都不會傳播過來，見 tpass-auth/INTEGRATION.md §7.2）。
// 填問卷是「按下去就落地成一筆記名資料」的動作，所以送出前一定要讓人看見自己是誰。
import { authConfig } from "@/config/auth";

export function IdentityBar({ email, returnPath }: { email: string; returnPath: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border-2 border-foreground bg-card px-3 py-2 shadow-[2px_2px_0_0_var(--color-foreground)]">
      <p className="min-w-0 font-mono text-[11px] font-bold text-foreground">
        目前身分：<span className="break-all">{email}</span>
      </p>
      {/* 切換帳號＝先清掉本服務的票（只有本服務清得掉），再鏈到 auth 清登入態，
          最後帶著 next 回到這一頁的登入卡片。 */}
      <form method="post" action={authConfig.logoutUrl} className="shrink-0">
        <input type="hidden" name="next" value={returnPath} />
        <button
          type="submit"
          className="font-mono text-[11px] font-bold text-accent underline underline-offset-2 transition-colors duration-200 hover:text-foreground"
        >
          不是你？切換帳號
        </button>
      </form>
    </div>
  );
}
