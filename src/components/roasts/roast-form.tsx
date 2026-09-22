'use client';

import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AppButton } from '@/components/app-button';
import { Field, Select, TextInput, Textarea } from '@/components/form/field';
import {
  ROAST_LEVEL_LABELS,
  formatDuration,
  parseDuration,
  roastFormSchema,
  weightLossPercent,
  type RoastFormInput,
  type RoastFormValues,
} from '@/lib/schemas/roast';
import { cn } from '@/lib/utils';

// 焙煎バッチのフォーム（F-ROAST-1〜7）。焙煎日だけで登録できる。減率は自動計算、時間は「分:秒」で入力。

export type GreenShopOption = { id: string; name: string };

export type RoastFormProps = {
  defaultValues?: Partial<RoastFormInput>;
  /** 生豆販売店（shops.kind = green_bean_shop）。無ければ欄を出さない */
  greenShops?: GreenShopOption[];
  onSubmit: (values: RoastFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  className?: string;
};

export function RoastForm({
  defaultValues,
  greenShops = [],
  onSubmit,
  onCancel,
  submitting,
  submitLabel = 'バッチを登録する',
  className,
}: RoastFormProps) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const form = useForm<RoastFormInput, unknown, RoastFormValues>({
    resolver: zodResolver(roastFormSchema),
    defaultValues: { roasted_on: format(new Date(), 'yyyy-MM-dd'), roast_level: 'medium', ...defaultValues },
  });
  const { register, handleSubmit, setValue, control, formState } = form;
  const { errors } = formState;
  const green = useWatch({ control, name: 'green_grams' });
  const roasted = useWatch({ control, name: 'roasted_grams' });
  const durationSec = useWatch({ control, name: 'duration_sec' });
  const [durationText, setDurationText] = useState(() =>
    typeof defaultValues?.duration_sec === 'number' ? (formatDuration(defaultValues.duration_sec) ?? '') : '',
  );
  const loss = weightLossPercent(num(green), num(roasted));

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn('border-border bg-card flex flex-col gap-3 rounded-[14px] border p-3.5', className)}
      aria-label="焙煎バッチ"
    >
      <Field label="焙煎日" htmlFor={id('date')} error={errors.roasted_on?.message}>
        <TextInput id={id('date')} type="date" className="font-num" {...register('roasted_on')} />
      </Field>
      <Field label="方法・器具" htmlFor={id('method')} error={errors.method?.message}>
        <TextInput
          id={id('method')}
          placeholder="手網 / 手回し / 電気焙煎機（機種名）"
          autoComplete="off"
          {...register('method')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="生豆" htmlFor={id('green')} error={errors.green_grams?.message}>
          <div className="relative">
            <TextInput
              id={id('green')}
              type="number"
              inputMode="numeric"
              placeholder="200"
              className="font-num pr-8"
              {...register('green_grams')}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3.5 -translate-y-1/2 text-xs">
              g
            </span>
          </div>
        </Field>
        <Field
          label="焙煎後"
          htmlFor={id('roasted')}
          error={errors.roasted_grams?.message}
          hint={loss !== null ? `減率 ${loss}%` : undefined}
        >
          <div className="relative">
            <TextInput
              id={id('roasted')}
              type="number"
              inputMode="numeric"
              placeholder="170"
              className="font-num pr-8"
              {...register('roasted_grams')}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3.5 -translate-y-1/2 text-xs">
              g
            </span>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="焙煎時間"
          htmlFor={id('duration')}
          error={errors.duration_sec?.message}
          hint={typeof durationSec === 'number' ? `${durationSec} 秒` : '分:秒（例 12:30）'}
        >
          <TextInput
            id={id('duration')}
            inputMode="numeric"
            placeholder="12:30"
            className="font-num"
            value={durationText}
            onChange={(e) => {
              setDurationText(e.target.value);
              setValue('duration_sec', parseDuration(e.target.value), {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
        </Field>
        <Field label="焙煎度" htmlFor={id('level')} error={errors.roast_level?.message}>
          <Select id={id('level')} {...register('roast_level')}>
            <option value="">未設定</option>
            {Object.entries(ROAST_LEVEL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {greenShops.length > 0 && (
        <Field label="生豆の入手元" htmlFor={id('green-shop')} error={errors.green_shop_id?.message}>
          <Select id={id('green-shop')} {...register('green_shop_id')}>
            <option value="">未設定</option>
            {greenShops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="焙煎メモ" htmlFor={id('memo')} error={errors.memo?.message}>
        <Textarea id={id('memo')} placeholder="火力の推移、1 ハゼ・2 ハゼ、狙い" {...register('memo')} />
      </Field>
      <div className={cn('mt-1 grid gap-2', onCancel ? 'grid-cols-2' : 'grid-cols-1')}>
        {onCancel && (
          <AppButton type="button" variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
            やめる
          </AppButton>
        )}
        <AppButton type="submit" size="md" loading={submitting}>
          {submitLabel}
        </AppButton>
      </div>
    </form>
  );
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
