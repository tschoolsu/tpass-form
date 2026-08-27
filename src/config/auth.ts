// tpass-form（consumer）SSO 設定中心。只讀 env，集中管理「對接 auth 所需的最少資訊」。
// 邊界：只需要 JWKS 公鑰來源與幾個 URL，絕不碰 auth 私鑰 / arctic / OAuth。
//
// 驗章本體在套件 tpass-auth-js（C1，2026-08-27）——這裡只負責把 env 綁上去。
// 要改驗章邏輯就去那個 repo 改，不要在這裡復活一份手抄副本。
import "server-only";
import { configFromEnv, createTpassNextAuth } from "tpass-auth-js/next";

// SSO 那六顆 env 的必填檢查在套件裡（缺了直接 throw）。
export const tpass = createTpassNextAuth(configFromEnv("FORM_SELF_URL"));

// 本服務自己的必填 env（不屬於 SSO 合約，所以套件不管）。
const REQUIRED = [
  "PORTAL_URL",
  // 匿名回覆去識別化的 HMAC secret：不設就直接拒絕啟動（fail closed）。
  // 空值 = 匿名雜湊可被已知 sub 清單暴力反解，匿名承諾形同虛設（安全審查 M1）。
  "ANON_HASH_SECRET",
] as const;

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `[config/auth] 缺少必填環境變數：${missing.join(", ")}（請檢查 .env.local）`,
  );
}

// 登入回跳路徑可帶站內路徑（例如剛要填的那份問卷），組成 authorize 入口（契約 v2）。
export function loginUrlFor(returnPath = "/"): string {
  return tpass.loginUrl(returnPath);
}

// reason 絕不放進 query string（auth 的 /denied 自己憑 session 在 server side 重查）。
export function deniedUrlFor(): string {
  return tpass.deniedUrl();
}

export const authConfig = {
  loginUrl: tpass.loginUrl("/"),
  // 登出走自己的 route：先清自己的 cookie，再鏈到 auth 清登入態。
  logoutUrl: tpass.logoutUrl,
  selfUrl: tpass.selfUrl,
  serviceId: tpass.serviceId,
  // 回門戶大廳的網址（navbar 按鈕用）。env 驅動，絕不寫死網域。
  portalUrl: process.env.PORTAL_URL!,
  anonHashSecret: process.env.ANON_HASH_SECRET!,
} as const;
