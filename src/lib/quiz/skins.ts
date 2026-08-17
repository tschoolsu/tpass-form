// 哪些 slug 要用客製特效版填寫器渲染（其餘一律走通用 FormFiller）。
// 目前只有一份客製問卷；要再加就往這個 Set 加 slug 並補對應的 filler。
import { QUIZ_SLUG } from "@/lib/quiz/freshman-quiz";

const SKINNED = new Set<string>([QUIZ_SLUG]);

export function hasQuizSkin(slug: string): boolean {
  return SKINNED.has(slug);
}
