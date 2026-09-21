import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// フォームの 1 項目（DESIGN.md §4 入力欄）。ラベル 11px、下に注記か錆色のエラー 1 文。
// react-hook-form の `register()` は React 19 なので `ref` を props としてそのまま渡せる。

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  /** ラベルの右に置く補助（「任意」のピルなど） */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, aside, className, children }: FieldProps) {
  const messageId = `${htmlFor}-message`;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-muted-foreground text-[11px]">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  'border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:outline-primary aria-invalid:border-destructive w-full rounded-xl border px-3.5 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';

/** 1 行の入力欄。高さ 48px。 */
export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="text-input" className={cn(controlClass, 'h-12', className)} {...props} />;
}

/** 複数行の入力欄。最小 84px。 */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClass, 'min-h-[84px] resize-y py-3 leading-relaxed', className)}
      {...props}
    />
  );
}

/** 選択欄。高さ 48px。ネイティブの select をトークンで塗る。 */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(controlClass, 'h-12 appearance-none pr-9', className)}
      {...props}
    >
      {children}
    </select>
  );
}
