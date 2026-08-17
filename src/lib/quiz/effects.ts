// ★ 選項特效 registry ★ key = option id（見 ./freshman-quiz.ts）。
//
// 特效分三層，只有第三層需要手寫元件：
//   1. decor  — className / icon：純資料，零程式。
//   2. burst  — 選中時噴出的 emoji 粒子。差異只在參數，全部共用一個 <Burst>。
//   3. scene  — 真的需要全屏視覺的才寫元件（6 個，見 components/quiz/scenes/）。
//
// 顏色一律 OKLCH（design.md 鐵則）。按鈕的 border-2 border-foreground 與 hard shadow
// 由 OptionCard 提供，這裡只覆蓋背景 / 文字 / 字體。
import {
  AlarmClock,
  AudioLines,
  Backpack,
  Bath,
  BedDouble,
  Clock,
  CloudRain,
  Coffee,
  Disc3,
  Droplets,
  EyeOff,
  FileText,
  Flower2,
  Footprints,
  Frown,
  Ghost,
  GraduationCap,
  Guitar,
  Heart,
  HeartCrack,
  HeartHandshake,
  Hourglass,
  House,
  Keyboard,
  Laugh,
  Leaf,
  Mic,
  MicVocal,
  Mountain,
  Music4,
  Piano,
  PiggyBank,
  Popcorn,
  Radio,
  School,
  Shuffle,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  ThumbsDown,
  VolumeX,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type SceneKey = "spring" | "summer" | "autumn" | "winter" | "rain" | "sixtyseven";

/** 選項文字本身的特殊處理（由 OptionCard 分派）。 */
export type TextFx = "marquee" | "scramble" | "ticker" | "cite";

export interface BurstSpec {
  emojis: string[];
  /** 粒子數，預設 14，上限 24（效能）。 */
  count?: number;
  /** 噴散半徑（px），預設 120。0 = 原地。 */
  spread?: number;
  /** >0 下墜、<0 上升、0 直線放射。預設 0。 */
  gravity?: number;
  /** "in" = 粒子從外往內被吸回（反向特效）。 */
  direction?: "out" | "in";
  /** ms，預設 900。 */
  duration?: number;
}

export interface OptionEffect {
  icon?: LucideIcon;
  /** 靜態樣式覆蓋（背景 / 文字色 / 字體）。 */
  className?: string;
  /** 選中時附加的動畫 class。省略 = 選中後完全不動。 */
  selectedClass?: string;
  burst?: BurstSpec;
  scene?: SceneKey;
  /** 選中時整張題卡震動。 */
  shakeScreen?: boolean;
  textFx?: TextFx;
}

export const OPTION_EFFECTS: Record<string, OptionEffect> = {
  // ── Q1 音樂類型 ─────────────────────────────────────────────────────
  o_pop: {
    icon: Mic,
    className: "bg-[oklch(0.93_0.07_350)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🎤", "✨", "💖", "🩷"], gravity: -0.4 },
  },
  o_rock: {
    icon: Guitar,
    className: "bg-[oklch(0.28_0.02_264)] text-[oklch(0.99_0_0)]",
    selectedClass: "animate-quiz-shake",
    burst: { emojis: ["🤘", "🎸", "🔥", "⚡"], count: 18, spread: 150 },
  },
  o_folk: {
    icon: Leaf,
    className: "bg-[oklch(0.94_0.06_120)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["🍃", "🪕", "🌾"], gravity: 0.5, duration: 1400 },
  },
  o_jazz: {
    icon: Music4,
    className: "bg-[oklch(0.32_0.06_285)] text-[oklch(0.99_0_0)]",
    selectedClass: "animate-quiz-sway",
    burst: { emojis: ["🎷", "🥂", "🎶"], gravity: -0.3, duration: 1300 },
  },
  o_blues: {
    icon: Droplets,
    className: "bg-[oklch(0.9_0.08_250)]",
    selectedClass: "animate-quiz-sway",
    burst: { emojis: ["🎺", "💧", "🎵"], gravity: 0.6, duration: 1200 },
  },
  o_hiphop: {
    icon: Disc3,
    className: "bg-[oklch(0.9_0.12_90)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🧢", "💥", "🔥", "🎧"], count: 20, spread: 160 },
  },
  o_rnb: {
    icon: Heart,
    className: "bg-[oklch(0.9_0.09_320)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["💜", "🎶", "🕯"], gravity: -0.4, duration: 1300 },
  },
  o_edm: {
    icon: Zap,
    className: "bg-[oklch(0.92_0.14_190)]",
    selectedClass: "animate-quiz-strobe",
    burst: { emojis: ["🔊", "⚡", "🌈", "💠"], count: 22, spread: 180, duration: 700 },
  },
  o_classical: {
    icon: Piano,
    className: "bg-[oklch(0.95_0.04_85)] tracking-wide",
    selectedClass: "animate-quiz-halo",
    burst: { emojis: ["🎼", "🕊", "🎻"], gravity: -0.2, duration: 1500 },
  },
  o_indie: {
    icon: Radio,
    className: "bg-[oklch(0.93_0.05_160)]",
    selectedClass: "animate-quiz-nudge",
    burst: { emojis: ["📼", "🌿", "🎙"], gravity: 0.3, duration: 1200 },
  },
  o_nomusic: {
    icon: VolumeX,
    className: "bg-[oklch(0.93_0.004_250)] text-muted-foreground",
    // 反向特效：粒子從外圍被吸回按鈕，最後歸零。
    burst: { emojis: ["🔇", "🤫", "🚫"], count: 12, direction: "in", duration: 1100 },
  },

  // ── Q2 季節（四個都是 scene 級）───────────────────────────────────────
  o_spring: {
    icon: Flower2,
    className: "bg-[oklch(0.95_0.05_350)]",
    selectedClass: "animate-quiz-bloom",
    scene: "spring",
    burst: { emojis: ["🌸", "🌷", "🐝"], gravity: 0.4, duration: 1600 },
  },
  o_summer: {
    icon: Sun,
    className: "bg-[oklch(0.93_0.12_85)]",
    selectedClass: "animate-quiz-sunglow",
    scene: "summer",
    burst: { emojis: ["🛟", "🌊", "🍉", "😎"], gravity: -0.2, duration: 1300 },
  },
  o_autumn: {
    icon: Leaf,
    className: "bg-[oklch(0.93_0.09_60)]",
    selectedClass: "animate-quiz-sway",
    scene: "autumn",
    burst: { emojis: ["🍁", "🍂", "🌰"], gravity: 0.5, duration: 1800 },
  },
  o_winter: {
    icon: Snowflake,
    className: "bg-[oklch(0.96_0.03_230)]",
    selectedClass: "animate-quiz-frost",
    scene: "winter",
    burst: { emojis: ["❄️", "🧊", "☃️"], gravity: 0.35, duration: 2000 },
  },

  // ── Q3 排隊 ─────────────────────────────────────────────────────────
  o_wait: {
    icon: Hourglass,
    className: "bg-[oklch(0.95_0.02_250)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["⏳", "…"], count: 8, duration: 1600, gravity: 0.2 },
  },
  o_leave: {
    icon: Footprints,
    className: "bg-[oklch(0.94_0.06_200)]",
    selectedClass: "animate-quiz-dashout",
    burst: { emojis: ["💨", "🏃"], count: 10, spread: 70, duration: 800 },
  },
  o_rage: {
    icon: AudioLines,
    className: "bg-[oklch(0.72_0.18_25)] text-[oklch(0.99_0_0)]",
    selectedClass: "animate-quiz-shake",
    shakeScreen: true,
    burst: { emojis: ["😡", "🥀", "💀", "😱", "😭"], count: 24, spread: 210, duration: 850 },
  },

  // ── Q4 睡多久 ───────────────────────────────────────────────────────
  o_sleep02: {
    icon: Coffee,
    className: "bg-[oklch(0.9_0.06_50)]",
    selectedClass: "animate-quiz-jitter",
    burst: { emojis: ["☕", "💀", "🥲"], count: 16, spread: 140 },
  },
  o_sleep35: {
    icon: Frown,
    className: "bg-[oklch(0.94_0.04_60)]",
    selectedClass: "animate-quiz-nudge",
    burst: { emojis: ["😪", "🥱"], count: 10, gravity: 0.3, duration: 1200 },
  },
  o_sleep67: {
    icon: Smile,
    className: "bg-[oklch(0.95_0.05_150)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["😌", "🌤"], count: 10, gravity: -0.3, duration: 1200 },
  },
  o_sleep8: {
    icon: Sparkles,
    className: "bg-[oklch(0.94_0.07_260)]",
    selectedClass: "animate-quiz-halo",
    burst: { emojis: ["✨", "😴", "🌙"], gravity: -0.4, duration: 1400 },
  },
  o_sleepall: {
    icon: BedDouble,
    className: "bg-[oklch(0.93_0.05_300)]",
    // 按鈕整個「躺下」。
    selectedClass: "animate-quiz-liedown",
    burst: { emojis: ["💤", "🛏", "🐨"], count: 12, gravity: -0.25, duration: 2000 },
  },

  // ── Q5 下大雨 ───────────────────────────────────────────────────────
  o_dash: {
    icon: Wind,
    className: "bg-[oklch(0.93_0.07_210)]",
    selectedClass: "animate-quiz-dashout",
    burst: { emojis: ["💨", "💦"], count: 12, spread: 80, duration: 800 },
  },
  o_buy: {
    icon: CloudRain,
    className: "bg-[oklch(0.94_0.06_150)]",
    selectedClass: "animate-quiz-openup",
    burst: { emojis: ["☂️", "🏪", "🧾"], count: 12, gravity: -0.2 },
  },
  o_share: {
    icon: HeartHandshake,
    className: "bg-[oklch(0.94_0.06_340)]",
    selectedClass: "animate-quiz-nudge",
    burst: { emojis: ["☂️", "🫶", "💕"], count: 12, gravity: -0.3, duration: 1300 },
  },
  o_stay: {
    icon: Hourglass,
    className: "bg-[oklch(0.94_0.02_250)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["🌧", "⏳"], count: 8, gravity: 0.6, duration: 1800 },
  },
  o_singin: {
    icon: MicVocal,
    className: "bg-[oklch(0.9_0.1_240)]",
    selectedClass: "animate-quiz-dance",
    scene: "rain",
    burst: { emojis: ["🎩", "☂️", "✨", "🎶"], count: 20, gravity: -0.2, duration: 1500 },
  },

  // ── Q6 電影票 ───────────────────────────────────────────────────────
  o_friend: {
    icon: Popcorn,
    className: "bg-[oklch(0.94_0.08_75)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🍿", "😂", "🎬"], count: 14 },
  },
  o_family: {
    icon: House,
    className: "bg-[oklch(0.94_0.06_30)]",
    selectedClass: "animate-quiz-breathe",
    burst: { emojis: ["🏠", "❤️", "🍚"], count: 12, gravity: -0.3, duration: 1300 },
  },
  o_principal: {
    icon: GraduationCap,
    // 金色 hard shadow（照 design.md「Inverted Card」的換 shadow 色做法，border 仍是 foreground）。
    className:
      "bg-[oklch(0.92_0.11_95)] shadow-[4px_4px_0_0_oklch(0.7_0.15_88)] hover:shadow-[7px_7px_0_0_oklch(0.7_0.15_88)]",
    selectedClass: "animate-quiz-solemn",
    burst: { emojis: ["🎓", "📜", "😐"], count: 10, duration: 1200 },
  },
  o_lover: {
    icon: Heart,
    className: "bg-[oklch(0.93_0.08_355)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["💕", "💘", "🌹"], gravity: -0.5, duration: 1400 },
  },

  // ── Q7 對 67 的看法 ─────────────────────────────────────────────────
  o_never: {
    icon: Ghost,
    className: "bg-[oklch(0.95_0.01_250)] text-muted-foreground",
    selectedClass: "animate-quiz-vanish",
    burst: { emojis: ["❓", "🫥"], count: 8, duration: 1100 },
  },
  o_kid: {
    icon: Backpack,
    className: "bg-[oklch(0.93_0.08_120)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🎒", "🧒", "✏️"], count: 14 },
  },
  o_676767: {
    className: "bg-[oklch(0.88_0.15_100)] font-mono",
    selectedClass: "animate-quiz-shake",
    shakeScreen: true,
    scene: "sixtyseven",
    textFx: "marquee",
    burst: { emojis: ["6️⃣", "7️⃣", "💥", "🤣"], count: 24, spread: 220, duration: 900 },
  },
  o_serious: {
    icon: FileText,
    className: "bg-[oklch(0.96_0.01_80)] font-mono tracking-tight",
    textFx: "cite",
    selectedClass: "animate-quiz-halo",
    burst: { emojis: ["📄", "🧐", "✒️"], count: 8, duration: 1400 },
  },
  o_notfunny: {
    icon: ThumbsDown,
    className: "bg-[oklch(0.9_0.004_250)] text-muted-foreground",
    // 一顆 💀 慢慢升起，全場最冷。
    burst: { emojis: ["💀"], count: 1, spread: 0, gravity: -0.25, duration: 1600 },
  },

  // ── Q8 摔一跤 ───────────────────────────────────────────────────────
  o_laugh: {
    icon: Laugh,
    className: "bg-[oklch(0.94_0.08_80)]",
    selectedClass: "animate-quiz-nudge",
    burst: { emojis: ["😅", "💦"], count: 10 },
  },
  o_ignore: {
    icon: EyeOff,
    className: "bg-[oklch(0.95_0.01_250)]",
    selectedClass: "animate-quiz-vanish",
    burst: { emojis: ["🫥", "🚶"], count: 6, duration: 1200 },
  },
  o_cry: {
    icon: Frown,
    className: "bg-[oklch(0.93_0.05_260)]",
    selectedClass: "animate-quiz-shrink",
    burst: { emojis: ["😭", "💧", "🌧"], count: 16, gravity: 0.7, duration: 1300 },
  },

  // ── Q9 破大防 ───────────────────────────────────────────────────────
  o_looks: {
    icon: HeartCrack,
    className: "bg-[oklch(0.93_0.06_20)]",
    selectedClass: "animate-quiz-crack",
    burst: { emojis: ["💔", "🪞", "🥲"], count: 14 },
  },
  o_onesec: {
    icon: AlarmClock,
    className: "bg-[oklch(0.92_0.1_30)] font-mono",
    textFx: "ticker",
    selectedClass: "animate-quiz-jitter",
    burst: { emojis: ["⏰", "😫", "🕗"], count: 14, spread: 140 },
  },
  o_smell: {
    icon: Bath,
    className: "bg-[oklch(0.93_0.1_130)]",
    selectedClass: "animate-quiz-stink",
    burst: { emojis: ["💩", "🫧", "🤢"], count: 16, gravity: -0.4, duration: 1600 },
  },
  o_nobreak: {
    icon: Mountain,
    // 唯一「選中後完全不動」的選項：石頭紋理，沒有 selectedClass。
    className: "bg-[oklch(0.88_0.01_90)] text-[oklch(0.35_0.02_90)]",
    burst: { emojis: ["🗿"], count: 1, spread: 0, duration: 1200 },
  },

  // ── Q10 ㄕㄓ ────────────────────────────────────────────────────────
  o_clock: {
    icon: Clock,
    className: "bg-[oklch(0.94_0.04_250)]",
    selectedClass: "animate-quiz-tick",
    burst: { emojis: ["🕐", "🕒", "🕕"], count: 12, duration: 1200 },
  },
  o_school: {
    icon: School,
    className: "bg-[oklch(0.93_0.07_150)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🏫", "📣", "🎒"], count: 12 },
  },
  o_dementia: {
    icon: Shuffle,
    className: "bg-[oklch(0.93_0.08_310)]",
    textFx: "scramble",
    selectedClass: "animate-quiz-jitter",
    burst: { emojis: ["🌀", "❓", "🧠"], count: 16, spread: 150 },
  },
  o_pig: {
    icon: PiggyBank,
    className: "bg-[oklch(0.93_0.07_355)]",
    selectedClass: "animate-quiz-bounce",
    burst: { emojis: ["🐷", "🐖", "🎊"], count: 16 },
  },
  o_even: {
    icon: Sparkles,
    className: "bg-[oklch(0.94_0.06_70)]",
    selectedClass: "animate-quiz-nudge",
    burst: { emojis: ["⁉️", "🤨"], count: 10 },
  },
  o_none: {
    icon: Keyboard,
    className: "bg-[oklch(0.95_0.01_250)] font-mono",
    selectedClass: "animate-quiz-strobe",
    burst: { emojis: ["⌨️", "ㄅ", "ㄆ", "ㄇ", "ㄈ"], count: 14, duration: 1100 },
  },
};

export function effectOf(optionId: string): OptionEffect {
  return OPTION_EFFECTS[optionId] ?? {};
}
