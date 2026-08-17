// ★「新生直屬快問快答」題目定義 ★
// 這是一份「一次性客製問卷」：題目寫在 code 裡，DB 只存一份等價的 Form row
// （由 scripts/seed-freshman-quiz.ts 寫入），好處是提交／驗證／防重複／後台匯出
// 全部沿用既有管線，畫面卻能換成客製特效版。
//
// ⚠️ id 全部手寫且語意化，且**上線後不能改**：
//    - ./effects.ts 用 option id 對映特效
//    - Response.answers 存的就是 option id
// isomorphic（client 也 import），不可依賴 server-only。
import type { FormDefinition, FormSettings, QuestionBlock } from "@/lib/survey-schema";

export const QUIZ_SLUG = "zhishu";
export const QUIZ_TITLE = "新生直屬快問快答";
export const QUIZ_DESCRIPTION = "十題，選你的直覺就好。每個選項都有自己的脾氣。";

function q(
  id: string,
  title: string,
  options: Array<[id: string, label: string]>,
): QuestionBlock {
  return {
    kind: "question",
    id,
    type: "single_choice",
    title,
    required: true,
    options: options.map(([oid, label]) => ({ id: oid, label })),
  };
}

export const QUIZ_QUESTIONS: QuestionBlock[] = [
  q("q1_music", "你最喜歡什麼類型的歌？", [
    ["o_pop", "流行（Pop）"],
    ["o_rock", "搖滾（Rock）"],
    ["o_folk", "民謠（Folk）"],
    ["o_jazz", "爵士（Jazz）"],
    ["o_blues", "藍調（Blues）"],
    ["o_hiphop", "嘻哈／饒舌（Hip-Hop / Rap）"],
    ["o_rnb", "R&B／節奏藍調"],
    ["o_edm", "電子音樂（Electronic / EDM）"],
    ["o_classical", "古典（Classical）"],
    ["o_indie", "獨立音樂（Indie）"],
    ["o_nomusic", "不聽歌（No music）"],
  ]),
  q("q2_season", "你比較喜歡哪個季節？", [
    ["o_spring", "春"],
    ["o_summer", "夏"],
    ["o_autumn", "秋"],
    ["o_winter", "冬"],
  ]),
  q("q3_queue", "你排隊買飲料，前面的人點超慢，你會？", [
    ["o_wait", "默默等"],
    ["o_leave", "直接去別家"],
    ["o_rage", "破口大罵 😱🥀😭😡"],
  ]),
  q("q4_sleep", "你平常都睡多久？", [
    ["o_sleep02", "0-2 小時"],
    ["o_sleep35", "3-5 小時"],
    ["o_sleep67", "6-7 小時"],
    ["o_sleep8", "睡滿 8 小時"],
    ["o_sleepall", "整天都在睡"],
  ]),
  q("q5_rain", "吃完午餐後發現外面下大雨，但你沒有帶傘，你會怎麼做？", [
    ["o_dash", "直接跑回去"],
    ["o_buy", "去超商買傘"],
    ["o_share", "問路人可不可以一起撐"],
    ["o_stay", "待在原地等雨停"],
    ["o_singin", "Singin' in the Rain"],
  ]),
  q("q6_ticket", "你有兩張電影票，你更希望和誰一起去看？", [
    ["o_friend", "好友"],
    ["o_family", "家人"],
    ["o_principal", "校長"],
    ["o_lover", "戀人"],
  ]),
  q("q7_67", "你對於 67 的看法？", [
    ["o_never", "沒聽過"],
    ["o_kid", "小學生"],
    ["o_676767", "676767"],
    ["o_serious", "嚴肅探討"],
    ["o_notfunny", "根本不好笑"],
  ]),
  q("q8_fall", "在新生學堂摔了一跤，你會怎麼做？", [
    ["o_laugh", "尷尬的笑兩聲"],
    ["o_ignore", "假裝無事發生"],
    ["o_cry", "躲在角落哭"],
  ]),
  q("q9_break", "什麼事情最容易讓你破大防（pdf ㄡ）🏚️", [
    ["o_looks", "被批評長相"],
    ["o_onesec", "差一秒打到卡"],
    ["o_smell", "沒洗頭被聞到臭味"],
    ["o_nobreak", "我從不破防哈"],
  ]),
  q("q10_bopomofo", "「ㄕㄓ」你的鍵盤跳出什麼？", [
    ["o_clock", "時鐘"],
    ["o_school", "實中"],
    ["o_dementia", "失智"],
    ["o_pig", "神豬"],
    ["o_even", "甚至"],
    ["o_none", "都不是"],
  ]),
];

// 全部題目放在隱含的 __start__ 段（不放 section marker）：QuizFiller 自己做一題一頁分頁，
// 而 validateAnswers 的跳轉感知走訪會把這 10 題全部視為必答。
export const QUIZ_DEFINITION: FormDefinition = { blocks: QUIZ_QUESTIONS };

export const QUIZ_SETTINGS: FormSettings = {
  anonymous: false,
  identityFields: ["name", "email", "grade"],
  theme: { tone: "violet" },
  acceptingResponses: true,
  oneResponsePerUser: true,
};
