'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { escapeLike } from '@/lib/supabase/errors';
import type { ShopKind } from '@/lib/schemas/shop';
import type { Tables } from '@/types/database';

export type Shop = Tables<'shops'>;

export interface ShopFilters {
  kind?: ShopKind;
  /** 店名の部分一致（F-SHOP-2 のインクリメンタル検索） */
  search?: string;
}

export const shopKeys = {
  all: ['shops'] as const,
  list: (filters: ShopFilters) => [...shopKeys.all, 'list', filters] as const,
  detail: (id: string) => [...shopKeys.all, 'detail', id] as const,
};

/**
 * 店一覧（S6）。座標の無い店も返す。地図に出すかどうかは UI 側で `lat`/`lng` を見て判断する。
 * 平均星・記録件数は #6 の集計フックで別途取る。
 */
export function useShops(filters: ShopFilters = {}) {
  return useQuery({
    queryKey: shopKeys.list(filters),
    queryFn: async (): Promise<Shop[]> => {
      let q = getSupabaseBrowserClient().from('shops').select('*').order('name');
      if (filters.kind) q = q.eq('kind', filters.kind);
      if (filters.search?.trim()) q = q.ilike('name', `%${escapeLike(filters.search.trim())}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useShop(id: string | null | undefined) {
  return useQuery({
    queryKey: shopKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Shop> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('shops')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
