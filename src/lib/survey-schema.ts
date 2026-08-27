// ★ 問卷定義的單一真相（zod + 型別）★ 建構器與填寫器共用，故必須 isomorphic（不可 import server-only）。
// 表單 = 有序 blocks（section / text / question）。section 把表單切成段，跳轉邏輯在段與選項上。
import { z } from "zod";
import { customAlphabet } from "nanoid";

// ── id 產生器（builder 端新增 block / option 用）──────────────────────
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
export const newId = (prefix = "") => (prefix ? `${prefix}_${nano()}` : nano());

// ── 色票（與 design system 五個 tone 對齊）────────────────────────────
export const TONES = ["green", "blue", "orange", "violet", "rose"] as const;
export const toneSchema = z.enum(TONES);
export type Tone = z.infer<typeof toneSchema>;

// ── 題型 ──────────────────────────────────────────────────────────────
export const QUESTION_TYPES = [
  "short_text",
  "paragraph",
  "single_choice",
  "multi_choice",
  "dropdown",
  "linear_scale",
  "date",
  "grid_single",
  "grid_multi",
  "file_upload",
] as const;
export const qTypeSchema = z.enum(QUESTION_TYPES);
export type QType = z.infer<typeof qTypeSchema>;

export const QUESTION_TYPE_LABELS: Record<QType, string> = {
  short_text: "短答",
  paragraph: "段落",
  single_choice: "單選",
  multi_choice: "多選（複選）",
  dropdown: "下拉選單",
  linear_scale: "線性量表",
  date: "日期",
  grid_single: "單選方格",
  grid_multi: "多選方格",
  file_upload: "檔案上傳",
};

// 跳轉目標：段 id 或結束。
export const GOTO_END = "END" as const;
const gotoSchema = z.string().min(1); // 段 id 或 "END"

// ── 說明欄插圖 ────────────────────────────────────────────────────────
// 圖片本體存 FormAsset（DB + 物件儲存），定義裡只留 id 參照。
// alt 一欄兩用：畫面上是圖說，讀螢幕時是替代文字。
export const imageRefSchema = z.object({
  id: z.string().min(1), // FormAsset.id
  alt: z.string().default(""),
  // 尺寸在定義裡複製一份：渲染時就能給 <img> 固定長寬比，不必為了排版回查 DB。
  // optional 是為了讓手工或舊資料也能過。
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

export const MAX_IMAGES_PER_FIELD = 6;

// 四處說明欄共用同一個欄位形狀，別各自長一套。
const imagesField = () => z.array(imageRefSchema).max(MAX_IMAGES_PER_FIELD).default([]);

export const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  goTo: gotoSchema.optional(), // 單選/下拉：選此項跳到指定段或 END
});
export type Option = z.infer<typeof optionSchema>;

export const gridItemSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});
export type GridItem = z.infer<typeof gridItemSchema>;

// 一個 question block（扁平物件，型別專屬 config 用 optional；結構完整性由
// validateFormStructure 在發布時把關，避免 ZodEffects 破壞 discriminatedUnion）。
export const questionBlockSchema = z.object({
  kind: z.literal("question"),
  id: z.string().min(1),
  type: qTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  images: imagesField(),
  required: z.boolean().default(false),
  // 選擇題
  options: z.array(optionSchema).optional(),
  // 量表
  scale: z
    .object({
      min: z.number().int(),
      max: z.number().int(),
      minLabel: z.string().optional(),
      maxLabel: z.string().optional(),
    })
    .optional(),
  // 方格
  grid: z
    .object({
      rows: z.array(gridItemSchema),
      cols: z.array(gridItemSchema),
    })
    .optional(),
  // 檔案上傳
  file: z
    .object({
      accept: z.array(z.string()).default([]),
      maxSizeMB: z.number().positive().default(10),
      maxFiles: z.number().int().positive().default(1),
    })
    .optional(),
});
export type QuestionBlock = z.infer<typeof questionBlockSchema>;

export const sectionBlockSchema = z.object({
  kind: z.literal("section"),
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  images: imagesField(),
  defaultNext: z.union([z.literal("NEXT"), z.literal("END"), z.string()]).default("NEXT"),
});
export type SectionBlock = z.infer<typeof sectionBlockSchema>;

export const textBlockSchema = z.object({
  kind: z.literal("text"),
  id: z.string().min(1),
  heading: z.string().optional(),
  body: z.string().optional(),
  images: imagesField(),
});
export type TextBlock = z.infer<typeof textBlockSchema>;

export const blockSchema = z.discriminatedUnion("kind", [
  questionBlockSchema,
  sectionBlockSchema,
  textBlockSchema,
]);
export type Block = z.infer<typeof blockSchema>;

export const formDefinitionSchema = z.object({
  blocks: z.array(blockSchema).default([]),
});
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

// ── 表單設定 ──────────────────────────────────────────────────────────
export const IDENTITY_FIELDS = ["name", "email", "grade"] as const;
export const identityFieldSchema = z.enum(IDENTITY_FIELDS);
export type IdentityField = z.infer<typeof identityFieldSchema>;
export const IDENTITY_FIELD_LABELS: Record<IdentityField, string> = {
  name: "姓名",
  email: "電子郵件",
  grade: "年級",
};

