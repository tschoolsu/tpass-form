"use client";

import {
  type FormSettings,
  type IdentityField,
  IDENTITY_FIELDS,
  IDENTITY_FIELD_LABELS,
  TONES,
  type Tone,
} from "@/lib/survey-schema";
import { Switch, Label, cn } from "@/components/ui/primitives";
import { ImageAttachments } from "./ImageAttachments";

interface Props {
  formId: string;
  settings: FormSettings;
  onChange: (next: FormSettings) => void;
  webhooks: Array<{ id: string; name: string }>;
}

const TONE_SWATCH: Record<Tone, string> = {
  green: "bg-tone-green-badge",
  blue: "bg-tone-blue-badge",
  orange: "bg-tone-orange-badge",
  violet: "bg-tone-violet-badge",
  rose: "bg-tone-rose-badge",
};

export function SettingsPanel({ formId, settings, onChange, webhooks }: Props) {
  const set = (patch: Partial<FormSettings>) => onChange({ ...settings, ...patch });

  const toggleWebhook = (id: string) => {
    const has = settings.webhookIds.includes(id);
    set({
      webhookIds: has
        ? settings.webhookIds.filter((x) => x !== id)
        : [...settings.webhookIds, id],
    });
  };

  const toggleIdentity = (f: IdentityField) => {
    const has = settings.identityFields.includes(f);
    set({
      identityFields: has
        ? settings.identityFields.filter((x) => x !== f)
        : [...settings.identityFields, f],
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-extrabold text-lg">表單設定</h2>

      {/* 問卷說明的插圖（圖會出現在最上方那張抬頭卡片裡）*/}
      <div>
        <Label>問卷說明的圖片</Label>
        <p className="mt-1 mb-2 text-xs font-medium text-muted-foreground">
          放在標題與說明文字下方，每位填寫者一進來就看得到。
        </p>
        <ImageAttachments
          formId={formId}
          images={settings.images}
          onChange={(images) => set({ images })}
        />
      </div>

      {/* 主題色 */}
      <div>
        <Label>主題色</Label>
        <div className="mt-2 flex gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              aria-label={t}
              onClick={() => set({ theme: { ...settings.theme, tone: t } })}
              className={cn(
                "h-8 w-8 rounded-lg border-2 border-foreground transition-all duration-200",
                TONE_SWATCH[t],
                settings.theme.tone === t
                  ? "shadow-[2px_2px_0_0_var(--color-foreground)] -translate-y-0.5"
                  : "opacity-70",
              )}
            />
          ))}
        </div>
      </div>

      {/* 匿名 */}
      <div className="flex items-start justify-between gap-3 border-t-2 border-dashed border-foreground/15 pt-4">
        <div>
          <Label>匿名作答</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            開啟後不記錄任何身分欄位。
          </p>
        </div>
        <Switch
          checked={settings.anonymous}
          onChange={(v) => set({ anonymous: v })}
          label="匿名作答"
        />
      </div>

      {/* 身分自動帶入 */}
      <div className={cn(settings.anonymous && "opacity-40 pointer-events-none")}>
        <Label>自動記錄的身分</Label>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          送出時由伺服器從登入身分填入（使用者無法竄改）。年級依 T-Pass 的入學屆別計算。
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {IDENTITY_FIELDS.map((f) => (
            <label key={f} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={settings.identityFields.includes(f)}
                onChange={() => toggleIdentity(f)}
              />
              <span className="font-medium">{IDENTITY_FIELD_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 防重複 */}
      <div className="flex items-start justify-between gap-3 border-t-2 border-dashed border-foreground/15 pt-4">
        <div>
          <Label>每人限填一次</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            匿名時以不可逆雜湊防重複，仍不洩漏身分。
          </p>
        </div>
        <Switch
          checked={settings.oneResponsePerUser}
          onChange={(v) => set({ oneResponsePerUser: v })}
          label="每人限填一次"
        />
      </div>

      {/* 收件開關 */}
      <div className="flex items-start justify-between gap-3 border-t-2 border-dashed border-foreground/15 pt-4">
        <div>
          <Label>接受回覆</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            關閉後填寫頁停止收件。
          </p>
        </div>
        <Switch
          checked={settings.acceptingResponses}
          onChange={(v) => set({ acceptingResponses: v })}
          label="接受回覆"
        />
      </div>

      {/* 新回覆通知：預設全關。會有大量回覆的問卷開了只會洗版，
          「不會有人定期檢查」的（例如回報表單）才值得開。 */}
      <div className="border-t-2 border-dashed border-foreground/15 pt-4">
        <Label>收到新回覆時通知</Label>
        <p className="mt-1 mb-2 text-xs font-medium text-muted-foreground">
          通知只會說「有新回覆」與填寫者是誰，<strong>不會送出答案內容</strong>。
          目標在後台的「通知目標」頁登記。
        </p>
        {webhooks.length === 0 ? (
          <p className="text-xs font-medium text-muted-foreground">
            還沒有任何通知目標——先到後台的「通知目標」頁登記一個。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {webhooks.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-primary)]"
                  checked={settings.webhookIds.includes(w.id)}
                  onChange={() => toggleWebhook(w.id)}
                />
                {w.name}
              </label>
            ))}
          </div>
        )}

        {/* 內容外送由人決定：預設只送關鍵資訊，要連答案一起送得自己按下去。
            只有選了通知目標才顯示——沒有目標時這個選項沒有意義。 */}
        {settings.webhookIds.length > 0 && (
          <div className="mt-4 rounded-xl border-2 border-foreground bg-muted p-3">
            <Switch
              checked={settings.webhookIncludeAnswers}
              onChange={(v) => set({ webhookIncludeAnswers: v })}
              label="連答案內容一起送"
            />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {settings.webhookIncludeAnswers ? (
                <>
                  <strong className="text-tone-orange-text">答案全文會出現在群組裡</strong>
                  （含附件檔名；附件本身仍要進後台下載）。
                  請確認那個群組的成員都能看這份問卷的回覆——群組成員名單不在 T-Pass 的權限管理裡，
                  有人卸任或畢業不會自動收權。內容太長會截斷，完整版在後台。
                </>
              ) : (
                <>目前只送「有新回覆 + 填寫者是誰 + 後台連結」，答案內容不會離開這個系統。</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
