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
import { ShopCandidateTools, type ShopCandidate } from '@/components/shops/shop-candidate-tools';
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
// 星とメモだけでも保存できる。店は既存から選ぶか、名前だけ手入力して新規にする（候補検索は Phase 3）。
// 店の候補（現在地から / 店名で検索 / 地図で指定）は ShopCandidateTools に任せ、選んだ候補の座標は shopMeta に持って submit に含める。

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

  const [shopPicking, setShopPicking] = useState(false);
  /** 候補や地図で決めた新規店の付帯情報（既存の店を選んだら null） */
  const [shopMeta, setShopMeta] = useState<{
    address: string | null;
    lat: number | null;
    lng: number | null;
    externalPlaceId: string | null;
  } | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const brewIsOther =
    typeof brewMethod === 'string' &&
    brewMethod !== '' &&
    !(BREW_METHODS as readonly string[]).includes(brewMethod);
  const [brewOther, setBrewOther] = useState(brewIsOther);

  const ratingValue = typeof rating === 'number' ? rating : null;

  function pickShop(s: ShopOption) {
    setValue('shop_id', s.id, { shouldDirty: true });
    setValue('shop_name', s.name, { shouldDirty: true });
    setShopMeta(null);
    setShopPicking(false);
  }
  function pickCandidate(c: ShopCandidate) {
    setValue('shop_id', null);
    setValue('shop_name', c.name, { shouldDirty: true, shouldValidate: true });
    setShopMeta({ address: c.address, lat: c.lat, lng: c.lng, externalPlaceId: c.externalPlaceId });
    setShopPicking(false);
  }
  function pickPosition(pos: { lat: number; lng: number }) {
    setValue('shop_id', null);
    setShopMeta((m) => ({ address: m?.address ?? null, externalPlaceId: null, lat: pos.lat, lng: pos.lng }));
  }
  function clearShop() {
    setValue('shop_id', null);
    setValue('shop_name', '');
    setShopMeta(null);
    onShopSearch?.('');
    setShopPicking(true);
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
          if (v === 'home') setShopPicking(false);
        }}
      />

      {place === 'shop' && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px]">店</span>
          {shopId || (!shopPicking && shopName) ? (
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
                      ? `新しい店として登録します（座標あり${shopMeta.address ? ` · ${shopMeta.address}` : ''}）`
                      : '新しい店として登録します'}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-[18px]" aria-hidden />
            </button>
          ) : (
            <div className="relative">
              <Store
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
                aria-hidden
              />
              <TextInput
                id={id('shop')}
                placeholder="店名を入力（無ければそのまま新規登録）"
                autoComplete="off"
                className="pl-10"
                aria-label="店"
                aria-autocomplete="list"
                aria-expanded={shopPicking && shopOptions.length > 0}
                {...register('shop_name', {
                  onChange: (e) => {
                    setValue('shop_id', null);
                    onShopSearch?.(e.target.value);
                  },
                })}
                onFocus={() => setShopPicking(true)}
                onBlur={() => setTimeout(() => setShopPicking(false), 120)}
              />
              {shopPicking && shopOptions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="店の候補"
                  className="bg-card border-border absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border py-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)]"
                >
                  {shopOptions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickShop(s)}
                        className="hover:bg-secondary flex h-11 w-full flex-col justify-center px-3.5 text-left"
                      >
                        <span className="text-sm">{s.name}</span>
                        {s.address && <span className="text-muted-foreground text-[11px]">{s.address}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!shopId && (
            <ShopCandidateTools
              query={shopName}
              nearby={shopCandidates?.nearby}
              geocode={shopCandidates?.geocode}
              onPick={pickCandidate}
              onPickPosition={pickPosition}
              position={
                shopMeta?.lat != null && shopMeta.lng != null
                  ? { lat: shopMeta.lat, lng: shopMeta.lng }
                  : null
              }
            />
          )}
          <p className="text-muted-foreground text-xs">
            店は後から付けることもできます。座標が無くても保存できます。
          </p>
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
