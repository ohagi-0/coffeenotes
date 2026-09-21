'use client';

import { Suspense, useState } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { List, PencilLine } from 'lucide-react';
import { BeanForm, type BeanFormSubmit } from '@/components/beans/bean-form';
import { EntryOption } from '@/components/logs/entry-option';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { Row } from '@/components/row';
import { PHASE1_STEPS, WizardStepper } from '@/components/wizard-stepper';
import { useBeans } from '@/features/beans/queries';
import { writeNewLogDraft } from '@/features/logs/new-log-draft';
import { useRoasterSearch } from '@/features/roasters/queries';
import { routes } from '@/lib/routes';

// S3 記録作成（F-LOG-1）。段階は URL の ?step= に持つ（動的セグメントは使わない。ADR 0008）。
//   (なし)  入口: カードを撮る（Phase 2）/ 手で入力する / 登録済みの豆から
//   bean    ② 豆フォーム（手入力）
//   place   ③ 店・日付・評価・メモ（Issue #19）

const RECENT_BEANS = 3;

function stepHref(step: 'bean' | 'place'): Route {
  return `${routes.newLog}?step=${step}` as Route;
}

function Entry() {
  const router = useRouter();
  const beans = useBeans();
  const recent = (beans.data ?? []).slice(0, RECENT_BEANS);

  function pickExisting(id: string, name: string) {
    writeNewLogDraft({ bean: { kind: 'existing', id, name } });
    router.push(stepHref('place'));
  }

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-4 text-2xl font-bold">記録を追加</h1>
      <div className="flex flex-col gap-2.5">
        {/* 「カードを撮る」（Camera アイコン、主候補）は Phase 2（F-OCR-1）で先頭に足す。それまで出さない */}
        <EntryOption
          icon={PencilLine}
          title="手で入力する"
          description="カードが無い豆、量り売り、もらい物"
          primary
          href={stepHref('bean')}
        />
        <EntryOption
          icon={List}
          title="登録済みの豆から"
          description="同じ豆をもう一度飲んだとき"
          onClick={() => document.getElementById('recent-beans')?.scrollIntoView({ behavior: 'smooth' })}
          disabled={!beans.isPending && recent.length === 0}
        />
      </div>

      <section id="recent-beans" aria-label="最近の豆" className="mt-6">
        <h2 className="mb-1 text-[13px] font-bold">最近の豆</h2>
        {beans.isPending && <p className="text-muted-foreground py-3 text-sm">読み込み中…</p>}
        {beans.error && (
          <p className="text-destructive py-3 text-sm">豆を読み込めませんでした。{beans.error.message}</p>
        )}
        {!beans.isPending && !beans.error && recent.length === 0 && (
          <p className="text-muted-foreground py-3 text-sm">
            まだ豆がありません。「手で入力する」から最初の豆を登録できます。
          </p>
        )}
        {recent.map((b) => (
          <Row
            key={b.id}
            initial={b.name.slice(0, 2)}
            title={b.name}
            subtitle={b.roaster?.name ?? (b.source === 'home_roasted' ? '自家焙煎' : null)}
            onClick={() => pickExisting(b.id, b.name)}
          />
        ))}
      </section>
    </div>
  );
}

function BeanStep() {
  const router = useRouter();
  const [roasterQuery, setRoasterQuery] = useState('');
  const roasters = useRoasterSearch(roasterQuery);

  function onSubmit(values: BeanFormSubmit) {
    writeNewLogDraft({ bean: { kind: 'new', form: values.form, roaster: values.roaster } });
    router.push(stepHref('place'));
  }

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">豆の情報</h1>
      <WizardStepper current={1} steps={PHASE1_STEPS} className="mb-4" />
      <BeanForm
        roasterOptions={(roasters.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
        onRoasterSearch={setRoasterQuery}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function PlaceStep() {
  // ③ は Issue #19 で実装する
  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">どこで、どうだった？</h1>
      <WizardStepper current={2} steps={PHASE1_STEPS} className="mb-4" />
      <p className="text-muted-foreground text-sm">店・日付・評価・メモの入力は次の作業（#19）で入ります。</p>
    </div>
  );
}

function NewLogInner() {
  const step = useSearchParams().get('step');
  if (step === 'bean') return <BeanStep />;
  if (step === 'place') return <PlaceStep />;
  return <Entry />;
}

export default function NewLogPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <NewLogInner />
    </Suspense>
  );
}
