'use client';

import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Copy, Plus, Store, X } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { Field, TextInput, Textarea } from '@/components/form/field';
import { PlaceSegment } from '@/components/logs/place-segment';
import type { ShopCandidate } from '@/components/shops/shop-candidate-tools';
import { ShopPicker, type ShopPickerHint } from '@/components/shops/shop-picker';
import { RatingStars } from '@/components/logs/rating-stars';
import { RoastForm, type GreenShopOption } from '@/components/roasts/roast-form';
import { RECIPE_KEYS, hasRecipe, type RecipeValues } from '@/features/logs/aggregate';
import { formatBrewRatio } from '@/features/logs/presenters';
import { ROAST_LEVEL_LABELS, type RoastFormValues, type RoastLevel } from '@/lib/schemas/roast';
import { useRatingInputMode } from '@/features/settings/use-preferences';
import type { LogFormDraft } from '@/features/logs/save-new-log';
import { logFormFieldsSchema, type LogPlace } from '@/lib/schemas/log';
import { cn } from '@/lib/utils';

// ③ 店・日付・評価・メモ（S3 ③、F-LOG-2/3/4/8、F-SHOP-2/6、F-TAG-1/2）。
// 星とメモだけでも保存できる。店は「店で」を押すと開く全画面の検索シート（ShopPicker）で選ぶ:
// 登録済みの店 / カードのロースター名からの候補 / 近くの店 / 地図で見つかった店、一番上に「自分で登録する」。
// 「自分で登録する」は店名 + 住所の手入力。決定時に住所から位置を引く（F-SHOP-6。地図のピン刺しはスマホでは無理があるので使わない。2026-09-25）。
// 選んだ候補や住所から引いた座標は shopMeta に持って submit に含める。

export type ShopOption = { id: string; name: string; address?: string | null };

