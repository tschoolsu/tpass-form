"use client";

// 選項大按鈕。Neobrutalism 底子（border-2 border-foreground + hard shadow）不動，
// 特效只覆蓋背景 / 文字色 / 字體，並在選中時附加動畫 class 與粒子。
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "tpass-ui";
import { effectOf } from "@/lib/quiz/effects";
import { rng } from "@/lib/quiz/rand";
import { Burst } from "@/components/quiz/Burst";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ⚠ 背景色**不能**放進 BASE：Tailwind 會把 bg-card 這種 theme token 排在
// arbitrary 的 bg-[oklch(…)] 之後，同權重下 BASE 反而蓋掉選項自己的顏色
// （症狀：整排按鈕都是白底，設白字的那幾個直接看不到字）。背景一律由 fx 提供。
const BASE =
  "relative flex w-full items-center gap-3 overflow-visible rounded-2xl border-2 border-foreground px-4 py-3.5 text-left font-bold transition-all duration-200 shadow-[3px_3px_0_0_var(--color-foreground)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]";

// ── textFx：少數選項的文字本身要有事發生 ──────────────────────────────
function Marquee({ text }: { text: string }) {
  const train = `${text}　`.repeat(6);
  return (
    <span className="inline-flex max-w-[9rem] overflow-hidden align-bottom">
      <span className="whitespace-nowrap animate-quiz-marquee">{train}</span>
    </span>
  );
}

// 只在選中時掛上（未選中時 OptionCard 直接印原文），所以不需要 reset 分支。
function Scramble({ text }: { text: string }) {
  const [shown, setShown] = React.useState(text);

  React.useEffect(() => {
    const chars = [...text];
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      if (tick > 9) {
        window.clearInterval(timer);
        setShown(text);
        return;
      }
      const r = rng(tick);
      setShown(
        chars
          .map((c) => ({ c, k: r() }))
          .sort((a, b) => a.k - b.k)
          .map((x) => x.c)
          .join(""),
      );
    }, 65);
    return () => window.clearInterval(timer);
  }, [text]);

  return <>{shown}</>;
}

const TICKS = ["07:59:57", "07:59:58", "07:59:59", "08:00:00"];

function Ticker() {
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setI((p) => (p + 1 < TICKS.length ? p + 1 : p));
    }, 230);
    return () => window.clearInterval(timer);
  }, []);

  const late = i === TICKS.length - 1;
  return (
    <span
      className={cn(
        "ml-2 inline-block rounded-md border-2 border-foreground bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold",
        late && "text-destructive",
      )}
    >
      {TICKS[i]}
    </span>
  );
}

interface Props {
  optionId: string;
  label: string;
  index: number;
  selected: boolean;
  /** 每次選擇 +1；換 key 讓 <Burst> 重播。 */
  burstKey: number;
  /** 系統要求減少動態效果 → 只留 decor。 */
  reduced: boolean;
  onSelect: () => void;
}

export function OptionCard({
  optionId,
  label,
  index,
  selected,
  burstKey,
  reduced,
  onSelect,
}: Props) {
  const fx = effectOf(optionId);
  const animate = selected && !reduced;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        BASE,
        fx.className ?? "bg-card",
        selected && "ring-4 ring-foreground/15",
        animate && fx.selectedClass,
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-card font-mono text-xs font-bold text-foreground">
        {selected ? <Check className="h-3.5 w-3.5" /> : LETTERS[index]}
      </span>

      {fx.icon && <fx.icon className="h-5 w-5 shrink-0" aria-hidden />}

      <span className="min-w-0 flex-1">
        {animate && fx.textFx === "marquee" ? (
          <Marquee text={label} />
        ) : animate && fx.textFx === "scramble" ? (
          <Scramble key={burstKey} text={label} />
        ) : (
          label
        )}
        {animate && fx.textFx === "ticker" && <Ticker key={burstKey} />}
      </span>

      {animate && fx.burst && <Burst key={burstKey} spec={fx.burst} />}
    </button>
  );
}
