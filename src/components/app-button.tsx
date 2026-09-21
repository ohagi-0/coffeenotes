'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// アプリのボタン（DESIGN.md §4）。shadcn の ui/button.tsx は生成物なので触らず、
// ここで Base UI のプリミティブに直接バリアントを載せる。リンク化は `render={<Link href="…" />}`。
// 画面に主ボタン（primary）は 1 つ。破壊的操作（destructive）は必ず確認ダイアログを挟む。
export const appButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-5',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-border',
        ghost: 'border-border text-foreground hover:bg-secondary border bg-transparent',
        destructive: 'border-destructive text-destructive hover:bg-destructive/10 border bg-transparent',
        white: 'text-card-ink bg-white hover:bg-[#f1e8da]',
      },
      size: {
        lg: 'h-13 px-5 text-[15px]',
        md: 'h-11 px-4 text-sm',
        sm: 'h-9 rounded-[10px] px-3.5 text-[13px]',
      },
      width: {
        full: 'w-full',
        auto: 'w-auto',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg', width: 'full' },
  },
);

type Props = ButtonPrimitive.Props &
  VariantProps<typeof appButtonVariants> & {
    /** true の間はスピナーを出して押せなくする（保存中の二重送信防止） */
    loading?: boolean;
  };

export function AppButton({
  className,
  variant,
  size,
  width,
  loading,
  disabled,
  children,
  render,
  ...props
}: Props) {
  return (
    <ButtonPrimitive
      data-slot="app-button"
      // render で <Link> などに置き換えるときはネイティブの <button> ではないことを Base UI に伝える
      render={render}
      nativeButton={render ? false : undefined}
      className={cn(appButtonVariants({ variant, size, width }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </ButtonPrimitive>
  );
}
