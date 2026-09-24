'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, List, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { AppButton } from '@/components/app-button';
import { BeanForm, type BeanFormSubmit } from '@/components/beans/bean-form';
import { CardImage } from '@/components/beans/card-image';
import { ErrorCallout } from '@/components/error-callout';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { CaptureStep, type CapturedImages } from '@/components/logs/capture-step';
import { EntryOption } from '@/components/logs/entry-option';
import { LogForm } from '@/components/logs/log-form';
import { Row } from '@/components/row';
import { Skeleton } from '@/components/ui/skeleton';
import { PHASE1_STEPS, WIZARD_STEPS, WizardStepper } from '@/components/wizard-stepper';
import { requireUserId } from '@/features/auth/require-user-id';
import { saveBeanImages } from '@/features/beans/images';
import { useCreateBean } from '@/features/beans/mutations';
import { beanKeys, useBean, useBeans } from '@/features/beans/queries';
import { latestRecipe } from '@/features/logs/aggregate';
import { useCreateLog } from '@/features/logs/mutations';
import { useLogsByBean } from '@/features/logs/queries';
import {
  clearNewLogDraft,
  readNewLogDraft,
  writeNewLogDraft,
  type DraftImages,
} from '@/features/logs/new-log-draft';
import { saveNewLog, type SaveNewLogStage, type LogFormDraft } from '@/features/logs/save-new-log';
import { geocodePlace, searchNearbyPlaces } from '@/features/geo/search';
import { clearCaptureDraft, readCaptureDraft, writeCaptureDraft } from '@/features/ocr/capture-draft';
import { OcrRequestError, requestBeanCardExtraction } from '@/features/ocr/extract-bean-card';
import { extractionToBeanForm, type BeanFormPrefill } from '@/features/ocr/to-bean-form';
import { useCreateRoaster } from '@/features/roasters/mutations';
import { useCreateRoast } from '@/features/roasts/mutations';
import { useRoastsByBean } from '@/features/roasts/queries';
import { useRoasterSearch } from '@/features/roasters/queries';
import { useCreateShop } from '@/features/shops/mutations';
import { useShops } from '@/features/shops/queries';
import { useTags } from '@/features/tags/queries';
import { blobToDataUrl, dataUrlToBlob } from '@/lib/image/data-url';
import { qrTextToUrl, readQrFromBlob } from '@/lib/image/qr';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { routes } from '@/lib/routes';

// S3 記録作成（F-LOG-1）。段階は URL の ?step= に持つ（動的セグメントは使わない。ADR 0008）。
//   (なし)  入口: カードを撮る / 手で入力する / 登録済みの豆から
//   capture ① カード撮影（F-OCR-1）→ 画像は sessionStorage に data URL で持つ
//   ocr     ② 読み取り結果の確認・修正（F-OCR-2/5）。失敗・上限・無効なら同じ画面で手入力に切り替える
//   bean    ② 豆フォーム（手入力）
//   place   ③ 店・日付・評価・メモ → 保存（豆・ロースター・画像・店・記録の順に作る）

const RECENT_BEANS = 3;
/** これを超えたら読み取りを打ち切って手入力に切り替える（DESIGN.md S3 ②） */
const OCR_AUTO_FALLBACK_MS = 10_000;

type Step = 'capture' | 'ocr' | 'bean' | 'place';

function stepHref(step: Step): Route {
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
        <EntryOption
          icon={Camera}
          title="カードを撮る"
          description="表と裏を撮ると、豆の情報を読み取ります"
          primary
          href={stepHref('capture')}
        />
        <EntryOption
          icon={PencilLine}
          title="手で入力する"
          description="カードが無い豆、量り売り、もらい物"
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

function CaptureStepPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function onSubmit({ front, back }: CapturedImages) {
    setSaving(true);
    setFailure(null);
    try {
      const draft: DraftImages = { front: await blobToDataUrl(front) };
      if (back) draft.back = await blobToDataUrl(back);
      if (!writeCaptureDraft(draft)) {
        setFailure(
          'この端末では画像を一時保存できません（ストレージの空きが無いか、プライベートブラウズ）。',
        );
        return;
      }
      router.push(stepHref('ocr'));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '画像を用意できませんでした');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">カードを撮る</h1>
      <WizardStepper current={1} steps={WIZARD_STEPS} className="mb-4" />
      {failure && (
        <ErrorCallout
          title="画像を保持できませんでした"
          what={failure}
          next="「手で入力する」なら画像なしで登録できます。"
          onRetry={() => router.replace(stepHref('bean'))}
          retryLabel="手で入力する"
          className="mb-4"
        />
      )}
      <CaptureStep onSubmit={onSubmit} submitting={saving} />
    </div>
  );
}

