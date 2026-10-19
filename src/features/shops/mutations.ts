'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { pickProvided } from '@/lib/schemas/common';
import { shopFormSchema, type ShopFormInput } from '@/lib/schemas/shop';
import { requireUserId } from '@/features/auth/require-user-id';
import { findOrCreateShop } from './find-or-create-shop';
import { shopKeys } from './queries';
import type { Shop } from './queries';

/**
 * 店を登録する（F-SHOP-1/6）。座標が無くても保存できる。
 * 地図の候補から選んだ店（OSM の ID あり）は、同じ店がすでにあればそれを返す（二重登録しない）。
 */
export function useCreateShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShopFormInput): Promise<{ id: string; created: boolean }> =>
      findOrCreateShop(getSupabaseBrowserClient(), await requireUserId(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shopKeys.all }),
  });
}

export type UpdateShopInput = { id: string } & Partial<ShopFormInput>;

/**
 * 店を部分更新する。座標を変えるときは `lat` と `lng` を必ず一緒に渡す
 * （片方だけだと DB の CHECK 制約で失敗する）。
 */
export function useUpdateShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateShopInput): Promise<Shop> => {
      const values = pickProvided(shopFormSchema.partial().parse(patch), patch);
      const { data, error } = await getSupabaseBrowserClient()
        .from('shops')
        .update(values)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (shop) => {
      queryClient.invalidateQueries({ queryKey: shopKeys.all });
      queryClient.setQueryData(shopKeys.detail(shop.id), shop);
    },
  });
}

/** 店を削除する。紐づく記録の `shop_id` は ON DELETE SET NULL で外れる（記録は残る）。 */
export function useDeleteShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await getSupabaseBrowserClient().from('shops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopKeys.all });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
