// 答案驗證（isomorphic：填寫器 client 即時驗 + submit server 端再驗一次，同一份邏輯）。
// 跳轉感知：只對「使用者實際走過的段」裡的題目強制必填——server 端會用答案重算路徑，不信任 client。
import {
  type FormDefinition,
  type QuestionBlock,
  type Section,
  getSections,
  questionsOf,
  resolveNextSection,
  START_SECTION_ID,
} from "@/lib/survey-schema";

export type AnswerMap = Record<string, unknown>;

// 從 __start__ 依答案沿著跳轉走，收集走過的段（防環：最多走 section 數 + 1 次）。
export function walkVisitedSections(
  def: FormDefinition,
  answers: AnswerMap,
): Section[] {
  const sections = getSections(def);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const visited: Section[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = START_SECTION_ID;
  let guard = 0;
  while (cursor && cursor !== "END" && guard <= sections.length) {
    const sec = byId.get(cursor);
    if (!sec || seen.has(sec.id)) break;
    seen.add(sec.id);
    visited.push(sec);
    cursor = resolveNextSection(sec, sections, answers);
    guard++;
  }
  return visited;
}

export function walkVisitedQuestions(
  def: FormDefinition,
  answers: AnswerMap,
): QuestionBlock[] {
  return walkVisitedSections(def, answers).flatMap(questionsOf);
}

// 空白判定（驗證與結果彙整共用：沒填就是沒填）。
export function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

// 驗單一題的值，回傳錯誤訊息或 null。required 為 false 且空白 → 直接通過。
export function validateValue(q: QuestionBlock, value: unknown): string | null {
  const blank = isBlank(value);
  if (blank) return q.required ? "此題必填" : null;

  switch (q.type) {
    case "short_text":
    case "paragraph":
      if (typeof value !== "string") return "格式錯誤";
      return null;
    case "single_choice":
    case "dropdown": {
      if (typeof value !== "string") return "格式錯誤";
      return q.options?.some((o) => o.id === value) ? null : "選項不存在";
    }
    case "multi_choice": {
      if (!Array.isArray(value)) return "格式錯誤";
      const ids = new Set(q.options?.map((o) => o.id));
      return value.every((v) => typeof v === "string" && ids.has(v))
        ? null
        : "選項不存在";
    }
    case "linear_scale": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return "請選一個數值";
      if (q.scale && (n < q.scale.min || n > q.scale.max)) return "超出量表範圍";
      return null;
    }
    case "date":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return "日期格式錯誤";
      return null;
    case "grid_single": {
      const map = value as Record<string, unknown>;
      const cols = new Set(q.grid?.cols.map((c) => c.id));
      for (const row of q.grid?.rows ?? []) {
        const picked = map?.[row.id];
        if (q.required && (picked === undefined || picked === null))
          return "每一列都要選";
        if (picked !== undefined && !cols.has(picked as string))
          return "選項不存在";
      }
      return null;
    }
    case "grid_multi": {
      const map = value as Record<string, unknown>;
      const cols = new Set(q.grid?.cols.map((c) => c.id));
      for (const row of q.grid?.rows ?? []) {
        const picked = map?.[row.id];
        if (q.required && (!Array.isArray(picked) || picked.length === 0))
          return "每一列至少選一個";
        if (Array.isArray(picked) && !picked.every((c) => cols.has(c as string)))
          return "選項不存在";
      }
      return null;
    }
    case "file_upload": {
      if (!Array.isArray(value)) return "格式錯誤";
      if (q.file && value.length > q.file.maxFiles)
        return `最多上傳 ${q.file.maxFiles} 個檔案`;
      return null;
    }
    default:
      return null;
  }
}

// 驗整份（只驗走過路徑上的題）。回傳 { [questionId]: errorMessage }。
export function validateAnswers(
  def: FormDefinition,
  answers: AnswerMap,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of walkVisitedQuestions(def, answers)) {
    const err = validateValue(q, answers[q.id]);
    if (err) errors[q.id] = err;
  }
  return errors;
}
