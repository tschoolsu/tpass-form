共通規則（auth、UI、指令、DB 紅線）見 ../AGENTS.md，先讀它。

# tpass-form（T-Form 問卷）

- ❌ 身分欄（姓名 / 信箱 / 年級）一律伺服器端從 session 戳記，**不信任 client 傳來的身分**。
- 憑證放 `$HOME/tpass-certs`（`tpass setup` 會 symlink 過去；沒有 ops repo 就自己 mkcert，見 tpass-ops `docs/handbook/01-new-service.md`〈建立本機憑證〉）。
