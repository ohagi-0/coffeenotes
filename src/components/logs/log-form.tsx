'use client';

import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ChevronRight, Plus, Store, X } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { Field, TextInput, Textarea } from '@/components/form/field';
import { PlaceSegment } from '@/components/logs/place-segment';
import { RatingStars } from '@/components/logs/rating-stars';
import { useRatingInputMode } from '@/features/settings/use-preferences';
import type { LogFormDraft } from '@/features/logs/save-new-log';
import { logFormFieldsSchema, type LogPlace } from '@/lib/schemas/log';
import { cn } from '@/lib/utils';

// ③ 店・日付・評価・メモ（S3 ③、F-LOG-2/3/4/8、F-SHOP-2/6、F-TAG-1/2）。
// 星とメモだけでも保存できる。店は既存から選ぶか、名前だけ手入力して新規にする（候補検索は Phase 3）。
// レシピ（自宅）と焙煎バッチは Phase 4 まで出さない。

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
  defaultValues?: Partial<FormInput>;
  onSubmit: (values: LogFormDraft) => void;
  submitting?: boolean;
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
  defaultValues,
  onSubmit,
  submitting,
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

  const [shopPicking, setShopPicking] = useState(false);
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
    setShopPicking(false);
  }
  function clearShop() {
    setValue('shop_id', null);
    setValue('shop_name', '');
    onShopSearch?.('');
    setShopPicking(true);
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
      fields,
      shop: fields.place === 'shop' && (shop_id || shop_name) ? { id: shop_id, name: shop_name } : null,
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
                  {shopId ? '登録済みの店' : '新しい店として登録します'}
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
          <p className="text-muted-foreground text-xs">
            店は後から付けることもできます。現在地からの候補と地図での指定は Phase 3 で。
          </p>
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

      <div className="mt-2">
        <AppButton type="submit" loading={submitting}>
          {submitLabel}
        </AppButton>
      </div>
    </form>
  );
}
