'use client';

import { useQuery } from '@tanstack/react-query';
import type { QueryData } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { escapeLike } from '@/lib/supabase/errors';
import type { BeanSource } from '@/lib/schemas/bean';

/** 豆の取得で常に付ける関連: ロースター名とカード画像。 */
export const BEAN_SELECT = '*, roaster:roasters(id, name), bean_images(id, side, storage_path)';

function beanQuery() {
  return getSupabaseBrowserClient().from('beans').select(BEAN_SELECT);
}
export type BeanWithRelations = QueryData<ReturnType<typeof beanQuery>>[number];

export interface BeanFilters {
  country?: string;
  process?: string;
  variety?: string;
  roasterId?: string;
  source?: BeanSource;
  /** 豆名の部分一致 */
  search?: string;
}

export const beanKeys = {
  all: ['beans'] as const,
  list: (filters: BeanFilters) => [...beanKeys.all, 'list', filters] as const,
  detail: (id: string) => [...beanKeys.all, 'detail', id] as const,
  filterOptions: () => [...beanKeys.all, 'filter-options'] as const,
};

/** 豆一覧。絞り込みは生産国 / 精製 / 品種 / ロースター（F-LIST-2）。新しい順。 */
export function useBeans(filters: BeanFilters = {}) {
  return useQuery({
    queryKey: beanKeys.list(filters),
    queryFn: async (): Promise<BeanWithRelations[]> => {
      let q = beanQuery().order('created_at', { ascending: false });
      if (filters.country) q = q.eq('country', filters.country);
      if (filters.process) q = q.eq('process', filters.process);
      if (filters.variety) q = q.eq('variety', filters.variety);
      if (filters.roasterId) q = q.eq('roaster_id', filters.roasterId);
      if (filters.source) q = q.eq('source', filters.source);
      if (filters.search?.trim()) q = q.ilike('name', `%${escapeLike(filters.search.trim())}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** 豆 1 件（S4 豆詳細）。 */
export function useBean(id: string | null | undefined) {
  return useQuery({
    queryKey: beanKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<BeanWithRelations> => {
      const { data, error } = await beanQuery().eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export interface BeanFilterOptions {
  countries: string[];
  processes: string[];
  varieties: string[];
}

function distinctSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'ja'));
}

/** 絞り込みチップの候補（自分の豆に登場する生産国・精製・品種）。 */
export function useBeanFilterOptions() {
  return useQuery({
    queryKey: beanKeys.filterOptions(),
    queryFn: async (): Promise<BeanFilterOptions> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('beans')
        .select('country, process, variety');
      if (error) throw error;
      return {
        countries: distinctSorted(data.map((r) => r.country)),
        processes: distinctSorted(data.map((r) => r.process)),
        varieties: distinctSorted(data.map((r) => r.variety)),
      };
    },
  });
}
