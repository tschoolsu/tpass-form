// 決定性偽隨機。特效的粒子位置需要「看起來隨機」，但 React Compiler 禁止 render 期
// 呼叫 Math.random（purity 規則），且不決定性的 render 本身就是 bug 溫床。
// 同一個 seed 永遠產生同一串值 → 粒子分佈穩定、可重現。
export function rng(seed: number): () => number {
  let s = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
