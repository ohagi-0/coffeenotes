'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { SettingRow, SettingSection } from '@/components/settings/setting-row';
import { useRatingInputMode, type RatingInputMode } from '@/features/settings/use-preferences';
import { cn } from '@/lib/utils';

export const OCR_DAILY_LIMIT = 50;

export type SettingsViewProps = {
  email: string | null;
  /** ログイン方式。Supabase の app_metadata.providers から */
  providers: string[];
  /** 今日の OCR 実行回数。Phase 2 まで 0 */
  ocrUsedToday?: number;
  onSignOut: () => Promise<void> | void;
  signingOut?: boolean;
};

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', email: 'メールリンク' };

// S9 設定（DESIGN.md §5）。データは props で受け、ページ側でセッションとつなぐ。
export function SettingsView({
  email,
  providers,
  ocrUsedToday = 0,
  onSignOut,
  signingOut,
}: SettingsViewProps) {
  const [ratingInput, setRatingInput] = useRatingInputMode();
  const [deleteNotice, setDeleteNotice] = useState(false);
  const initial = (email?.[0] ?? '?').toUpperCase();
  const providerText = providers.map((p) => PROVIDER_LABEL[p] ?? p).join(' / ') || '—';
  const ocrPercent = Math.min(100, Math.round((ocrUsedToday / OCR_DAILY_LIMIT) * 100));

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">設定</h1>

      <div className="flex items-center gap-3 py-3.5">
        <span className="bg-primary text-primary-foreground font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{email ?? 'ログイン中'}</p>
          <p className="text-muted-foreground text-xs">{providerText} でログイン</p>
        </div>
      </div>

      <SettingSection title="読み取り">
        <SettingRow
          label="今日の読み取り回数"
          value={
            <>
              {ocrUsedToday} / {OCR_DAILY_LIMIT} 回
            </>
          }
          note={
            <span className="flex items-center gap-2">
              <span className="bg-secondary block h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${ocrPercent}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={OCR_DAILY_LIMIT}
                  aria-valuenow={ocrUsedToday}
                  aria-label="今日の読み取り回数"
                />
              </span>
              毎日 0 時にリセット · カード読み取りは Phase 2 で有効
            </span>
          }
        />
      </SettingSection>

      <SettingSection title="表示">
        <SettingRow
          label="星の入力"
          trailing={
            <div
              role="radiogroup"
              aria-label="星の入力方法"
              className="bg-secondary flex rounded-[10px] p-0.5"
            >
              {(
                [
                  ['tap', 'タップ'],
                  ['slider', 'スライダー'],
                ] as [RatingInputMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={ratingInput === mode}
                  onClick={() => setRatingInput(mode)}
                  className={cn(
                    'focus-visible:outline-primary h-9 rounded-lg px-3 text-xs font-bold outline-none focus-visible:outline-2',
                    ratingInput === mode ? 'bg-foreground text-background' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
      </SettingSection>

      <SettingSection title="データ">
        <SettingRow
          label="CSV でダウンロード"
          disabled
          trailing={<Download className="text-muted-foreground size-[18px]" aria-hidden />}
          note="Phase 5 で有効になります"
        />
        <SettingRow
          label="JSON でダウンロード"
          disabled
          trailing={<Download className="text-muted-foreground size-[18px]" aria-hidden />}
        />
        <SettingRow
          label="位置情報"
          value="記録するときだけ"
          note="店を探すときにだけ現在地を使います。保存はしません。"
        />
      </SettingSection>

      <SettingSection title="アカウント">
        <SettingRow
          label={signingOut ? 'ログアウト中…' : 'ログアウト'}
          onClick={() => void onSignOut()}
          disabled={signingOut}
        />
      </SettingSection>

      <div className="mt-8 flex flex-col gap-2.5">
        <AppButton variant="destructive" onClick={() => setDeleteNotice(true)}>
          アカウントと全データを削除
        </AppButton>
        <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
          画像を含むすべての記録を削除します。元に戻せません。
        </p>
        {deleteNotice && (
          <div role="alert" className="border-border bg-card rounded-[14px] border p-3.5 text-sm">
            <p className="font-bold">削除はまだ使えません</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              アカウント削除（F-AUTH-3）は後の段階で有効になります。それまでに削除したい場合はお問い合わせください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
