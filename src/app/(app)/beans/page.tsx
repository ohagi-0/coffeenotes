'use client';

import { Suspense, useMemo, useState } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { BeanDetail } from '@/components/beans/bean-detail';
import { frontImagePath, useBeanImageUrl } from '@/features/beans/images';
import { RoastBatches } from '@/components/roasts/roast-batches';
import { useCreateRoast } from '@/features/roasts/mutations';
import { useRoastsByBean } from '@/features/roasts/queries';
import { useShops } from '@/features/shops/queries';
import { BeanDetailSkeleton } from '@/components/beans/bean-detail-skeleton';
import { BeanForm, type BeanFormSubmit } from '@/components/beans/bean-form';
import { ErrorCallout } from '@/components/error-callout';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { useUpdateBean } from '@/features/beans/mutations';
import { beanSpecItems, beanTaste } from '@/features/beans/presenters';
import { useBean, useBeanFilterOptions } from '@/features/beans/queries';
import { writeNewLogDraft } from '@/features/logs/new-log-draft';
import { toTimelineItem } from '@/features/logs/presenters';
import { useLogsByBean, useRatingStats } from '@/features/logs/queries';
import { useCreateRoaster } from '@/features/roasters/mutations';
import { useRoasterSearch } from '@/features/roasters/queries';
import { idFromSearchParams, routes } from '@/lib/routes';

// S4 豆詳細。URL は /beans?id=（ADR 0008）。?edit=1 で同じページ内に豆フォームを出す。

function BeanPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = idFromSearchParams(params);
  const editing = params.get('edit') === '1';
  const bean = useBean(id);
  const image = useBeanImageUrl(frontImagePath(bean.data?.bean_images));
  const homeRoasted = bean.data?.source === 'home_roasted';
  const roasts = useRoastsByBean(homeRoasted ? id : null);
  const greenShops = useShops({ kind: 'green_bean_shop' });
  const createRoast = useCreateRoast();
  const logs = useLogsByBean(id);
  const stats = useRatingStats();
  const items = useMemo(() => (logs.data ?? []).map(toTimelineItem), [logs.data]);

  const [roasterQuery, setRoasterQuery] = useState('');
  const roasters = useRoasterSearch(roasterQuery);
  const beanOptions = useBeanFilterOptions();
  const updateBean = useUpdateBean();
  const createRoaster = useCreateRoaster();
  const [failure, setFailure] = useState<string | null>(null);

  const crumb = (
    <div className="text-muted-foreground pt-3 pb-2.5 text-xs">
      <a href={routes.logs} className="text-muted-foreground">
        入力記録一覧
      </a>{' '}
      › 豆
    </div>
  );

  if (!id) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="豆が見つかりません"
          what="URL に豆の ID がありません。"
          next="一覧から記録を選び直してください。"
        />
      </div>
    );
  }
  if (bean.isPending) {
    return (
      <div className="pb-2">
        {crumb}
        <BeanDetailSkeleton />
      </div>
    );
  }
  if (bean.error) {
    return (
      <div className="pb-2">
        {crumb}
        <ErrorCallout
          title="豆を読み込めませんでした"
          what={bean.error.message}
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => void bean.refetch()}
        />
      </div>
    );
  }
  const b = bean.data;

  if (editing) {
    async function onSubmit(values: BeanFormSubmit) {
      setFailure(null);
      try {
        const roasterId =
          values.roaster.id ??
          (values.roaster.name.trim()
            ? (await createRoaster.mutateAsync({ name: values.roaster.name.trim() })).id
            : null);
        await updateBean.mutateAsync({ id: b.id, ...values.form, roaster_id: roasterId });
        toast.success('保存しました');
        router.replace(routes.bean(b.id) as Route);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : '保存できませんでした');
      }
    }
    return (
      <div className="pb-2">
        <div className="text-muted-foreground flex items-center justify-between pt-3 pb-2.5 text-xs">
          <span>
            <a href={routes.bean(b.id)} className="text-muted-foreground">
              {b.name}
            </a>{' '}
            › 編集
          </span>
          <a href={routes.bean(b.id)} className="text-primary font-medium">
            やめる
          </a>
        </div>
        <h1 className="pb-3 text-2xl font-bold">豆を編集</h1>
        {failure && (
          <ErrorCallout
            title="保存できませんでした"
            what={failure}
            next="入力は残っています。もう一度お試しください。"
            className="mb-4"
          />
        )}
        <BeanForm
          defaultValues={{
            name: b.name,
            roaster_id: b.roaster?.id ?? null,
            roaster_name: b.roaster?.name ?? '',
            source: b.source === 'home_roasted' ? 'home_roasted' : 'purchased',
            country: b.country ?? '',
            region: b.region ?? '',
            variety: b.variety ?? '',
            process: b.process ?? '',
            altitude_m: b.altitude_m ?? '',
            flavor_notes: b.flavor_notes,
            description: b.description ?? '',
            taste_flavor: b.taste_flavor,
            taste_sweetness: b.taste_sweetness,
            taste_acidity: b.taste_acidity,
            taste_aftertaste: b.taste_aftertaste,
            taste_body: b.taste_body,
            price_jpy: b.price_jpy ?? '',
            price_grams: b.price_grams ?? '',
            roast_level: (b.roast_level as 'light' | 'medium' | 'dark' | null) ?? '',
            roasted_on: b.roasted_on ?? '',
            reference_url: b.reference_url ?? '',
          }}
          roasterOptions={(roasters.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
          onRoasterSearch={setRoasterQuery}
          recentCountries={beanOptions.data?.countries}
          recentVarieties={beanOptions.data?.varieties}
          onSubmit={onSubmit}
          submitLabel="保存する"
          submitting={updateBean.isPending || createRoaster.isPending}
        />
      </div>
    );
  }

  return (
    <>
      <BeanDetail
        name={b.name}
        imageSrc={image.data ?? null}
        roasterName={b.roaster?.name ?? (b.source === 'home_roasted' ? '自家焙煎' : null)}
        country={b.country}
        spec={beanSpecItems(b)}
        flavorNotes={b.flavor_notes}
        description={b.description}
        taste={beanTaste(b)}
        stat={stats.data?.byBean.get(b.id)}
        logs={items}
        logsPending={logs.isPending}
        logsError={logs.error}
        onRetryLogs={() => void logs.refetch()}
        editHref={`${routes.bean(b.id)}&edit=1` as Route}
        onLogAgain={() => {
          writeNewLogDraft({ bean: { kind: 'existing', id: b.id, name: b.name } });
          router.push(`${routes.newLog}?step=place` as Route);
        }}
      />
      {homeRoasted && (
        <RoastBatches
          roasts={roasts.data}
          isPending={roasts.isPending}
          error={roasts.error}
          onRetry={() => void roasts.refetch()}
          statByRoast={stats.data?.byRoast}
          greenShops={(greenShops.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
          creating={createRoast.isPending}
          onCreate={async (values) => {
            await createRoast.mutateAsync({ ...values, bean_id: b.id });
            toast.success('バッチを登録しました');
          }}
        />
      )}
    </>
  );
}

export default function BeanPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <BeanPageInner />
    </Suspense>
  );
}
