import Link from "next/link";
import { Header } from "@/components/common/Header";
import { IdentityBar } from "@/components/common/IdentityBar";
import { FormFiller } from "@/components/fill/FormFiller";
import { QuizFiller } from "@/components/quiz/QuizFiller";
import { tpass, authConfig, loginUrlFor } from "@/config/auth";
import { getPublicForm, findOwnResponse } from "@/lib/forms";
import { isAdmin } from "@/config/admin";
import { hasQuizSkin } from "@/lib/quiz/skins";
import { getDraft } from "@/lib/response-draft";
import { IDENTITY_FIELD_LABELS } from "@/lib/survey-schema";
import type { AnswerMap } from "@/lib/answers";

function Shell({
  children,
  isLoggedIn,
  admin,
  userEmail,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  admin: boolean;
  userEmail?: string | null;
}) {
  return (
    <>
      <Header
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
        isAdmin={admin}
      />
      <main className="flex-1 overflow-x-clip">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">{children}</div>
      </main>
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
      <h1 className="font-extrabold text-2xl">{title}</h1>
      <p className="mt-2 font-medium text-muted-foreground">{body}</p>
      <Link href="/" className="mt-4 inline-block font-bold text-accent hover:underline">
        回問卷大廳 →
      </Link>
    </div>
  );
}

export default async function FillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await tpass.getSession();
  const form = await getPublicForm(slug);

  const admin = isAdmin(session);

  if (!form || form.status === "draft") {
    return (
      <Shell isLoggedIn={!!session} admin={admin} userEmail={session?.email}>
        <Notice title="找不到這份問卷" body="連結可能有誤，或問卷尚未發布。" />
      </Shell>
    );
  }

  if (form.status === "closed" || !form.settings.acceptingResponses) {
    return (
      <Shell isLoggedIn={!!session} admin={admin} userEmail={session?.email}>
        <Notice title="這份問卷已停止收件" body="感謝你的關注，目前無法再填寫。" />
      </Shell>
    );
  }

  // 需要登入才能填（身分戳記 + 防重複）。
  if (!session) {
    return (
      <Shell isLoggedIn={false} admin={false}>
        <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
          <h1 className="font-extrabold text-2xl">{form.title}</h1>
          <p className="mt-2 font-medium text-muted-foreground">請先用學校帳號登入再填寫。</p>
          <a
            href={loginUrlFor(`/f/${slug}`)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
          >
            使用學校帳號登入
          </a>
        </div>
      </Shell>
    );
  }

  // 只能填一次的問卷：填過的人分兩路——問卷允許修改就交出預填的填寫器（編輯模式）；
  // 否則攔在這裡。原本唯一的攔截是送出時撞 DB unique 約束，使用者得整份重填完才被擋。
  // 「填過了」是綁在**這個帳號**上的判斷，而本服務的帳號不一定是使用者以為的那個
  // （契約 v2 的 cookie 不跟著 portal 換帳號走），所以一定要把帳號印出來並給切換入口。
  const own = await findOwnResponse(form, session.sub);
  // editing 是「要拿去預填的那筆」；用物件而不是 boolean 當旗標，TS 才能在 JSX 裡縮窄型別。
  const editing =
    own !== null && form.settings.allowEditAfterSubmit && !hasQuizSkin(slug) ? own : null;
  if (own && !editing) {
    return (
      <Shell isLoggedIn admin={admin} userEmail={session.email}>
        <IdentityBar email={session.email} returnPath={`/f/${slug}`} />
        <Notice
          title="你已經填過這份問卷了"
          body={`這份問卷每個帳號只能填寫一次。目前登入的是 ${session.email}。`}
        />
      </Shell>
    );
  }

  const { anonymous, identityFields } = form.settings;
  const identityNotice = anonymous
    ? "此問卷為匿名作答，不記錄你的身分。"
    : identityFields.length > 0
      ? `此問卷將記錄你的：${identityFields.map((f) => IDENTITY_FIELD_LABELS[f]).join("、")}`
      : null;

  // 填寫進度草稿（自動儲存）：回到同一份問卷就接續上次。
  const draft = await getDraft(form.id, session.sub);

  // 少數問卷有客製特效皮（題目文字仍讀 DB，特效讀 code）；其餘一律走通用填寫器。
  if (hasQuizSkin(slug)) {
    return (
      <Shell isLoggedIn admin={admin} userEmail={session.email}>
        <IdentityBar email={session.email} returnPath={`/f/${slug}`} />
        <QuizFiller
          slug={slug}
          title={form.title}
          description={form.description}
          definition={form.definition}
          tone={form.settings.theme.tone}
          identityNotice={identityNotice}
          initialAnswers={draft?.answers ?? null}
          draftSavedAt={draft?.updatedAt.toISOString() ?? null}
        />
      </Shell>
    );
  }

  return (
    <Shell isLoggedIn admin={admin} userEmail={session.email}>
      <IdentityBar email={session.email} returnPath={`/f/${slug}`} />
      <FormFiller
        slug={slug}
        formId={form.id}
        title={form.title}
        description={form.description}
        descriptionImages={form.settings.images}
        definition={form.definition}
        tone={form.settings.theme.tone}
        identityNotice={identityNotice}
        mode={editing ? "edit" : "new"}
        editingSubmittedAt={editing?.submittedAt.toISOString() ?? null}
        initialAnswers={editing ? (editing.answers as AnswerMap) : (draft?.answers ?? null)}
        initialHistory={editing ? null : (draft?.history ?? null)}
        draftSavedAt={editing ? null : (draft?.updatedAt.toISOString() ?? null)}
      />
    </Shell>
  );
}
