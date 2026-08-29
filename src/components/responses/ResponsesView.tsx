"use client";
// 回覆檢視三分頁：摘要 / 依題目 / 單筆。三者共用 server 一次撈好的同一份 responses，
// 統計在 client 端算（useMemo），不另外打 API。
import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, List, Search, Trash2, User } from "lucide-react";
import type { QuestionBlock } from "@/lib/survey-schema";
import { computeStats, type ResponseRecord } from "@/lib/response-stats";
import { Badge, Button, Input, Select, cn } from "tpass-ui";
import { QuestionSummary } from "@/components/responses/QuestionSummary";
import { SingleResponse } from "@/components/responses/SingleResponse";
import { AnswerView } from "@/components/responses/AnswerView";
import { deleteResponseAction } from "@/app/admin/forms/[id]/responses/actions";

type Tab = "summary" | "question" | "single";

const TABS: { id: Tab; label: string; icon: typeof List }[] = [
  { id: "summary", label: "摘要", icon: BarChart3 },
  { id: "question", label: "依題目", icon: List },
  { id: "single", label: "單筆", icon: User },
];

export function ResponsesView({
  formId,
  questions,
  responses,
  anonymous,
}: {
  formId: string;
  questions: QuestionBlock[];
  responses: ResponseRecord[];
  anonymous: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("summary");
  const [qIndex, setQIndex] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  const stats = React.useMemo(
    () => questions.map((q) => computeStats(q, responses)),
    [questions, responses],
  );

  // 單筆分頁的搜尋：姓名 / 電子郵件，不分大小寫。
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return responses;
    return responses.filter((r) =>
      `${r.respondentName ?? ""} ${r.respondentEmail ?? ""}`.toLowerCase().includes(needle),
    );
  }, [responses, query]);

  // 索引一律在 render 時夾住：刪除 / 搜尋都可能讓長度縮短。
  const idx = Math.min(cursor, Math.max(0, filtered.length - 1));
  const current = filtered[idx];

  const jumpTo = (responseId: string) => {
    const at = responses.findIndex((r) => r.id === responseId);
    if (at < 0) return;
    setQuery("");
    setCursor(at);
    setTab("single");
  };

  const qi = Math.min(qIndex, questions.length - 1);
  const q = questions[qi];

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border-2 border-foreground px-3 py-2 text-sm font-bold shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)]",
              tab === id ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "summary" && (
        <div className="flex flex-col gap-4">
          {questions.map((question, i) => (
            <QuestionSummary
              key={question.id}
              q={question}
              stats={stats[i]}
              index={i}
              onJump={jumpTo}
            />
          ))}
        </div>
      )}

      {tab === "question" && q && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              aria-label="上一題"
              disabled={qi === 0}
              onClick={() => setQIndex(Math.max(0, qi - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={q.id}
              onChange={(e) => setQIndex(questions.findIndex((x) => x.id === e.target.value))}
              className="flex-1"
            >
              {questions.map((x, i) => (
                <option key={x.id} value={x.id}>
                  Q{i + 1}. {x.title || "（未命名題目）"}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              aria-label="下一題"
              disabled={qi >= questions.length - 1}
              onClick={() => setQIndex(Math.min(questions.length - 1, qi + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <QuestionSummary q={q} stats={stats[qi]} index={qi} large onJump={jumpTo} />

          <section className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]">
            <h3 className="mb-3 font-extrabold">作答明細（{responses.length} 筆）</h3>
            <ul className="flex flex-col gap-2">
              {responses.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground bg-tone-green-bg px-3 py-2"
                >
                  <span className="min-w-0 font-medium">
                    <AnswerView q={q} value={r.answers[q.id]} />
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1">
                    {r.respondentName && (
                      <Badge className="bg-tone-blue-badge">{r.respondentName}</Badge>
                    )}
                    {r.respondentEmail && (
                      <Badge className="bg-tone-blue-badge">{r.respondentEmail}</Badge>
                    )}
                    <Button size="sm" className="ml-1" onClick={() => jumpTo(r.id)}>
                      看單筆
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "single" && (
        <div className="flex flex-col gap-4">
          {!anonymous && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                placeholder="搜尋姓名或電子郵件"
                className="pl-9"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-foreground/30 p-10 text-center font-bold">
              沒有符合的回覆。
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    aria-label="上一筆"
                    disabled={idx === 0}
                    onClick={() => setCursor(Math.max(0, idx - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-mono text-sm font-bold">
                    第 {idx + 1} 筆 / 共 {filtered.length} 筆
                    {query.trim() && `（全部 ${responses.length} 筆）`}
                  </span>
                  <Button
                    size="sm"
                    aria-label="下一筆"
                    disabled={idx >= filtered.length - 1}
                    onClick={() => setCursor(Math.min(filtered.length - 1, idx + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <DeleteResponse
                  key={current.id}
                  formId={formId}
                  responseId={current.id}
                  onDeleted={() => router.refresh()}
                />
              </div>
              <SingleResponse response={current} questions={questions} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 行內兩段式確認（專案沒有 dialog 原語，也不用瀏覽器 confirm）。
// 由呼叫端用 key={responseId} 掛載：換到別筆就重新掛載，確認狀態自動歸零，避免手殘刪錯。
function DeleteResponse({
  formId,
  responseId,
  onDeleted,
}: {
  formId: string;
  responseId: string;
  onDeleted: () => void;
}) {
  const [armed, setArmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () =>
    startTransition(async () => {
      const res = await deleteResponseAction(formId, responseId);
      if (!res.ok) {
        setError(res.error ?? "刪除失敗");
        return;
      }
      setArmed(false);
      onDeleted();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm font-bold text-destructive">{error}</span>}
      {armed ? (
        <>
          <span className="text-sm font-bold">確定刪除這筆回覆？</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "刪除中…" : "確定刪除"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setArmed(false)}>
            取消
          </Button>
        </>
      ) : (
        <Button size="sm" variant="destructive" onClick={() => setArmed(true)}>
          <Trash2 className="h-4 w-4" /> 刪除此筆
        </Button>
      )}
    </div>
  );
}
