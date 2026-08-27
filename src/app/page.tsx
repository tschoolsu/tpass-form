// 問卷大廳首頁（Server Component）：列出已發布問卷，任何登入者都能填 / 複製連結分享。
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/common/Header";
import { CopyLinkButton } from "@/components/common/CopyLinkButton";
import { tpass, authConfig, loginUrlFor } from "@/config/auth";
import { isAdmin } from "@/config/admin";
import { listPublishedForms } from "@/lib/forms";
import { type Tone } from "@/lib/survey-schema";

const TONE_BG: Record<Tone, string> = {
  green: "bg-tone-green-bg",
  blue: "bg-tone-blue-bg",
  orange: "bg-tone-orange-bg",
  violet: "bg-tone-violet-bg",
  rose: "bg-tone-rose-bg",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const session = await tpass.getSession();
  const isLoggedIn = session !== null;
  // logout=1 只是 auth 導回來的畫面提示，不是憑證：只有在 session 確實無效時才採信。
  const { logout } = await searchParams;
  const justLoggedOut = !isLoggedIn && logout === "1";

  // 契約 v2：本服務的 cookie 只在本網域，第一次被造訪時身上什麼都沒有——要主動去 auth
  // 換一張自己的票，使用者才會「從門戶點進來就直接認得」（authorize 那趟是無感的）。
  // 剛登出時不能導，否則會立刻被彈回登入，等於登不出去。
  if (!isLoggedIn && !justLoggedOut) redirect(loginUrlFor("/"));

  const admin = isAdmin(session);
  const forms = isLoggedIn ? await listPublishedForms() : [];

  return (
    <>
      <Header
        isLoggedIn={isLoggedIn}
        userEmail={session?.email ?? null}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
        isAdmin={admin}
      />

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold shadow-[2px_2px_0_0_var(--color-foreground)]">
            <ClipboardList className="h-3.5 w-3.5" /> 學生會問卷
          </span>
          <h1 className="mt-4 font-extrabold text-3xl sm:text-4xl tracking-tight">
            {justLoggedOut ? "您已登出" : "目前開放的問卷"}
          </h1>
          <p className="mt-2 font-medium text-muted-foreground">
            {isLoggedIn
              ? "點卡片填寫，或複製連結分享給其他人。"
              : justLoggedOut
                ? "您已安全登出 T-Form。要繼續查看與填寫問卷，請重新登入。"
                : "請用學校帳號登入以查看與填寫問卷。"}
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          {!isLoggedIn ? (
            <div className="rounded-2xl border-2 border-dashed border-foreground/30 p-12 text-center">
              <a
                href={authConfig.loginUrl}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
              >
                使用學校帳號登入
              </a>
            </div>
          ) : forms.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-foreground/30 p-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-bold">目前沒有開放中的問卷</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map((f) => {
                const url = new URL(`/f/${f.slug}`, authConfig.selfUrl).toString();
                return (
                  <div
                    key={f.id}
                    className={`group relative flex flex-col gap-3 rounded-2xl border-2 border-foreground p-5 shadow-[4px_4px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-foreground)] focus-within:-translate-y-0.5 focus-within:shadow-[6px_6px_0_0_var(--color-foreground)] ${TONE_BG[f.settings.theme.tone]}`}
                  >
                    {/* 整張卡片即「填寫」——覆蓋整卡的透明連結，點任一處進入填寫 */}
                    <Link
                      href={`/f/${f.slug}`}
                      aria-label={`填寫 ${f.title}`}
                      className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />

                    {/* 右上角複製連結：icon-only，浮在填寫連結之上 */}
                    <div className="absolute right-3 top-3 z-10">
                      <CopyLinkButton url={url} variant="default" iconOnly />
                    </div>

                    <div className="flex-1 pr-10">
                      <h2 className="font-extrabold text-lg leading-tight">{f.title}</h2>
                      {f.description && (
                        <p className="mt-1.5 text-sm font-medium text-foreground/70 line-clamp-3">
                          {f.description}
                        </p>
                      )}
                    </div>

                    {/* 填寫提示（非按鈕，指示整卡可點） */}
                    <div className="flex items-center justify-between font-bold">
                      <span>填寫問卷</span>
                      <ArrowUpRight className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t-2 border-dashed border-foreground/30 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="font-mono text-sm font-extrabold text-foreground">
            T<span className="text-primary">-</span>Form
          </span>
          <span className="font-mono text-xs font-bold text-muted-foreground">
            © 2026 TSchool 學生會數位部
          </span>
        </div>
      </footer>
    </>
  );
}
