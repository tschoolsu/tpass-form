# This is NOT the Next.js you know

本專案用 **Next 16.3 + React 19**，且啟用 React Compiler。API、慣例、檔案結構都可能與你的訓練資料不同。
寫任何 Next code 前先讀 `node_modules/next/dist/docs/` 對應指南，留意 deprecation。

重點差異提醒：
- `cookies()`、route handler 的 `ctx.params`、page 的 `params` 都是 **async**（要 `await`）。
- mutation 用 server actions（`"use server"`）；server action 可被直接 POST，**授權一定要在函式內做**。
- 本機跑 `pnpm dev`（已設好 HTTPS + `form.lvh.me:3002` + `NODE_TLS_REJECT_UNAUTHORIZED=0`）。檢查用 `pnpm lint` + `pnpm exec tsc --noEmit`。

# 角色與紅線

T-Form 是 T-Pass SSO 的**消費端**問卷服務。動手前先讀 `README.md` 與上層 `../AGENTS.md`。

- ❌ 不要 import / 複製 auth 私鑰、`arctic`、OAuth callback。只需 JWKS 公鑰。
- ❌ 不要在前端驗章、不要把 token 塞 localStorage、不要關掉 `algorithms:['EdDSA']` 鎖定。
- ❌ 不要把網域 / issuer / audience / storage 寫死——讀 `src/config/*`（env 驅動）。
- ❌ 身分欄（姓名 / 信箱 / 年級）一律伺服器端從 session 戳記，**不信任 client 傳來的身分**。
- ✅ UI 一律 light-only Neobrutalism + OKLCH，照 `../tpass-portal/docs/design.md`。

## 生態系地圖在上層

本 repo 是 **tpass 生態系**的一個服務（id：`form`）。整個生態系的地圖、跨服務規範、
`services.json` 註冊表、`tpass` CLI 與部署流程，都在上層 **tpass-ops** repo 的
`AGENTS.md` 與 `docs/`。動跨服務的東西前先讀那邊。

- 憑證放 `$HOME/tpass-certs`（`tpass setup` 會 symlink 過去；沒有 ops repo 就自己 mkcert，見 tpass-ops `docs/handbook/01-new-service.md`〈建立本機憑證〉）。
- SSO 串接合約（契約 v2）：`../tpass-auth/INTEGRATION.md`（權威）。