const formSchema = logFormFieldsSchema.omit({ bean_id: true, shop_id: true }).extend({
  shop_id: z.string().nullable().default(null),
  shop_name: z.string().trim().max(120, '店名は 120 文字までです').default(''),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export type LogFormProps = {
  /** 記録する豆の表示名（見出しの下に出す） */
  beanName: string;
  shopOptions?: ShopOption[];
  onShopSearch?: (query: string) => void;
  /** 過去に使ったタグ（候補として点線で出す） */
  tagSuggestions?: string[];
  /** 同じ豆の直近レシピ（F-BREW-7「前回のレシピを複製」）。無ければボタンを出さない */
  lastRecipe?: RecipeValues | null;
  /** 自家焙煎の豆のとき: 既存の焙煎バッチ。渡すと「自宅で」にバッチ選択が出る */
  roastOptions?: { id: string; roasted_on: string; roast_level: string | null }[];
  /** 自家焙煎の豆か（バッチが 0 件でも新規登録の導線を出す） */
  homeRoasted?: boolean;
  /** 新規バッチのフォームに出す生豆販売店 */
  greenShops?: GreenShopOption[];
  /** 店の候補検索（F-SHOP-3/4）。渡さなければチップを出さない */
  shopCandidates?: {
    nearby: (pos: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
    geocode: (query: string, near?: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
  };
  /** 検索シートの上に出す手がかり（カードのロースター名など）。候補を先に引いておく */
  shopHint?: ShopPickerHint | null;
  /** 登録済みの店を読み込み中か（検索シートの表示用） */
  shopOptionsPending?: boolean;
  defaultValues?: Partial<FormInput>;
  onSubmit: (values: LogFormDraft) => void;
  submitting?: boolean;
  /** 保存中の段階（「画像を保存しています…」など）。ボタンの下に出す */
  submittingText?: string | null;
  submitLabel?: string;
  className?: string;
};

const BREW_METHODS = ['ハンドドリップ', 'エスプレッソ', 'アイス'] as const;
const BREW_OTHER = 'その他';

export function LogForm({
  beanName,
  shopOptions = [],
  onShopSearch,
  tagSuggestions = [],
  lastRecipe,
  roastOptions = [],
  homeRoasted = false,
  greenShops,
  shopCandidates,
  shopHint,
  shopOptionsPending,
  defaultValues,
  onSubmit,
  submitting,
  submittingText,
  submitLabel = '保存する',
  className,
}: LogFormProps) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [ratingInputMode] = useRatingInputMode();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      place: 'shop',
      kind: 'drank',
      logged_on: format(new Date(), 'yyyy-MM-dd'),
      rating: null,
      tag_names: [],
      shop_id: null,
      shop_name: '',
      ...defaultValues,
    },
  });
  const { register, handleSubmit, setValue, control, formState } = form;
  const { errors } = formState;

  const place = (useWatch({ control, name: 'place' }) ?? 'shop') as LogPlace;
  const rating = useWatch({ control, name: 'rating' });
  const shopId = useWatch({ control, name: 'shop_id' }) ?? null;
  const shopName = useWatch({ control, name: 'shop_name' }) ?? '';
  const tags = (useWatch({ control, name: 'tag_names' }) ?? []) as string[];
  const brewMethod = useWatch({ control, name: 'brew_method' });
  const doseG = useWatch({ control, name: 'dose_g' });
  const waterG = useWatch({ control, name: 'water_g' });
  const roastIdRaw = useWatch({ control, name: 'roast_id' });
  const roastId = typeof roastIdRaw === 'string' ? roastIdRaw : null;
  const ratio = formatBrewRatio(num(doseG), num(waterG));
  // レシピは既定で閉じる。編集で値が入っていれば開く
  const [recipeOpen, setRecipeOpen] = useState(() =>
    hasRecipe(defaultValues as Partial<RecipeValues> | undefined),
  );
  const [newRoast, setNewRoast] = useState<RoastFormValues | null>(null);
  const [roastAdding, setRoastAdding] = useState(false);

  /** 検索シートの開閉と検索語 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  /** 「自分で登録する」を選んで店名を手入力している間 true */
  const [manual, setManual] = useState(false);
  /** 候補や住所で決めた新規店の付帯情報（既存の店を選んだら null） */
  const [shopMeta, setShopMeta] = useState<{
    address: string | null;
    lat: number | null;
    lng: number | null;
    externalPlaceId: string | null;
  } | null>(null);
  /** 「自分で登録する」の住所欄と、決定時の位置の問い合わせ */
  const [manualAddress, setManualAddress] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualNote, setManualNote] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const brewIsOther =
    typeof brewMethod === 'string' &&
    brewMethod !== '' &&
    !(BREW_METHODS as readonly string[]).includes(brewMethod);
  const [brewOther, setBrewOther] = useState(brewIsOther);

  const ratingValue = typeof rating === 'number' ? rating : null;

  function openPicker() {
    setPickerQuery('');
    onShopSearch?.('');
    setManual(false);
    setPickerOpen(true);
  }
  function setQuery(q: string) {
    setPickerQuery(q);
    onShopSearch?.(q);
  }
  function pickShop(s: ShopOption) {
    setValue('shop_id', s.id, { shouldDirty: true });
    setValue('shop_name', s.name, { shouldDirty: true });
    setShopMeta(null);
    setManual(false);
    setPickerOpen(false);
  }
  function pickCandidate(c: ShopCandidate) {
    setValue('shop_id', null);
    setValue('shop_name', c.name, { shouldDirty: true, shouldValidate: true });
    setShopMeta({ address: c.address, lat: c.lat, lng: c.lng, externalPlaceId: c.externalPlaceId });
    setManual(false);
    setPickerOpen(false);
  }
  function registerManually(name: string) {
    setValue('shop_id', null);
    setValue('shop_name', name, { shouldDirty: true });
    setShopMeta(null);
    setManualAddress('');
    setManualNote(null);
    setPickerOpen(false);
    setManual(true);
  }
  /** 店名 + 住所で決定。住所があれば位置を引く。引けなくても保存はできる（あとから店の編集で直せる） */
  async function confirmManual() {
    const address = manualAddress.trim();
    let meta: NonNullable<typeof shopMeta> = {
      address: address || null,
      lat: null,
      lng: null,
      externalPlaceId: null,
    };
    if (address && shopCandidates?.geocode) {
      setManualBusy(true);
      try {
        const hits = await shopCandidates.geocode(address);
        const hit = hits[0];
        if (hit) meta = { ...meta, lat: hit.lat, lng: hit.lng };
        setManualNote(
          hit ? null : '住所から位置を特定できませんでした。保存はできます。位置は店の編集で付けられます',
        );
      } catch {
        setManualNote('位置の問い合わせに失敗しました。保存はできます。位置は店の編集で付けられます');
      } finally {
        setManualBusy(false);
      }
    }
    setShopMeta(meta);
    setManual(false);
  }
  function clearShop() {
    setValue('shop_id', null);
    setValue('shop_name', '');
    setShopMeta(null);
    setManual(false);
    openPicker();
  }
  function copyLastRecipe() {
    if (!lastRecipe) return;
    for (const k of RECIPE_KEYS) {
      const v = lastRecipe[k];
      setValue(k, (v ?? '') as never, { shouldDirty: true });
    }
    setBrewOther(
      typeof lastRecipe.brew_method === 'string' &&
        lastRecipe.brew_method !== '' &&
        !(BREW_METHODS as readonly string[]).includes(lastRecipe.brew_method),
    );
    setRecipeOpen(true);
  }
  function toggleTag(name: string) {
    setValue('tag_names', tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name], {
      shouldDirty: true,
    });
  }
  function addTag() {
    const v = tagDraft.trim().replace(/^#/, '');
    if (!v) return;
    if (!tags.includes(v)) setValue('tag_names', [...tags, v], { shouldDirty: true });
    setTagDraft('');
  }

  const submit = handleSubmit((values) => {
    const { shop_id, shop_name, ...fields } = values;
    onSubmit({
      fields: { ...fields, roast_id: fields.place === 'home' ? (newRoast ? null : fields.roast_id) : null },
      newRoast: fields.place === 'home' ? newRoast : null,
      shop:
        fields.place === 'shop' && (shop_id || shop_name)
          ? { id: shop_id, name: shop_name, ...(shop_id ? {} : (shopMeta ?? {})) }
          : null,
    });
  });

  const suggestions = tagSuggestions.filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-4', className)}>
      <p className="text-muted-foreground -mt-1 text-sm">
        <span className="font-display text-foreground text-lg">{beanName}</span> を
      </p>

      <PlaceSegment
        value={place}
        onChange={(v) => {
          setValue('place', v, { shouldDirty: true });
          // 「店で」を押したら（すでに店でも）検索シートを開く。店を選び直したいときの入口も兼ねる
          if (v === 'shop') openPicker();
          else {
            setPickerOpen(false);
            setManual(false);
          }
        }}
      />

      {place === 'shop' && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px]">店</span>
          {shopId || (!manual && shopName) ? (
            <button
              type="button"
              onClick={clearShop}
              className="border-primary bg-card flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left"
            >
              <span className="bg-secondary text-primary font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
                {shopName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{shopName}</span>
                <span className="text-muted-foreground block text-xs">
                  {shopId
                    ? '登録済みの店'
                    : shopMeta?.lat != null
                      ? `新しい店として登録します（地図に出ます${shopMeta.address ? ` · ${shopMeta.address}` : ''}）`
                      : shopMeta?.address
                        ? `新しい店として登録します（${shopMeta.address}）`
                        : '新しい店として登録します'}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-[18px]" aria-hidden />
            </button>
          ) : manual ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Store
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
                  aria-hidden
                />
                <TextInput
                  id={id('shop')}
                  placeholder="店名を入力"
                  autoComplete="off"
                  autoFocus
                  className="pl-10"
                  aria-label="店"
                  {...register('shop_name', {
                    onChange: () => setValue('shop_id', null),
                  })}
                />
              </div>
              <TextInput
                id={id('shop-address')}
                placeholder="住所（例: 東京都台東区蔵前 3-1-2）"
                autoComplete="off"
                aria-label="店の住所"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
              />
              <p className="text-muted-foreground text-[11px]">
                住所を入れると地図に出ます。店名だけでも登録できます
              </p>
              <div className="flex items-center justify-between">
                <button type="button" onClick={openPicker} className="text-primary text-[12px] font-medium">
                  検索に戻る
                </button>
                <button
                  type="button"
                  onClick={() => void confirmManual()}
                  disabled={!shopName.trim() || manualBusy}
                  className="text-primary text-[12px] font-bold disabled:opacity-50"
                >
                  {manualBusy ? '位置を調べています…' : 'この内容で決定'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              className="border-border bg-card flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left"
            >
              <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
                <Store className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">店を選ぶ</span>
                <span className="text-muted-foreground block text-xs">
                  登録済み・現在地・地図から探す。無ければ自分で登録
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-[18px]" aria-hidden />
            </button>
          )}
          {manualNote && !manual && (
            <p role="status" className="text-muted-foreground text-xs">
              {manualNote}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            店は後から付けることもできます。店の情報はあとから編集できます。
          </p>
          <ShopPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            query={pickerQuery}
            onQueryChange={setQuery}
            registered={shopOptions}
            registeredPending={shopOptionsPending}
            candidates={shopCandidates}
            hint={shopHint}
            onPickShop={pickShop}
            onPickCandidate={pickCandidate}
            onRegisterManually={registerManually}
          />
        </div>
      )}

      {place === 'home' && (homeRoasted || roastOptions.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px]">焙煎バッチ</span>
          {newRoast ? (
            <div className="border-primary bg-card flex items-center justify-between rounded-[14px] border px-3.5 py-3 text-sm">
              <span>
                <span className="font-num">{newRoast.roasted_on}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {newRoast.roast_level ? ROAST_LEVEL_LABELS[newRoast.roast_level as RoastLevel] : ''} ·
                  新しいバッチとして登録
                </span>
              </span>
              <button
                type="button"
                onClick={() => setNewRoast(null)}
                className="text-muted-foreground text-xs underline"
              >
                取り消す
              </button>
            </div>
          ) : roastAdding ? (
            <RoastForm
              greenShops={greenShops}
              onCancel={() => setRoastAdding(false)}
              submitLabel="このバッチを使う"
              onSubmit={(values) => {
                setNewRoast(values);
                setValue('roast_id', null);
                setRoastAdding(false);
              }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {roastOptions.length > 0 && (
                <select
                  aria-label="焙煎バッチ"
                  className="border-border bg-card h-11 rounded-xl border px-3.5 text-sm"
                  value={roastId ?? ''}
                  onChange={(e) => setValue('roast_id', e.target.value || null, { shouldDirty: true })}
                >
                  <option value="">バッチを選ばない</option>
                  {roastOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roasted_on}
                      {r.roast_level && r.roast_level in ROAST_LEVEL_LABELS
                        ? ` · ${ROAST_LEVEL_LABELS[r.roast_level as RoastLevel]}`
                        : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setRoastAdding(true)}
                className="text-primary flex items-center gap-1 self-start text-[13px] font-medium"
              >
                <Plus className="size-4" aria-hidden />
                新しいバッチを登録
              </button>
            </div>
          )}
        </div>
      )}

      {place === 'home' && (
        <div className="border-border rounded-[14px] border">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <button
              type="button"
              aria-expanded={recipeOpen}
              onClick={() => setRecipeOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              <ChevronDown
                className={cn('size-4 transition-transform', !recipeOpen && '-rotate-90')}
                aria-hidden
              />
              レシピ
              <span className="text-muted-foreground text-[11px] font-normal">任意</span>
            </button>
            {lastRecipe && (
              <button
                type="button"
                onClick={copyLastRecipe}
                className="text-primary flex items-center gap-1 text-[12px] font-medium"
              >
                <Copy className="size-3.5" aria-hidden />
                前回のレシピを複製
              </button>
            )}
          </div>
          {recipeOpen && (
            <div className="border-border flex flex-col gap-3 border-t px-3.5 pt-3 pb-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="グラインダー" htmlFor={id('grinder')} error={errors.grinder?.message}>
                  <TextInput
                    id={id('grinder')}
                    placeholder="Comandante C40"
                    autoComplete="off"
                    {...register('grinder')}
                  />
                </Field>
                <Field label="挽き目" htmlFor={id('grind')} error={errors.grind_setting?.message}>
                  <TextInput
                    id={id('grind')}
                    placeholder="25 クリック"
                    autoComplete="off"
                    {...register('grind_setting')}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label="豆量" htmlFor={id('dose')} error={errors.dose_g?.message}>
                  <div className="relative">
                    <TextInput
                      id={id('dose')}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="15"
                      className="font-num pr-7"
                      {...register('dose_g')}
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      g
                    </span>
                  </div>
                </Field>
                <Field label="湯量" htmlFor={id('water')} error={errors.water_g?.message}>
                  <div className="relative">
                    <TextInput
                      id={id('water')}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="225"
                      className="font-num pr-7"
                      {...register('water_g')}
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      g
                    </span>
                  </div>
                </Field>
                <div className="pb-3 text-right">
                  <span className="text-muted-foreground block text-[11px]">比率</span>
                  <span
                    className="font-num text-[26px] leading-none font-extrabold"
                    aria-label="豆と湯の比率"
                  >
                    {ratio ?? '—'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="湯温" htmlFor={id('temp')} error={errors.water_temp_c?.message}>
                  <div className="relative">
                    <TextInput
                      id={id('temp')}
                      type="number"
                      inputMode="numeric"
                      placeholder="92"
                      className="font-num pr-8"
                      {...register('water_temp_c')}
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      ℃
                    </span>
                  </div>
                </Field>
                <Field label="抽出時間" htmlFor={id('time')} error={errors.brew_time_sec?.message}>
                  <div className="relative">
                    <TextInput
                      id={id('time')}
                      type="number"
                      inputMode="numeric"
                      placeholder="180"
                      className="font-num pr-8"
                      {...register('brew_time_sec')}
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      秒
                    </span>
                  </div>
                </Field>
              </div>
              <Field label="レシピメモ" htmlFor={id('recipe-memo')} error={errors.recipe_memo?.message}>
                <Textarea
                  id={id('recipe-memo')}
                  placeholder="注ぎ方、蒸らし時間など"
                  {...register('recipe_memo')}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label="日付" htmlFor={id('date')} error={errors.logged_on?.message}>
        <TextInput id={id('date')} type="date" className="font-num" {...register('logged_on')} />
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">評価</span>
        <RatingStars
          value={ratingValue}
          size="lg"
          onChange={(v) => setValue('rating', v, { shouldDirty: true, shouldValidate: true })}
          aria-label="評価"
        />
        {ratingInputMode === 'slider' && (
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={ratingValue ?? 3}
            onChange={(e) => setValue('rating', Number(e.target.value), { shouldDirty: true })}
            aria-label="評価（スライダー）"
            className="accent-primary mt-1 w-full"
          />
        )}
        <p className="text-muted-foreground text-[11px]">
          星の左半分で .5、右半分で .0。空のままでも保存できます。
        </p>
        {errors.rating?.message && (
          <p role="alert" className="text-destructive text-xs">
            {errors.rating.message}
          </p>
        )}
      </div>

      <Field label="メモ" htmlFor={id('memo')} error={errors.memo?.message}>
        <Textarea id={id('memo')} placeholder="味の感想、次に試したいこと" {...register('memo')} />
      </Field>

      <div className="flex flex-col gap-1">
        <label htmlFor={id('tag')} className="text-muted-foreground text-[11px]">
          タグ
        </label>
        <div className="flex gap-2">
          <TextInput
            id={id('tag')}
            placeholder="#ゲイシャ"
            autoComplete="off"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <AppButton
            type="button"
            variant="secondary"
            size="md"
            width="auto"
            onClick={addTag}
            aria-label="タグを追加"
          >
            <Plus className="size-5" aria-hidden />
            追加
          </AppButton>
        </div>
        {(tags.length > 0 || suggestions.length > 0) && (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="付けたタグと候補">
            {tags.map((t) => (
              <li
                key={t}
                className="bg-secondary flex items-center gap-1 rounded-[5px] pl-2 text-[12px] leading-[1.9]"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-label={`${t} を外す`}
                  className="text-muted-foreground hover:text-foreground grid size-6 place-items-center"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {suggestions.map((t) => (
              <li key={`s-${t}`}>
                <button
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-label={`${t} を付ける`}
                  className="border-border text-muted-foreground hover:text-foreground rounded-[5px] border border-dashed px-2 text-[12px] leading-[1.9]"
                >
                  #{t}
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.tag_names?.message && (
          <p role="alert" className="text-destructive text-xs">
            {errors.tag_names.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">飲み方</span>
        <div role="group" aria-label="飲み方" className="flex flex-wrap gap-2">
          {[...BREW_METHODS, BREW_OTHER].map((m) => {
            const active = m === BREW_OTHER ? brewOther : !brewOther && brewMethod === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (m === BREW_OTHER) {
                    setBrewOther(true);
                    setValue('brew_method', '', { shouldDirty: true });
                  } else {
                    setBrewOther(false);
                    setValue('brew_method', brewMethod === m ? null : m, { shouldDirty: true });
                  }
                }}
                className={cn(
                  'focus-visible:outline-primary inline-flex h-[34px] items-center rounded-full border px-3.5 text-xs font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
                  active
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-foreground',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        {brewOther && (
          <TextInput
            aria-label="飲み方（自由入力）"
            placeholder="フレンチプレス、エアロプレス など"
            className="mt-1"
            {...register('brew_method')}
          />
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <AppButton type="submit" loading={submitting}>
          {submitLabel}
        </AppButton>
        {submitting && submittingText && (
          <p role="status" className="text-muted-foreground text-center text-xs">
            {submittingText}
          </p>
        )}
      </div>
    </form>
  );
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
