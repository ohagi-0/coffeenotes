'use client';

import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/app-button';
import { Field, Select, TextInput } from '@/components/form/field';
import { ShopCandidateTools, type ShopCandidate } from '@/components/shops/shop-candidate-tools';
import {
  SHOP_KIND_LABELS,
  shopFormSchema,
  type ShopFormInput,
  type ShopFormValues,
} from '@/lib/schemas/shop';
import { cn } from '@/lib/utils';

// 店の手入力フォーム（S6、F-SHOP-1/6）。店名だけで登録できる。座標は空でよい（地図には出ない）。
// 候補（現在地 / 店名・住所で検索）と地図の長押しで座標を入れられる（F-SHOP-3/4/7）。

export type ShopFormProps = {
  defaultValues?: Partial<ShopFormInput>;
  onSubmit: (values: ShopFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
  className?: string;
  /** 候補検索。渡さなければチップを出さない */
  candidates?: {
    nearby: (pos: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
    geocode: (query: string, near?: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
  };
};

export function ShopForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = '登録する',
  className,
  candidates,
}: ShopFormProps) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const form = useForm<ShopFormInput, unknown, ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: { kind: 'cafe', ...defaultValues },
  });
  const { register, handleSubmit, formState, setValue, control } = form;
  const { errors } = formState;
  const name = useWatch({ control, name: 'name' }) ?? '';
  const address = useWatch({ control, name: 'address' }) ?? '';
  const latRaw = useWatch({ control, name: 'lat' });
  const lngRaw = useWatch({ control, name: 'lng' });
  const lat = latRaw === '' || latRaw == null ? null : Number(latRaw);
  const lng = lngRaw === '' || lngRaw == null ? null : Number(lngRaw);
  const position =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  function pickCandidate(c: ShopCandidate) {
    if (!String(name).trim()) setValue('name', c.name, { shouldDirty: true, shouldValidate: true });
    if (c.address && !String(address).trim()) setValue('address', c.address, { shouldDirty: true });
    setValue('lat', c.lat, { shouldDirty: true, shouldValidate: true });
    setValue('lng', c.lng, { shouldDirty: true, shouldValidate: true });
    setValue('external_place_id', c.externalPlaceId, { shouldDirty: true });
  }
  function pickPosition(pos: { lat: number; lng: number }) {
    setValue('lat', pos.lat, { shouldDirty: true, shouldValidate: true });
    setValue('lng', pos.lng, { shouldDirty: true, shouldValidate: true });
  }

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
        hint="任意。「店名で検索」で住所と座標を補完できます"
      >
        <TextInput
          id={id('address')}
          placeholder="東京都台東区蔵前 3-1-2"
          autoComplete="off"
          {...register('address')}
        />
      </Field>
      <ShopCandidateTools
        query={[String(name), String(address)].filter((s) => s.trim()).join(' ')}
        nearby={candidates?.nearby}
        geocode={candidates?.geocode}
        onPick={pickCandidate}
        onPickPosition={pickPosition}
        position={position}
      />
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
