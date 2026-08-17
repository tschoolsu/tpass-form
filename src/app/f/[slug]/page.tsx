import Link from "next/link";
import { Header } from "@/components/common/Header";
import { FormFiller } from "@/components/fill/FormFiller";
import { QuizFiller } from "@/components/quiz/QuizFiller";
import { getSession } from "@/lib/tpass-auth";
import { getPublicForm } from "@/lib/forms";
import { isAdmin } from "@/config/admin";
import { authConfig, loginUrlFor } from "@/config/auth";
import { hasQuizSkin } from "@/lib/quiz/skins";
import { IDENTITY_FIELD_LABELS } from "@/lib/survey-schema";

function Shell({ children, isLoggedIn, admin }: { children: React.ReactNode; isLoggedIn: boolean; admin: boolean }) {
  return (
    <>
      <Header
        isLoggedIn={isLoggedIn}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
        isAdmin={admin}
      />
      <main className="flex-1">
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
  const session = await getSession();
  const form = await getPublicForm(slug);

  const admin = isAdmin(session);

  if (!form || form.status === "draft") {
    return (
      <Shell isLoggedIn={!!session} admin={admin}>
        <Notice title="找不到這份問卷" body="連結可能有誤，或問卷尚未發布。" />
      </Shell>
    );
  }

  if (form.status === "closed" || !form.settings.acceptingResponses) {
    return (
      <Shell isLoggedIn={!!session} admin={admin}>
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

  const { anonymous, identityFields } = form.settings;
  const identityNotice = anonymous
    ? "此問卷為匿名作答，不記錄你的身分。"
    : identityFields.length > 0
      ? `此問卷將記錄你的：${identityFields.map((f) => IDENTITY_FIELD_LABELS[f]).join("、")}`
      : null;

  // 少數問卷有客製特效皮（題目文字仍讀 DB，特效讀 code）；其餘一律走通用填寫器。
  if (hasQuizSkin(slug)) {
    return (
      <Shell isLoggedIn admin={admin}>
        <QuizFiller
          slug={slug}
          title={form.title}
          description={form.description}
          definition={form.definition}
          tone={form.settings.theme.tone}
          identityNotice={identityNotice}
        />
      </Shell>
    );
  }

  return (
    <Shell isLoggedIn admin={admin}>
      <FormFiller
        slug={slug}
        formId={form.id}
        title={form.title}
        description={form.description}
        definition={form.definition}
        tone={form.settings.theme.tone}
        identityNotice={identityNotice}
      />
    </Shell>
  );
}
