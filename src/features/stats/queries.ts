'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StatsRow } from './aggregate';

export const statsKeys = { all: ['stats'] as const, rows: () => [...statsKeys.all, 'rows'] as const };

/** 分析に要る列だけを全記録分取る（数百件規模を想定。集計はクライアント側） */
export function useStatsRows() {
  return useQuery({
    queryKey: statsKeys.rows(),
    queryFn: async (): Promise<StatsRow[]> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('logs')
        .select(
          'logged_on, rating, shop_id, bean:beans!inner(id, country, process, flavor_notes, taste_flavor, taste_sweetness, taste_acidity, taste_aftertaste, taste_body)',
        )
        .order('logged_on', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