export const formSettingsSchema = z.object({
  anonymous: z.boolean().default(false),
  identityFields: z.array(identityFieldSchema).default([]),
  theme: z
    .object({ tone: toneSchema.default("violet") })
    .default({ tone: "violet" }),
  images: imagesField(), // 問卷標題下那段說明的插圖
  acceptingResponses: z.boolean().default(true),
  oneResponsePerUser: z.boolean().default(false),
  // 收到新回覆時要通知哪些 webhook（目標在 /admin/webhooks 登記，這裡只存 id）。
  // 空陣列＝不通知，這是預設——大量回覆的問卷開了只會洗版。
  // 存 id 不存關聯：webhook 被刪掉時這裡會留下孤兒 id，讀取端一律以現存的 webhook 為準
  // （notifyNewResponse 用 id IN (...) 查，查不到就是不送），不需要為此多一張表。
  webhookIds: z.array(z.string()).default([]),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

// ── 段落分組 + 跳轉（填寫器導航用，isomorphic）──────────────────────
export const START_SECTION_ID = "__start__";

export interface Section {
  id: string;
  title?: string;
  description?: string;
  images: ImageRef[];
  defaultNext: string; // "NEXT" | "END" | sectionId
  blocks: Array<QuestionBlock | TextBlock>;
}

// 把有序 blocks 依 section marker 切成段；第一段為隱含的 __start__。
export function getSections(def: FormDefinition): Section[] {
  const sections: Section[] = [];
  let current: Section = {
    id: START_SECTION_ID,
    defaultNext: "NEXT",
    images: [],
    blocks: [],
  };
  for (const b of def.blocks) {
    if (b.kind === "section") {
      sections.push(current);
      current = {
        id: b.id,
        title: b.title,
        description: b.description,
        images: b.images ?? [],
        defaultNext: b.defaultNext ?? "NEXT",
        blocks: [],
      };
    } else {
      current.blocks.push(b);
    }
  }
  sections.push(current);
  return sections;
}

export function questionsOf(section: Section): QuestionBlock[] {
  return section.blocks.filter((b): b is QuestionBlock => b.kind === "question");
}

// 決定離開某段後要去的下一段 id（或 "END"）。
// 規則：段內最後一個「有設定 goTo 且被選中」的單選/下拉題覆蓋 section.defaultNext。
export function resolveNextSection(
  section: Section,
  sections: Section[],
  answers: Record<string, unknown>,
): string {
  let target = section.defaultNext;
  for (const q of questionsOf(section)) {
    if (q.type !== "single_choice" && q.type !== "dropdown") continue;
    const picked = answers[q.id];
    if (typeof picked !== "string") continue;
    const opt = q.options?.find((o) => o.id === picked);
    if (opt?.goTo) target = opt.goTo;
  }
  if (target === "NEXT") {
    const idx = sections.findIndex((s) => s.id === section.id);
    const next = sections[idx + 1];
    return next ? next.id : "END";
  }
  return target; // "END" 或 sectionId
}

// ── builder 工廠 ──────────────────────────────────────────────────────
export function createQuestion(type: QType): QuestionBlock {
  const base = {
    kind: "question" as const,
    id: newId("q"),
    type,
    title: "",
    images: [],
    required: false,
  };
  switch (type) {
    case "single_choice":
    case "multi_choice":
    case "dropdown":
      return { ...base, options: [{ id: newId("o"), label: "選項 1" }] };
    case "linear_scale":
      return { ...base, scale: { min: 1, max: 5 } };
    case "grid_single":
    case "grid_multi":
      return {
        ...base,
        grid: {
          rows: [{ id: newId("r"), label: "列 1" }],
          cols: [{ id: newId("c"), label: "欄 1" }],
        },
      };
    case "file_upload":
      return { ...base, file: { accept: [], maxSizeMB: 10, maxFiles: 1 } };
    default:
      return base;
  }
}

export function createSection(): SectionBlock {
  return { kind: "section", id: newId("s"), title: "新區段", images: [], defaultNext: "NEXT" };
}

export function createText(): TextBlock {
  return { kind: "text", id: newId("t"), heading: "說明標題", body: "", images: [] };
}

export function emptyForm(): FormDefinition {
  return { blocks: [createQuestion("short_text")] };
}

// 發布前的結構完整性檢查（題目 config 是否齊全、是否至少有一題）。回傳人話錯誤陣列。
export function validateFormStructure(def: FormDefinition): string[] {
  const errors: string[] = [];
  const questions = def.blocks.filter(
    (b): b is QuestionBlock => b.kind === "question",
  );
  if (questions.length === 0) errors.push("問卷至少要有一題。");

  for (const q of questions) {
    const label = q.title?.trim() || `（未命名 ${QUESTION_TYPE_LABELS[q.type]}）`;
    if (!q.title?.trim()) errors.push(`有一題（${QUESTION_TYPE_LABELS[q.type]}）還沒填標題。`);

    const needsOptions =
      q.type === "single_choice" || q.type === "multi_choice" || q.type === "dropdown";
    if (needsOptions && (!q.options || q.options.length === 0)) {
      errors.push(`「${label}」至少要一個選項。`);
    }
    if (needsOptions && q.options?.some((o) => !o.label.trim())) {
      errors.push(`「${label}」有空白選項。`);
    }
    if (q.type === "linear_scale" && q.scale && q.scale.min >= q.scale.max) {
      errors.push(`「${label}」量表最小值要小於最大值。`);
    }
    if (q.type === "grid_single" || q.type === "grid_multi") {
      if (!q.grid || q.grid.rows.length === 0 || q.grid.cols.length === 0) {
        errors.push(`「${label}」方格需要至少一列與一欄。`);
      }
    }
  }
  return errors;
}
