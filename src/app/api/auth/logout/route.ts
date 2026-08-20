// POST /api/auth/logout — 兩段式登出（契約 v2）：
// 1. 清掉本服務自己的 host-only cookie（只有本服務能清）。
// 2. 回一頁自動送出的 form，POST 到 auth 的登出入口清 auth 登入態，
//    auth 再 303 導回本服務（帶 ?logout=1 純畫面提示）。
//
// 可選的 next（站內路徑）：登出後回到指定頁而非根路徑。「切換帳號」需要它——
// 根路徑未登入會自動導去 authorize（page.tsx），使用者根本來不及選帳號。
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/config/auth";

export const runtime = "nodejs";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// 沒有 body（或不是表單編碼）的 POST 一樣要能登出，不能因為讀 body 失敗就 500。
async function nextFrom(request: NextRequest): Promise<string> {
  try {
    return String((await request.formData()).get("next") ?? "/");
  } catch {
    return "/";
  }
}

export async function POST(request: NextRequest) {
  // next 只能是站內路徑（防 Open Redirect）——與 callback route 同一條規則。
  const next = await nextFrom(request);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const returnTo = new URL(safeNext, authConfig.selfUrl).toString();

  const authLogout = `${authConfig.authLogoutUrl}?redirect_uri=${encodeURIComponent(returnTo)}`;
  const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>登出中…</title></head>
<body onload="document.forms[0].submit()">
<form method="post" action="${escapeHtml(authLogout)}">
<noscript><button type="submit">完成登出</button></noscript>
</form>
</body></html>`;
  const response = new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  response.cookies.set(authConfig.ownCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: authConfig.cookieSecure,
    path: "/",
    maxAge: 0,
  });
  return response;
}
