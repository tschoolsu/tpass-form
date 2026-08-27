// 把「回報問題給數位部」問卷寫進 DB（冪等，用 slug upsert，可重跑）。
//
//   FEEDBACK_OWNER_SUB=<sub> FEEDBACK_OWNER_EMAIL=<email> pnpm db:seed:feedback
//
// 題目真相在 src/lib/feedback/feedback-form.ts；這支腳本只負責①從 tpass-registry
// 派生「哪些服務可選」②搬進 DB。服務清單絕不硬編碼——註冊表更新後重跑這支即可。
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildFeedbackDefinition,
  FEEDBACK_DESCRIPTION,
  FEEDBACK_SETTINGS,
  FEEDBACK_SLUG,
  FEEDBACK_TITLE,
  type FeedbackServiceOption,
} from "../src/lib/feedback/feedback-form";

// 腳本不經 Next 路由，process.env 不會自動載入 .env.local；明確載入。
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

interface RegistryService {
  id: string;
  name: string;
  enabled: boolean;
  deployed: boolean;
  portal?: { label: string };
}

// 註冊表位置與 portal/auth 同一套規則：預設並排在上一層，TPASS_REGISTRY_PATH 是逃生門。
function registryPath(): string {
  const override = process.env.TPASS_REGISTRY_PATH;
  if (override) return isAbsolute(override) ? override : resolve(process.cwd(), override);
  return join(process.cwd(), "..", "tpass-registry", "services.json");
}

function serviceOptions(): FeedbackServiceOption[] {
  const file = registryPath();
  let json: { services: RegistryService[] };
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(
      `讀不到服務註冊表：${file}\n` +
        `  它是並排的 public repo：git clone https://github.com/tschoolsu/tpass-registry.git\n` +
        `  或用 TPASS_REGISTRY_PATH 指到 services.json。\n` +
        `  原始錯誤：${(e as Error).message}`,
    );
  }
  return json.services
    // 學生選得到的只有「線上活著、而且大廳看得到」的服務。
    .filter((s) => s.enabled && s.deployed && s.portal)
    .map((s) => ({ id: s.id, label: s.portal!.label || s.name }));
}

async function main() {
  const ownerSub = process.env.FEEDBACK_OWNER_SUB?.trim();
  const ownerEmail = process.env.FEEDBACK_OWNER_EMAIL?.trim();
  if (!ownerSub || !ownerEmail) {
    throw new Error(
      "缺 FEEDBACK_OWNER_SUB / FEEDBACK_OWNER_EMAIL。到 auth 的 /admin 找自己的 sub，再重跑：\n" +
        "  FEEDBACK_OWNER_SUB=… FEEDBACK_OWNER_EMAIL=… pnpm db:seed:feedback",
    );
  }

  const services = serviceOptions();
  if (services.length === 0) {
    throw new Error("註冊表裡沒有任何「已上線且有大廳卡片」的服務，回報問卷會沒有服務可選。");
  }

  const definition = buildFeedbackDefinition(services) as unknown as Prisma.InputJsonValue;
  const settings = FEEDBACK_SETTINGS as unknown as Prisma.InputJsonValue;

  const form = await prisma.form.upsert({
    where: { slug: FEEDBACK_SLUG },
    create: {
      slug: FEEDBACK_SLUG,
      title: FEEDBACK_TITLE,
      description: FEEDBACK_DESCRIPTION,
      status: "published",
      publishedAt: new Date(),
      ownerSub,
      ownerEmail,
      definition,
      settings,
    },
    update: {
      title: FEEDBACK_TITLE,
      description: FEEDBACK_DESCRIPTION,
      status: "published",
      definition,
      settings,
      // 撞掉任何開著的建構器分頁（樂觀鎖），不讓它把 seed 的內容靜默蓋回去。
      version: { increment: 1 },
    },
    select: { id: true, slug: true, version: true },
  });

  console.log(
    `[seed:feedback] 完成：/f/${form.slug}（id=${form.id}, version=${form.version}）\n` +
      `  可選服務：${services.map((s) => s.label).join("、")}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
