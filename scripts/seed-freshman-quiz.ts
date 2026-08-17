// 把「新生直屬快問快答」寫進 DB（冪等，用 slug upsert，可重跑）。
//
//   QUIZ_OWNER_SUB=<sub> QUIZ_OWNER_EMAIL=<email> pnpm db:seed:quiz
//
// 題目真相在 src/lib/quiz/freshman-quiz.ts（特效也靠那裡的 id 對映）；這支腳本只負責搬進 DB，
// 好讓提交／驗證／防重複／後台回應檢視與 CSV 匯出全部沿用既有管線。
// 用相對路徑 import（不靠 tsconfig paths），且那個檔對 survey-schema 只有 type-only import，
// 執行期不需要解析 @/ 別名。
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  QUIZ_DEFINITION,
  QUIZ_DESCRIPTION,
  QUIZ_SETTINGS,
  QUIZ_SLUG,
  QUIZ_TITLE,
} from "../src/lib/quiz/freshman-quiz";

// 腳本不經 Next 路由，process.env 不會自動載入 .env.local；明確載入。
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const ownerSub = process.env.QUIZ_OWNER_SUB?.trim();
  const ownerEmail = process.env.QUIZ_OWNER_EMAIL?.trim();
  if (!ownerSub || !ownerEmail) {
    throw new Error(
      "缺 QUIZ_OWNER_SUB / QUIZ_OWNER_EMAIL。到 auth 的 /admin 找自己的 sub，再重跑：\n" +
        "  QUIZ_OWNER_SUB=… QUIZ_OWNER_EMAIL=… pnpm db:seed:quiz",
    );
  }

  const definition = QUIZ_DEFINITION as unknown as Prisma.InputJsonValue;
  const settings = QUIZ_SETTINGS as unknown as Prisma.InputJsonValue;

  const form = await prisma.form.upsert({
    where: { slug: QUIZ_SLUG },
    create: {
      slug: QUIZ_SLUG,
      title: QUIZ_TITLE,
      description: QUIZ_DESCRIPTION,
      status: "published",
      publishedAt: new Date(),
      ownerSub,
      ownerEmail,
      definition,
      settings,
    },
    update: {
      title: QUIZ_TITLE,
      description: QUIZ_DESCRIPTION,
      status: "published",
      definition,
      settings,
      // 撞掉任何開著的建構器分頁（樂觀鎖），不讓它把 seed 的內容靜默蓋回去。
      version: { increment: 1 },
    },
    select: { id: true, slug: true, version: true },
  });

  const questions = QUIZ_DEFINITION.blocks.filter((b) => b.kind === "question");
  const options = questions.reduce((n, q) => n + (q.options?.length ?? 0), 0);

  console.log(
    `✓ ${QUIZ_TITLE}：${questions.length} 題 / ${options} 選項\n` +
      `  id=${form.id} slug=${form.slug} version=${form.version}\n` +
      `  填寫頁：/f/${form.slug}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
