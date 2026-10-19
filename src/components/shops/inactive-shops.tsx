'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteShop } from '@/features/shops/mutations';
import { cn } from '@/lib/utils';

// 「まだ記録のない店（N）」の折りたたみ（S6、#43）。記録の無い店は「行った店の履歴」に混ぜず、一覧の最下部に退避する。
// 既定は閉じる。開くと店名と「削除」だけの行。削除は 2 段階（記録が 0 件の店なので記録には影響しない）。0 件なら見出しごと出さない。

export type InactiveShop = { id: string; name: string };

export function InactiveShops({ shops }: { shops: InactiveShop[] }) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const del = useDeleteShop();
  if (shops.length === 0) return null;

  function remove(s: InactiveShop) {
    del.mutate(s.id, {
      onSuccess: () => {
        setConfirmId(null);
        toast.success(`「${s.name}」を削除しました`);
      },
    });
  }

  return (
    <section className="border-border mt-6 border-t pt-3" aria-label="まだ記録のない店">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-muted-foreground flex min-h-11 w-full items-center justify-between text-[13px] font-medium"
      >
        <span>
          まだ記録のない店<span className="font-num ml-1">（{shops.length}）</span>
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <>
          <p className="text-muted-foreground text-[11px]">
            まだ記録を付けていない店です。記録するときの店選びには出ます。
          </p>
          {del.error && (
            <p role="alert" className="text-destructive py-2 text-xs">
              削除できませんでした（{del.error.message}）
            </p>
          )}
          <ul>
            {shops.map((s) => (
              <li key={s.id} className="border-border flex min-h-12 items-center gap-2 border-b py-1">
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                {confirmId === s.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      disabled={del.isPending}
                      className="text-destructive h-11 px-2 text-[12px] font-bold disabled:opacity-50"
                    >
                      {del.isPending ? '削除中…' : '削除する'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="text-muted-foreground h-11 px-2 text-[12px]"
                    >
                      やめる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(s.id)}
                    aria-label={`店「${s.name}」を削除`}
                    className="text-muted-foreground hover:text-destructive h-11 px-2 text-[12px]"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
