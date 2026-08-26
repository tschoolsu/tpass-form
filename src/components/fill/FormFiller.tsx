"use client";

import * as React from "react";
import { CheckCircle2, ArrowLeft, ArrowRight, Send } from "lucide-react";
import {
  type FormDefinition,
  type ImageRef,
  type Tone,
  getSections,
  questionsOf,
  resolveNextSection,
  START_SECTION_ID,
} from "@/lib/survey-schema";
import { validateValue, type AnswerMap } from "@/lib/answers";
import { QuestionRenderer } from "@/components/fill/QuestionRenderer";
import { Button, cn } from "@/components/ui/primitives";
import { DescriptionImages } from "@/components/common/DescriptionImages";
import { submitFormAction, type SubmitResult } from "@/app/f/[slug]/actions";
import { useDraftAutosave } from "@/components/fill/useDraftAutosave";
import { DraftBar } from "@/components/fill/DraftBar";

interface Props {
  slug: string;
  formId: string;
  title: string;
  description: string | null;
  descriptionImages: ImageRef[];
  definition: FormDefinition;
  tone: Tone;
  identityNotice: string | null;
  // 伺服器端草稿（自動儲存的填寫進度）。沒有草稿時一律 null。
  initialAnswers?: AnswerMap | null;
  initialHistory?: string[] | null;
  draftSavedAt?: string | null;
}

const TONE_BG: Record<Tone, string> = {
  green: "bg-tone-green-bg",
  blue: "bg-tone-blue-bg",
  orange: "bg-tone-orange-bg",
  violet: "bg-tone-violet-bg",
  rose: "bg-tone-rose-bg",
};

export function FormFiller({
  slug,
  formId,
  title,
  description,
  descriptionImages,
  definition,
  tone,
  identityNotice,
  initialAnswers = null,
  initialHistory = null,
  draftSavedAt = null,
}: Props) {
  const sections = React.useMemo(() => getSections(definition), [definition]);
  const byId = React.useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const [answers, setAnswers] = React.useState<AnswerMap>(() => initialAnswers ?? {});
  // 草稿存下來的區段可能已被建構者刪掉，只留現在還存在的；全沒了就回開頭。
  const [history, setHistory] = React.useState<string[]>(() => {
    const kept = (initialHistory ?? []).filter((id) => byId.has(id));
    return kept.length > 0 ? kept : [START_SECTION_ID];
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const currentId = history[history.length - 1];
  const section = byId.get(currentId) ?? sections[0];
  const nextTarget = resolveNextSection(section, sections, answers);
  const isLast = nextTarget === "END";

  const draft = useDraftAutosave(slug, answers, history, draftSavedAt);

  const setAnswer = (qid: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    setErrors((e) => {
      if (!e[qid]) return e;
      const { [qid]: _omit, ...rest } = e;
      return rest;
    });
  };

  function validateCurrent(): boolean {
    const next: Record<string, string> = {};
    for (const q of questionsOf(section)) {
      const err = validateValue(q, answers[q.id]);
      if (err) next[q.id] = err;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function goNext() {
    if (!validateCurrent()) return;
    if (isLast) {
      setSubmitting(true);
      setMessage(null);
      let res: SubmitResult;
      try {
        res = await submitFormAction(slug, answers);
      } finally {
        setSubmitting(false);
      }
      if (res.ok) {
        draft.markDone(); // 送出後草稿已由伺服器刪掉，別再存回去
        setDone(true);
      } else {
        if (res.errors) setErrors(res.errors);
        setMessage(res.message ?? "送出失敗，請再試一次。");
      }
      return;
    }
    setHistory((h) => [...h, nextTarget]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discard() {
    await draft.discard();
    setAnswers({});
    setHistory([START_SECTION_ID]);
    setErrors({});
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 font-extrabold text-2xl">已送出，謝謝你！</h2>
        <p className="mt-2 font-medium text-muted-foreground">你的回覆已經收到。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 抬頭 */}
      <div
        className={cn(
          "rounded-2xl border-2 border-foreground p-6 shadow-[4px_4px_0_0_var(--color-foreground)]",
          TONE_BG[tone],
        )}
      >
        <h1 className="font-extrabold text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 font-medium text-foreground/80 whitespace-pre-wrap">{description}</p>
        )}
        <DescriptionImages images={descriptionImages} />
        {identityNotice && (
          <p className="mt-3 inline-block rounded-md border-2 border-foreground bg-card px-2 py-1 font-mono text-[11px] font-bold">
            {identityNotice}
          </p>
        )}
      </div>

      {draft.restored && (
        <p className="rounded-xl border-2 border-foreground bg-tone-green-badge px-3 py-2 font-mono text-[11px] font-bold">
          已還原你上次的填寫進度
        </p>
      )}

      {/* 區段標題 */}
      {section.id !== START_SECTION_ID &&
        (section.title || section.description || section.images.length > 0) && (
        <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]">
          {section.title && <h2 className="font-extrabold text-lg">{section.title}</h2>}
          {section.description && (
            <p className="mt-1 font-medium text-muted-foreground whitespace-pre-wrap">
              {section.description}
            </p>
          )}
          <DescriptionImages images={section.images} />
        </div>
      )}

      {/* 區段內 blocks */}
      {section.blocks.map((block) =>
        block.kind === "question" ? (
          <div
            key={block.id}
            className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]"
          >
            <QuestionRenderer
              question={block}
              value={answers[block.id]}
              onChange={(v) => setAnswer(block.id, v)}
              error={errors[block.id]}
              formId={formId}
            />
          </div>
        ) : (
          <div
            key={block.id}
            className="rounded-2xl border-2 border-dashed border-foreground/40 bg-muted/40 p-5"
          >
            {block.heading && <h3 className="font-extrabold">{block.heading}</h3>}
            {block.body && (
              <p className="mt-1 font-medium text-muted-foreground whitespace-pre-wrap">
                {block.body}
              </p>
            )}
            <DescriptionImages images={block.images} />
          </div>
        ),
      )}

      {message && (
        <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 font-bold text-sm">
          {message}
        </p>
      )}

      <DraftBar
        saveState={draft.saveState}
        savedAt={draft.savedAt}
        disabled={submitting}
        onDiscard={() => void discard()}
      />

      {/* 導覽 */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={history.length <= 1 || submitting}
        >
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

