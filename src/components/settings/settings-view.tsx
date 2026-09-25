'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { TextInput } from '@/components/form/field';
import { routes } from '@/lib/routes';
import Link from 'next/link';
import { SettingRow, SettingSection } from '@/components/settings/setting-row';
import { useRatingInputMode, type RatingInputMode } from '@/features/settings/use-preferences';
import { OCR_DAILY_LIMIT } from '@/lib/ocr';
import { cn } from '@/lib/utils';

export { OCR_DAILY_LIMIT };

export type SettingsViewProps = {
  email: string | null;
  /** ログイン方式。Supabase の app_metadata.providers から */
  providers: string[];
  /** 今日の OCR 実行回数（features/ocr の useOcrUsage から） */
  ocrUsedToday?: number;
  onSignOut: () => Promise<void> | void;
  signingOut?: boolean;
  /** アカウントと全データの削除（F-AUTH-3）。成功したら呼び出し側でログイン画面へ */
  onDeleteAccount?: () => Promise<void>;
  /** エクスポート（F-MISC-2）。渡さなければ行を無効にする */
  onExport?: (format: 'csv' | 'json') => Promise<void>;
};

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', email: 'メールリンク' };

// S9 設定（DESIGN.md §5）。データは props で受け、ページ側でセッションとつなぐ。
export function SettingsView({
  email,
  providers,
  ocrUsedToday = 0,
  onSignOut,
  signingOut,
  onDeleteAccount,
  onExport,
}: SettingsViewProps) {
  const [ratingInput, setRatingInput] = useRatingInputMode();
  const [confirming, setConfirming] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const emailMatches = !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  async function runExport(format: 'csv' | 'json') {
    if (!onExport || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      await onExport(format);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'エクスポートできませんでした');
    } finally {
      setExporting(null);
    }
  }
  const initial = (email?.[0] ?? '?').toUpperCase();
  const providerText = providers.map((p) => PROVIDER_LABEL[p] ?? p).join(' / ') || '—';
  const ocrPercent = Math.min(100, Math.round((ocrUsedToday / OCR_DAILY_LIMIT) * 100));

  return (
    <div className="pb-2">
      <h1 className="pt-5 pb-4 text-2xl font-bold">設定</h1>

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
              毎日 0 時にリセット
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
          label={exporting === 'csv' ? 'CSV を作成中…' : 'CSV でダウンロード'}
          onClick={() => void runExport('csv')}
          disabled={!onExport || exporting !== null}
          trailing={<Download className="text-muted-foreground size-[18px]" aria-hidden />}
          note="Excel で開ける形式。記録・豆・店・レシピ・タグを 1 行 1 記録で出します"
        />
        <SettingRow
          label={exporting === 'json' ? 'JSON を作成中…' : 'JSON でダウンロード'}
          onClick={() => void runExport('json')}
          disabled={!onExport || exporting !== null}
          trailing={<Download className="text-muted-foreground size-[18px]" aria-hidden />}
          note={exportError ? <span className="text-destructive">{exportError}</span> : undefined}
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
        <AppButton variant="destructive" onClick={() => setConfirming(true)} disabled={confirming}>
          アカウントと全データを削除
        </AppButton>
        <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
          画像を含むすべての記録を削除します。元に戻せません。
        </p>
        {confirming && (
          <div
            role="dialog"
            aria-label="アカウント削除の確認"
            className="border-destructive bg-destructive/10 flex flex-col gap-3 rounded-[14px] border p-3.5 text-sm"
          >
            <p className="text-destructive font-bold">本当に削除しますか？</p>
            <p className="text-[13px] leading-relaxed">
              記録・豆・店・タグ・カード画像をすべて削除し、ログインできなくなります。元に戻せません。
              ロースター名の共有マスタは残ります。
            </p>
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-muted-foreground">確認のため、ログイン中のメールアドレスを入力</span>
              <TextInput
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder={email ?? 'you@example.com'}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                aria-label="確認用メールアドレス"
              />
            </label>
            {deleteError && (
              <p role="alert" className="text-destructive text-[12px]">
                {deleteError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <AppButton
                variant="ghost"
                size="md"
                onClick={() => {
                  setConfirming(false);
                  setConfirmEmail('');
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                やめる
              </AppButton>
              <AppButton
                variant="destructive"
                size="md"
                disabled={!emailMatches || !onDeleteAccount}
                loading={deleting}
                onClick={async () => {
                  if (!onDeleteAccount) return;
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await onDeleteAccount();
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : '削除できませんでした');
                    setDeleting(false);
                  }
                }}
              >
                削除する
              </AppButton>
            </div>
          </div>
        )}
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          <Link href={routes.privacy} className="underline underline-offset-2">
            プライバシーポリシー
          </Link>
          {' · '}
          <Link href={routes.terms} className="underline underline-offset-2">
            利用規約
          </Link>
        </p>
      </div>
    </div>
  );
}
