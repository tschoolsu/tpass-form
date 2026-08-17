"use client";

// ★ 通用 emoji 粒子 ★ 只有這一個元件，涵蓋櫻花／落葉／雪／雨／confetti／音符／💩⋯⋯
// 差異全在 BurstSpec 的參數。只動 transform / opacity（GPU 友善），到期自我卸載，DOM 不累積。
import * as React from "react";
import type { BurstSpec } from "@/lib/quiz/effects";
import { rng } from "@/lib/quiz/rand";

const MAX_COUNT = 24;

interface Particle {
  key: number;
  ch: string;
  style: React.CSSProperties;
}

function build(spec: BurstSpec, duration: number): Particle[] {
  const count = Math.min(spec.count ?? 14, MAX_COUNT);
  const spread = spec.spread ?? 120;
  const gravity = spec.gravity ?? 0;

  return Array.from({ length: count }, (_, i) => {
    const r = rng(i);
    const angle = (i / count) * Math.PI * 2 + r() * 0.7;
    const dist = spread * (0.45 + r() * 0.55);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist * 0.7 + gravity * spread;
    return {
      key: i,
      ch: spec.emojis[i % spec.emojis.length],
      style: {
        "--quiz-tx": `${tx.toFixed(1)}px`,
        "--quiz-ty": `${ty.toFixed(1)}px`,
        "--quiz-rot": `${(r() * 640 - 320).toFixed(0)}deg`,
        animationDuration: `${duration}ms`,
        animationDelay: `${(r() * 0.18).toFixed(2)}s`,
        fontSize: `${(0.9 + r() * 0.7).toFixed(2)}rem`,
      } as React.CSSProperties,
    };
  });
}

/** 掛上就播一次。要重播請換 key（QuizFiller 用遞增的 burstKey）。 */
export function Burst({ spec }: { spec: BurstSpec }) {
  const duration = spec.duration ?? 900;
  const [alive, setAlive] = React.useState(true);
  const particles = React.useMemo(() => build(spec, duration), [spec, duration]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setAlive(false), duration + 300);
    return () => window.clearTimeout(timer);
  }, [duration]);

  if (!alive) return null;

  const anim =
    spec.direction === "in" ? "animate-quiz-particle-in" : "animate-quiz-particle-out";

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {particles.map((p) => (
        <span
          key={p.key}
          className={`absolute left-1/2 top-1/2 select-none leading-none ${anim}`}
          style={p.style}
        >
          {p.ch}
        </span>
      ))}
    </span>
  );
}
