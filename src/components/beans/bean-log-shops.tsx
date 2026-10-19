'use client';

import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ErrorCallout } from '@/components/error-callout';
import { ShopField } from '@/components/shops/shop-field';
import type { ShopPickerOption } from '@/components/shops/shop-picker';
import type { ShopCandidateSources } from '@/features/geo/search';
import type { PickedShop } from '@/features/shops/find-or-create-shop';

// 豆の編集画面の「飲んだ店」（2026-10-19）。店は記録に付いているので、この豆の「店で」の記録ごとに
// 店を付ける・変える・外すができる。入力欄は記録作成と同じ部品（ShopField）。
// 変更は親が持ち、豆の「保存する」でまとめて反映する（features/logs/change-log-shop.ts）。

export type BeanLogShopRow = {
  id: string;
  logged_on: string;
  place: string;
  shop: { id: string; name: string; address?: string | null } | null;
};

export type BeanLogShopsProps = {
  logs: BeanLogShopRow[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  /** 記録 ID → 変更後の店（null は外す）。キーが無い記録は変更なし */
  edits: Record<string, PickedShop | null>;
  onEdit: (logId: string, shop: PickedShop | null) => void;
  shopOptions: ShopPickerOption[];
  shopOptionsPending?: boolean;
  onShopSearch?: (query: string) => void;
  candidates?: ShopCandidateSources;
};

/** 記録の今の店を、店の欄の値の形にする */
export function currentShopOf(row: BeanLogShopRow): PickedShop | null {
  return row.shop ? { id: row.shop.id, name: row.shop.name, address: row.shop.address ?? null } : null;
}

/** 変更後の店が今の店と違うか（名前が空の新規は「外す」と同じ扱い） */
export function isShopChanged(row: BeanLogShopRow, next: PickedShop | null): boolean {
  const n = next && (next.id || next.name.trim()) ? next : null;
  if (!n) return row.shop !== null;
  if (n.id) return n.id !== row.shop?.id;
  return true;
}

function dateLabel(d: string): string {
  try {
    return format(parseISO(d), 'yyyy年M月d日（E）', { locale: ja });
  } catch {
    return d;
  }
}

export function BeanLogShops({
  logs,
  isPending,
  error,
  onRetry,
  edits,
  onEdit,
  shopOptions,
  shopOptionsPending,
  onShopSearch,
  candidates,
}: BeanLogShopsProps) {
  const shopLogs = (logs ?? []).filter((l) => l.place === 'shop');
  const changed = shopLogs.filter((l) => l.id in edits && isShopChanged(l, edits[l.id] ?? null)).length;

  return (
    <section aria-labelledby="bean-log-shops-title" className="border-border mb-5 border-b pb-5">
      <h2 id="bean-log-shops-title" className="text-sm font-bold">
        飲んだ店
      </h2>
      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
        記録ごとに店を付けたり変えたりできます。「保存する」で反映されます。
      </p>

      {isPending ? (
        <p className="text-muted-foreground text-xs" role="status">
          記録を読み込んでいます…
        </p>
      ) : error ? (
        <ErrorCallout
          title="記録を読み込めませんでした"
          what={error.message}
          next="通信状態を確認して、もう一度読み込んでください。豆の情報はこのまま保存できます。"
          onRetry={onRetry}
        />
      ) : (logs ?? []).length === 0 ? (
        <p className="text-muted-foreground text-xs">この豆の記録はまだありません。</p>
      ) : shopLogs.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          自宅で淹れた記録だけです。店を付けるには、記録の編集で「店で」を選んでください。
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shopLogs.map((l) => {
            const value = l.id in edits ? (edits[l.id] ?? null) : currentShopOf(l);
            const dirty = l.id in edits && isShopChanged(l, edits[l.id] ?? null);
            return (
              <li key={l.id}>
                <ShopField
                  label={
                    shopLogs.length > 1
                      ? `${dateLabel(l.logged_on)}の記録`
                      : `${dateLabel(l.logged_on)}に飲んだ店`
                  }
                  value={value}
                  onChange={(v) => onEdit(l.id, v)}
                  shopOptions={shopOptions}
                  shopOptionsPending={shopOptionsPending}
                  onShopSearch={onShopSearch}
                  candidates={candidates}
                  note={
                    dirty
                      ? value
                        ? '保存すると変わります'
                        : '保存すると店が外れます'
                      : !value
                        ? 'まだ店が付いていません'
                        : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {changed > 0 && (
        <p className="text-primary mt-3 text-xs" role="status">
          {changed} 件の記録の店を変更します
        </p>
      )}
    </section>
  );
}
