'use client';

import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { EMPTY_TASTE, TasteDots, type TasteValues } from '@/components/beans/taste-dots';
import { Field, Select, TextInput, Textarea } from '@/components/form/field';
import { beanFormSchema, type BeanFormInput } from '@/lib/schemas/bean';
import type { DraftBeanForm, DraftRoaster } from '@/features/logs/new-log-draft';
import { cn } from '@/lib/utils';

// 豆フォーム（S3 ②、F-BEAN-1〜11/15）。beanFormSchema を resolver に使う。
// ロースターは共有マスタから選ぶか、無ければ名前だけ入れて「新しいロースター」として扱う（保存時に登録）。
// OCR 結果（Phase 2）は defaultValues に流し込むだけ。確定はユーザー操作。

export type RoasterOption = { id: string; name: string };

const formSchema = beanFormSchema.omit({ roaster_id: true }).extend({
  roaster_name: z.string().trim().min(1, 'ロースターを入力してください').max(120),
  roaster_id: z.string().nullable().default(null),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export type BeanFormSubmit = { form: DraftBeanForm; roaster: DraftRoaster };

export type BeanFormProps = {
  defaultValues?: Partial<FormInput>;
  /** ロースター候補（`onRoasterSearch` の結果） */
  roasterOptions?: RoasterOption[];
  onRoasterSearch?: (query: string) => void;
  onSubmit: (values: BeanFormSubmit) => void;
  submitLabel?: string;
  submitting?: boolean;
  className?: string;
};

const SOURCE_LABELS = { purchased: '購入', home_roasted: '自家焙煎' } as const;
const ROAST_LABELS = { light: '浅煎り', medium: '中煎り', dark: '深煎り' } as const;
const TASTE_KEYS = [
  'taste_flavor',
  'taste_sweetness',
  'taste_acidity',
  'taste_aftertaste',
  'taste_body',
] as const;

export function BeanForm({
  defaultValues,
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
  const { errors } = formState;

  const flavorNotes = (useWatch({ control, name: 'flavor_notes' }) ?? []) as string[];
  const roasterName = useWatch({ control, name: 'roaster_name' }) ?? '';
  const roasterId = useWatch({ control, name: 'roaster_id' }) ?? null;
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
      <Field
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
      </Field>

      <Field
        label="ロースター"
        htmlFor={id('roaster')}
        error={errors.roaster_name?.message}
        hint={roasterIsNew ? '新しいロースターとして登録します' : undefined}
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
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="生産国" htmlFor={id('country')} error={errors.country?.message}>
          <TextInput id={id('country')} placeholder="Colombia" autoComplete="off" {...register('country')} />
        </Field>
        <Field label="標高" htmlFor={id('altitude')} error={errors.altitude_m?.message}>
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
        </Field>
      </div>

      <Field label="地域" htmlFor={id('region')} error={errors.region?.message}>
        <TextInput
          id={id('region')}
          placeholder="Caicedonia, Valle del Cauca"
          autoComplete="off"
          {...register('region')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="品種" htmlFor={id('variety')} error={errors.variety?.message}>
          <TextInput id={id('variety')} placeholder="Geisha" autoComplete="off" {...register('variety')} />
        </Field>
        <Field label="精製" htmlFor={id('process')} error={errors.process?.message}>
          <TextInput id={id('process')} placeholder="Washed" autoComplete="off" {...register('process')} />
        </Field>
      </div>

      <Field label="フレーバー" htmlFor={id('flavor')} error={errors.flavor_notes?.message}>
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
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">味覚チャート</span>
        <TasteDots value={taste} onChange={onTaste} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="価格"
          htmlFor={id('price')}
          error={errors.price_jpy?.message ?? errors.price_grams?.message}
        >
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-xs">
                ¥
              </span>
              <TextInput
                id={id('price')}
                type="number"
                inputMode="numeric"
                placeholder="3800"
                className="font-num pl-7"
                aria-invalid={!!errors.price_jpy}
                {...register('price_jpy')}
              />
            </div>
            <span className="text-muted-foreground text-xs">/</span>
            <div className="relative w-[76px]">
              <TextInput
                id={id('grams')}
                type="number"
                inputMode="numeric"
                placeholder="100"
                aria-label="グラム数"
                className="font-num pr-6"
                aria-invalid={!!errors.price_grams}
                {...register('price_grams')}
              />
              <span className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                g
              </span>
            </div>
          </div>
        </Field>
        <Field label="入手区分" htmlFor={id('source')} error={errors.source?.message}>
          <Select id={id('source')} {...register('source')}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="焙煎度" htmlFor={id('roast')} error={errors.roast_level?.message}>
        <Select id={id('roast')} {...register('roast_level')}>
          <option value="">未設定</option>
          {Object.entries(ROAST_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="説明文" htmlFor={id('description')} error={errors.description?.message}>
        <Textarea
          id={id('description')}
          placeholder="カードの裏の説明文。無ければ空でかまいません"
          {...register('description')}
        />
      </Field>

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
