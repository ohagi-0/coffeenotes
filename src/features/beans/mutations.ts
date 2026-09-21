'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { beanFormSchema, beanInsertSchema, type BeanFormInput } from '@/lib/schemas/bean';
import { pickProvided } from '@/lib/schemas/common';
import type { Json } from '@/types/database';
import { requireUserId } from '@/features/auth/require-user-id';
import { BEAN_SELECT, beanKeys, type BeanWithRelations } from './queries';

export interface CreateBeanInput extends BeanFormInput {
  /** OCR 経由のときだけ渡す生出力（再抽出・方式比較用） */
  ocr_raw?: Json | null;
}

/** 豆を登録する（F-BEAN-1〜11/15）。`user_id` はセッションから入れる。 */
export function useCreateBean() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ocr_raw, ...form }: CreateBeanInput): Promise<BeanWithRelations> => {
      const values = beanInsertSchema.parse({ ...form, user_id: await requireUserId() });
      const { data, error } = await getSupabaseBrowserClient()
        .from('beans')
        .insert({ ...values, ocr_raw: ocr_raw ?? null })
        .select(BEAN_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: beanKeys.all }),
  });
}

export type UpdateBeanInput = { id: string } & Partial<BeanFormInput>;

/** 豆を部分更新する。渡したキーだけを送る（省略した項目は変えない）。 */
export function useUpdateBean() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateBeanInput): Promise<BeanWithRelations> => {
      const values = pickProvided(beanFormSchema.partial().parse(patch), patch);
      const { data, error } = await getSupabaseBrowserClient()
        .from('beans')
        .update(values)
        .eq('id', id)
        .select(BEAN_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (bean) => {
      queryClient.invalidateQueries({ queryKey: beanKeys.all });
      queryClient.setQueryData(beanKeys.detail(bean.id), bean);
    },
  });
}

/**
 * 豆を削除する。紐づく記録・画像行は ON DELETE CASCADE で消える。
 * Storage 上の画像ファイルの削除は #8 の `deleteBeanImage` を呼ぶ側で行う。
 */
export function useDeleteBean() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await getSupabaseBrowserClient().from('beans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: beanKeys.all });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
