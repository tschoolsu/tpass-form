"use client";

// ★ 客製特效版填寫器 ★ 一題一頁、選中觸發特效、選完自動進下一題（最後一題除外，要手動送出）。
// 題目文字讀 DB 的 definition（後台可改字），特效讀 code 的 registry（用 option id 對映）。
// 提交完全沿用通用管線的 submitFormAction：驗證 / 身分戳記 / 防重複都不重寫。
import * as React from "react";
import { ArrowLeft, ArrowRight, PartyPopper, Send } from "lucide-react";
import {
  type FormDefinition,
  type QuestionBlock,
  type Tone,
} from "@/lib/survey-schema";
import type { AnswerMap } from "@/lib/answers";
import { effectOf } from "@/lib/quiz/effects";
import { Burst } from "@/components/quiz/Burst";
import { OptionCard } from "@/components/quiz/OptionCard";
import { Scene } from "@/components/quiz/Scene";
import { useReducedMotion } from "@/components/quiz/useReducedMotion";
import { Button, cn } from "@/components/ui/primitives";
import { submitFormAction, type SubmitResult } from "@/app/f/[slug]/actions";

const TONE_BG: Record<Tone, string> = {
  green: "bg-tone-green-bg",
  blue: "bg-tone-blue-bg",
  orange: "bg-tone-orange-bg",
  violet: "bg-tone-violet-bg",
  rose: "bg-tone-rose-bg",
};

/** 選中後停留多久再自動進下一題（要看得完特效）。 */
const ADVANCE_MS = 1500;
const ADVANCE_MS_REDUCED = 300;

interface Props {
  slug: string;
  title: string;
  description: string | null;
  definition: FormDefinition;
  tone: Tone;
  identityNotice: string | null;
}

export function QuizFiller({
  slug,
  title,
  description,
  definition,
  tone,
  identityNotice,
}: Props) {
  const questions = React.useMemo(
    () =>
      definition.blocks.filter(
        (b): b is QuestionBlock => b.kind === "question",
      ),
    [definition],
  );

  const reduced = useReducedMotion();
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [burstKey, setBurstKey] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const advanceTimer = React.useRef<number | null>(null);
  const cancelAdvance = React.useCallback(() => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);
  React.useEffect(() => cancelAdvance, [cancelAdvance]);

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const picked = q ? answers[q.id] : undefined;
  // scene 由「當前題的答案」推導，不另存 state：換題自然消失，重選則靠 burstKey 換 key 重播。
  const scene = typeof picked === "string" ? effectOf(picked).scene : undefined;
  const shakeCard =
    typeof picked === "string" ? effectOf(picked).shakeScreen === true : false;

  function pick(optionId: string) {
    if (!q) return;
    cancelAdvance();
    setAnswers((a) => ({ ...a, [q.id]: optionId }));
    setBurstKey((k) => k + 1);
    setError(null);
    if (!isLast) {
      advanceTimer.current = window.setTimeout(
        () => {
          advanceTimer.current = null;
          setStep((s) => Math.min(s + 1, questions.length - 1));
        },
        reduced ? ADVANCE_MS_REDUCED : ADVANCE_MS,
      );
    }
  }

  function goNext() {
    if (!q) return;
    if (typeof answers[q.id] !== "string") {
      setError("這題還沒選。");
      return;
    }
    cancelAdvance();
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    void submit();
  }

  function goBack() {
    cancelAdvance();
    setError(null);
    setMessage(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    let res: SubmitResult;
    try {
      res = await submitFormAction(slug, answers);
    } finally {
      setSubmitting(false);
    }
    if (res.ok) {
      setBurstKey((k) => k + 1);
      setDone(true);
      return;
    }
    setMessage(res.message ?? "送出失敗，請再試一次。");
  }

  if (done) {
    return (
      <div className="relative rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
        <PartyPopper className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 font-extrabold text-2xl">送出了，謝謝你！</h2>
        <p className="mt-2 font-medium text-muted-foreground">
          你的回覆已經收到。祝你直屬順利。
        </p>
        {!reduced && (
          <Burst
            key={burstKey}
            spec={{
              emojis: ["🎉", "🎊", "✨", "🩷", "💚"],
              count: 22,
              spread: 200,
              gravity: -0.3,
              duration: 1600,
            }}
          />
        )}
      </div>
    );
  }

  if (!q) {
    return (
      <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
        <h2 className="font-extrabold text-xl">這份問卷目前沒有題目</h2>
      </div>
    );
  }

  const progress = ((step + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col gap-4">
      {scene && !reduced && <Scene key={burstKey} scene={scene} />}

      {/* 抬頭 */}
      <div
        className={cn(
          "rounded-2xl border-2 border-foreground p-6 shadow-[4px_4px_0_0_var(--color-foreground)]",
          TONE_BG[tone],
        )}
      >
        <h1 className="font-extrabold text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 font-medium text-foreground/80 whitespace-pre-wrap">
            {description}
          </p>
        )}
        {identityNotice && (
          <p className="mt-3 inline-block rounded-md border-2 border-foreground bg-card px-2 py-1 font-mono text-[11px] font-bold">
            {identityNotice}
          </p>
        )}
      </div>

      {/* 進度 */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold">
          {step + 1} / {questions.length}
        </span>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-foreground bg-card">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 題目 + 選項 */}
      <div
        className={cn(
          "rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]",
          shakeCard && !reduced && "animate-quiz-shake",
        )}
      >
        <h2 className="font-extrabold text-lg sm:text-xl">{q.title}</h2>
        {q.description && (
          <p className="mt-1 font-medium text-muted-foreground">{q.description}</p>
        )}

        <div role="radiogroup" aria-label={q.title} className="mt-4 flex flex-col gap-2.5">
          {q.options?.map((o, i) => (
            <OptionCard
              key={o.id}
              optionId={o.id}
              label={o.label}
              index={i}
              selected={picked === o.id}
              burstKey={burstKey}
              reduced={reduced}
              onSelect={() => pick(o.id)}
            />
          ))}
        </div>

        {error && (
          <p className="mt-3 font-mono text-xs font-bold text-destructive">{error}</p>
        )}
      </div>

      {message && (
        <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 font-bold text-sm">
          {message}
        </p>
      )}

      {/* 導覽 */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0 || submitting}>
          <ArrowLeft className="h-4 w-4" /> 上一步
        </Button>
        <Button
          type="button"
          variant={isLast ? "primary" : "accent"}
          onClick={goNext}
          disabled={submitting}
        >
          {isLast ? (
            <>
              <Send className="h-4 w-4" /> {submitting ? "送出中…" : "送出"}
            </>
          ) : (
            <>
              下一步 <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
