"use client";

// ★ 全屏 scene ★ 只有真的需要「整個畫面有事發生」的選項才用（見 effects.ts 的 scene 欄位）。
// 春／秋／冬 共用同一個 <Fall> 飄落原語，只有夏天、雨、676767 需要自己的視覺。
// 全部 pointer-events-none + aria-hidden，固定播 SCENE_MS 後自我卸載。
import * as React from "react";
import type { SceneKey } from "@/lib/quiz/effects";
import { rng } from "@/lib/quiz/rand";

const SCENE_MS = 3200;

// ── 飄落原語：春櫻、秋葉、冬雪都是它 ──────────────────────────────────
function Fall({
  emojis,
  count,
  duration,
  spin = false,
}: {
  emojis: string[];
  count: number;
  duration: number;
  spin?: boolean;
}) {
  const items = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = rng(i);
        return {
          key: i,
          ch: emojis[i % emojis.length],
          style: {
            left: `${(r() * 100).toFixed(1)}%`,
            "--quiz-sway": `${(r() * 90 - 45).toFixed(0)}px`,
            "--quiz-rot": `${spin ? (r() * 720 - 360).toFixed(0) : "0"}deg`,
            animationDuration: `${(duration * (0.7 + r() * 0.6)).toFixed(0)}ms`,
            animationDelay: `${(r() * 1.1).toFixed(2)}s`,
            fontSize: `${(0.9 + r() * 1.1).toFixed(2)}rem`,
          } as React.CSSProperties,
        };
      }),
    [emojis, count, duration, spin],
  );

  return (
    <>
      {items.map((it) => (
        <span
          key={it.key}
          className="absolute top-0 select-none leading-none animate-quiz-fall"
          style={it.style}
        >
          {it.ch}
        </span>
      ))}
    </>
  );
}

// ── 夏：大太陽光暈脈動 + 泳圈搖晃 + 地表熱氣 ────────────────────────────
function Summer() {
  return (
    <>
      <span
        className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full animate-quiz-pulse"
        style={{
          background:
            "radial-gradient(circle, oklch(0.93 0.16 92 / 0.9) 0%, oklch(0.95 0.13 95 / 0.35) 45%, transparent 70%)",
        }}
      />
      <span
        className="absolute bottom-12 left-[10%] text-5xl select-none animate-quiz-float"
        style={{ animationDuration: "2600ms" }}
      >
        🛟
      </span>
      <span
        className="absolute bottom-20 right-[12%] text-4xl select-none animate-quiz-float"
        style={{ animationDuration: "3100ms", animationDelay: "0.4s" }}
      >
        🕶
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-40 animate-quiz-shimmer"
        style={{
          background: "linear-gradient(to top, oklch(0.95 0.1 200 / 0.4), transparent)",
        }}
      />
      <Fall emojis={["☀️", "🌴", "🍹"]} count={10} duration={5200} />
    </>
  );
}

// ── Singin' in the Rain：雨線 + 道具 ───────────────────────────────────
function Rain() {
  const drops = React.useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const r = rng(i + 500);
        return {
          key: i,
          style: {
            left: `${(r() * 100).toFixed(1)}%`,
            height: `${(40 + r() * 70).toFixed(0)}px`,
            background:
              "linear-gradient(to bottom, transparent, oklch(0.55 0.1 245 / 0.75))",
            animationDuration: `${(650 + r() * 550).toFixed(0)}ms`,
            animationDelay: `${(r() * 1.2).toFixed(2)}s`,
          } as React.CSSProperties,
        };
      }),
    [],
  );

  return (
    <>
      {drops.map((d) => (
        <span
          key={d.key}
          className="absolute top-0 w-px animate-quiz-raindrop"
          style={d.style}
        />
      ))}
      {/* 不用 -translate-x-1/2：quiz-dance 會覆蓋 transform，改用 left 百分比定位。 */}
      <span
        className="absolute bottom-14 left-[45%] text-5xl select-none animate-quiz-dance"
        style={{ animationDuration: "900ms" }}
      >
        🕺
      </span>
      <span
        className="absolute bottom-24 left-[18%] text-4xl select-none animate-quiz-float"
        style={{ animationDuration: "2400ms" }}
      >
        ☂️
      </span>
      <span
        className="absolute top-20 right-[16%] text-4xl select-none animate-quiz-float"
        style={{ animationDuration: "2800ms", animationDelay: "0.3s" }}
      >
        🎩
      </span>
    </>
  );
}

// ── 676767：全場最誇張 ────────────────────────────────────────────────
function SixtySeven() {
  const cells = React.useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const r = rng(i + 900);
        return {
          key: i,
          style: {
            left: `${(r() * 94).toFixed(1)}%`,
            top: `${(r() * 92).toFixed(1)}%`,
            fontSize: `${(1.2 + r() * 3.4).toFixed(2)}rem`,
            animationDelay: `${(r() * 0.9).toFixed(2)}s`,
            animationDuration: `${(700 + r() * 700).toFixed(0)}ms`,
          } as React.CSSProperties,
        };
      }),
    [],
  );

  return (
    <>
      {cells.map((c) => (
        <span
          key={c.key}
          className="absolute select-none font-mono font-extrabold text-[oklch(0.58_0.19_100)] animate-quiz-pop"
          style={c.style}
        >
          67
        </span>
      ))}
    </>
  );
}

function Body({ scene }: { scene: SceneKey }) {
  switch (scene) {
    case "spring":
      return <Fall emojis={["🌸", "🌸", "🌷", "🌼"]} count={28} duration={4200} spin />;
    case "autumn":
      return <Fall emojis={["🍁", "🍂", "🍁", "🌰"]} count={24} duration={3800} spin />;
    case "winter":
      return <Fall emojis={["❄️", "❄", "🌨", "❄️"]} count={32} duration={5200} />;
    case "summer":
      return <Summer />;
    case "rain":
      return <Rain />;
    case "sixtyseven":
      return <SixtySeven />;
    default:
      return null;
  }
}

/** 掛上就播一次；要重播請換 key。 */
export function Scene({ scene }: { scene: SceneKey }) {
  const [alive, setAlive] = React.useState(true);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setAlive(false), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!alive) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden animate-quiz-scene-out"
      style={{ animationDuration: `${SCENE_MS}ms` }}
    >
      <Body scene={scene} />
    </div>
  );
}
