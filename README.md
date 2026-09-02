# T-Form — 學生會問卷系統

TSchool 數位服務平台的問卷子模組（消費端）。對標 Google 表單的建構 / 填寫體驗，
視覺改成平台的 light-only Neobrutalism。透過 T-Pass SSO 認身分，**只用 JWKS 公鑰本地驗章**，
不回呼 auth、不碰私鑰。

- 子網域（本機）：`https://form.lvh.me:3002`（tpass-auth:3000 / tpass-portal:3001 之後）
- 技術棧：Next 16.3 + React 19 + Tailwind v4 + tpass-auth-js + Prisma 7 (Postgres) + @dnd-kit + react-hook-form/zod

## 功能

- **建構器**（`/admin/forms/[id]/edit`，學生會成員限定）：拖拉排序、10 種題型
  （短答 / 段落 / 單選 / 多選 / 下拉 / 線性量表 / 日期 / 單選方格 / 多選方格 / 檔案上傳）、
  區段、文字區塊、**跳轉邏輯**（依選項或區段預設跳段 / 結束）、每份表單客製主題色、
  匿名 / 身分自動帶入 / 每人限填一次開關。自動存草稿。
- **填寫器**（`/f/[slug]`）：分段 wizard、跳轉感知、即時驗證、檔案上傳。
- **問卷大廳**（`/`）：列出已發布問卷，任何登入者可填、**複製連結**分享。
- **身分戳記**：非匿名時由伺服器從登入身分填入姓名 / 信箱 / 年級（**client 不可竄改**）；
  年級由信箱前三碼（入學民國學年度）推算，8 月跳新學年度。
- **結果**（`/admin/forms/[id]/responses`）：逐筆檢視 + **匯出 CSV**（DB 才是真相來源，CSV 只是鏡像）。
- **新回覆通知**（`/admin/webhooks`）：登記 Discord / Google Chat 的 incoming webhook，
  再到每份問卷的設定面板勾選要用哪幾個（預設全關——會有大量回覆的問卷開了只會洗版；
  「不會有人定期檢查」的回報型表單才值得開）。
  每份問卷再自己決定通知**只送關鍵資訊**（有新回覆／填寫者／後台連結；預設）還是
  **連答案內容一起送**——這是人的決定，不是預設值（理由見 `src/lib/webhook-format.ts` 檔頭）。
  只收 `discord.com` / `chat.googleapis.com` 的網址，其他一律擋（SSRF / 外流面）。
- **名單管理**（`/admin/members`，超管限定）：env 種子超管 + DB UI 增刪學生會成員 email。

## 本機啟動

1. **環境變數**：`cp .env.example .env.local`，填上 `DATABASE_URL`（託管 Postgres，如 Neon / Supabase）、
   `SUPER_ADMIN_EMAILS`（你的 email）、`ANON_HASH_SECRET`。其餘 SSO / 網域變數已給本機預設值。

2. **資料庫建表**：
   ```bash
   pnpm exec prisma migrate dev  # 套用 prisma/migrations；改 schema 後也用它產新 migration（不要 db push）
   ```

3. **HTTPS 憑證**（與 tpass-auth / tpass-portal 共用 mkcert）：
   ```bash
   mkcert -install
   mkdir -p certs && mkcert -key-file certs/form.lvh.me-key.pem -cert-file certs/form.lvh.me.pem form.lvh.me
   ```

4. **啟動**：
   ```bash
   pnpm dev                # https://form.lvh.me:3002（package.json 已設好 HTTPS + NODE_TLS_REJECT_UNAUTHORIZED=0）
   ```
   Production smoke：`pnpm build && pnpm start:https`。

5. **登入**：用學校 Google 帳號（`auth` 服務需同時在跑）。`SUPER_ADMIN_EMAILS` 內的帳號登入後右上角出現「管理後台」。

## 檢查

```bash
pnpm lint
pnpm exec tsc --noEmit
```

## 架構備忘

- 驗章走共用套件 `tpass-auth-js`（`src/config/auth.ts` 綁 env、callback／logout route 各一行），不要在這裡手抄驗章。
- 資料庫走 Prisma 7 + `@prisma/adapter-pg`（`src/lib/db.ts`），schema 改動只透過 `prisma migrate dev` 產 migration；準則見 tpass-ops `docs/handbook/01-new-service.md`〈資料庫〉。
- **登出留在本服務**：`src/config/auth.ts` 的 `logoutUrl` 夾帶 `redirect_uri=<自己>`，讓 auth 登出後
  `303` 導回 T-Form 首頁而不是 auth 自己的頁面（契約見 `tpass-auth/INTEGRATION.md` §7.2）。
  首頁 (`src/app/page.tsx`) 讀網址上的 `logout=1` 顯示「您已登出」文案；這個參數**只是畫面提示**，
  只有在 `!isLoggedIn` 時才採信，不能拿來判斷登入狀態。
- 「誰能開問卷」auth 不管，全在 `src/config/admin.ts` 的消費端白名單（env 種子 ∪ DB）。
- 表單定義 / 設定存 jsonb（`src/lib/survey-schema.ts` 為單一真相，建構與填寫共用）。
- 檔案儲存 `src/lib/storage.ts` 預設 `local` driver（寫 `./data/uploads`——`data/` 是
  ops 每日備份會打包的目錄，換路徑等於讓這些檔案沒有備份）；
  上線把 `STORAGE_DRIVER=s3` 接 Supabase Storage / S3，URL 全 env 驅動。
