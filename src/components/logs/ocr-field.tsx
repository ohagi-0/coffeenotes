'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/schemas/bean-card';

// 要確認フィールド（DESIGN.md §4、F-OCR-5）。
// OCR の confidence が LOW_CONFIDENCE_THRESHOLD 未満なら、ラベル横に「要確認」タグと入力欄の下に琥珀の点線（2px、間隔 5px）を出す。
// ユーザーが中の入力欄を編集したら解除する（子の input / textarea / select の change を捕まえる）。
// react-hook-form では <Controller render={({ field, fieldState }) => <OcrField dirty={fieldState.isDirty} …>} /> のように包める。

export function isLowConfidence(confidence: number | null | undefined): boolean {
  return typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;
}

export type OcrFieldProps = {
  label: ReactNode;
  /** OCR の信頼度 0〜1。OCR 由来でない項目は渡さない */
  confidence?: number | null;
  /** 外から「編集済み」を渡す場合（react-hook-form の isDirty など）。省略時は内部で change を検知する */
  dirty?: boolean;
  /** 入力欄の id。ラベルの for に使う */
  htmlFor?: string;
  /** バリデーションエラー。錆色で 1 文 */
  error?: string;
  /** 補助テキスト */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function OcrField({
  label,
  confidence,
  dirty,
  htmlFor,
  error,
  hint,
  className,
  children,
}: OcrFieldProps) {
  const [edited, setEdited] = useState(false);
  const low = isLowConfidence(confidence) && !(dirty ?? edited);

  return (
    <div
      className={cn('border-border border-b py-3', className)}
      data-low-confidence={low ? 'true' : undefined}
      onChangeCapture={() => setEdited(true)}
    >
      <label htmlFor={htmlFor} className="text-muted-foreground mb-0.5 flex items-center gap-2 text-[11px]">
        <span>{label}</span>
        {low && (
          <span className="bg-warn text-background rounded-[3px] px-1.5 py-px text-[10px] leading-4 font-bold">
            要確認
          </span>
        )}
      </label>
      {/* 琥珀の点線下線。<input> 自身の text-decoration は内側の描画領域で切れて見えないため、枠の下辺で描く */}
      <div className={cn(low && 'border-warn border-b-2 border-dotted pb-[5px]')}>{children}</div>
      {error ? (
        <p role="alert" className="text-destructive mt-1 text-[12px]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground mt-1 text-[12px]">{hint}</p>
      ) : null}
    </div>
  );
}
