'use client';

import { Suspense, useMemo, useState } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ErrorCallout } from '@/components/error-callout';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { LogDetail } from '@/components/logs/log-detail';
import { LogForm } from '@/components/logs/log-form';
import { LogListSkeleton } from '@/components/logs/log-list-item-skeleton';
import { frontImagePath, useBeanImageUrl } from '@/features/beans/images';
import { useDeleteLog, useUpdateLog } from '@/features/logs/mutations';
import { formatBrewRatio, toTimelineItem } from '@/features/logs/presenters';
import { useCreateRoast } from '@/features/roasts/mutations';
import { useRoastsByBean } from '@/features/roasts/queries';
import { roastLevelLabel } from '@/components/roasts/roast-batches';
import { useLog, useLogsByBean } from '@/features/logs/queries';
import type { LogFormDraft } from '@/features/logs/save-new-log';
import { useCreateShop } from '@/features/shops/mutations';
import { useShops } from '@/features/shops/queries';
import { useTags } from '@/features/tags/queries';
import { idFromSearchParams, routes } from '@/lib/routes';

// S5 記録詳細・編集。URL は /logs?id=（ADR 0008）。?edit=1 で LogForm をページ内に出す。

function LogPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = idFromSearchParams(params);
  const editing = params.get('edit') === '1';
  const log = useLog(id);
  const roasts = useRoastsByBean(log.data?.bean.id ?? null);
  const greenShops = useShops({ kind: 'green_bean_shop' });
  const createRoast = useCreateRoast();
  const image = useBeanImageUrl(frontImagePath(log.data?.bean.bean_images));
  const beanId = log.data?.bean_id ?? null;
  const siblings = useLogsByBean(beanId);
  const others = useMemo(
    () => (siblings.data ?? []).filter((l) => l.id !== id).map(toTimelineItem),
    [siblings.data, id],
  );
  const deleteLog = useDeleteLog();
  const updateLog = useUpdateLog();
  const createShop = useCreateShop();
  const [shopQuery, setShopQuery] = useState('');
  const shops = useShops(shopQuery.trim() ? { search: shopQuery } : {});
  const tags = useTags();
  const [failure, setFailure] = useState<string | null>(null);

  const crumb = (
    <div className="text-muted-foreground pt-3 pb-2.5 text-xs">
      <a href={routes.home} className="text-muted-foreground">
        入力記録一覧
      </a>{' '}
      › 記録
    </div>
  );

  if (!id) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="記録が見つかりません"
          what="URL に記録の ID がありません。"
          next="一覧から記録を選び直してください。"
        />
      </div>
    );
  }
  if (log.isPending) {
    return (
      <div className="pb-2">
        {crumb}
        <LogListSkeleton count={1} />
      </div>
    );
  }
  if (log.error) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="記録を読み込めませんでした"
          what={log.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void log.refetch()}
        />
      </div>
    );
  }
  const l = log.data;
  const tagNames = l.log_tags.map((t) => t.tag?.name).filter((n): n is string => !!n);

  if (editing) {
    async function onSubmit(values: LogFormDraft) {
      setFailure(null);
      try {
        let shopId: string | null = null;
        if (values.fields.place === 'shop' && values.shop) {
          shopId =
            values.shop.id ??
            (values.shop.name.trim()
              ? (await createShop.mutateAsync({ name: values.shop.name.trim() })).id
              : null);
        }
        let roastId = values.fields.roast_id ?? null;
        if (values.newRoast)
          roastId = (await createRoast.mutateAsync({ ...values.newRoast, bean_id: l.bean.id })).id;
        await updateLog.mutateAsync({ id: l.id, ...values.fields, shop_id: shopId, roast_id: roastId });
        toast.success('保存しました');
        router.replace(routes.log(l.id) as Route);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : '保存できませんでした');
      }
    }
    return (
      <div className="pb-2">
        <div className="text-muted-foreground flex items-center justify-between pt-3 pb-2.5 text-xs">
          <span>記録 › 編集</span>
          <a href={routes.log(l.id)} className="text-primary font-medium">
            やめる
          </a>
        </div>
        <h1 className="pb-3 text-2xl font-bold">記録を編集</h1>
        {failure && (
          <ErrorCallout
            title="保存できませんでした"
            what={failure}
            next="入力は残っています。もう一度お試しください。"
            className="mb-4"
          />
        )}
        <LogForm
          beanName={l.bean.name}
          defaultValues={{
            place: l.place === 'home' ? 'home' : 'shop',
            kind: l.kind === 'bought' ? 'bought' : 'drank',
            logged_on: l.logged_on,
            rating: l.rating,
            memo: l.memo ?? '',
            tag_names: tagNames,
            brew_method: l.brew_method ?? '',
            grinder: l.grinder ?? '',
            grind_setting: l.grind_setting ?? '',
            dose_g: l.dose_g ?? '',
            water_g: l.water_g ?? '',
            water_temp_c: l.water_temp_c ?? '',
            brew_time_sec: l.brew_time_sec ?? '',
            recipe_memo: l.recipe_memo ?? '',
            roast_id: l.roast?.id ?? null,
            shop_id: l.shop?.id ?? null,
            shop_name: l.shop?.name ?? '',
          }}
          homeRoasted={l.bean.source === 'home_roasted'}
          roastOptions={(roasts.data ?? []).map((r) => ({
            id: r.id,
            roasted_on: r.roasted_on,
            roast_level: r.roast_level,
          }))}
          greenShops={(greenShops.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
          shopOptions={(shops.data ?? []).map((s) => ({ id: s.id, name: s.name, address: s.address }))}
          onShopSearch={setShopQuery}
          tagSuggestions={(tags.data ?? []).map((t) => t.name)}
          onSubmit={onSubmit}
          submitLabel="保存する"
          submitting={updateLog.isPending || createShop.isPending || createRoast.isPending}
        />
      </div>
    );
  }

  const ratio = formatBrewRatio(l.dose_g, l.water_g);
  const recipe =
    l.place === 'home'
      ? [
          {
            label: '焙煎バッチ',
            value: l.roast
              ? [l.roast.roasted_on, roastLevelLabel(l.roast.roast_level)].filter(Boolean).join(' · ')
              : null,
            ja: true,
          },
          { label: 'グラインダー', value: l.grinder, ja: true },
          { label: '挽き目', value: l.grind_setting },
          {
            label: '豆量 / 湯量',
            value:
              l.dose_g !== null && l.water_g !== null
                ? `${l.dose_g} g / ${l.water_g} g${ratio ? `（${ratio}）` : ''}`
                : null,
          },
          { label: '湯温', value: l.water_temp_c, unit: '℃' },
          {
            label: '抽出時間',
            value:
              l.brew_time_sec !== null
                ? `${Math.floor(l.brew_time_sec / 60)}:${String(l.brew_time_sec % 60).padStart(2, '0')}`
                : null,
          },
        ]
      : [];

  return (
    <LogDetail
      loggedOn={l.logged_on}
      bean={{
        imageSrc: image.data ?? null,
        id: l.bean.id,
        name: l.bean.name,
        roasterName: l.bean.roaster?.name ?? null,
        country: l.bean.country,
        process: l.bean.process,
      }}
      place={l.place === 'home' ? 'home' : 'shop'}
      shopName={l.shop?.name ?? null}
      shopId={l.shop?.id ?? null}
      brewMethod={l.brew_method}
      recipe={recipe}
      rating={l.rating}
      memo={l.memo}
      tags={tagNames}
      others={others}
      othersPending={siblings.isPending}
      othersError={siblings.error}
      editHref={`${routes.log(l.id)}&edit=1` as Route}
      deleting={deleteLog.isPending}
      onDelete={async () => {
        try {
          await deleteLog.mutateAsync(l.id);
          toast.success('削除しました');
          router.replace(routes.home);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '削除できませんでした');
        }
      }}
    />
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <LogPageInner />
    </Suspense>
  );
}
