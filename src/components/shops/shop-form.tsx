'use client';

import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/app-button';
import { Field, Select, TextInput } from '@/components/form/field';
import {
  SHOP_KIND_LABELS,
  shopFormSchema,
  type ShopFormInput,
  type ShopFormValues,
} from '@/lib/schemas/shop';
import { cn } from '@/lib/utils';

// 店の手入力フォーム（S6、F-SHOP-1/6）。店名だけで登録できる。座標は空でよい（地図には出ない）。
// 「住所から座標を補完」「地図で指定」は Phase 3（F-SHOP-4/7）で足す。

export type ShopFormProps = {
  defaultValues?: Partial<ShopFormInput>;
  onSubmit: (values: ShopFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
  className?: string;
};

export function ShopForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = '登録する',
  className,
}: ShopFormProps) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const form = useForm<ShopFormInput, unknown, ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: { kind: 'cafe', ...defaultValues },
  });
  const { register, handleSubmit, formState } = form;
  const { errors } = formState;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn('flex flex-col gap-3', className)}>
      <Field label="店名" htmlFor={id('name')} error={errors.name?.message}>
        <TextInput
          id={id('name')}
          placeholder="KIELO COFFEE 蔵前"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      <Field label="種別" htmlFor={id('kind')} error={errors.kind?.message}>
        <Select id={id('kind')} {...register('kind')}>
          {Object.entries(SHOP_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="住所"
        htmlFor={id('address')}
        error={errors.address?.message}
        hint="任意。地図に出すには座標が要ります（Phase 3 で住所から補完できるようになります）"
      >
        <TextInput
          id={id('address')}
          placeholder="東京都台東区蔵前 3-1-2"
          autoComplete="off"
          {...register('address')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="緯度" htmlFor={id('lat')} error={errors.lat?.message}>
          <TextInput
            id={id('lat')}
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="35.7037"
            className="font-num"
            aria-invalid={!!errors.lat}
            {...register('lat')}
          />
        </Field>
        <Field label="経度" htmlFor={id('lng')} error={errors.lng?.message}>
          <TextInput
            id={id('lng')}
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="139.7907"
            className="font-num"
            aria-invalid={!!errors.lng}
            {...register('lng')}
          />
        </Field>
      </div>
      <div className="mt-2">
        <AppButton type="submit" loading={submitting}>
          {submitLabel}
        </AppButton>
      </div>
    </form>
  );
}