type OcrPhase = 'running' | 'ready' | 'manual' | 'failed';

function OcrStepPage() {
  const router = useRouter();
  const [capture] = useState(() => readCaptureDraft());
  const [phase, setPhase] = useState<OcrPhase>('running');
  const [prefill, setPrefill] = useState<BeanFormPrefill | null>(null);
  const [ocrRaw, setOcrRaw] = useState<unknown>(null);
  /** カードの QR から読んだ参照 URL（F-OCR-4）。読み取りの成否に関係なくフォームに入れる */
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [roasterQuery, setRoasterQuery] = useState('');
  const roasters = useRoasterSearch(roasterQuery);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!capture || started.current) return;
    started.current = true; // StrictMode の二重実行で 2 回読み取らない（1 回分の上限を無駄にしない）
    const ac = new AbortController();
    controller.current = ac;
    const timer = setTimeout(() => ac.abort(), OCR_AUTO_FALLBACK_MS);
    (async () => {
      try {
        const [front, back] = await Promise.all([
          dataUrlToBlob(capture.front),
          capture.back ? dataUrlToBlob(capture.back) : Promise.resolve(null),
        ]);
        // QR はブラウザ内で読む（OCR と並行。無ければ null）
        void Promise.all([readQrFromBlob(front), back ? readQrFromBlob(back) : Promise.resolve(null)]).then(
          ([a, b]) => setQrUrl(qrTextToUrl(a) ?? qrTextToUrl(b)),
        );
        const res = await requestBeanCardExtraction({ front, back, signal: ac.signal });
        setPrefill(extractionToBeanForm(res.extraction));
        setOcrRaw(res.raw);
        setPhase('ready');
      } catch (e) {
        if (e instanceof OcrRequestError) {
          switch (e.code) {
            case 'aborted':
              setNotice('10 秒以内に読み取れなかったので、手入力に切り替えました。画像は保存されます。');
              setPhase('manual');
              return;
            case 'ocr_disabled':
              setNotice(
                'カードの読み取りは現在使えません。画像は保存されるので、内容は手で入力してください。',
              );
              setPhase('manual');
              return;
            case 'quota_exceeded':
              setNotice(e.message);
              setPhase('manual');
              return;
            case 'unauthorized':
              router.replace(routes.login as Route);
              return;
            default:
              setFailure(e.message);
              setPhase('failed');
              return;
          }
        }
        setFailure(e instanceof Error ? e.message : '読み取りに失敗しました');
        setPhase('failed');
      } finally {
        clearTimeout(timer);
      }
    })();
  }, [capture, router]);

  function skipToManual() {
    controller.current?.abort();
    setNotice('画像は保存されます。内容は手で入力してください。');
    setPhase('manual');
  }

  function onSubmit(values: BeanFormSubmit) {
    writeNewLogDraft({
      bean: {
        kind: 'new',
        form: values.form,
        roaster: values.roaster,
        ...(capture ? { images: capture } : {}),
        ...(phase === 'ready' && ocrRaw !== null ? { ocrRaw } : {}),
      },
    });
    router.push(stepHref('place'));
  }

  if (!capture) {
    return (
      <div className="pb-2">
        <h1 className="pt-2 pb-3 text-2xl font-bold">読み取り結果を確認</h1>
        <ErrorCallout
          title="撮影した画像が見つかりません"
          what="ブラウザを閉じたか、画像を一時保存できませんでした。"
          next="もう一度カードを撮ってください。"
          onRetry={() => router.replace(stepHref('capture'))}
          retryLabel="撮り直す"
        />
      </div>
    );
  }

  const images = (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <CardImage src={capture.front} beanName="表面" alt="表面のカード" size="full" />
      {capture.back ? (
        <CardImage src={capture.back} beanName="裏面" alt="裏面のカード" size="full" />
      ) : (
        <div className="bg-card border-border text-muted-foreground flex aspect-[3/4] items-center justify-center rounded-[5px] border border-dashed text-[12px]">
          裏面なし
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">読み取り結果を確認</h1>
      <WizardStepper current={2} steps={WIZARD_STEPS} className="mb-4" />
      {images}

      {phase === 'running' && (
        <div aria-busy className="flex flex-col gap-3">
          <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-1/3 animate-[ocr-progress_1.6s_ease-in-out_infinite] rounded-full motion-reduce:animate-none" />
          </div>
          <p className="text-muted-foreground text-[12px]">読み取っています。通常 3〜8 秒かかります。</p>
          <div className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <AppButton variant="ghost" onClick={skipToManual}>
            スキップして手入力する
          </AppButton>
          <style>{`@keyframes ocr-progress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}

      {phase === 'failed' && (
        <div className="flex flex-col gap-3">
          <ErrorCallout
            title="文字が判別できませんでした"
            what={failure ?? '読み取りに失敗しました。'}
            next="明るい場所で正面から撮り直すか、内容を手で入力してください。画像は残っています。"
          />
          <div className="grid grid-cols-2 gap-2">
            <AppButton variant="secondary" onClick={() => router.replace(stepHref('capture'))}>
              撮り直す
            </AppButton>
            <AppButton
              onClick={() => {
                setNotice('画像は保存されます。内容は手で入力してください。');
                setPhase('manual');
              }}
            >
              手で入力する
            </AppButton>
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'manual') && (
        <>
          <p className="text-muted-foreground mb-3 text-[12px] leading-relaxed">
            {phase === 'ready' ? (
              <>
                読み取った内容を確認してください。「要確認」の項目は自信が低いものです。
                <button
                  type="button"
                  className="text-primary ml-1 underline underline-offset-2"
                  onClick={() => {
                    setPrefill(null);
                    setNotice('画像は保存されます。内容は手で入力してください。');
                    setPhase('manual');
                  }}
                >
                  手入力に切り替える
                </button>
              </>
            ) : (
              notice
            )}
          </p>
          <BeanForm
            key={`${phase}-${qrUrl ?? ''}`}
            defaultValues={{
              ...(phase === 'ready' ? prefill?.values : {}),
              ...(qrUrl && !prefill?.values.reference_url ? { reference_url: qrUrl } : {}),
            }}
            confidence={
              phase === 'ready'
                ? {
                    ...prefill?.confidence,
                    ...(qrUrl && !prefill?.values.reference_url ? { reference_url: 1 } : {}),
                  }
                : undefined
            }
            roasterOptions={(roasters.data ?? []).map((r) => ({ id: r.id, name: r.name }))}
            onRoasterSearch={setRoasterQuery}
            onSubmit={onSubmit}
          />
        </>
      )}
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

const SAVE_STAGE_TEXT: Record<SaveNewLogStage, string> = {
  bean: '豆を保存しています…',
  images: 'カード画像を保存しています…',
  shop: '店を登録しています…',
  roast: '焙煎バッチを登録しています…',
  log: '記録を保存しています…',
};

function PlaceStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft] = useState(() => readNewLogDraft());
  const [shopQuery, setShopQuery] = useState('');
  const shops = useShops(shopQuery.trim() ? { search: shopQuery } : {});
  const tags = useTags();
  const createRoaster = useCreateRoaster();
  const createBean = useCreateBean();
  const createShop = useCreateShop();
  const createLog = useCreateLog();
  const createRoast = useCreateRoast();
  const existingBeanId = draft?.bean.kind === 'existing' ? draft.bean.id : null;
  const existingBean = useBean(existingBeanId);
  const beanLogs = useLogsByBean(existingBeanId);
  const roasts = useRoastsByBean(existingBeanId);
  const greenShops = useShops({ kind: 'green_bean_shop' });
  const homeRoasted =
    draft?.bean.kind === 'new'
      ? draft.bean.form.source === 'home_roasted'
      : existingBean.data?.source === 'home_roasted';
  const lastRecipe = latestRecipe(beanLogs.data ?? []);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<SaveNewLogStage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="pb-2">
        <h1 className="pt-2 pb-3 text-2xl font-bold">どこで、どうだった？</h1>
        <ErrorCallout
          title="豆の情報が見つかりません"
          what="この画面は豆を選んでから開きます。ブラウザを閉じると途中の入力は消えます。"
          next="入口に戻って、もう一度豆を選んでください。"
          onRetry={() => router.replace(routes.newLog)}
          retryLabel="入口に戻る"
        />
      </div>
    );
  }

  const beanName = draft.bean.kind === 'existing' ? draft.bean.name : draft.bean.form.name;
  const fromCamera = draft.bean.kind === 'new' && !!draft.bean.images;

  async function onSubmit(values: LogFormDraft) {
    if (!draft) return;
    setSaving(true);
    setStage(null);
    setFailure(null);
    try {
      const result = await saveNewLog(draft, values, {
        onProgress: setStage,
        createRoaster: (input) => createRoaster.mutateAsync(input),
        createBean: (input) => createBean.mutateAsync(input),
        createShop: (input) => createShop.mutateAsync(input),
        createLog: (input) => createLog.mutateAsync(input),
        createRoast: (input) => createRoast.mutateAsync(input),
        saveBeanImages: async (beanId, images) => {
          const userId = await requireUserId();
          const [front, back] = await Promise.all([
            dataUrlToBlob(images.front),
            images.back ? dataUrlToBlob(images.back) : Promise.resolve(null),
          ]);
          await saveBeanImages(getSupabaseBrowserClient(), { userId, beanId, images: { front, back } });
          queryClient.invalidateQueries({ queryKey: beanKeys.all });
        },
      });
      clearNewLogDraft();
      clearCaptureDraft();
      toast.success('保存しました');
      if (result.imageError) toast.warning(`カード画像だけ保存できませんでした: ${result.imageError}`);
      router.replace(routes.bean(result.beanId) as Route);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '保存できませんでした');
      setSaving(false);
    }
  }

  return (
    <div className="pb-2">
      <h1 className="pt-2 pb-3 text-2xl font-bold">どこで、どうだった？</h1>
      {fromCamera ? (
        <WizardStepper current={3} steps={WIZARD_STEPS} className="mb-4" />
      ) : (
        <WizardStepper current={2} steps={PHASE1_STEPS} className="mb-4" />
      )}
      {failure && (
        <ErrorCallout
          title="保存できませんでした"
          what={failure}
          next="入力は残っています。通信状態を確認して、もう一度保存してください。"
          className="mb-4"
        />
      )}
      <LogForm
        beanName={beanName}
        shopOptions={(shops.data ?? []).map((s) => ({ id: s.id, name: s.name, address: s.address }))}
        onShopSearch={setShopQuery}
        tagSuggestions={(tags.data ?? []).map((t) => t.name)}
        lastRecipe={lastRecipe}
        homeRoasted={!!homeRoasted}
        roastOptions={(roasts.data ?? []).map((r) => ({
          id: r.id,
          roasted_on: r.roasted_on,
          roast_level: r.roast_level,
        }))}
        greenShops={(greenShops.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        shopCandidates={{
          nearby: (pos) => searchNearbyPlaces(pos),
          geocode: (query, near) => geocodePlace({ query, near }),
        }}
        onSubmit={onSubmit}
        submitting={saving}
        submittingText={stage ? SAVE_STAGE_TEXT[stage] : null}
      />
    </div>
  );
}

function NewLogInner() {
  const step = useSearchParams().get('step');
  if (step === 'capture') return <CaptureStepPage />;
  if (step === 'ocr') return <OcrStepPage />;
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
