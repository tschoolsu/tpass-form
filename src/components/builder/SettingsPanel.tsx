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

interface Props {
  settings: FormSettings;
  onChange: (next: FormSettings) => void;
}

const TONE_SWATCH: Record<Tone, string> = {
  green: "bg-tone-green-badge",
  blue: "bg-tone-blue-badge",
  orange: "bg-tone-orange-badge",
  violet: "bg-tone-violet-badge",
  rose: "bg-tone-rose-badge",
};

export function SettingsPanel({ settings, onChange }: Props) {
  const set = (patch: Partial<FormSettings>) => onChange({ ...settings, ...patch });

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
    </div>
  );
}
