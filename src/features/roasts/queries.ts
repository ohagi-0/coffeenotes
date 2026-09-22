'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type Roast = Tables<'roasts'>;

export const roastKeys = {
  all: ['roasts'] as const,
  byBean: (beanId: string) => [...roastKeys.all, 'by-bean', beanId] as const,
  detail: (id: string) => [...roastKeys.all, 'detail', id] as const,
};

/** 豆の焙煎バッチ（新しい順）。購入豆なら空 */
export function useRoastsByBean(beanId: string | null | undefined) {
  return useQuery({
    queryKey: roastKeys.byBean(beanId ?? ''),
    enabled: !!beanId,
    queryFn: async (): Promise<Roast[]> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('roasts')
        .select('*')
        .eq('bean_id', beanId!)
        .order('roasted_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
