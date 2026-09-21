'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { escapeLike } from '@/lib/supabase/errors';
import type { Tables } from '@/types/database';

export type Roaster = Tables<'roasters'>;

export const roasterKeys = {
  all: ['roasters'] as const,
  search: (query: string) => [...roasterKeys.all, 'search', query] as const,
  detail: (id: string) => [...roasterKeys.all, 'detail', id] as const,
};

/** ロースター名の前方一致検索（共有マスタ。全ユーザーの行が対象、F-BEAN-2 の入力補助）。 */
export function useRoasterSearch(query: string, limit = 20) {
  const q = query.trim();
  return useQuery({
    queryKey: roasterKeys.search(q),
    enabled: q.length > 0,
    queryFn: async (): Promise<Roaster[]> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('roasters')
        .select('*')
        .ilike('name', `${escapeLike(q)}%`)
        .order('name')
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useRoaster(id: string | null | undefined) {
  return useQuery({
    queryKey: roasterKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Roaster> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('roasters')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
