'use client';

import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { EMPTY_TASTE, TasteDots, type TasteValues } from '@/components/beans/taste-dots';
import { Field, Select, TextInput, Textarea } from '@/components/form/field';
import { OcrField } from '@/components/logs/ocr-field';
import type { BeanFormFieldName } from '@/features/ocr/to-bean-form';
import {
  beanFormSchema,
  type BeanFormInput,
  BEAN_ROAST_LEVEL_LABELS,
  type BeanRoastLevel,
} from '@/lib/schemas/bean';
import type { DraftBeanForm, DraftRoaster } from '@/features/logs/new-log-draft';
import { cn } from '@/lib/utils';

// 豆フォーム（S3 ②、F-BEAN-1〜11/15）。beanFormSchema を resolver に使う。
// ロースターは共有マスタから選ぶか、無ければ名前だけ入れて「新しいロースター」として扱う（保存時に登録）。
// OCR 結果は defaultValues に流し込むだけ。確定はユーザー操作。confidence を渡すと、その項目は OcrField（要確認）で描く。

export type RoasterOption = { id: string; name: string };

const formSchema = beanFormSchema.omit({ roaster_id: true }).extend({
  roaster_name: z.string().trim().max(120, 'ロースター名は 120 文字までです').default(''),
  roaster_id: z.string().nullable().default(null),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export type BeanFormSubmit = { form: DraftBeanForm; roaster: DraftRoaster };

export type BeanFormProps = {
  defaultValues?: Partial<FormInput>;
  /** OCR の項目ごとの信頼度 0〜1（F-OCR-5）。低い項目に「要確認」を出す。手入力では渡さない */
  confidence?: Partial<Record<BeanFormFieldName, number>>;
  /** ロースター候補（`onRoasterSearch` の結果） */
  roasterOptions?: RoasterOption[];
  onRoasterSearch?: (query: string) => void;
  onSubmit: (values: BeanFormSubmit) => void;
  submitLabel?: string;
  submitting?: boolean;
  className?: string;
};

const SOURCE_LABELS = { purchased: '購入', home_roasted: '自家焙煎' } as const;
const TASTE_KEYS = [
  'taste_flavor',
  'taste_sweetness',
  'taste_acidity',
  'taste_aftertaste',
  'taste_body',
] as const;

type OcrState = {
  confidence?: Partial<Record<BeanFormFieldName, number>>;
  dirtyFields: Record<string, unknown>;
};
type FProps = Parameters<typeof Field>[0] & { name?: BeanFormFieldName; ocr?: OcrState };

// confidence のある項目は OcrField（要確認タグ + 琥珀の点線）、それ以外は通常の Field。
// コンポーネントの外で定義する（レンダー内で定義すると毎回別の型になり、入力欄が再マウントされて入力中の状態が飛ぶ）。
function F({ name, ocr, aside, ...props }: FProps) {
  const c = name ? ocr?.confidence?.[name] : undefined;
  if (c === undefined) return <Field aside={aside} {...props} />;
  const dirty = name ? Boolean(ocr?.dirtyFields[name]) : false;
  return <OcrField confidence={c} dirty={dirty} {...props} />;
}

export function BeanForm({
  defaultValues,
  confidence,
  roasterOptions = [],
  onRoasterSearch,
  onSubmit,
  submitLabel = '次へ：どこで飲んだ？',
  submitting,
  className,
}: BeanFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: 'purchased',
      flavor_notes: [],
      roaster_id: null,
      roaster_name: '',
      ...defaultValues,
    },
  });
  const { register, handleSubmit, setValue, control, formState } = form;
  const { errors, dirtyFields } = formState;

  // 要確認表示に使う（F に渡す）。レンダーごとに新しいオブジェクトだが、F はトップレベルの部品なので再マウントはしない
  const ocr: OcrState = { confidence, dirtyFields: dirtyFields as Record<string, unknown> };

  const flavorNotes = (useWatch({ control, name: 'flavor_notes' }) ?? []) as string[];
  const roasterName = useWatch({ control, name: 'roaster_name' }) ?? '';
  const roasterId = useWatch({ control, name: 'roaster_id' }) ?? null;
  const roastLevelRaw = useWatch({ control, name: 'roast_level' });
  const roastLevel = typeof roastLevelRaw === 'string' && roastLevelRaw !== '' ? roastLevelRaw : null;
  const tasteRaw = useWatch({ control, name: TASTE_KEYS });
  const taste: TasteValues = {
    flavor: numOrNull(tasteRaw[0]),
    sweetness: numOrNull(tasteRaw[1]),
    acidity: numOrNull(tasteRaw[2]),
    aftertaste: numOrNull(tasteRaw[3]),
    body: numOrNull(tasteRaw[4]),
  };

  const [flavorDraft, setFlavorDraft] = useState('');
  const [roasterFocused, setRoasterFocused] = useState(false);

  function addFlavor() {
    const v = flavorDraft.trim();
    if (!v) return;
    if (!flavorNotes.includes(v)) setValue('flavor_notes', [...flavorNotes, v], { shouldDirty: true });
    setFlavorDraft('');
  }
  function removeFlavor(v: string) {
    setValue(
      'flavor_notes',
      flavorNotes.filter((f) => f !== v),
      { shouldDirty: true },
    );
  }
  function pickRoaster(r: RoasterOption) {
    setValue('roaster_id', r.id, { shouldDirty: true });
    setValue('roaster_name', r.name, { shouldDirty: true, shouldValidate: true });
    setRoasterFocused(false);
  }
  function onTaste(next: TasteValues) {
    setValue('taste_flavor', next.flavor, { shouldDirty: true });
    setValue('taste_sweetness', next.sweetness, { shouldDirty: true });
    setValue('taste_acidity', next.acidity, { shouldDirty: true });
    setValue('taste_aftertaste', next.aftertaste, { shouldDirty: true });
    setValue('taste_body', next.body, { shouldDirty: true });
  }

  const submit = handleSubmit((values) => {
    const { roaster_name, roaster_id, ...rest } = values;
    onSubmit({ form: rest, roaster: { id: roaster_id, name: roaster_name } });
  });

  const roasterIsNew = roasterName.trim() !== '' && roasterId === null;
  const showRoasterList = roasterFocused && roasterOptions.length > 0 && roasterId === null;

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-3', className)}>
      <F
        name="name"
        ocr={ocr}
        label="豆名"
        htmlFor={id('name')}
        error={errors.name?.message}
        hint="カードの表記のまま（英字のままで可）"
      >
        <TextInput
          id={id('name')}
          placeholder="Lusitania Lime Geisha"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </F>

      <F
        name="roaster_name"
        ocr={ocr}
        label="ロースター"
        aside={<span className="text-muted-foreground text-[11px]">任意</span>}
        htmlFor={id('roaster')}
        error={errors.roaster_name?.message}
        hint={
          roasterIsNew
            ? '新しいロースターとして登録します'
            : roasterName.trim() === ''
              ? '分からなければ空のままで構いません'
              : undefined
        }
      >
        <div className="relative">
          <TextInput
            id={id('roaster')}
            placeholder="KIELO COFFEE"
            autoComplete="off"
            aria-invalid={!!errors.roaster_name}
            aria-autocomplete="list"
            aria-expanded={showRoasterList}
            {...register('roaster_name', {
              onChange: (e) => {
                setValue('roaster_id', null);
                onRoasterSearch?.(e.target.value);
              },
            })}
            onFocus={() => setRoasterFocused(true)}
            onBlur={() => setTimeout(() => setRoasterFocused(false), 120)}
          />
          {showRoasterList && (
            <ul
              role="listbox"
              aria-label="ロースターの候補"
              className="bg-card border-border absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border py-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)]"
            >
              {roasterOptions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickRoaster(r)}
                    className="hover:bg-secondary flex h-11 w-full items-center px-3.5 text-left text-sm"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </F>

      <div className="grid grid-cols-2 gap-3">
        <F name="country" ocr={ocr} label="生産国" htmlFor={id('country')} error={errors.country?.message}>
          <TextInput id={id('country')} placeholder="Colombia" autoComplete="off" {...register('country')} />
        </F>
        <F
          name="altitude_m"
          ocr={ocr}
          label="標高"
          htmlFor={id('altitude')}
          error={errors.altitude_m?.message}
        >
          <div className="relative">
            <TextInput
              id={id('altitude')}
              type="number"
              inputMode="numeric"
              placeholder="1650"
              className="font-num pr-9"
              aria-invalid={!!errors.altitude_m}
              {...register('altitude_m')}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3.5 -translate-y-1/2 text-xs">
              m
            </span>
          </div>
        </F>
      </div>

      <F name="region" ocr={ocr} label="地域" htmlFor={id('region')} error={errors.region?.message}>
        <TextInput
          id={id('region')}
          placeholder="Caicedonia, Valle del Cauca"
          autoComplete="off"
          {...register('region')}
        />
      </F>

      <div className="grid grid-cols-2 gap-3">
        <F name="variety" ocr={ocr} label="品種" htmlFor={id('variety')} error={errors.variety?.message}>
          <TextInput id={id('variety')} placeholder="Geisha" autoComplete="off" {...register('variety')} />
        </F>
        <F name="process" ocr={ocr} label="精製" htmlFor={id('process')} error={errors.process?.message}>
          <TextInput id={id('process')} placeholder="Washed" autoComplete="off" {...register('process')} />
        </F>
      </div>

      <F
        name="flavor_notes"
        ocr={ocr}
        label="フレーバー"
        htmlFor={id('flavor')}
        error={errors.flavor_notes?.message}
      >
        <div className="flex gap-2">
          <TextInput
            id={id('flavor')}
            placeholder="Lime"
            autoComplete="off"
            value={flavorDraft}
            onChange={(e) => setFlavorDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFlavor();
              }
            }}
          />
          <AppButton
            type="button"
            variant="secondary"
            size="md"
            width="auto"
            onClick={addFlavor}
            aria-label="フレーバーを追加"
          >
            <Plus className="size-5" aria-hidden />
            追加
          </AppButton>
        </div>
        {flavorNotes.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="追加したフレーバー">
            {flavorNotes.map((f) => (
              <li
                key={f}
                className="bg-secondary flex items-center gap-1 rounded-[5px] pl-2 text-[12px] leading-[1.9]"
              >
                {f}
                <button
                  type="button"
                  onClick={() => removeFlavor(f)}
                  aria-label={`${f} を外す`}
                  className="text-muted-foreground hover:text-foreground grid size-6 place-items-center"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </F>

      {confidence?.taste_flavor !== undefined ? (
        <OcrField
          label="味覚チャート"
          confidence={confidence.taste_flavor}
          dirty={Boolean(dirtyFields.taste_flavor)}
        >
          <TasteDots value={taste} onChange={onTaste} />
        </OcrField>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px]">味覚チャート</span>
          <TasteDots value={taste} onChange={onTaste} />
        </div>
      )}

      <F
        name="price_jpy"
        ocr={ocr}
        label="価格"
        htmlFor={id('price')}
        error={errors.price_jpy?.message ?? errors.price_grams?.message}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="text-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
              ¥
            </span>
            <TextInput
              id={id('price')}
              type="number"
              inputMode="numeric"
              placeholder="3800"
              className="font-num pl-8"
              aria-invalid={!!errors.price_jpy}
              {...register('price_jpy')}
            />
          </div>
          <span className="text-muted-foreground text-sm">/</span>
          <div className="relative w-[104px]">
            <TextInput
              id={id('grams')}
              type="number"
              inputMode="numeric"
              placeholder="100"
              aria-label="グラム数"
              className="font-num pr-8"
              aria-invalid={!!errors.price_grams}
              {...register('price_grams')}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3.5 -translate-y-1/2 text-sm">
              g
            </span>
          </div>
        </div>
      </F>

      <div className="grid grid-cols-2 gap-3">
        <F name="source" ocr={ocr} label="入手区分" htmlFor={id('source')} error={errors.source?.message}>
          <Select id={id('source')} {...register('source')}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </F>
      </div>

      <F
        name="roast_level"
        ocr={ocr}
        label="焙煎度"
        htmlFor={id('roast')}
        error={errors.roast_level?.message}
      >
        <div id={id('roast')} role="radiogroup" aria-label="焙煎度" className="flex flex-wrap gap-2">
          {(Object.keys(BEAN_ROAST_LEVEL_LABELS) as BeanRoastLevel[]).map((v) => {
            const active = roastLevel === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  setValue('roast_level', active ? null : v, { shouldDirty: true, shouldValidate: true })
                }
                className={cn(
                  'focus-visible:outline-primary inline-flex h-[34px] items-center rounded-full border px-3.5 text-xs font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
                  active
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-foreground',
                )}
              >
                {BEAN_ROAST_LEVEL_LABELS[v]}
              </button>
            );
          })}
        </div>
      </F>

      <F
        name="description"
        ocr={ocr}
        label="説明文"
        htmlFor={id('description')}
        error={errors.description?.message}
      >
        <Textarea
          id={id('description')}
          placeholder="カードの裏の説明文。無ければ空でかまいません"
          {...register('description')}
        />
      </F>

      <F
        name="reference_url"
        ocr={ocr}
        label="参照 URL"
        htmlFor={id('url')}
        error={errors.reference_url?.message}
        hint="カードの QR コードから自動で入ります"
      >
        <TextInput
          id={id('url')}
          type="url"
          inputMode="url"
          placeholder="https://"
          autoComplete="off"
          {...register('reference_url')}
        />
      </F>

      <div className="mt-2">
        <AppButton type="submit" loading={submitting}>
          {submitLabel}
        </AppButton>
      </div>
    </form>
  );
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export { EMPTY_TASTE };
export type { BeanFormInput };
